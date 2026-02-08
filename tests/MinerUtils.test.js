"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const MinerUtils_1 = require("../src/MinerUtils");
(0, vitest_1.describe)('MinerUtils', () => {
    (0, vitest_1.it)('should generate a valid SHA-256d hash', () => {
        const input = Buffer.from('hello');
        const hash = MinerUtils_1.MinerUtils.sha256d(input);
        (0, vitest_1.expect)(hash).toBeDefined();
        (0, vitest_1.expect)(hash.length).toBe(32);
        // Teste de valor conhecido (se possível)
        const knownInput = Buffer.from('abc');
        const knownHash = MinerUtils_1.MinerUtils.sha256d(knownInput);
        // sha256(sha256('abc'))
        const actualHash = '4f8b42c22dd3729b519ba6f68d2da7cc5b2d606d05daed5ad5128cc03e6c6358';
        (0, vitest_1.expect)(knownHash.toString('hex')).toBe(actualHash);
    });
    (0, vitest_1.it)('should reverse bytes correctly', () => {
        const input = Buffer.from([0x01, 0x02, 0x03, 0x04]);
        const reversed = MinerUtils_1.MinerUtils.reverseBytes(input);
        (0, vitest_1.expect)(reversed[0]).toBe(0x04);
        (0, vitest_1.expect)(reversed[3]).toBe(0x01);
    });
});
//# sourceMappingURL=MinerUtils.test.js.map