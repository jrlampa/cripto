export class GPUMiningEngine {
  private isActive: boolean = false;
  private hashrate: number = 0;

  constructor() { }

  public setPower(isActive: boolean): void {
    this.isActive = isActive;
    if (isActive) {
      // Simula um hashrate proporcional para GPU (geralmente maior que CPU)
      this.hashrate = Math.floor(Math.random() * 500) + 1000;
    } else {
      this.hashrate = 0;
    }
  }

  public getStatus() {
    return {
      active: this.isActive,
      hashrate: this.hashrate,
      isSimulated: true
    };
  }

  /**
   * Simula o consumo de recursos da GPU (Aumentando carga fictícia)
   */
  public getSimulatedLoad(): number {
    if (!this.isActive) return 0;
    return Math.floor(Math.random() * 20) + 80; // 80-100% de uso simulado
  }
}
