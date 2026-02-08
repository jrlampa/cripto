"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const MiningEngine_1 = require("./MiningEngine");
console.log("🚀 Cripto Miner V3 (Smart Mode): Iniciando...");
const engine = new MiningEngine_1.MiningEngine();
engine.start();
process.on('SIGINT', () => {
    console.log("🛑 Encerrando minerador...");
    process.exit();
});
//# sourceMappingURL=index.js.map