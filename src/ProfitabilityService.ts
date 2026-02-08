import axios from 'axios';

export class ProfitabilityService {
  private readonly KWH_PRICE_BRL = 1.10;
  private readonly MIN_PAYOUT = 0.1;

  // Cache de estatísticas da rede
  private networkDifficulty: number = 0;
  private blockReward: number = 0;
  private lastNetworkUpdate: number = 0;
  private readonly RECOVERY_FACTOR = 0.000000001; // Fallback se a API falhar

  private accumulatedCostBRL: number = 0;
  private accumulatedRevenueBRL: number = 0;
  private accumulatedXMR: number = 0;

  private currentXMRms: number = 0;
  private smoothedRate: number = 0;

  constructor() {
    this.fetchNetworkStats();
  }

  /**
   * Busca estatísticas reais da rede Monero
   */
  public async fetchNetworkStats(): Promise<void> {
    try {
      const resp = await axios.get('https://api.nanopool.org/v1/xmr/network/stats');
      if (resp.data && resp.data.status) {
        this.networkDifficulty = resp.data.data.difficulty;
        this.blockReward = resp.data.data.block_reward;
        this.lastNetworkUpdate = Date.now();
      }
    } catch (e) {
      console.error("⚠️ Falha ao buscar estatísticas da rede. Usando estimativa fixa.");
    }
  }

  /**
   * Atualiza as métricas financeiras baseadas na carga atual do sistema
   */
  public update(cpuLoad: number, gpuLoad: number, totalHashrate: number, xmrPriceBRL: number, deltaMs: number): void {
    const hours = deltaMs / (1000 * 3600);
    const seconds = deltaMs / 1000;

    const cpuWatts = 15 + (cpuLoad / 100) * 45;
    const gpuWatts = 10 + (gpuLoad / 100) * 60;
    const totalWatts = cpuWatts + gpuWatts;

    const cost = (totalWatts / 1000) * hours * this.KWH_PRICE_BRL;
    this.accumulatedCostBRL += cost;

    let xmrGained = 0;
    if (this.networkDifficulty > 0 && this.blockReward > 0) {
      // Fórmula real: Ganhos = (Hashrate / Dificuldade) * BlockReward * Segundos
      xmrGained = (totalHashrate / this.networkDifficulty) * this.blockReward * seconds;
    } else {
      xmrGained = totalHashrate * this.RECOVERY_FACTOR * hours * 1000;
    }

    this.accumulatedXMR += xmrGained;

    this.currentXMRms = xmrGained / deltaMs;
    this.smoothedRate = (this.smoothedRate * 0.9) + (this.currentXMRms * 0.1);

    const revenue = xmrGained * xmrPriceBRL;
    this.accumulatedRevenueBRL += revenue;

    // Atualiza estatísticas da rede a cada 10 minutos se necessário
    if (Date.now() - this.lastNetworkUpdate > 600000) {
      this.fetchNetworkStats();
    }
  }

  private calculateETA(targetXMR: number, currentXMR: number): string {
    if (this.smoothedRate <= 0) return "calculando...";

    const remaining = targetXMR - currentXMR;
    if (remaining <= 0) return "disponível";

    const msRemaining = remaining / this.smoothedRate;
    const totalSeconds = Math.floor(msRemaining / 1000);

    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (days > 365) return ">1 ano";
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  public getFinanceReport(lifetimeXMR: number = 0) {
    const progress = (lifetimeXMR / this.MIN_PAYOUT) * 100;
    return {
      cost: this.accumulatedCostBRL,
      revenue: this.accumulatedRevenueBRL,
      profit: this.accumulatedRevenueBRL - this.accumulatedCostBRL,
      xmr: this.accumulatedXMR,
      minPayout: this.MIN_PAYOUT,
      payoutProgress: Math.min(100, progress),
      etaPayout: this.calculateETA(this.MIN_PAYOUT, lifetimeXMR),
      eta1XMR: this.calculateETA(1.0, lifetimeXMR)
    };
  }
}
