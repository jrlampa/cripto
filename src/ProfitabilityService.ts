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

  constructor() {
    // Inicia com XMR por padrão, mas bootstrap chamará fetch conforme necessário
    this.fetchNetworkStats('XMR');
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
        this.updateStatsMap(coin, 20000000000, 4.41, 2.0); // ZEPH approx min
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
  public update(cpuLoad: number, gpuLoad: number, totalHashrate: number, coinPriceBRL: number, deltaMs: number, kwhPrice: number = 1.10, coin: string = 'XMR', poolDifficulty?: number): void {
    this.currentPriceBRL = coinPriceBRL;
    this.currentCoin = coin;

    const hours = deltaMs / (1000 * 3600);
    const cpuWatts = 15 + (cpuLoad / 100) * 45;
    const gpuWatts = 10 + (gpuLoad / 100) * 60;
    const totalWatts = cpuWatts + gpuWatts;

    const cost = (totalWatts / 1000) * hours * kwhPrice;
    this.accumulatedCostBRL += cost;

    // Cálculo teórico de ganho por segundo (PPS Teórico)
    // Rate = (Hashrate / Dificuldade) * Recompensa do Bloco
    let stats = this.statsMap.get(coin);

    // Fallback robustness: Create stats entry if missing, using pool difficulty if available
    if (!stats || stats.difficulty === 0) {
      if (poolDifficulty && poolDifficulty > 0) {
        // Default rewards fallback
        let defaultReward = 0.6; // XMR approx
        if (coin === 'BTC') defaultReward = 3.125 + 0.1; // Block subsidy + fees (approx)
        else if (coin === 'RVN') defaultReward = 2500;
        else if (coin === 'ERGO') defaultReward = 27; // Approx
        else if (coin === 'CFX') defaultReward = 2; // Approx

        // Create or update stats with real pool difficulty
        this.updateStatsMap(coin, poolDifficulty, defaultReward, 0.1); // minPayout default 0.1
        stats = this.statsMap.get(coin);
        console.log(`⚠️ Usando dificuldade do Pool para estimativa (${poolDifficulty})`);
      }
    }

    if (stats && stats.difficulty > 0) {
      // Use explicit pool difficulty if API is way off (e.g., testnet/mock) or just prefer real-time share diff
      const calculationDiff = (poolDifficulty && poolDifficulty > 0) ? poolDifficulty : stats.difficulty;

      const theoreticalRatePerSec = (totalHashrate / calculationDiff) * stats.reward;

      // Suavização (Exponential Moving Average) para evitar ETA pulando muito
      // Faster convergence if zero
      if (this.smoothedRate === 0) this.smoothedRate = theoreticalRatePerSec;
      else this.smoothedRate = (this.smoothedRate * 0.95) + (theoreticalRatePerSec * 0.05);

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

  private calculateETA(target: number, current: number): string {
    if (this.smoothedRate <= 0) return "calculando...";

    const remaining = target - current;
    if (remaining <= 0) return "disponível";

    // Rate está em moedas por SEGUNDO. msRemaining = (moedas_faltantes / moedas_por_segundo) * 1000
    const secondsRemaining = remaining / this.smoothedRate;
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
      etaPayout: this.calculateETA(minPayout, lifetimeCoin),
      eta1Unit: this.calculateETA(1.0, lifetimeCoin),
      minPayout: minPayout
    };
  }
}
