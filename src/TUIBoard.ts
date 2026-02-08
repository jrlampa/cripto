import * as blessed from 'blessed';
import * as os from 'os';

export class TUIBoard {
  private screen: any;
  private logBox: any;
  private statsBox: any;
  private cpuBox: any;
  private walletBox: any;

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

    // CPU Cores Section (Right)
    this.cpuBox = blessed.box({
      parent: this.screen,
      top: 3,
      right: 0,
      width: '50%',
      height: 10,
      label: ' [ HARDWARE & CARGA ] ',
      border: { type: 'line' },
      style: { border: { fg: 'green' } },
      tags: true
    });

    // Wallet Section (Middle)
    this.walletBox = blessed.box({
      parent: this.screen,
      top: 13,
      left: 0,
      width: '100%',
      height: 6,
      label: ' [ FINANCEIRO & CARTEIRA ] ',
      border: { type: 'line' },
      style: { border: { fg: 'yellow' } },
      tags: true
    });

    // Log Section (Bottom)
    this.logBox = blessed.log({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: '30%',
      label: ' [ LOGS DE REDE / EVENTOS ] ',
      border: { type: 'line' },
      style: { border: { fg: 'white' } },
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

  public updateStats(data: { state: string, threads: number, pool: string, poolConnected: boolean }): void {
    const stateColor = data.state === 'ÓCIO' ? '{bold}{magenta-fg}' : '{bold}{yellow-fg}';
    const connStatus = data.poolConnected ? '{bold}{green-fg}ONLINE{/green-fg}{/bold}' : '{bold}{red-fg}OFFLINE{/red-fg}{/bold}';

    this.statsBox.setContent(
      `Estado Atual: ${stateColor}${data.state}{/${data.state === 'ÓCIO' ? 'magenta-fg' : 'yellow-fg'}}{/bold}\n` +
      `Threads Ativas: {bold}${data.threads}{/bold}\n` +
      `Pool: {bold}${data.pool}{/bold}\n` +
      `Conexão: ${connStatus}`
    );
    this.render();
  }

  public updateCPU(usage: number): void {
    const barWidth = 30;
    const filled = Math.round((usage / 100) * barWidth);
    const bar = '[' + '='.repeat(filled) + ' '.repeat(barWidth - filled) + ']';

    this.cpuBox.setContent(
      `CPU: {bold}${os.cpus()[0]?.model}{/bold}\n\n` +
      `Carga Total: ${bar} {bold}${usage}%{/bold}\n` +
      `Núcleos: {bold}${os.cpus().length}{/bold}`
    );
    this.render();
  }

  public updateWallet(info: { address: string, brl: number, usd: number }): void {
    this.walletBox.setContent(
      `Endereço: {cyan-fg}${info.address}{/cyan-fg}\n` +
      `Cotação XMR: {bold}R$ ${info.brl.toFixed(2)}{/bold} | {bold}$ ${info.usd.toFixed(2)}{/bold} (Live)`
    );
    this.render();
  }

  private render(): void {
    this.screen.render();
  }
}
