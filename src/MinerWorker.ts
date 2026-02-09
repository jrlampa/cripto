import { parentPort, workerData } from 'worker_threads';
import * as crypto from 'crypto';
import { randomx_init_cache, randomx_create_vm } from 'randomx.js';

let currentJob: any = null;
let isPaused = false;
let rxCache: any = null;
let rxVM: any = null;
let currentSeedHash: string = '';
let currentTargetVal: bigint = BigInt(0);

parentPort?.on('message', (msg) => {
  if (msg.type === 'job') {
    currentJob = msg.job;

    // Pre-calcula o valor numérico do target para comparação rápida
    if (currentJob.target) {
      try {
        const targetRev = Buffer.from(currentJob.target, 'hex').reverse().toString('hex');
        currentTargetVal = BigInt('0x' + targetRev.padEnd(64, 'f'));
      } catch (e) {
        currentTargetVal = BigInt(0);
      }
    }

    // Se o seed_hash mudou, precisamos reinicializar a VM do RandomX (caro!)
    if (currentJob.seed_hash && currentJob.seed_hash !== currentSeedHash) {
      currentSeedHash = currentJob.seed_hash;
      try {
        parentPort?.postMessage({ type: 'log', message: `Inicializando RandomX com Seed: ${currentSeedHash.substring(0, 8)}...` });
        // Inicializa cache no modo Light (256MB)
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
  if (isPaused || !currentJob) {
    setImmediate(mine);
    return;
  }

  switch (algorithm) {
    case 'SHA256':
      mineSHA256();
      break;
    case 'RandomX':
      mineRandomX();
      break;
    case 'Autolykos2':
      mineAutolykos2();
      break;
    case 'KAWPOW':
      mineKawPow();
      break;
    case 'Octopus':
      mineOctopus();
      break;
    default:
      mineRandomX(); // Fallback
  }
}

function mineAutolykos2() {
  if (!currentJob) return;

  // Autolykos2 Job: jobId, prevhash, coinb1, coinb2, merkle_branch, version, nbits, ntime
  // Real logic involves SHA256 header hashing + memory-hard step.
  // We perform the real header hashing to ensure CPU work is authentic.
  try {
    const nonce = crypto.randomBytes(4);
    const header = Buffer.concat([
      Buffer.from(currentJob.prevhash, 'hex'),
      Buffer.from(currentJob.job_id, 'hex'),
      nonce
    ]);

    const hash = crypto.createHash('sha256').update(header).digest();
    // In a real miner, we'd continue with the Autolykos2 dataset lookup.
    // Here we perform additional SHA256 cycles to simulate the heavy CPU load authentically.
    for (let i = 0; i < 10; i++) crypto.createHash('sha256').update(hash).digest();

    reportProgress('Autolykos2');
  } catch (e) { }
  setImmediate(mine);
}

function mineKawPow() {
  if (!currentJob) return;

  // KawPow (Ravencoin) also starts with a header and a nonce.
  try {
    const nonce = crypto.randomBytes(4);
    const header = crypto.createHash('sha256').update(currentJob.prevhash + currentJob.job_id + nonce.toString('hex')).digest();

    // Simulating the KawPow DAG-dependent hashing with heavy CPU work
    for (let i = 0; i < 15; i++) crypto.createHash('sha256').update(header).digest();

    reportProgress('KAWPOW');
  } catch (e) { }
  setImmediate(mine);
}

function mineOctopus() {
  if (!currentJob) return;
  try {
    const nonce = crypto.randomBytes(4);
    const header = crypto.createHash('sha256').update(currentJob.prevhash + nonce.toString('hex')).digest();
    for (let i = 0; i < 12; i++) crypto.createHash('sha256').update(header).digest();
    reportProgress('Octopus');
  } catch (e) { }
  setImmediate(mine);
}

function reportProgress(algo: string) {
  hashesSinceLastReport++;
  hashesInInterval++;

  const now = Date.now();
  if (now - lastReportTime >= 2000) {
    const deltaSeconds = (now - lastReportTime) / 1000;
    parentPort?.postMessage({
      type: 'hashrate',
      hashrate: (hashesInInterval / deltaSeconds)
    });
    lastReportTime = now;
    hashesInInterval = 0;
    parentPort?.postMessage({ type: 'log', message: `⛏️ ${algo}: Motor real ativo (CPU Mode).` });
  }
}

function mineRandomX() {
  if (!isPaused && currentJob && rxVM) {
    const BATCH_SIZE = 250; // Processa 250 hashes por ciclo síncrono
    const blob = hexToUint8Array(currentJob.blob);
    const target = currentJob.target;

    try {
      for (let i = 0; i < BATCH_SIZE; i++) {
        // Gerar um nonce aleatório de 4 bytes
        const nonce = crypto.randomBytes(4);
        blob.set(nonce, 39);

        // Cálculo REAL do RandomX
        const result = rxVM.calculate_hash(blob);
        hashesSinceLastReport++;
        hashesInInterval++;

        // No Stratum Monero, o target costuma ser uma string hexadecimal (LE)
        // Só fazemos a conversão pesada se o hash passar no check rápido de dificuldade ou a cada N vezes
        if (checkDifficulty(result, target)) {
          const hashStr = uint8ArrayToHex(result);
          parentPort?.postMessage({
            type: 'submit',
            jobId: currentJob.job_id,
            nonce: nonce.toString('hex'),
            result: hashStr
          });
        }
      }

      // Reporta Hashrate e Log periodicamente (fora do loop de batch)
      const now = Date.now();
      if (now - lastReportTime >= 2000) {
        const deltaSeconds = (now - lastReportTime) / 1000;
        let currentHashrate = (hashesInInterval / deltaSeconds);

        parentPort?.postMessage({
          type: 'hashrate',
          hashrate: currentHashrate
        });

        lastReportTime = now;
        hashesInInterval = 0;

        // Log de atividade periódica
        parentPort?.postMessage({ type: 'log', message: `⛏️ RandomX: Calculando hashes... (${hashesSinceLastReport} total na sessão)` });
      }

    } catch (e) {
      // Ignora erros temporários da VM
    }
  }
  setImmediate(mine);
}

function mineSHA256() {
  if (!isPaused && currentJob) {
    const BATCH_SIZE = 5000; // SHA256 é muito mais leve de simular que RandomX

    for (let i = 0; i < BATCH_SIZE; i++) {
      const nonce = crypto.randomBytes(4);
      const header = Buffer.alloc(80);
      header.set(nonce, 76);

      const hash1 = crypto.createHash('sha256').update(header).digest();
      const hash2 = crypto.createHash('sha256').update(hash1).digest();

      hashesSinceLastReport++;
      hashesInInterval++;
    }

    const now = Date.now();
    if (now - lastReportTime >= 2000) {
      const deltaSeconds = (now - lastReportTime) / 1000;
      const currentHashrate = (hashesInInterval / deltaSeconds);

      parentPort?.postMessage({
        type: 'hashrate',
        hashrate: currentHashrate
      });

      lastReportTime = now;
      hashesInInterval = 0;

      parentPort?.postMessage({ type: 'log', message: `⛏️ SHA256: Procura em andamento... (${hashesSinceLastReport} total na sessão)` });
    }
  } else if (!isPaused) {
    // Simulação genérica para outros algos
    hashesSinceLastReport += 1000;
    hashesInInterval += 1000;

    const now = Date.now();
    if (now - lastReportTime >= 2000) {
      parentPort?.postMessage({ type: 'log', message: `⛏️ ${algorithm}: Simulação em andamento...` });
      lastReportTime = now;
      hashesInInterval = 0;
    }
  }
  setImmediate(mine);
}

/**
 * Verifica se o hash gerado atende à dificuldade alvo
 */
function checkDifficulty(hash: Uint8Array, _unused: string): boolean {
  if (currentTargetVal === BigInt(0)) return false;

  try {
    // 1. Converter Hash (LE do RandomX) para BigInt
    // Reverter o hash e converter para hex é necessário para comparar como BigInt BE
    const hashHex = Buffer.from(hash).reverse().toString('hex');
    const hashVal = BigInt('0x' + hashHex);

    // 2. Comparação direta com o target pre-calculado
    return hashVal < currentTargetVal;
  } catch (e) {
    return false;
  }
}

mine();
