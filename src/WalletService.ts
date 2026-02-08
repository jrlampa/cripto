import axios from 'axios';
import * as crypto from 'crypto';

export class WalletService {
  private lastPrice: number = 0;
  private walletAddress: string = '';
  private mnemonic: string = '';

  constructor() {
    this.generateMockWallet();
  }

  /**
   * Simula a geração de uma carteira Monero (XMR)
   * Nota: Em produção, o usuário deve usar o GUI oficial ou ferramentas como monero-js.
   */
  private generateMockWallet(): void {
    const randomHex = crypto.randomBytes(32).toString('hex');
    this.walletAddress = `4${randomHex.substring(0, 94)}`; // Monero addresses start with '4' and are 95 chars
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
