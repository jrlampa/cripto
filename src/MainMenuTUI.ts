import * as blessed from 'blessed';
import { WalletService } from './WalletService';

export interface CoinConfig {
  symbol: string;
  name: string;
  algorithm: string;
  poolHost: string;
  poolPort: number;
  color: string;
  presets?: { name: string, host: string, port: number }[];
}

export const COINS: CoinConfig[] = [
  // --- TOP 5 (RandomX Powerhouses) ---
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    algorithm: 'SHA256',
    poolHost: 'sha256.poolbinance.com',
    poolPort: 443,
    color: 'yellow',
    presets: [
      { name: 'Binance Pool (SHA256)', host: 'sha256.poolbinance.com', port: 443 },
      { name: 'Binance Pool (BTC)', host: 'btc.poolbinance.com', port: 1800 },
      { name: 'Binance Pool (BS)', host: 'bs.poolbinance.com', port: 3333 },
      { name: 'Custom / Outro', host: '', port: 0 }
    ]
  },
  {
    symbol: 'XMR',
    name: 'Monero',
    algorithm: 'RandomX',
    poolHost: 'xmr-eu1.nanopool.org',
    poolPort: 14444,
    color: 'red',
    presets: [
      { name: '⚡ Auto-Select Best (Latency Test)', host: 'AUTO_LATENCY', port: 0 },
      { name: 'Nanopool (Default)', host: 'xmr-eu1.nanopool.org', port: 14444 },
      { name: 'Binance Pool (BTC/SHA256 - CHECK ALGO!)', host: 'btc.poolbinance.com', port: 1800 },
      { name: 'Binance Pool (SHA256 - CHECK ALGO!)', host: 'sha256.poolbinance.com', port: 443 },
      { name: 'SupportXMR', host: 'pool.supportxmr.com', port: 3333 },
      { name: 'Custom / Outro', host: '', port: 0 }
    ]
  },
  {
    symbol: 'ERGO',
    name: 'Ergo',
    algorithm: 'Autolykos2',
    poolHost: 'ergo-eu1.nanopool.org',
    poolPort: 10600,
    color: 'cyan',
    presets: [
      { name: 'Nanopool (Default)', host: 'ergo-eu1.nanopool.org', port: 10600 },
      { name: '2Miners', host: 'erg.2miners.com', port: 8888 },
      { name: 'Custom / Outro', host: '', port: 0 }
    ]
  },
  {
    symbol: 'CFX',
    name: 'Conflux',
    algorithm: 'Octopus',
    poolHost: 'cfx-eu1.nanopool.org',
    poolPort: 10500,
    color: 'blue',
    presets: [
      { name: 'Nanopool (Default)', host: 'cfx-eu1.nanopool.org', port: 10500 },
      { name: 'WoolyPooly', host: 'pool.woolypooly.com', port: 3094 },
      { name: 'Custom / Outro', host: '', port: 0 }
    ]
  },
  {
    symbol: 'RVN',
    name: 'Ravencoin',
    algorithm: 'KAWPOW',
    poolHost: 'rvn-eu1.nanopool.org',
    poolPort: 10400,
    color: 'red',
    presets: [
      { name: 'Nanopool (Default)', host: 'rvn-eu1.nanopool.org', port: 10400 },
      { name: '2Miners', host: 'rvn.2miners.com', port: 6060 },
      { name: 'Custom / Outro', host: '', port: 0 }
    ]
  },
  {
    symbol: 'WOW',
    name: 'Wownero',
    algorithm: 'RandomX',
    poolHost: 'de.wownero.herominers.com',
    poolPort: 1166,
    color: 'magenta'
  },
  {
    symbol: 'EPIC',
    name: 'Epic Cash',
    algorithm: 'RandomX',
    poolHost: 'de.epic.herominers.com',
    poolPort: 1111,
    color: 'white'
  },

  // --- LIQUIDAÇÃO BINANCE (Depósito Direto) ---
  {
    symbol: 'BNB',
    name: 'Binance Coin (BSC)',
    algorithm: 'N/A (Liquid)',
    poolHost: 'N/A',
    poolPort: 0,
    color: 'yellow'
  },
  {
    symbol: 'SOL',
    name: 'Solana',
    algorithm: 'N/A (Liquid)',
    poolHost: 'N/A',
    poolPort: 0,
    color: 'magenta'
  },
  {
    symbol: 'ETH',
    name: 'Ethereum (Base)',
    algorithm: 'N/A (Liquid)',
    poolHost: 'N/A',
    poolPort: 0,
    color: 'blue'
  },

  // --- SUGESTÕES (Nicho & Mobile) ---
  {
    symbol: 'YDA',
    name: 'Yadacoin',
    algorithm: 'RandomX',
    poolHost: 'randomx.yadacoin.io',
    poolPort: 3333,
    color: 'green'
  },
  {
    symbol: 'XLA',
    name: 'Scala',
    algorithm: 'RandomX', // DefiX (RandomX variant)
    poolHost: 'de.scala.herominers.com',
    poolPort: 1190,
    color: 'blue'
  }
];

export class MainMenuTUI {
  private screen: any;
  private list: any;
  private selectedCoin: CoinConfig | null = null;
  private resolveSelection: ((coin: CoinConfig) => void) | null = null;

  constructor() {
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Antigravity Miner - Select Coin'
    });

    // Background
    blessed.box({
      parent: this.screen,
      width: '100%',
      height: '100%',
      style: {
        bg: 'black',
        fg: 'white'
      },
      content:
        `
 {bold}ANTIGRAVITY SMART MINER v3.0{/bold}
 ────────────────────────────────
 Escolha sua moeda para iniciar:
`
      ,
      tags: true,
      align: 'center',
      valign: 'top',
      padding: { top: 2 }
    });

    const items = COINS.map((c, i) => {
      let prefix = "";
      if (i === 0) prefix = "{bold}* TOP 1:{/bold} ";
      if (i > 0 && i < 5) prefix = `TOP ${i + 1}: `;
      if (i >= 5) prefix = `SUGESTÃO ${i - 4}: `;

      return `${prefix}${c.name} ({${c.color}-fg}${c.symbol}{/})`;
    });

    this.list = blessed.list({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '60%',
      height: '50%',
      items: items,
      keys: true,
      vi: true,
      mouse: true,
      tags: true,
      style: {
        fg: 'white',
        bg: 'black',
        selected: {
          bg: 'blue',
          fg: 'white',
          bold: true
        }
      },
      border: {
        type: 'line'
      },
      label: ' [ Selecione a Moeda ] '
    });

    this.list.on('select', (_item: any, index: number) => {
      const selected = COINS[index];
      if (selected) {
        this.selectedCoin = selected;
        // Check if presets exist (Only XMR for now)
        if (selected.presets && selected.presets.length > 0) {
          this.showPoolSelection(selected);
        } else {
          this.finish(selected);
        }
      }
    });

    this.screen.key(['escape', 'q', 'C-c'], () => {
      process.exit(0);
    });

    this.list.focus();
    this.screen.render();
  }

  private showPoolSelection(coin: CoinConfig) {
    this.list.hide();

    // Create new list for pools
    const poolList = blessed.list({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '70%',
      height: '50%',
      items: coin.presets!.map(p => p.name),
      keys: true,
      vi: true,
      mouse: true,
      tags: true,
      style: {
        fg: 'white',
        bg: 'black',
        selected: {
          bg: 'cyan',
          fg: 'black',
          bold: true
        }
      },
      border: {
        type: 'line'
      },
      label: ` [ Selecione o Pool para ${coin.name} ] `
    });

    poolList.on('select', (_item: any, index: number) => {
      if (!coin.presets || !coin.presets[index]) return;
      const preset = coin.presets[index];

      if (preset.name.includes('Custom')) {
        poolList.destroy();
        this.showCustomPoolInput(coin);
      } else if (preset.host === 'AUTO_LATENCY') {
        poolList.destroy();
        this.runLatencyTest(coin);
      } else {
        coin.poolHost = preset.host;
        coin.poolPort = preset.port;
        poolList.destroy();
        this.showPasswordInput(coin);
      }
    });

    poolList.focus();
    this.screen.render();
  }

  private async runLatencyTest(coin: CoinConfig) {
    const { NetworkTestService } = require('./NetworkTestService');
    const service = new NetworkTestService();

    const loadingBox = blessed.box({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '50%',
      height: '30%',
      content: '{center}{bold}Testando Latência dos Pools...{/bold}\n\nAguarde enquanto encontramos o servidor mais rápido para você.{/center}',
      tags: true,
      border: { type: 'line' },
      style: { border: { fg: 'cyan' } }
    });

    this.screen.render();

    // Hosts do Nanopool para teste (lista requerida pelo usuário)
    const candidates = [
      { name: 'Europe 1', host: 'xmr-eu1.nanopool.org', port: 14444 },
      { name: 'Europe 2', host: 'xmr-eu2.nanopool.org', port: 14444 },
      { name: 'US East', host: 'xmr-us-east1.nanopool.org', port: 14444 },
      { name: 'US West', host: 'xmr-us-west1.nanopool.org', port: 14444 },
      { name: 'Asia', host: 'xmr-asia1.nanopool.org', port: 14444 },
      { name: 'Japan', host: 'xmr-jp1.nanopool.org', port: 14444 },
      { name: 'Australia', host: 'xmr-au1.nanopool.org', port: 14444 }
    ];

    let resultsText = '{center}{bold}Testando Latência...{/bold}\n\n';

    // Testa todos e atualiza a UI
    const best = await service.findBestPool(candidates, (pool: any, latency: number) => {
      const ms = latency === Infinity ? 'TIMEOUT' : `${latency}ms`;
      const color = latency < 150 ? '{green-fg}' : latency < 300 ? '{yellow-fg}' : '{red-fg}';
      resultsText += `${pool.name}: ${color}${ms}{/}\n`;
      loadingBox.setContent(resultsText);
      this.screen.render();
    });

    // Mostra vencedor
    loadingBox.setContent(resultsText + `\n{bold}{green-fg}VENCEDOR: ${best.name} (${best.host}){/green-fg}{/bold}\n\nIniciando...`);
    this.screen.render();

    setTimeout(() => {
      loadingBox.destroy();
      coin.poolHost = best.host;
      coin.poolPort = best.port;
      this.showPasswordInput(coin);
    }, 2000);
  }

  private showCustomPoolInput(coin: CoinConfig) {
    const form = blessed.form({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '60%',
      height: 12, // Reduced height
      keys: true,
      border: { type: 'line' },
      label: ' [ Configurar Pool Customizado ] ',
      bg: 'blue'
    });

    blessed.text({
      parent: form,
      top: 1,
      left: 2,
      content: 'Host (ex: pool.host.com):',
      bg: 'blue'
    });

    const hostInput = blessed.textbox({
      parent: form,
      top: 2,
      left: 2,
      width: '90%',
      height: 3,
      inputOnFocus: true,
      border: { type: 'line' },
      style: { focus: { border: { fg: 'cyan' } } }
    });

    blessed.text({
      parent: form,
      top: 5,
      left: 2,
      content: 'Porta (ex: 3333):',
      bg: 'blue'
    });

    const portInput = blessed.textbox({
      parent: form,
      top: 6,
      left: 2,
      width: '30%',
      height: 3,
      inputOnFocus: true,
      border: { type: 'line' },
      style: { focus: { border: { fg: 'cyan' } } }
    });

    // Fix: Add explicit submit instruction
    blessed.text({
      parent: form,
      bottom: 1,
      left: 2,
      content: '{bold}Pressione ENTER em cada campo e depois ESC para confirmar.{/bold}',
      tags: true,
      bg: 'blue'
    });

    // Workflow: Host -> Enter -> Port -> Enter -> Finish
    hostInput.on('submit', () => {
      portInput.focus();
      this.screen.render();
    });

    portInput.on('submit', () => {
      const host = hostInput.value.trim();
      const port = parseInt(portInput.value.trim());

      if (host && port > 0) {
        coin.poolHost = host;
        coin.poolPort = port;
        form.destroy();
        this.showPasswordInput(coin);
      } else {
        // Simple error feedback
        hostInput.setValue('INVALIDO');
        this.screen.render();
      }
    });

    hostInput.focus();
    this.screen.render();
  }

  private showPasswordInput(coin: CoinConfig) {
    let defaultPass = 'x';
    try {
      const wallet = new WalletService();
      const stored = wallet.getPasswordForCoin(coin.symbol);
      if (stored) defaultPass = stored;
    } catch (e) {
      // Ignore error if wallet cannot be loaded here
    }

    const form = blessed.form({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '60%',
      height: 10,
      keys: true,
      border: { type: 'line' },
      label: ' [ Configurar Senha / Email (Opcional) ] ',
      bg: 'blue'
    });

    blessed.text({
      parent: form,
      top: 1,
      left: 2,
      content: 'Senha do Pool (ou Email para Nanopool):',
      bg: 'blue'
    });

    const passInput = blessed.textbox({
      parent: form,
      top: 2,
      left: 2,
      width: '90%',
      height: 3,
      inputOnFocus: true,
      border: { type: 'line' },
      style: { focus: { border: { fg: 'cyan' } } },
      value: defaultPass
    });

    blessed.text({
      parent: form,
      bottom: 1,
      left: 2,
      content: '{bold}ENTER para confirmar, ESC para cancelar.{/bold}',
      tags: true,
      bg: 'blue'
    });

    passInput.key(['escape'], () => {
      form.destroy();
      // If cancelled, proceed with default 'x'
      this.finish(coin, 'x');
    });

    passInput.on('submit', () => {
      const pass = passInput.value.trim() || 'x';
      form.destroy();
      this.finish(coin, pass);
    });

    passInput.focus();
    this.screen.render();
  }

  private finish(coin: CoinConfig, password?: string) {
    if (this.resolveSelection) {
      this.screen.destroy();
      // Attach password to coin config temporarily or just return it
      (coin as any).password = password || 'x';
      this.resolveSelection(coin);
    }
  }


  public async waitForSelection(): Promise<CoinConfig> {
    return new Promise((resolve) => {
      this.resolveSelection = resolve;
      this.screen.render();
    });
  }
}
