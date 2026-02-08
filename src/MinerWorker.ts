import { parentPort, workerData } from 'worker_threads';
import * as crypto from 'crypto';

/**
 * Nota: Simulação de carga de CPU para Monero. 
 * Em uma implementação real, usaríamos uma biblioteca nativa do RandomX.
 */
let isPaused = false;

parentPort?.on('message', (msg) => {
  if (msg === 'pause') isPaused = true;
  if (msg === 'resume') isPaused = false;
});

function mine() {
  if (!isPaused) {
    // Simula trabalho pesado de CPU com múltiplas iterações
    for (let i = 0; i < 1000; i++) {
      const nonce = Math.random().toString();
      crypto.createHash('sha256').update(nonce).digest('hex');
    }
  }

  // SetImmediate para permitir que o Node trate mensagens de pausa
  setImmediate(mine);
}

mine();
