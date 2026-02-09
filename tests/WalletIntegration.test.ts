import { describe, it, expect, beforeEach } from 'vitest';
import { WalletService } from '../src/WalletService';
import * as fs from 'fs';
import * as path from 'path';

describe('WalletIntegration Flow', () => {
  let wallet: WalletService;
  const walletPath = path.join(process.cwd(), 'wallet.json');

  beforeEach(() => {
    // Limpa o arquivo de carteira para começar do zero
    if (fs.existsSync(walletPath)) fs.unlinkSync(walletPath);
    wallet = new WalletService();
  });

  it('should initialize with real Binance addresses for BNB, SOL, ETH', () => {
    const bnbAddr = wallet.getAddressForCoin('BNB');
    const solAddr = wallet.getAddressForCoin('SOL');
    const ethAddr = wallet.getAddressForCoin('ETH');

    expect(bnbAddr).toBe('0x92768a234F7Fa9DD71d23734796cd66cEA33Fd38');
    expect(solAddr).toBe('69hDTBTfsGZpHLZoJZhdzmBpziPMGCHaX9Rn2LmJSxuR');
    expect(ethAddr).toBe('0x92768a234F7Fa9DD71d23734796cd66cEA33Fd38');
  });

  it('should validate addresses correctly for different networks', () => {
    // Simulating index.ts validation logic (would be better if exported, but we can test the patterns)
    const validate = (coin: string, addr: string): boolean => {
      if (coin === 'XMR') return /^[48]/.test(addr) && addr.length > 90;
      if (coin === 'ZEPH') return /^ZEPH/.test(addr);
      if (coin === 'BNB' || coin === 'ETH') return /^0x[a-fA-F0-9]{40}$/.test(addr);
      if (coin === 'SOL') return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
      return addr.length > 5;
    };

    expect(validate('BNB', wallet.getAddressForCoin('BNB'))).toBe(true);
    expect(validate('SOL', wallet.getAddressForCoin('SOL'))).toBe(true);
    expect(validate('ETH', wallet.getAddressForCoin('ETH'))).toBe(true);
    expect(validate('XMR', 'invalid')).toBe(false);
  });

  it('should maintain session data and cumulative profit', () => {
    wallet.updateLifetimeStats(10.5, 2.0); // R$ 10.50 profit, R$ 2.0 cost
    const info = wallet.getWalletInfo('BNB');
    expect(info.lifetimeMined).toBe(10.5);

    // Simulate restart
    const wallet2 = new WalletService();
    const info2 = wallet2.getWalletInfo('BNB');
    expect(info2.lifetimeMined).toBe(10.5); // Should persist
  });
});
