export class ProfitabilityService {
  private readonly KWH_PRICE_BRL = 1.10;
  private readonly REWARD_FACTOR = 0.000000001; // Fator simulado de ganhos p/ hashrate

  private startTime: number = Date.now();
  private accumulatedCostBRL: number = 0;
  private accumulatedRevenueBRL: number = 0;

  constructor() { }

  /**
   * Atualiza as métricas financeiras baseadas na carga atual do sistema
   * @param cpuLoad Carga da CPU (0-100)
   * @param gpuLoad Carga da GPU (0-100)
   * @param totalHashrate Hashrate combinado (CPU + GPU)
   * @param xmrPriceBRL Preço do XMR em BRL
   */
  public update(cpuLoad: number, gpuLoad: number, totalHashrate: number, xmrPriceBRL: number, deltaMs: number): void {
    const hours = deltaMs / (1000 * 3600);

    // Estimativa de consumo (Watts)
    // CPU: Base 15W + Carga (até 45W em laptop médio)
    // GPU: Base 10W + Carga (até 60W em laptop médio)
    const cpuWatts = 15 + (cpuLoad / 100) * 45;
    const gpuWatts = 10 + (gpuLoad / 100) * 60;
    const totalWatts = cpuWatts + gpuWatts;

    // Cálculo de Custo (R$ = (W/1000) * horas * preço_kwh)
    const cost = (totalWatts / 1000) * hours * this.KWH_PRICE_BRL;
    this.accumulatedCostBRL += cost;

    // Estimativa de Ganho (Simulado baseado em hashrate e preço)
    // Em um cenário real, isso dependeria da dificuldade da rede e PPLNS/PPS da pool
    const revenue = totalHashrate * this.REWARD_FACTOR * xmrPriceBRL * hours * 1000; // Multiplicador para escala
    this.accumulatedRevenueBRL += revenue;
  }

  public getFinanceReport() {
    return {
      cost: this.accumulatedCostBRL,
      revenue: this.accumulatedRevenueBRL,
      profit: this.accumulatedRevenueBRL - this.accumulatedCostBRL
    };
  }
}
