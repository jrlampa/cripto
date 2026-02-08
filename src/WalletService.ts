import axios from 'axios';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export class WalletService {
  private lastPrice: number = 0;
  private walletAddress: string = '';
  private mnemonic: string = '';
  private readonly walletFile = path.join(process.cwd(), 'wallet.json');

  constructor() {
    this.initialization();
  }

  private initialization(): void {
    if (fs.existsSync(this.walletFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.walletFile, 'utf8'));
        this.walletAddress = data.address;
        this.mnemonic = data.mnemonic;
        return;
      } catch (e) {
        console.error("⚠️ Erro ao ler arquivo da carteira. Gerando uma nova.");
      }
    }
    this.generateMockWallet();
    this.saveWallet();
  }

  private saveWallet(): void {
    const data = {
      address: this.walletAddress,
      mnemonic: this.mnemonic,
      createdAt: new Date().toISOString()
    };
    fs.writeFileSync(this.walletFile, JSON.stringify(data, null, 2));
  }

  /**
   * Simula a geração de uma carteira Monero (XMR)
   */
  private generateMockWallet(): void {
    const randomHex = crypto.randomBytes(32).toString('hex');
    this.walletAddress = `4${randomHex.substring(0, 94)}`;
    this.mnemonic = "seed-frase-simulada-para-festa-exemplo-minerador-antigravity";
  }

  public getWalletInfo() {
    return {
      address: this.walletAddress,
      mnemonic: this.mnemonic
    };
  }

  /**
   * Busca o preço do Monero via CoinGecko
   */
  public async fetchPrice(): Promise<{ brl: number, usd: number }> {
    try {
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
        params: {
          ids: 'monero',
          vs_currencies: 'brl,usd'
        }
      });
      const data = response.data.monero;
      this.lastPrice = data.brl;
      return {
        brl: data.brl,
        usd: data.usd
      };
    } catch (error) {
      console.error("⚠️ Erro ao buscar preço do XMR. Usando último valor conhecido.");
      return { brl: 850, usd: 145 }; // Fallback aproximado
    }
  }
}
