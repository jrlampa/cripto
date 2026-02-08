import axios from 'axios';

export class ProfitabilityService {
  private readonly MIN_PAYOUT = 1.0;

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

  private currentPriceBRL: number = 0;

  /**
   * Atualiza as métricas financeiras baseadas na carga atual do sistema
   */
  public update(cpuLoad: number, gpuLoad: number, totalHashrate: number, xmrPriceBRL: number, deltaMs: number, kwhPrice: number = 1.10): void {
    this.currentPriceBRL = xmrPriceBRL;
    const hours = deltaMs / (1000 * 3600);
    const seconds = deltaMs / 1000;

    const cpuWatts = 15 + (cpuLoad / 100) * 45;
    const gpuWatts = 10 + (gpuLoad / 100) * 60;
    const totalWatts = cpuWatts + gpuWatts;

    const cost = (totalWatts / 1000) * hours * kwhPrice;
    this.accumulatedCostBRL += cost;

    // XMR accumulation is now handled by addShare method
    // The revenue calculation here will be based on the accumulated XMR * price,
    // but the instruction implies removing the xmrGained calculation from here.
    // For now, we'll remove the xmrGained and related revenue calculation from here,
    // as the accumulatedXMR will be updated by addShare.
    // The getFinanceReport will use the accumulatedXMR.

    // Atualiza estatísticas da rede a cada 10 minutos se necessário
    if (Date.now() - this.lastNetworkUpdate > 600000) {
      this.fetchNetworkStats();
    }
  }

  /**
   * Adiciona recompensa baseada em um Share válido aceito pelo Pool.
   * Modelo PPS (Pay Per Share) simplificado para estimativa realista.
   */
  public addShare(shareDifficulty: number): void {
    if (this.networkDifficulty === 0) return;

    // Fórmula: (Dificuldade do Share / Dificuldade da Rede) * Recompensa do Bloco
    const shareValueXMR = (shareDifficulty / this.networkDifficulty) * this.blockReward;

    // Deduz taxa do pool (ex: 1%)
    const fee = shareValueXMR * 0.01;
    const netShareValue = shareValueXMR - fee;

    this.accumulatedXMR += netShareValue;
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
    return {
      cost: this.accumulatedCostBRL,
      revenue: this.accumulatedXMR * this.currentPriceBRL,
      profit: (this.accumulatedXMR * this.currentPriceBRL) - this.accumulatedCostBRL,
      xmr: this.accumulatedXMR,
      etaPayout: this.calculateETA(this.MIN_PAYOUT, lifetimeXMR),
      eta1XMR: this.calculateETA(1.0, lifetimeXMR),
      minPayout: this.MIN_PAYOUT
    };
  }
}
