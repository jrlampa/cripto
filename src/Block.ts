import * as crypto from 'crypto';

export class Block {
  public hash: string;
  public nonce: number = 0;

  constructor(
    public index: number,
    public timestamp: number,
    public data: string,
    public previousHash: string = ''
  ) {
    this.hash = this.calculateHash();
  }

  public calculateHash(): string {
    const dataString = this.index + this.previousHash + this.timestamp + JSON.stringify(this.data) + this.nonce;
    return crypto
      .createHash('sha256')
      .update(dataString)
      .digest('hex');
  }

  public mineBlock(difficulty: number): void {
    const target = Array(difficulty + 1).join('0');

    console.log(`🔨 Minerando bloco ${this.index}...`);

    while (this.hash.substring(0, difficulty) !== target) {
      this.nonce++;
      this.hash = this.calculateHash();
    }

    console.log(`✅ Bloco minerado! Hash: ${this.hash}`);
  }
}
