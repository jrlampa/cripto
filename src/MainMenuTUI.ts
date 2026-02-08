import * as blessed from 'blessed';

export interface CoinConfig {
  symbol: string;
  name: string;
  algorithm: string;
  poolHost: string;
  poolPort: number;
  color: string;
}

export const COINS: CoinConfig[] = [
  // --- TOP 5 (RandomX Powerhouses) ---
  {
    symbol: 'XMR',
    name: 'Monero',
    algorithm: 'RandomX',
    poolHost: 'xmr-eu1.nanopool.org',
    poolPort: 14444,
    color: 'red'
  },
  {
    symbol: 'ZEPH',
    name: 'Zephyr Protocol',
    algorithm: 'RandomX',
    poolHost: 'zeph.kryptex.network',
    poolPort: 7777,
    color: 'cyan'
  },
  {
    symbol: 'QRL',
    name: 'Quantum RL',
    algorithm: 'RandomX',
    poolHost: 'de.qrl.herominers.com',
    poolPort: 1166,
    color: 'yellow'
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
      width: '50%',
      height: '50%', // Alterado de 'shrink' para '50%' para garantir espaço
      items: items,
      keys: true,
      vi: true,
      mouse: true,
      tags: true, // Enable parsing of {bold}{/bold} tags
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
      label: ' [ Selecione ] '
    });

    this.list.on('select', (_item: any, index: number) => {
      const selected = COINS[index];
      if (selected) {
        this.selectedCoin = selected;
        if (this.resolveSelection) {
          this.screen.destroy();
          this.resolveSelection(selected);
        }
      }
    });

    this.screen.key(['escape', 'q', 'C-c'], () => {
      process.exit(0);
    });

    this.list.focus();
  }

  public async waitForSelection(): Promise<CoinConfig> {
    return new Promise((resolve) => {
      this.resolveSelection = resolve;
      this.screen.render();
    });
  }
}
