"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Block = void 0;
const crypto = require("crypto");
class Block {
    index;
    timestamp;
    data;
    previousHash;
    hash;
    nonce = 0;
    constructor(index, timestamp, data, previousHash = '') {
        this.index = index;
        this.timestamp = timestamp;
        this.data = data;
        this.previousHash = previousHash;
        this.hash = this.calculateHash();
    }
    calculateHash() {
        const dataString = this.index + this.previousHash + this.timestamp + JSON.stringify(this.data) + this.nonce;
        return crypto
            .createHash('sha256')
            .update(dataString)
            .digest('hex');
    }
    mineBlock(difficulty) {
        const target = Array(difficulty + 1).join('0');
        console.log(`🔨 Minerando bloco ${this.index}...`);
        while (this.hash.substring(0, difficulty) !== target) {
            this.nonce++;
            this.hash = this.calculateHash();
        }
        console.log(`✅ Bloco minerado! Hash: ${this.hash}`);
    }
}
exports.Block = Block;
//# sourceMappingURL=Block.js.map