export declare class Block {
    index: number;
    timestamp: number;
    data: string;
    previousHash: string;
    hash: string;
    nonce: number;
    constructor(index: number, timestamp: number, data: string, previousHash?: string);
    calculateHash(): string;
    mineBlock(difficulty: number): void;
}
//# sourceMappingURL=Block.d.ts.map