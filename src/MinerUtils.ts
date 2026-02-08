import * as crypto from 'crypto';

export class MinerUtils {
  /**
   * Double SHA256 hashing (SHA256d)
   */
  public static sha256d(buffer: Buffer): Buffer {
    const hash1 = crypto.createHash('sha256').update(buffer).digest();
    return crypto.createHash('sha256').update(hash1).digest();
  }

  /**
   * Reverse byte order (Endianness conversion)
   */
  public static reverseBytes(buffer: Buffer): Buffer {
    const reversed = Buffer.allocUnsafe(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      reversed[i] = buffer[buffer.length - 1 - i]!;
    }
    return reversed;
  }

  /**
   * Convert hex string to reversed Buffer
   */
  public static hexToReversedBuffer(hex: string): Buffer {
    return this.reverseBytes(Buffer.from(hex, 'hex'));
  }
}
