export class AddressValidator {
  /**
   * Validates a cryptocurrency address based on the coin symbol.
   * @param symbol The coin symbol (e.g., 'XMR', 'BTC').
   * @param address The address or worker name to validate.
   * @param poolHost The pool hostname (optional, for specific rules like Binance).
   * @returns True if the address checks out according to the coin's rules.
   */
  static validate(symbol: string, address: string, poolHost: string = ''): boolean {
    if (!address) return false;

    // Normalize: remove whitespace
    const cleanAddr = address.trim();
    const len = cleanAddr.length;

    // Basic length check
    if (len < 3) return false;

    // Specific Coin Rules
    switch (symbol) {
      case 'XMR':
        // Monero (Standard: 95, Integrated: 106) allow some flexibility
        // Must start with 4 or 8.
        return /^[48]/.test(cleanAddr) && len >= 90 && len <= 110 && !cleanAddr.includes('XGGfpH');

      case 'ZEPH':
        // Zephyr Protocol (starts with ZEPH)
        return /^ZEPH/.test(cleanAddr) && len >= 80 && len <= 130 && !cleanAddr.includes('XGGfpH');

      case 'WOW':
        // Wownero (starts with WW)
        return /^WW/.test(cleanAddr) && len >= 80 && len <= 130 && !cleanAddr.includes('XGGfpH');

      case 'BTC':
        // Bitcoin (Worker name or Address)
        // If it looks like Monero (starts with 4/8 and long), it's invalid for BTC
        const looksLikeXMR = (cleanAddr.startsWith('4') || cleanAddr.startsWith('8')) && len > 90;
        if (looksLikeXMR) return false;

        // BTC Address Regex (Legacy 1, P2SH 3, Bech32 bc1) OR Worker Name (user.worker)
        // For simplicity in this miner context, we allow almost anything not XMR-like if length is reasonable
        // Real BTC addresses are 26-35 chars usually, or bc1 up to 90.
        // Worker names can be short.
        return len > 3 && len < 90;

      case 'RVN':
        // Ravencoin Logic
        const isBinance = poolHost && (poolHost.includes('binance.com') || poolHost.includes('poolbinance'));

        if (isBinance) {
          // Binance requires AccountName.WorkerName
          // Must have a dot, be alphanumeric, and reasonable length
          return cleanAddr.includes('.') && /^[a-zA-Z0-9.]+$/.test(cleanAddr) && len > 3;
        } else {
          // Standard RVN Address (starts with R, Base58)
          return /^R[1-9A-HJ-NP-Za-km-z]{33}$/.test(cleanAddr);
        }

      case 'CFX':
        // Conflux (cfx:...)
        return /^cfx:/.test(cleanAddr) || len > 30;

      case 'ERGO':
        // Ergo (starts with 9, ~51 chars)
        return /^9[1-9A-HJ-NP-Za-km-z]{45,55}$/.test(cleanAddr);

      case 'BNB':
      case 'ETH':
        // Ethereum/BSC (0x...)
        return /^0x[a-fA-F0-9]{40}$/.test(cleanAddr);

      case 'SOL':
        // Solana (Base58, 32-44 chars)
        return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(cleanAddr);

      default:
        // Generic fallback for unknown coins
        return len > 20;
    }
  }

  /**
   * Heuristic to detect and fix double-pasted addresses (e.g. 4AB...4AB...)
   * @param address The potentially corrupted address
   * @returns The fixed address or the original if no issue detected
   */
  static fixDoublePaste(address: string): string {
    if (!address || address.length < 20) return address; // Too short to be a double paste of a valid crypto address usually

    // Must be even length to be a perfect double paste
    if (address.length % 2 !== 0) return address;

    const half = address.length / 2;
    const firstHalf = address.substring(0, half);
    const secondHalf = address.substring(half);

    if (firstHalf === secondHalf) {
      return firstHalf;
    }

    return address;
  }
}
