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

const algorithm = workerData.algorithm || 'RandomX';

// Rate limiting logging and reporting variables
let lastReportTime = Date.now();
let hashesInInterval = 0;

/**
 * Função principal de mineração
 */
function mine() {
  if (algorithm === 'SHA256') {
    mineSHA256();
  } else {
    mineRandomX();
  }
}

function mineRandomX() {
  if (!isPaused && currentJob && rxVM) {
    const blob = hexToUint8Array(currentJob.blob);
    // Gerar um nonce aleatório de 4 bytes na posição correta do blob (offset 39)
    const nonce = crypto.randomBytes(4);
    blob.set(nonce, 39);

    try {
      // Cálculo REAL do RandomX
      const result = rxVM.calculate_hash(blob);
      hashesSinceLastReport++;
      hashesInInterval++;

      // Manual Loop Interval Check (Avoids Event Loop Starvation)
      const now = Date.now();
      if (now - lastReportTime >= 2000) {
        const deltaSeconds = (now - lastReportTime) / 1000;
        const currentHashrate = hashesInInterval / deltaSeconds;

        parentPort?.postMessage({
          type: 'hashrate',
          hashrate: currentHashrate
        });

        lastReportTime = now;
        hashesInInterval = 0;
      }

      // Log de atividade periódica para RandomX (XMR)
      if (hashesSinceLastReport % 1000 === 0) {
        parentPort?.postMessage({ type: 'log', message: `⛏️ RandomX: Calculando hashes... (${hashesSinceLastReport} total na sessão)` });
      }

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
  setImmediate(mine);
}

function mineSHA256() {
  if (!isPaused && currentJob) {
    // SHA256 Job typically: version, prevhash, merkel_root, ntime, nbits
    // For simulation/educational purposes on CPU (BTC mining on CPU is impossible today),
    // we will implement a basic double-sha256 header hash.
    // However, standard Stratum BTC jobs require constructing the block header from portions.
    // Simplified Logic: Just hash a changing nonce.

    // Construct Header (mockup for CPU simulation)
    // In real BTC stratum: Header = Version + PrevHash + MerkleRoot + Time + NBits + Nonce
    const nonce = crypto.randomBytes(4);

    // Mock header construction (80 bytes)
    const header = Buffer.alloc(80);
    header.fill(0);
    // ... fill header parts from currentJob if available ...
    header.set(nonce, 76); // Nonce is last 4 bytes

    const hash1 = crypto.createHash('sha256').update(header).digest();
    const hash2 = crypto.createHash('sha256').update(hash1).digest();

    hashesSinceLastReport++;
    hashesInInterval++;

    const now = Date.now();
    if (now - lastReportTime >= 2000) {
      const deltaSeconds = (now - lastReportTime) / 1000;
      const currentHashrate = hashesInInterval / deltaSeconds;

      parentPort?.postMessage({
        type: 'hashrate',
        hashrate: currentHashrate
      });

      lastReportTime = now;
      hashesInInterval = 0;
    }

    // Log de atividade periódica (aproximadamente a cada 1.000.000 hashes)
    if (hashesSinceLastReport % 1000000 === 0) {
      parentPort?.postMessage({ type: 'log', message: `⛏️ SHA256: Procura em andamento... (${hashesSinceLastReport} total na sessão)` });
    }
  } else if (!isPaused) {
    // Para algoritmos ainda não implementados 100% (ERGO, CFX, RVN),
    // simulamos a "procura" para que o TUI mostre que está ativo.
    hashesSinceLastReport++;
    if (hashesSinceLastReport % 1000000 === 0) {
      parentPort?.postMessage({ type: 'log', message: `⛏️ ${algorithm}: Simulação em andamento... (${hashesSinceLastReport} total na sessão)` });
    }
  }
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
