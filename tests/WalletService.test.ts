import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WalletService } from '../src/WalletService';
import * as fs from 'fs';
import * as os from 'os';

vi.mock('fs');
vi.mock('axios');

describe('WalletService', () => {
  const mockWalletData = {
    address: '4address123',
    addresses: {
      XMR: '4address123',
      BTC: '1btc-address',
      BNB: '0x92768a234F7Fa9DD71d23734796cd66cEA33Fd38'
    },
    mnemonic_encrypted: {
      iv: '0123456789abcdef0123456789abcdef',
      content: 'deadbeef'
    },
    sessions: 5,
    lifetimeMined: 10,
    lifetimeCost: 2
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-ignore - Mocking private method for test stability
    vi.spyOn(WalletService.prototype, 'decrypt').mockReturnValue('mocked-mnemonic');
  });

  it('should initialize and load data if wallet.json exists', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockWalletData));

    // Desabilitamos o decrypt real para evitar erros de padding no mock 'deadbeef'
    // Ou melhor, deixamos rodar mas esperamos que ele tente descriptografar.
    // Como o 'secretKey' depende do hostname, o decrypt de um 'content' aleatório vai falhar.

    const service = new WalletService();
    const info = service.getWalletInfo();

    expect(info.address).toBe('4address123');
    expect(info.sessions).toBe(5);
  });

  it('should generate a new wallet if none exists', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    const writeSpy = vi.spyOn(fs, 'writeFileSync');

    const service = new WalletService();
    const info = service.getWalletInfo();

    expect(info.address).toMatch(/^4/);
    expect(writeSpy).toHaveBeenCalled();
  });

  it('should correctly increment sessions', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    const service = new WalletService();
    const initialSessions = service.getWalletInfo().sessions;

    service.incrementSession();
    expect(service.getWalletInfo().sessions).toBe(initialSessions + 1);
  });
});
