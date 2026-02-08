import { parentPort, workerData } from 'worker_threads';
import * as crypto from 'crypto';
import { randomx_init_cache, randomx_create_vm } from 'randomx.js';

let currentJob: any = null;
let isPaused = false;
let rxCache: any = null;
let rxVM: any = null;
let currentSeedHash: string = '';

parentPort?.on('message', (msg) => {
  if (msg.type === 'job') {
    currentJob = msg.job;
    // Se o seed_hash mudou, precisamos reinicializar a VM do RandomX (caro!)
    if (currentJob.seed_hash && currentJob.seed_hash !== currentSeedHash) {
      currentSeedHash = currentJob.seed_hash;
      try {
        parentPort?.postMessage({ type: 'log', message: `Inicializando RandomX com Seed: ${currentSeedHash.substring(0, 8)}...` });
        // Inicializa cache no modo Light (256MB)
        // CRÍTICO: Converter hex string para Buffer para garantir a chave correta
        const seedBuffer = Buffer.from(currentSeedHash, 'hex');
        rxCache = randomx_init_cache(seedBuffer);
        rxVM = randomx_create_vm(rxCache);
        parentPort?.postMessage({ type: 'log', message: `RandomX (WASM) inicializado com sucesso!` });
      } catch (e) {
        parentPort?.postMessage({ type: 'log', message: `Erro ao inicializar RandomX: ${e}` });
      }
    }
  } else if (msg.type === 'pause') {
    isPaused = true;
  } else if (msg.type === 'resume') {
    isPaused = false;
  }
});

function hexToUint8Array(hex: string): Uint8Array {
  return new Uint8Array(Buffer.from(hex, 'hex'));
}

function uint8ArrayToHex(arr: Uint8Array): string {
  return Buffer.from(arr).toString('hex');
}

let hashesSinceLastReport = 0;

// Reporta hashrate a cada 2 segundos
setInterval(() => {
  if (hashesSinceLastReport > 0) {
    parentPort?.postMessage({
      type: 'hashrate',
      hashrate: hashesSinceLastReport / 2
    });
    hashesSinceLastReport = 0;
  }
}, 2000);

/**
 * Função principal de mineração
 */
function mine() {
  if (!isPaused && currentJob && rxVM) {
    const blob = hexToUint8Array(currentJob.blob);
    // Gerar um nonce aleatório de 4 bytes na posição correta do blob (offset 39)
    const nonce = crypto.randomBytes(4);
    blob.set(nonce, 39);

    try {
      // Cálculo REAL do RandomX
      const result = rxVM.calculate_hash(blob);
      hashesSinceLastReport++;

      const hashStr = uint8ArrayToHex(result);

      // No Stratum Monero, o target costuma ser uma string hexadecimal (ex: "00000000ffffffff...")
      if (checkDifficulty(result, currentJob.target)) {
        parentPort?.postMessage({
          type: 'submit',
          jobId: currentJob.job_id,
          nonce: nonce.toString('hex'),
          result: hashStr
        });
      }
    } catch (e) {
      // Ignora erros temporários da VM
    }
  }

  // SetImmediate para não bloquear o loop de eventos
  setImmediate(mine);
}

/**
 * Verifica se o hash gerado atende à dificuldade alvo
 */
function checkDifficulty(hash: Uint8Array, targetHex: string): boolean {
  if (!targetHex) return false;

  try {
    // 1. Converter Hash (Little-Endian do RandomX) para BigInt (Big-Endian)
    const hashHex = Buffer.from(hash).reverse().toString('hex');
    const hashVal = BigInt('0x' + hashHex);

    // 2. Ajustar Target da Pool
    // O target (ex: "f3220000") é Little-Endian. Precisamos reverter para Big-Endian para comparação numérica correta.
    // "f3220000" LE -> "000022f3" BE. Isso força o Hash a ser pequeno (iniciar com zeros).
    const targetRev = Buffer.from(targetHex, 'hex').reverse().toString('hex');

    // Expandir para 32 bytes. 'f' padding é o "teto" da dificuldade (safety margin).
    const paddedTarget = targetRev.padEnd(64, 'f');
    const targetVal = BigInt('0x' + paddedTarget);

    // Debug periódico (1% das vezes)
    if (Math.random() < 0.01) {
      const msg = `[DiffCheck] Hash:${hashHex.substring(0, 8)}.. < Tgt:${paddedTarget.substring(0, 8)}.. = ${hashVal < targetVal}`;
      parentPort?.postMessage({ type: 'log', message: msg });
    }

    // 3. Comparação: Para um share ser válido, Hash < Target
    return hashVal < targetVal;
  } catch (e) {
    parentPort?.postMessage({ type: 'log', message: `Erro no checkDifficulty: ${e}` });
    return false;
  }
}

mine();
