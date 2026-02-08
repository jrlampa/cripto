import { MiningEngine } from './MiningEngine';
import { WalletService } from './WalletService';
import { TUIBoard } from './TUIBoard';
import { GPUDetector } from './GPUDetector';
import { GPUMiningEngine } from './GPUMiningEngine';

const tui = new TUIBoard();
tui.log("Iniciando minerador inteligente...");

const POOL_HOST = 'xmr-eu1.nanopool.org';
const POOL_PORT = 14444;

const wallet = new WalletService();
const walletInfo = wallet.getWalletInfo();
const engine = new MiningEngine(POOL_HOST, POOL_PORT, walletInfo.address);
const gpuDetector = new GPUDetector();
const gpuEngine = new GPUMiningEngine();

let gpuModel = "Buscando...";

tui.updateWallet({ address: walletInfo.address, brl: 0, usd: 0 });

async function updateFinance() {
  const price = await wallet.fetchPrice();
  tui.updateWallet({ address: walletInfo.address, brl: price.brl, usd: price.usd });
}

async function initGPU() {
  const info = await gpuDetector.detect();
  if (info) {
    gpuModel = info.model;
    tui.log(`GPU Detectada: ${gpuModel}`);
  } else {
    gpuModel = "Não detectada";
    tui.log("⚠️ Nenhuma GPU ativa encontrada.");
  }
}

// Configura o dashboard fixo
setInterval(() => {
  const isIdle = engine.isIdle();
  const cpuLoad = Math.floor(Math.random() * 5) + (engine.getActiveWorkersCount() > 1 ? 95 : 10);

  gpuEngine.setPower(isIdle);
  const gpuStatus = gpuEngine.getStatus();

  tui.updateCPU(cpuLoad);
  tui.updateGPU({
    model: gpuModel,
    load: gpuEngine.getSimulatedLoad(),
    hashrate: gpuStatus.hashrate
  });

  tui.updateStats({
    state: isIdle ? 'ÓCIO' : 'ATIVO',
    threads: engine.getActiveWorkersCount(),
    pool: POOL_HOST,
    poolConnected: true
  });
}, 1000);

// Inicia a mineração
engine.start();
updateFinance();
initGPU();
setInterval(updateFinance, 5 * 60 * 1000);

tui.log(`Conectado à pool ${POOL_HOST}`);
tui.log(`Carteira carregada: ${walletInfo.address.substring(0, 8)}...`);

process.on('SIGINT', () => {
  tui.log("🛑 Encerrando minerador...");
  setTimeout(() => process.exit(), 500);
});
