"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const worker_threads_1 = require("worker_threads");
const crypto = require("crypto");
/**
 * Nota: Simulação de carga de CPU para Monero.
 * Em uma implementação real, usaríamos uma biblioteca nativa do RandomX.
 */
let isPaused = false;
worker_threads_1.parentPort?.on('message', (msg) => {
    if (msg === 'pause')
        isPaused = true;
    if (msg === 'resume')
        isPaused = false;
});
function mine() {
    if (!isPaused) {
        // Simula trabalho pesado de CPU
        const nonce = Math.random().toString();
        crypto.createHash('sha256').update(nonce).digest('hex');
    }
    // SetImmediate para permitir que o Node trate mensagens de pausa
    setImmediate(mine);
}
mine();
//# sourceMappingURL=MinerWorker.js.map