import { describe, it, expect } from 'vitest';
import { MinerUtils } from '../src/MinerUtils';

describe('MinerUtils', () => {
  it('should generate a valid SHA-256d hash', () => {
    const input = Buffer.from('hello');
    const hash = MinerUtils.sha256d(input);
    expect(hash).toBeDefined();
    expect(hash.length).toBe(32);

    // Teste de valor conhecido (se possível)
    const knownInput = Buffer.from('abc');
    const knownHash = MinerUtils.sha256d(knownInput);
    // sha256(sha256('abc'))
    const actualHash = '4f8b42c22dd3729b519ba6f68d2da7cc5b2d606d05daed5ad5128cc03e6c6358';
    expect(knownHash.toString('hex')).toBe(actualHash);
  });

  it('should reverse bytes correctly', () => {
    const input = Buffer.from([0x01, 0x02, 0x03, 0x04]);
    const reversed = MinerUtils.reverseBytes(input);
    expect(reversed[0]).toBe(0x04);
    expect(reversed[3]).toBe(0x01);
  });
});
