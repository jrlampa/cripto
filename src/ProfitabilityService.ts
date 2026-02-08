export class ProfitabilityService {
  private readonly KWH_PRICE_BRL = 1.10;
  private readonly REWARD_FACTOR = 0.000000001; // Fator simulado de ganhos p/ hashrate
  private readonly MIN_PAYOUT = 0.1; // Mínimo para payout na Nanopool (configurável)

  private startTime: number = Date.now();
  private accumulatedCostBRL: number = 0;
  private accumulatedRevenueBRL: number = 0;
  private accumulatedXMR: number = 0;

  private currentXMRms: number = 0; // Taxa instantânea (XMR/ms)
  private smoothedRate: number = 0; // Média móvel da taxa

  constructor() { }

  /**
   * Atualiza as métricas financeiras baseadas na carga atual do sistema
   */
  public update(cpuLoad: number, gpuLoad: number, totalHashrate: number, xmrPriceBRL: number, deltaMs: number): void {
    const hours = deltaMs / (1000 * 3600);

    const cpuWatts = 15 + (cpuLoad / 100) * 45;
    const gpuWatts = 10 + (gpuLoad / 100) * 60;
    const totalWatts = cpuWatts + gpuWatts;

    const cost = (totalWatts / 1000) * hours * this.KWH_PRICE_BRL;
    this.accumulatedCostBRL += cost;

    const xmrGained = totalHashrate * this.REWARD_FACTOR * hours * 1000;
    this.accumulatedXMR += xmrGained;

    // Taxa de mineração (XMR/ms)
    this.currentXMRms = xmrGained / deltaMs;
    // Suavização (EMA) para evitar oscilações bruscas no ETA
    this.smoothedRate = (this.smoothedRate * 0.9) + (this.currentXMRms * 0.1);

    const revenue = xmrGained * xmrPriceBRL;
    this.accumulatedRevenueBRL += revenue;
  }

  private calculateETA(targetXMR: number, currentXMR: number): string {
    if (this.smoothedRate <= 0) return "---";

    const remaining = targetXMR - currentXMR;
    if (remaining <= 0) return "0m";

    const msRemaining = remaining / this.smoothedRate;
    const totalSeconds = Math.floor(msRemaining / 1000);

    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (days > 99) return ">99d";
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
