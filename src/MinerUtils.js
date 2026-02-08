"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MinerUtils = void 0;
const crypto = require("crypto");
class MinerUtils {
    /**
     * Double SHA256 hashing (SHA256d)
     */
    static sha256d(buffer) {
        const hash1 = crypto.createHash('sha256').update(buffer).digest();
        return crypto.createHash('sha256').update(hash1).digest();
    }
    /**
     * Reverse byte order (Endianness conversion)
     */
    static reverseBytes(buffer) {
        const reversed = Buffer.allocUnsafe(buffer.length);
        for (let i = 0; i < buffer.length; i++) {
            reversed[i] = buffer[buffer.length - 1 - i];
        }
        return reversed;
    }
    /**
     * Convert hex string to reversed Buffer
     */
    static hexToReversedBuffer(hex) {
        return this.reverseBytes(Buffer.from(hex, 'hex'));
    }
}
exports.MinerUtils = MinerUtils;
//# sourceMappingURL=MinerUtils.js.map