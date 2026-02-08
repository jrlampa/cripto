import { MiningEngine } from './MiningEngine';
import { WalletService } from './WalletService';
import { TUIBoard } from './TUIBoard';
import { GPUDetector } from './GPUDetector';
import { GPUMiningEngine } from './GPUMiningEngine';
import { ProfitabilityService } from './ProfitabilityService';

const tui = new TUIBoard();
tui.log("Iniciando minerador inteligente...");

const POOL_HOST = 'xmr-eu1.nanopool.org';
const POOL_PORT = 14444;

const wallet = new WalletService();
const walletInfo = wallet.getWalletInfo();
const engine = new MiningEngine(POOL_HOST, POOL_PORT, walletInfo.address);
const gpuDetector = new GPUDetector();
const gpuEngine = new GPUMiningEngine();
const profitService = new ProfitabilityService();

let gpuModel = "Buscando...";
let lastPrice = { brl: 0, usd: 0 };
let lastUpdateTime = Date.now();

tui.updateWallet({ address: walletInfo.address, brl: 0, usd: 0 });

async function updateFinance() {
  lastPrice = await wallet.fetchPrice();
  tui.updateWallet({
    address: walletInfo.address,
    brl: lastPrice.brl,
    usd: lastPrice.usd
  });
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

let progress = 0;

// Redireciona logs para o TUI para manter a tela limpa
const originalLog = console.log;
console.log = (...args) => tui.log(args.join(' '));

// Configura o dashboard fixo
setInterval(() => {
  const now = Date.now();
  const deltaMs = now - lastUpdateTime;
  lastUpdateTime = now;

  const isIdle = engine.isIdle();
  const cpuLoad = Math.floor(Math.random() * 5) + (engine.getActiveWorkersCount() > 1 ? 95 : 10);
  const engineStats = engine.getStats();

  gpuEngine.setPower(isIdle);
  const gpuStatus = gpuEngine.getStatus();
  const currentGpuLoad = gpuEngine.getSimulatedLoad();

  // Atualiza Financeiro Real-time
  profitService.update(cpuLoad, currentGpuLoad, engineStats.job ? cpuLoad + gpuStatus.hashrate : 0, lastPrice.brl, deltaMs);
  const finance = profitService.getFinanceReport();

  tui.updateCPU(cpuLoad);
  tui.updateGPU({
    model: gpuModel,
    load: currentGpuLoad,
    hashrate: gpuStatus.hashrate
  });

  tui.updateStats({
    state: isIdle ? 'ÓCIO' : 'ATIVO',
    threads: engine.getActiveWorkersCount(),
    pool: POOL_HOST,
    poolConnected: true,
    shares: engineStats.shares,
    difficulty: engineStats.difficulty
  });

  tui.updateWallet({
    address: walletInfo.address,
    brl: lastPrice.brl,
    usd: lastPrice.usd,
    energyCost: finance.cost,
    minedValue: finance.revenue,
    sessions: wallet.getWalletInfo().sessions,
    totalMined: wallet.getWalletInfo().initialMined,
    totalCost: wallet.getWalletInfo().initialCost,
    xmr: finance.xmr,
    initialXMR: wallet.getWalletInfo().initialXMR,
    minPayout: finance.minPayout
  });

  // Simulação de progresso do job
  progress += Math.floor(Math.random() * 3) + 1;
  if (progress > 100) progress = 0;
  tui.updateProgress(progress);
}, 1000);

// Salvamento periódico (Auto-save) a cada 30 segundos
setInterval(() => {
  const finance = profitService.getFinanceReport();
  wallet.updateLifetimeStats(finance.revenue, finance.cost, finance.xmr);
}, 30000);

// Inicia a mineração
wallet.incrementSession(); // Incrementa contador de sessões
engine.start();
updateFinance();
initGPU();
setInterval(updateFinance, 5 * 60 * 1000);

tui.log(`Conectado à pool ${POOL_HOST}`);
tui.log(`Carteira carregada: ${walletInfo.address.substring(0, 8)}... | Sessão #${wallet.getWalletInfo().sessions}`);

function handleExit() {
  originalLog("\n🛑 Encerrando minerador e salvando progresso...");
  const finance = profitService.getFinanceReport();
  wallet.updateLifetimeStats(finance.revenue, finance.cost, finance.xmr);

  // Pequena espera para garantir o flush do arquivo
  setTimeout(() => {
    originalLog("✅ Progresso salvo com sucesso. Até logo!");
    process.exit(0);
  }, 800);
}

tui.on('exit', handleExit);
process.on('SIGINT', handleExit);
