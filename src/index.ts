import { StratumClient } from './StratumClient';

console.log("🚀 Cripto Miner V2: Iniciando Conexão Stratum...");

// Exemplo: Conectando à pool do Braiins (antiga Slushpool) via porta de teste/geral
// Ou NiceHash para demonstração
const POOL_HOST = 'stratum.slushpool.com';
const POOL_PORT = 3333;
const WALLET_ADDRESS = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'; // Endereço do Bloco Gênesis para exemplo
const WORKER_NAME = 'antigravity_miner';

const miner = new StratumClient(POOL_HOST, POOL_PORT);

miner.on('connected', () => {
  console.log("📡 Solicitando assinatura (subscribe)...");
  miner.subscribe();
});

miner.on('response', (res) => {
  if (res.id === 1) {
    console.log("✅ Assinatura confirmada! Autorizando minerador...");
    miner.authorize(`${WALLET_ADDRESS}.${WORKER_NAME}`);
  } else if (res.id === 2) {
    if (res.result) {
      console.log("🎉 Minerador AUTORIZADO! Aguardando primeiro trabalho...");
    } else {
      console.error("❌ Falha na autorização:", res.error);
    }
  }
});

miner.on('job', (params) => {
  const [jobId, prevHash, coinb1, coinb2, merkleBranch, version, nbits, ntime, cleanJobs] = params;
  console.log(`\n💎 NOVO TRABALHO RECEBIDO!`);
  console.log(`🆔 Job ID: ${jobId}`);
  console.log(`🔗 Previous Hash: ${prevHash}`);
  console.log(`🕒 Time: ${ntime}`);
  console.log(`🎯 Bits: ${nbits}`);
  console.log(`-----------------------------------`);
  console.log("🔨 Iniciando processo de hashing em background...");
});

miner.on('error', (err) => {
  console.log("⚠️ Tentando reconectar em 5 segundos...");
  setTimeout(() => miner.connect(), 5000);
});

miner.connect();
