"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MiningEngine = void 0;
const worker_threads_1 = require("worker_threads");
const os = require("os");
const IdleDetector_1 = require("./IdleDetector");
class MiningEngine {
    workers = [];
    idleDetector;
    numCores = os.cpus().length;
    constructor() {
        this.idleDetector = new IdleDetector_1.IdleDetector();
        this.idleDetector.on('change', (isIdle) => this.handleStateChange(isIdle));
    }
    start() {
        console.log(`🚀 Iniciando Engine com ${this.numCores} núcleos disponíveis.`);
        this.idleDetector.start();
        this.spawnWorkers(this.numCores); // Inicia com tudo (assumindo o início como teste)
    }
    spawnWorkers(count) {
        this.stopWorkers();
        console.log(`🔨 Criando ${count} threads de mineração...`);
        for (let i = 0; i < count; i++) {
            const worker = new worker_threads_1.Worker('./src/MinerWorker.ts', {
                workerData: { id: i }
            });
            this.workers.push(worker);
        }
    }
    stopWorkers() {
        this.workers.forEach(w => w.terminate());
        this.workers = [];
    }
    handleStateChange(isIdle) {
        if (isIdle) {
            console.log("🌙 Sistema ocioso. Liberando potência TOTAL!");
            this.spawnWorkers(this.numCores);
        }
        else {
            console.log("⚡ Sistema em uso. Reduzindo carga para não travar.");
            this.spawnWorkers(1); // Deixa apenas 1 núcleo rodando
        }
    }
}
exports.MiningEngine = MiningEngine;
//# sourceMappingURL=MiningEngine.js.map