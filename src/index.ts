import { MiningEngine } from './MiningEngine';
import { WalletService } from './WalletService';
import { TUIBoard } from './TUIBoard';
import { GPUDetector } from './GPUDetector';
import { GPUSimulator } from './GPUSimulator';
import { ProfitabilityService } from './ProfitabilityService';
import { PoolService } from './PoolService';

const tui = new TUIBoard();

// Redireciona logs IMEDIATAMENTE para o TUI para manter a tela limpa
const originalLog = console.log;
console.log = (...args) => tui.log(args.join(' '));

tui.log("Iniciando minerador inteligente...");

const POOL_HOST = 'xmr-eu1.nanopool.org';
const POOL_PORT = 14444;

const wallet = new WalletService();
const walletInfo = wallet.getWalletInfo();
const engine = new MiningEngine(POOL_HOST, POOL_PORT, walletInfo.address);
const gpuDetector = new GPUDetector();
const gpuSim = new GPUSimulator();
const profitService = new ProfitabilityService();
const poolService = new PoolService(walletInfo.address);

let gpuModel = "Buscando...";
let lastPrice = { brl: 0, usd: 0 };
let lastUpdateTime = Date.now();
let lastPoolStats: any = null;

tui.updateWallet({ address: walletInfo.address, brl: 0, usd: 0 });

async function updateFinance() {
  lastPrice = await wallet.fetchPrice();
  tui.updateWallet({
    address: walletInfo.address,
    brl: lastPrice.brl,
    usd: lastPrice.usd
  });
}

async function updatePoolData() {
  const stats = await poolService.fetchStats();
  if (stats) {
    lastPoolStats = stats;
    tui.log(`Pool: Dados da Nanopool atualizados. Saldo: ${stats.balance} XMR`);
  }
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

// Configura o dashboard fixo
setInterval(() => {
  const now = Date.now();
  const deltaMs = now - lastUpdateTime;
  lastUpdateTime = now;

  const isIdle = engine.isIdle();
  const cpuLoad = Math.floor(Math.random() * 5) + (engine.getActiveWorkersCount() > 1 ? 95 : 10);
  const engineStats = engine.getStats();

  gpuSim.setPower(isIdle);
  const gpuStatus = gpuSim.getStatus();
  const currentGpuLoad = gpuSim.getSimulatedLoad();

  // Atualiza Financeiro Real-time
  const walletMeta = wallet.getWalletInfo();
  const totalHashrate = engineStats.job ? (engineStats.hashrate || 0) + gpuStatus.hashrate : 0;
  profitService.update(cpuLoad, currentGpuLoad, totalHashrate, lastPrice.brl, deltaMs);
  const finance = profitService.getFinanceReport((walletMeta.initialXMR || 0) + profitService.getFinanceReport().xmr);

  tui.updateCPU(cpuLoad);
  tui.updateGPU({
    model: gpuModel,
    load: currentGpuLoad,
    hashrate: gpuStatus.hashrate,
    isSimulated: gpuStatus.isSimulated
  });

  tui.updateStats({
    state: isIdle ? 'ÓCIO' : 'ATIVO',
    threads: engine.getActiveWorkersCount(),
    pool: POOL_HOST,
    poolConnected: true,
    shares: engineStats.shares,
    difficulty: engineStats.difficulty,
    isPaused: engine.isEnginePaused(),
    hashrate: engineStats.hashrate // Novo: passa hashrate da CPU
  });

  tui.updateWallet({
    address: walletInfo.address,
    brl: lastPrice.brl,
    usd: lastPrice.usd,
    energyCost: finance.cost,
    minedValue: finance.revenue,
    sessions: walletMeta.sessions,
    totalMined: walletMeta.initialMined,
    totalCost: walletMeta.initialCost,
    xmr: finance.xmr,
    initialXMR: walletMeta.initialXMR,
    minPayout: finance.minPayout,
    etaPayout: finance.etaPayout,
    eta1XMR: finance.eta1XMR
  });

  tui.updatePoolStats(lastPoolStats);

  // Simulação de progresso do job
  progress += Math.floor(Math.random() * 3) + 1;
  if (progress > 100) progress = 0;
  tui.updateProgress(progress);

  // Renderização final (batch)
  tui.render();
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
updatePoolData();
initGPU();
setInterval(updateFinance, 5 * 60 * 1000);
setInterval(updatePoolData, 5 * 60 * 1000);

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
tui.on('toggle_pause', () => engine.togglePause());
tui.on('increase_threads', () => engine.adjustThreads(1));
tui.on('decrease_threads', () => engine.adjustThreads(-1));

engine.on('share_accepted', (res) => {
  tui.log(`✅ {green-fg}Share aceito pela pool!{/green-fg} (Res: ${JSON.stringify(res.result)})`);
});

engine.on('share_rejected', (err) => {
  tui.log(`❌ {red-fg}Share rejeitado:{/red-fg} ${JSON.stringify(err)}`);
});

process.on('SIGINT', handleExit);
