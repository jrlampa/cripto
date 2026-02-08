import * as blessed from 'blessed';
import * as os from 'os';

export class TUIBoard {
  private screen: any;
  private logBox: any;
  private statsBox: any;
  private cpuBox: any;
  private gpuBox: any;
  private walletBox: any;
  private progressBox: any;

  constructor() {
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Antigravity Monero Miner v3'
    });

    // Dashboard Header
    blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: ' {bold}ANTIGRAVITY SMART MINER v3.0{/bold} | Monero (XMR) ',
      style: {
        bg: 'blue',
        fg: 'white'
      }
    });

    // Stats Section (Left)
    this.statsBox = blessed.box({
      parent: this.screen,
      top: 3,
      left: 0,
      width: '50%',
      height: 10,
      label: ' [ RESUMO DO SISTEMA ] ',
      border: { type: 'line' },
      style: { border: { fg: 'cyan' } },
      tags: true
    });

    // CPU Section
    this.cpuBox = blessed.box({
      parent: this.screen,
      top: 3,
      right: 0,
      width: '50%',
      height: 6,
      label: ' [ CPU & CARGA ] ',
      border: { type: 'line' },
      style: { border: { fg: 'green' } },
      tags: true
    });

    // GPU Section
    this.gpuBox = blessed.box({
      parent: this.screen,
      top: 9,
      right: 0,
      width: '50%',
      height: 6,
      label: ' [ GPU & CARGA ] ',
      border: { type: 'line' },
      style: { border: { fg: 'magenta' } },
      tags: true
    });

    // Wallet Section
    this.walletBox = blessed.box({
      parent: this.screen,
      top: 15,
      left: 0,
      width: '100%',
      height: 6, // Aumentado de 4 para 6
      label: ' [ FINANCEIRO & CARTEIRA ] ',
      border: { type: 'line' },
      style: { border: { fg: 'yellow' } },
      tags: true
    });

    // Progress Section (Bottom)
    this.progressBox = blessed.box({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 3,
      label: ' [ PROGRESSO DOS CALCULOS ] ',
      border: { type: 'line' },
      style: { border: { fg: 'cyan' } },
      tags: true
    });

    // Log Section (Bottom)
    this.logBox = blessed.log({
      parent: this.screen,
      bottom: 3,
      left: 0,
      width: '100%',
      height: '25%', // Reduzido ligeiramente para dar espaço
      label: ' [ LOGS DE REDE / EVENTOS ] ',
      border: { type: 'line' },
      style: { border: { fg: 'white' } },
      scrollable: true,
      alwaysScroll: true,
      tags: true,
      scrollbar: {
        ch: ' ',
        track: { bg: 'cyan' },
        style: { inverse: true }
      },
      keys: true,
      vi: true,
      mouse: true
    });

    this.screen.key(['escape', 'q', 'C-c'], () => {
      this.screen.destroy();
      process.exit(0);
    });

    this.render();
  }

  public log(message: string): void {
    const time = new Date().toLocaleTimeString();
    this.logBox.log(`[{cyan-fg}${time}{/cyan-fg}] ${message}`);
  }

  private startTime: number = Date.now();

  public updateStats(info: {
    state: string,
    threads: number,
    pool: string,
    poolConnected: boolean,
    shares?: number,
    difficulty?: number
  }): void {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    const s = uptime % 60;
    const uptimeStr = `${h}h ${m}m ${s}s`;

    this.statsBox.setContent(
      `Estado: {bold}${info.state}{/bold}\n` +
      `Threads: {bold}${info.threads}{/bold}\n` +
      `Conexão: ${info.poolConnected ? '{green-fg}Conectado{/green-fg}' : '{red-fg}Desconectado{/red-fg}'}\n` +
      `Pool: {cyan-fg}${info.pool}{/cyan-fg}\n\n` +
      `Shares: {yellow-fg}${info.shares || 0}{/yellow-fg}\n` +
      `Diff:   {blue-fg}${info.difficulty || 'N/A'}{/blue-fg}\n` +
      `Uptime: {bold}${uptimeStr}{/bold}`
    );
    this.render();
  }

  public updateCPU(usage: number): void {
    const barWidth = 20;
    const filled = Math.round((usage / 100) * barWidth);
    const bar = '[' + '='.repeat(filled) + ' '.repeat(barWidth - filled) + ']';

    this.cpuBox.setContent(
      `Carga: ${bar} {bold}${usage}%{/bold}\n` +
      `Núcleos: {bold}${os.cpus().length}{/bold}`
    );
    this.render();
  }

  public updateGPU(data: { model: string, load: number, hashrate: number }): void {
    const barWidth = 20;
    const filled = Math.round((data.load / 100) * barWidth);
    const bar = '[' + '='.repeat(filled) + ' '.repeat(barWidth - filled) + ']';

    this.gpuBox.setContent(
      `Modelo: {bold}${data.model}{/bold}\n` +
      `Carga:  ${bar} {bold}${data.load}%{/bold}\n` +
      `Hash:   {bold}${data.hashrate} H/s{/bold}`
    );
    this.render();
  }

  public updateWallet(info: {
    address: string,
    brl: number,
    usd: number,
    energyCost?: number,
    minedValue?: number
  }): void {
    const profit = (info.minedValue || 0) - (info.energyCost || 0);
    const profitColor = profit >= 0 ? '{green-fg}' : '{red-fg}';

    this.walletBox.setContent(
      `Endereço: {cyan-fg}${info.address}{/cyan-fg}\n` +
      `Cotação:  {bold}R$ ${info.brl.toLocaleString()}{/bold} | {bold}$${info.usd.toLocaleString()}{/bold}\n` +
      `Energia:  {red-fg}R$ ${(info.energyCost || 0).toFixed(4)}{/red-fg} | Gerado: {green-fg}R$ ${(info.minedValue || 0).toFixed(4)}{/green-fg}\n` +
      `Saldo:    ${profitColor}{bold}R$ ${profit.toFixed(4)}{/bold}{/}`
    );
    this.render();
  }

  public updateProgress(percent: number): void {
    const width = this.progressBox.width - 4;
    const filled = Math.round((percent / 100) * width);
    const bar = '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled));

    this.progressBox.setContent(`{cyan-fg}${bar}{/cyan-fg} ${percent}%`);
    this.render();
  }

  private render(): void {
    this.screen.render();
  }
}
