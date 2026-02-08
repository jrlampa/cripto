export class ProfitabilityService {
  private readonly KWH_PRICE_BRL = 1.10;
  private readonly REWARD_FACTOR = 0.000000001; // Fator simulado de ganhos p/ hashrate
  private readonly MIN_PAYOUT = 0.1; // Mínimo para payout na Nanopool (configurável)

  private startTime: number = Date.now();
  private accumulatedCostBRL: number = 0;
  private accumulatedRevenueBRL: number = 0;
  private accumulatedXMR: number = 0;

  constructor() { }

  /**
   * Atualiza as métricas financeiras baseadas na carga atual do sistema
   */
  public update(cpuLoad: number, gpuLoad: number, totalHashrate: number, xmrPriceBRL: number, deltaMs: number): void {
    const hours = deltaMs / (1000 * 3600);

    // Estimativa de consumo (Watts)
    const cpuWatts = 15 + (cpuLoad / 100) * 45;
    const gpuWatts = 10 + (gpuLoad / 100) * 60;
    const totalWatts = cpuWatts + gpuWatts;

    // Cálculo de Custo (R$)
    const cost = (totalWatts / 1000) * hours * this.KWH_PRICE_BRL;
    this.accumulatedCostBRL += cost;

    // Estimativa de Ganho em XMR (Simulado)
    const xmrGained = totalHashrate * this.REWARD_FACTOR * hours * 1000;
    this.accumulatedXMR += xmrGained;

    // Conversão para BRL
    const revenue = xmrGained * xmrPriceBRL;
    this.accumulatedRevenueBRL += revenue;
  }

  public getFinanceReport() {
    const progress = (this.accumulatedXMR / this.MIN_PAYOUT) * 100;
    return {
      cost: this.accumulatedCostBRL,
      revenue: this.accumulatedRevenueBRL,
      profit: this.accumulatedRevenueBRL - this.accumulatedCostBRL,
      xmr: this.accumulatedXMR,
      minPayout: this.MIN_PAYOUT,
      payoutProgress: Math.min(100, progress)
    };
  }
}
