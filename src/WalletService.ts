import axios from 'axios';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class WalletService {
  private lastPrice: number = 0;
  private walletAddress: string = ''; // Kept for backward compatibility and XMR default
  private walletAddresses: { [key: string]: string } = {}; // New property for multiple addresses
  private mnemonic: string = '';
  private sessions: number = 0;
  private lifetimeMined: number = 0;
  private lifetimeCost: number = 0;
  private lifetimeXMR: number = 0;
  private baselineMined: number = 0;
  private baselineCost: number = 0;
  private baselineXMR: number = 0;
  private readonly walletFile = path.join(process.cwd(), 'wallet.json');
  private readonly algorithm = 'aes-256-cbc';
  private readonly secretKey = process.env.WALLET_PASSWORD ?
    crypto.createHash('sha256').update(process.env.WALLET_PASSWORD).digest() :
    crypto.createHash('sha256').update(os.hostname() + 'antigravity-secret').digest();

  private energyCostPerKwh: number = 1.10;

  constructor() {
    this.initialization();
  }

  private encrypt(text: string): { iv: string, content: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.secretKey, iv);
    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
    return {
      iv: iv.toString('hex'),
      content: encrypted.toString('hex')
    };
  }

  private decrypt(hash: { iv: string, content: string }): string {
    const decipher = crypto.createDecipheriv(this.algorithm, this.secretKey, Buffer.from(hash.iv, 'hex'));
    const decrpyted = Buffer.concat([decipher.update(Buffer.from(hash.content, 'hex')), decipher.final()]);
    return decrpyted.toString();
  }

  private initialization(): void {
    if (fs.existsSync(this.walletFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.walletFile, 'utf8'));
        this.walletAddress = data.address;
        this.walletAddresses = data.addresses || {};

        // Garante que o endereço padrão (XMR) vai para o mapa
        if (!this.walletAddresses['XMR'] && this.walletAddress) {
          this.walletAddresses['XMR'] = this.walletAddress;
        }

        // Suporte a migração: Se existir mnemonic_encrypted, usa ele. Se não, tenta converter o antigo.
        if (data.mnemonic_encrypted) {
          try {
            this.mnemonic = this.decrypt(data.mnemonic_encrypted);
          } catch (e) {
            console.error("❌ Erro ao descriptografar mnemônica. Verifique a senha.");
            this.mnemonic = "ERRO_DESCRIPTOGRAFIA_SENHA_INCORRETA";
          }
        } else {
          this.mnemonic = data.mnemonic;
        }

        this.sessions = data.sessions || 0;
        this.lifetimeMined = data.lifetimeMined || 0;
        this.lifetimeCost = data.lifetimeCost || 0;
        this.lifetimeXMR = data.lifetimeXMR || 0;
        this.baselineMined = this.lifetimeMined;
        this.baselineCost = this.lifetimeCost;
        this.baselineXMR = this.lifetimeXMR;
        this.energyCostPerKwh = data.energyCostPerKwh !== undefined ? data.energyCostPerKwh : 1.10;
      } catch (e) {
        console.error("⚠️ Erro ao ler arquivo da carteira.");
      }
    }

    // Prioridade: Importar dados reais se os arquivos estiverem presentes
    const cakeFile = path.join(process.cwd(), 'carteira_cake.html');
    const wordsFile = path.join(process.cwd(), 'words.html');

    let updated = false;

    if (fs.existsSync(cakeFile)) {
      const html = fs.readFileSync(cakeFile, 'utf8');
      const addressMatch = html.match(/4[a-zA-Z0-9]{94}/);
      if (addressMatch && this.walletAddress !== addressMatch[0]) {
        this.walletAddress = addressMatch[0];
        updated = true;
      }
    }

    if (fs.existsSync(wordsFile)) {
      const html = fs.readFileSync(wordsFile, 'utf8');
      const wordsMatch = html.match(/<body>(.*?)<\/body>/);
      if (wordsMatch && wordsMatch[1] && this.mnemonic !== wordsMatch[1]) {
        this.mnemonic = wordsMatch[1];
        updated = true;
      }
    }

    if (updated || !this.walletAddress) {
      if (!this.walletAddress) this.generateMockWallet();
      this.saveWallet();
    }
  }

  private saveWallet(): void {
    const encryptedMnemonic = this.encrypt(this.mnemonic);
    const data = {
      address: this.walletAddress,
      addresses: this.walletAddresses,
      mnemonic_encrypted: encryptedMnemonic, // Agora guardamos apenas a versão encriptada
      sessions: this.sessions,
      energyCostPerKwh: this.energyCostPerKwh,
      lifetimeMined: this.lifetimeMined,
      lifetimeCost: this.lifetimeCost,
      lifetimeXMR: this.lifetimeXMR,
      lastUpdated: new Date().toISOString()
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

  public getAddressForCoin(symbol: string): string {
    return this.walletAddresses[symbol] || this.walletAddress;
  }

  public setAddressForCoin(symbol: string, address: string): void {
    this.walletAddresses[symbol] = address;
    if (symbol === 'XMR') this.walletAddress = address;
    this.saveWallet();
  }

  public getWalletInfo(symbol: string = 'XMR') {
    return {
      address: this.getAddressForCoin(symbol),
      // Ocultamos a mnemônica por segurança em logs e TUI se necessário, mas mantemos para uso interno
      mnemonic: this.mnemonic === "ERRO_DESCRIPTOGRAFIA_SENHA_INCORRETA" ? "[PROTEGIDO: ERRO DE SENHA]" : "[PROTEGIDO: ENCRIPTADO]",
      sessions: this.sessions,
      lifetimeMined: this.lifetimeMined,
      lifetimeCost: this.lifetimeCost,
      lifetimeXMR: this.lifetimeXMR,
      initialMined: this.baselineMined,
      initialCost: this.baselineCost,
      initialXMR: this.baselineXMR,
      energyCost: this.energyCostPerKwh
    };
  }

  public incrementSession(): void {
    this.sessions++;
    this.saveWallet();
  }

  public updateLifetimeStats(sessionMined: number, sessionCost: number, sessionXMR?: number): void {
    this.lifetimeMined = this.baselineMined + sessionMined;
    this.lifetimeCost = this.baselineCost + sessionCost;
    if (sessionXMR !== undefined) {
      this.lifetimeXMR = this.baselineXMR + sessionXMR;
    }
    this.saveWallet();
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
