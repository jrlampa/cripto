import { CoinConfig } from '../MainMenuTUI';
import { WalletService } from '../WalletService';
import { AddressValidator } from '../services/AddressValidator';

export class InteractiveSetup {
  private wallet: WalletService;

  constructor(walletService: WalletService) {
    this.wallet = walletService;
  }

  /**
   * Ensures the user has a valid address/worker configured for the selected coin.
   * If not, prompts the user via CLI (readline) until a valid input is provided.
   */
  async ensureValidConfiguration(coin: CoinConfig): Promise<{ address: string; password: string }> {
    const isBTC = coin.algorithm === 'SHA256';
    const label = isBTC ? 'Nome do Worker (ex: user.001)' : 'Endereço de carteira';

    // Load current state
    // Check if password exists in coin config (from menu) or wallet
    let password = (coin as any).password || this.wallet.getPasswordForCoin(coin.symbol);
    const walletInfo = this.wallet.getWalletInfo(coin.symbol);
    let address = walletInfo.address || "";

    // Apply auto-fix for double paste
    address = AddressValidator.fixDoublePaste(address);

    // Validate current state
    let isValid = AddressValidator.validate(coin.symbol, address, coin.poolHost);

    // If valid and we have password (if needed), just return
    if (isValid && (!isBTC || password)) {
      // Save possibly fixed address if it changed
      if (address !== walletInfo.address) {
        this.wallet.setAddressForCoin(coin.symbol, address, password);
      }
      return { address, password };
    }

    // IF NOT VALID, START INTERACTIVE MODE
    // -----------------------------------
    console.log(`\n⚠️  Configuração para ${coin.name} (${coin.symbol}) incompleta.`);

    // Custom Label for Binance
    const isBinance = coin.poolHost && (coin.poolHost.includes('binance.com') || coin.poolHost.includes('poolbinance'));
    if (isBinance && coin.symbol === 'RVN') {
      console.log(`ℹ️  Binance Pool detectada: Requer 'NomeDaConta.Worker' (ex: jonatas.worker1) ao invés de endereço de carteira.`);
    }

    if (address) console.log(`   Valor atual (${isBTC || isBinance ? 'Worker/Conta' : 'Endereço'}): ${address.substring(0, 20)}...`);

    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const ask = (q: string): Promise<string> => {
      return new Promise(resolve => readline.question(q, resolve));
    };

    try {
      while (!isValid) {
        // Offer auto-fix or demo for valid coins (Only if NOT Binance, as Binance needs real account)
        if (!isBinance && address && address.length > 5) {
          // Heuristic: If it looks semi-valid but failed strict check, maybe offer a generated one?
          // Keeping original logic: "Endereço parece inválido para a pool real"
          console.log(`⚠️  Endereço de ${coin.symbol} parece inválido para a pool real.`);
          console.log(`🔍 Tentando gerar endereço de demonstração compatível...`);
          const fixed = this.wallet.generateAddressForCoin(coin.symbol);

          // This generates a valid address, so we can use it
          this.wallet.setAddressForCoin(coin.symbol, fixed);
          address = fixed;
          isValid = true;
          console.log(`✅ Endereço de reparo ativado: ${fixed}`);
          break;
        }

        const promptLabel = (isBinance && coin.symbol === 'RVN') ? 'Nome da Conta Binance (ex: user.worker)' : label;
        const input = await ask(`👉 Por favor, digite seu ${promptLabel}: `);
        let cleanInput = input.trim();

        // Auto-fix double paste on input
        cleanInput = AddressValidator.fixDoublePaste(cleanInput);
        if (cleanInput !== input.trim()) {
          console.log("⚠️ Detectada colagem dupla! Corrigindo automaticamente...");
        }

        if (AddressValidator.validate(coin.symbol, cleanInput, coin.poolHost)) {
          address = cleanInput;
          isValid = true;
          console.log(`✅ ${isBinance ? 'Conta/Worker' : 'Endereço'} válido!`);
        } else {
          const errorMsg = isBinance
            ? "❌ Formato inválido para Binance. Use 'Conta.Worker' (ex: usuario.001)"
            : `❌ Valor inválido (Tamanho: ${cleanInput.length}). Tente novamente.`;
          console.log(errorMsg);
        }
      }

      // Password Prompt for BTC
      if (isBTC && !password) {
        const pass = await ask(`👉 Digite a senha para o worker (ou Enter para '123456'): `);
        password = pass.trim() || '123456';
      }

      // Save everything
      this.wallet.setAddressForCoin(coin.symbol, address, password);
      console.log(`✅ Configuração salva! Iniciando minerador...`);

      return { address, password };

    } finally {
      readline.close();
    }
  }
}
