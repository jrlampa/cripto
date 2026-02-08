import * as blessed from 'blessed';
import * as os from 'os';
import { EventEmitter } from 'events';

export class TUIBoard extends EventEmitter {
  private screen: any;
  private logBox: any;
  private statsBox: any;
  private cpuBox: any;
  private gpuBox: any;
  private walletBox: any;
  private poolBox: any;
  private progressBox: any;

  constructor() {
    super();
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
      height: 12, // Aumentado para 12
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
      height: 8,
      label: ' [ FINANCEIRO & CARTEIRA ] ',
      border: { type: 'line' },
      style: { border: { fg: 'yellow' } },
      tags: true
    });

    // Pool Section (NEW)
    this.poolBox = blessed.box({
      parent: this.screen,
      top: 23,
      left: 0,
      width: '100%',
      height: 7,
      label: ' [ ESTATISTICAS DA POOL (NANOPOOL) ] ',
      border: { type: 'line' },
      style: { border: { fg: 'blue' } },
      tags: true
    });

    // Eventos de Teclado
    this.screen.key(['p', 'P'], () => {
      this.emit('toggle_pause');
    });

    this.screen.key(['+', 'kp+'], () => {
      this.emit('increase_threads');
    });

    this.screen.key(['-', 'kp-'], () => {
      this.emit('decrease_threads');
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
      height: '20%',
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
      this.emit('exit');
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
    difficulty?: number,
    isPaused?: boolean
  }): void {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    const s = uptime % 60;
    const uptimeStr = `${h}h ${m}m ${s}s`;

    let stateColor = info.state === 'ATIVO' ? '{green-fg}' : '{yellow-fg}';
    if (info.isPaused) stateColor = '{red-fg}PAUSADO{/red-fg}';
    else stateColor = `${stateColor}${info.state}{/stateColor}`;

    this.statsBox.content = '';
    this.statsBox.setContent(
      `Estado: {bold}${stateColor}{/bold}\n` +
      `Threads: {bold}${info.threads}{/bold} (Use +/- para ajustar)\n` +
      `Conexão: ${info.poolConnected ? '{green-fg}Conectado{/green-fg}' : '{red-fg}Desconectado{/red-fg}'}\n` +
      `Pool: {cyan-fg}${info.pool}{/cyan-fg}\n\n` +
      `Shares: {yellow-fg}${info.shares || 0}{/yellow-fg}\n` +
      `Diff:   {blue-fg}${info.difficulty || 'N/A'}{/blue-fg}\n` +
      `Uptime: {bold}${uptimeStr}{/bold}`
    );
  }

  public updateCPU(usage: number): void {
    const barWidth = 20;
    const filled = Math.round((usage / 100) * barWidth);
    const bar = '[' + '='.repeat(filled) + ' '.repeat(barWidth - filled) + ']';

    this.cpuBox.content = '';
    this.cpuBox.setContent(
      `Carga: ${bar} {bold}${usage}%{/bold}\n` +
      `Núcleos: {bold}${os.cpus().length}{/bold}`
    );
  }

  public updateGPU(data: { model: string, load: number, hashrate: number }): void {
    const barWidth = 20;
    const filled = Math.round((data.load / 100) * barWidth);
    const bar = '[' + '='.repeat(filled) + ' '.repeat(barWidth - filled) + ']';

    this.gpuBox.content = '';
    this.gpuBox.setContent(
      `Modelo: {bold}${data.model}{/bold}\n` +
      `Carga:  ${bar} {bold}${data.load}%{/bold}\n` +
      `Hash:   {bold}${data.hashrate} H/s{/bold}`
    );
  }

  public updateWallet(info: {
    address: string,
    brl: number,
    usd: number,
    energyCost?: number,
    minedValue?: number,
    sessions?: number,
    totalMined?: number,
    totalCost?: number,
    xmr?: number,
    initialXMR?: number,
    minPayout?: number,
    etaPayout?: string,
    eta1XMR?: string
  }): void {
    const sessionProfit = (info.minedValue || 0) - (info.energyCost || 0);
    const profitColor = sessionProfit >= 0 ? '{green-fg}' : '{red-fg}';

    const walletInfo = info.totalMined !== undefined ? { mined: info.totalMined, cost: info.totalCost } : { mined: 0, cost: 0 };
    const lifetimeMined = (walletInfo.mined || 0) + (info.minedValue || 0);
    const lifetimeCost = (walletInfo.cost || 0) + (info.energyCost || 0);
    const lifetimeProfit = lifetimeMined - lifetimeCost;
    const lifetimeColor = lifetimeProfit >= 0 ? '{green-fg}' : '{red-fg}';

    const lifetimeXMR = (info.initialXMR || 0) + (info.xmr || 0);
    const payoutMeta = info.minPayout || 0.1;
    const progress = (lifetimeXMR / payoutMeta) * 100;
    const progressColor = progress >= 100 ? '{green-fg}' : '{yellow-fg}';

    this.walletBox.content = '';
    this.walletBox.setContent(
      `Endereço: {cyan-fg}${info.address}{/cyan-fg} | Sessões: {bold}${info.sessions || 1}{/bold}\n` +
      `XMR Total: {bold}${lifetimeXMR.toFixed(8)} XMR{/bold} | Meta: {bold}${payoutMeta} XMR{/bold} (R$ ${(payoutMeta * info.brl).toFixed(2)})\n` +
      `Progresso: ${progressColor}[${'█'.repeat(Math.floor(Math.min(100, progress) / 5))}${'░'.repeat(20 - Math.floor(Math.min(100, progress) / 5))}] ${Math.min(100, progress).toFixed(2)}%{/}\n` +
      `ETA Payout: {bold}${info.etaPayout || '---'}{/bold} | ETA 1.0 XMR: {bold}${info.eta1XMR || '---'}{/bold}\n` +
      `Sessão:   {red-fg}Luz R$ ${(info.energyCost || 0).toFixed(4)}{/red-fg} | Gerado: {green-fg}R$ ${(info.minedValue || 0).toFixed(4)}{/green-fg} | Saldo: ${profitColor}R$ ${sessionProfit.toFixed(4)}{/}\n` +
      `Total:    {red-fg}Luz R$ ${lifetimeCost.toFixed(4)}{/red-fg} | Gerado: {green-fg}R$ ${lifetimeMined.toFixed(4)}{/green-fg} | Saldo: ${lifetimeColor}{bold}R$ ${lifetimeProfit.toFixed(4)}{/bold}{/}`
    );
  }

  public updatePoolStats(data: any): void {
    if (!data) {
      this.poolBox.setContent('{red-fg}⚠️ Aguardando dados da Nanopool...{/red-fg}');
      return;
    }

    this.poolBox.content = '';
    this.poolBox.setContent(
      `Saldo: {green-fg}${data.balance.toFixed(8)} XMR{/green-fg} | Não Confirmado: {yellow-fg}${data.unconfirmedBalance.toFixed(8)} XMR{/yellow-fg}\n` +
      `Hashrate Pool: {bold}${data.hashrate.toFixed(2)} H/s{/bold}\n` +
      `Médias: {cyan-fg}1h: ${data.avgHashrate.h1.toFixed(2)}{/cyan-fg} | {cyan-fg}12h: ${data.avgHashrate.h12.toFixed(2)}{/cyan-fg} | {cyan-fg}24h: ${data.avgHashrate.h24.toFixed(2)}{/cyan-fg}`
    );
  }

  public updateProgress(percent: number): void {
    const width = this.progressBox.width - 4;
    const filled = Math.round((percent / 100) * width);
    const bar = '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled));

    this.progressBox.setContent(`{cyan-fg}${bar}{/cyan-fg} ${percent}%`);
  }

  public render(): void {
    this.screen.render();
  }
}
