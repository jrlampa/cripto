import { describe, it, expect } from 'vitest';
import { AddressValidator } from '../src/services/AddressValidator';

describe('AddressValidator', () => {
  describe('fixDoublePaste', () => {
    it('should fix a double pasted address', () => {
      const addr = '4AB1234AB1234AB1234A'; // 20 chars
      const double = addr + addr;
      expect(AddressValidator.fixDoublePaste(double)).toBe(addr);
    });

    it('should return original if not double pasted', () => {
      const addr = '4AB123C';
      expect(AddressValidator.fixDoublePaste(addr)).toBe(addr);
    });

    it('should ignore short strings', () => {
      const short = 'abcabc'; // Length 6, too short for trigger (< 20)
      expect(AddressValidator.fixDoublePaste(short)).toBe(short);
    });
  });

  describe('validate', () => {
    it('should validate Monero addresses', () => {
      // Mock valid XMR (starts with 4, len ~95)
      const validXMR = '4' + '1'.repeat(94);
      expect(AddressValidator.validate('XMR', validXMR)).toBe(true);

      // Invalid start
      const invalidStart = '1' + '1'.repeat(94);
      expect(AddressValidator.validate('XMR', invalidStart)).toBe(false);

      // Too short
      const short = '4' + '1'.repeat(10);
      expect(AddressValidator.validate('XMR', short)).toBe(false);
    });

    it('should validate Zephyr addresses', () => {
      const validZEPH = 'ZEPH' + '1'.repeat(90);
      expect(AddressValidator.validate('ZEPH', validZEPH)).toBe(true);

      const invalidZEPH = 'XMR' + '1'.repeat(90);
      expect(AddressValidator.validate('ZEPH', invalidZEPH)).toBe(false);
    });

    it('should validate Ravencoin addresses', () => {
      // Standard R... (No pool context)
      const validRVN = 'R' + 'a'.repeat(33); // 34 chars
      expect(AddressValidator.validate('RVN', validRVN)).toBe(true);

      // Standard R... (Non-Binance pool context)
      expect(AddressValidator.validate('RVN', validRVN, 'rvn.2miners.com')).toBe(true);

      // Binance Context: REJECT standard address
      expect(AddressValidator.validate('RVN', validRVN, 'rvn.poolbinance.com')).toBe(false);

      // Binance Context: ACCEPT Account.Worker
      const binanceWorker = 'myuser.worker1';
      expect(AddressValidator.validate('RVN', binanceWorker, 'rvn.poolbinance.com')).toBe(true);

      // Binance Context: REJECT invalid worker (no dot)
      expect(AddressValidator.validate('RVN', 'justuser', 'rvn.poolbinance.com')).toBe(false);

      // Binance Context: REJECT invalid worker (symbols)
      expect(AddressValidator.validate('RVN', 'user#name.worker', 'rvn.poolbinance.com')).toBe(false);
    });

    it('should validate ETH/BNB addresses', () => {
      const validETH = '0x' + '0'.repeat(40);
      expect(AddressValidator.validate('ETH', validETH)).toBe(true);

      const invalidETH = '0x' + '0'.repeat(39); // Too short
      expect(AddressValidator.validate('ETH', invalidETH)).toBe(false);
    });
  });
});
