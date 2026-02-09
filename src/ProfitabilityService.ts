import axios from 'axios';

export class ProfitabilityService {
  private readonly MIN_PAYOUT = 1.0;

  // Cache de estatísticas da rede (agora por moeda)
  private statsMap: Map<string, { difficulty: number, reward: number, lastUpdate: number, minPayout: number }> = new Map();
  private currentAlgorithm: string = 'RandomX';
  private currentCoin: string = 'XMR';

  private accumulatedCostBRL: number = 0;
  private accumulatedCoin: number = 0; // Quantidade da moeda atual acumulada

  private currentPriceBRL: number = 0;
  private smoothedRate: number = 0;
  private smoothedRatePool: number = 0;

  constructor() {
    // Inicialização passiva. fetchNetworkStats será chamado sob demanda ou pelo bootstrap se necessário.
  }

  /**
   * Busca estatísticas reais da rede baseadas na moeda selecionada
   */
  public async fetchNetworkStats(coin: string): Promise<void> {
    this.currentCoin = coin;
    try {
      if (coin === 'XMR' || coin === 'ERGO' || coin === 'CFX' || coin === 'RVN') {
        const symbol = coin.toLowerCase();
        const resp = await axios.get(`https://api.nanopool.org/v1/${symbol}/network/stats`);
        if (resp.data && resp.data.status) {
          const minPayout = coin === 'XMR' ? 0.1 : (coin === 'ERGO' ? 1.0 : (coin === 'CFX' ? 1.0 : 50.0));
          this.updateStatsMap(coin, resp.data.data.difficulty, resp.data.data.block_reward, minPayout);
        }
      } else if (coin === 'BTC') {
        const diffResp = await axios.get('https://blockchain.info/q/getdifficulty');
        const rewardResp = await axios.get('https://blockchain.info/q/bcperblock');
        if (diffResp.data && rewardResp.data) {
          this.updateStatsMap(coin, diffResp.data, rewardResp.data / 100000000, 0.005); // Binance Pool approx min
        }
      } else if (coin === 'ZEPH') {
        const resp = await axios.get(`https://zephyr.herominers.com/api/stats`);
        if (resp.data && resp.data.network) {
          this.updateStatsMap(coin, resp.data.network.difficulty, resp.data.network.reward / 1000000000000, 2.0);
        } else {
          this.updateStatsMap(coin, 20000000000, 4.41, 2.0); // ZEPH approx min
        }
      }
    } catch (e) {
      console.error(`⚠️ Falha ao buscar estatísticas para ${coin}. Usando fallback.`);
      if (!this.statsMap.has(coin)) {
        this.updateStatsMap(coin, 1000000, 0.6, 0.1);
      }
    }
  }

  private updateStatsMap(coin: string, diff: number, reward: number, minPayout: number) {
    this.statsMap.set(coin, {
      difficulty: diff,
      reward: reward,
      lastUpdate: Date.now(),
      minPayout: minPayout
    });
  }

  /**
   * Atualiza as métricas financeiras
   */
  public update(cpuLoad: number, gpuLoad: number, totalHashrate: number, coinPriceBRL: number, deltaMs: number, kwhPrice: number = 1.10, coin: string = 'XMR', poolDifficulty?: number, poolHashrate: number = 0): void {
    this.currentPriceBRL = coinPriceBRL;
    this.currentCoin = coin;

    const hours = deltaMs / (1000 * 3600);
    const cpuWatts = 15 + (cpuLoad / 100) * 45;
    const gpuWatts = 10 + (gpuLoad / 100) * 60;
    const totalWatts = cpuWatts + gpuWatts;

    const cost = (totalWatts / 1000) * hours * kwhPrice;
    this.accumulatedCostBRL += cost;

    // Cálculo teórico de ganho por segundo (PPS Teórico)
    // Rate = (Hashrate / Dificuldade_da_Rede) * Recompensa_do_Bloco
    let stats = this.statsMap.get(coin);

    // Fallback robustness: Create stats entry if missing, using REALISTIC Network Difficulty fallbacks
    // Share Difficulty (poolDifficulty) != Network Difficulty.
    if (!stats || stats.difficulty === 0) {
      let hardcodedDiff = 300000000000; // Monero ~300G
      let defaultReward = 0.6;

      if (coin === 'BTC') { hardcodedDiff = 85000000000000; defaultReward = 3.125; }
      else if (coin === 'ZEPH') { hardcodedDiff = 20000000000; defaultReward = 4.41; }
      else if (coin === 'RVN') { hardcodedDiff = 100000; defaultReward = 2500; }
      else if (coin === 'ERGO') { hardcodedDiff = 2000000000000; defaultReward = 27; }

      this.updateStatsMap(coin, hardcodedDiff, defaultReward, coin === 'XMR' ? 0.1 : 1.0);
      stats = this.statsMap.get(coin);
    }

    if (stats && stats.difficulty > 0) {
      // 1. Taxa baseada no Hashrate Local (Capacidade de Mineração)
      const theoreticalRateLocal = (totalHashrate / stats.difficulty) * stats.reward;
      if (this.smoothedRate === 0) this.smoothedRate = theoreticalRateLocal;
      else this.smoothedRate = (this.smoothedRate * 0.95) + (theoreticalRateLocal * 0.05);

      // 2. Taxa baseada no Hashrate Reportado pela Pool (Performance na Pool)
      const theoreticalRatePool = (poolHashrate / stats.difficulty) * stats.reward;
      if (this.smoothedRatePool === 0) this.smoothedRatePool = theoreticalRatePool;
      else this.smoothedRatePool = (this.smoothedRatePool * 0.95) + (theoreticalRatePool * 0.05);

      // Atualiza estatísticas da rede a cada 10 minutos
      if (Date.now() - stats.lastUpdate > 600000) {
        this.fetchNetworkStats(coin);
      }
    }
  }

  /**
   * Adiciona recompensa baseada em um Share válido
   */
  public addShare(shareDifficulty: number): void {
    const stats = this.statsMap.get(this.currentCoin);
    if (!stats || stats.difficulty === 0) return;

    // Fórmula: (Dificuldade do Share / Dificuldade da Rede) * Recompensa do Bloco
    const shareValue = (shareDifficulty / stats.difficulty) * stats.reward;

    // Deduz taxa do pool (1%)
    const netShareValue = shareValue * 0.99;

    this.accumulatedCoin += netShareValue;
  }

  private calculateETA(target: number, current: number, rate: number): string {
    if (rate <= 0) return "calculando...";

    const remaining = target - current;
    if (remaining <= 0) return "disponível";

    // Rate está em moedas por SEGUNDO. msRemaining = (moedas_faltantes / moedas_por_segundo) * 1000
    const secondsRemaining = remaining / rate;
    const totalSeconds = Math.floor(secondsRemaining);

    if (totalSeconds < 0) return "calculando...";

    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (days > 365) return ">1 ano";
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  public getFinanceReport(lifetimeCoin: number = 0) {
    const revenue = this.accumulatedCoin * this.currentPriceBRL;
    const stats = this.statsMap.get(this.currentCoin);
    const minPayout = stats?.minPayout || this.MIN_PAYOUT;

    return {
      cost: this.accumulatedCostBRL,
      revenue: revenue,
      profit: revenue - this.accumulatedCostBRL,
      xmr: this.accumulatedCoin, // Mantemos o nome da key por compatibilidade com a interface do TUI por enquanto
      coinAmount: this.accumulatedCoin,
      // ETAs baseados no hashrate local (Realista/Rede)
      etaPayout: this.calculateETA(minPayout, lifetimeCoin, this.smoothedRate),
      eta1Unit: this.calculateETA(1.0, lifetimeCoin, this.smoothedRate),
      // ETAs baseados no hashrate da pool (Comparação)
      etaPayoutPool: this.calculateETA(minPayout, lifetimeCoin, this.smoothedRatePool),
      eta1UnitPool: this.calculateETA(1.0, lifetimeCoin, this.smoothedRatePool),
      minPayout: minPayout
    };
  }
}
