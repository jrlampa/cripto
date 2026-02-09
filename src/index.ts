import { MiningEngine } from './MiningEngine';
import { WalletService } from './WalletService';
import { TUIBoard } from './TUIBoard';
import { GPUDetector } from './GPUDetector';
import { ProfitabilityService } from './ProfitabilityService';
import { NanopoolService, GenericPoolService, IPoolService } from './PoolService';
import { MainMenuTUI } from './MainMenuTUI';
import { InteractiveSetup } from './ui/InteractiveSetup';
import { MinerWrapper } from './services/MinerWrapper';

async function bootstrap() {
  // 1. Startup Menu
  const menu = new MainMenuTUI();
  const coinConfig = await menu.waitForSelection();

  // 2. Address Management
  const wallet = new WalletService();
  const setup = new InteractiveSetup(wallet);
  const { address, password: walletPassword } = await setup.ensureValidConfiguration(coinConfig);
  let walletInfo = wallet.getWalletInfo(coinConfig.symbol);

  // 3. Initialize Main Dashboard
  const tui = new TUIBoard(coinConfig.name, coinConfig.symbol, coinConfig.algorithm);

  // Redirect logs
  const originalLog = console.log;
  console.log = (...args: any[]) => tui.log(args.join(' '));

  tui.log(`Iniciando minerador de ${coinConfig.name} (${coinConfig.symbol})...`);

  const POOL_HOST = coinConfig.poolHost;
  const POOL_PORT = coinConfig.poolPort;

  if (process.stdin.isPaused()) {
    process.stdin.resume();
  }

  const isMineable = coinConfig.algorithm !== 'N/A (Liquid)';
  let engine: MiningEngine | null = null;
  const minerWrapper = new MinerWrapper();
  let useExternalMiner = false;

  let lastPoolStats: any = null;

  if (isMineable) {
    // Check for External Miner (Gminer) for KAWPOW/GPU (and Ergo/Conflux)
    const gpuAlgos = ['KAWPOW', 'Autolykos2', 'Octopus'];
    if (gpuAlgos.includes(coinConfig.algorithm) && minerWrapper.hasExternalMiner()) {
      tui.log(`🚀 Modo GPU Detectado: Iniciando Gminer externo para ${coinConfig.algorithm}...`);
      useExternalMiner = minerWrapper.startMiner({
        coin: coinConfig.symbol,
        algorithm: coinConfig.algorithm,
        poolUrl: `${POOL_HOST}:${POOL_PORT}`,
        user: walletInfo.address,
        pass: walletPassword
      },
        (msg) => tui.log(msg),
        (hashrate) => {
          // Mock engine stats or direct update
          if (lastPoolStats) lastPoolStats.hashrate = hashrate;
        });

      if (useExternalMiner) {
        tui.log(`✅ Gminer iniciado com sucesso.`);
      } else {
        tui.log(`⚠️ Falha ao iniciar Gminer. Revertendo para modo CPU.`);
      }
    }

    if (!useExternalMiner) {
      engine = new MiningEngine(POOL_HOST, POOL_PORT, walletInfo.address, coinConfig.algorithm, walletPassword, coinConfig.symbol);
    }
  } else {
    tui.log(`ℹ️ ${coinConfig.name} é uma moeda de liquidação (Liquid). Apenas acompanhando saldo/preço.`);
  }

  const gpuDetector = new GPUDetector();
  const profitService = new ProfitabilityService();

  // Select Pool Service Strategy
  let poolService: IPoolService;
  if (POOL_HOST.includes('nanopool.org')) {
    poolService = new NanopoolService(walletInfo.address);
    tui.setPoolName("Nanopool API");
  } else {
    poolService = new GenericPoolService();
    tui.setPoolName(`Generic/Custom (${POOL_HOST})`);
  }

  let gpuModel = "Buscando...";
  let lastPrice = { brl: 0, usd: 0 };
  let lastUpdateTime = Date.now();
  // let lastPoolStats initialized above to be in scope for callback

  tui.updateWallet({ address: walletInfo.address, brl: 0, usd: 0 });

  async function updateFinance() {
    lastPrice = await wallet.fetchPrice(coinConfig.symbol);
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
      const poolTotalXMR = stats.balance + stats.unconfirmedBalance;
      tui.log(`Pool: Dados recebidos. Saldo: ${poolTotalXMR.toFixed(6)} ${coinConfig.symbol}`);

      const walletMeta = wallet.getWalletInfo(coinConfig.symbol);
      if (walletMeta.lifetimeMined === 0 && poolTotalXMR > 0 && lastPrice.brl > 0) {
        const syncedRevenue = poolTotalXMR * lastPrice.brl;
        wallet.updateLifetimeStats(syncedRevenue, walletMeta.lifetimeCost, poolTotalXMR);
        tui.log(`💰 Sincronizando ganhos iniciais da Pool: R$ ${syncedRevenue.toFixed(2)}`);
      }
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

    const isIdle = engine ? engine.isIdle() : false;
    const currentActiveWorkers = engine ? engine.getActiveWorkersCount() : 0;
    const cpuLoad = Math.floor(Math.random() * 5) + (currentActiveWorkers > 1 ? 95 : 10);
    const engineStats = engine ? engine.getStats() : { shares: 0, difficulty: 0, job: null, hashrate: 0 };

    const walletMeta = wallet.getWalletInfo(coinConfig.symbol);
    const totalHashrate = engineStats.job ? (engineStats.hashrate || 0) : 0;
    const poolHashrate = (lastPoolStats && lastPoolStats.hashrate) ? lastPoolStats.hashrate : 0;

    profitService.update(cpuLoad, 0, totalHashrate, lastPrice.brl, deltaMs, walletMeta.energyCost, coinConfig.symbol, engineStats.difficulty, poolHashrate);

    const finance = profitService.getFinanceReport((walletMeta.initialXMR || 0) + profitService.getFinanceReport().xmr);

    if (lastPoolStats) {
      const poolTotal = lastPoolStats.balance + lastPoolStats.unconfirmedBalance;
    }

    let state = 'AGUARDANDO OCIOSIDADE';
    const activeWorkersCount = engine ? engine.getActiveWorkersCount() : 0;

    if (useExternalMiner) {
      state = '{green-fg}MINERANDO (GPU / Gminer){/green-fg}';
    } else if (engine?.isEnginePaused()) {
      state = '{red-fg}PAUSADO (Manual){/red-fg}';
    } else if (activeWorkersCount > 0) {
      state = '{green-fg}MINERANDO ⛏️{/green-fg}';
    }

    tui.updateCPU(cpuLoad);
    tui.updateGPU({
      model: gpuModel.replace('NVIDIA ', '').replace('GeForce ', ''),
      load: useExternalMiner ? 100 : 0,
      hashrate: useExternalMiner && lastPoolStats ? lastPoolStats.hashrate : 0,
      isSimulated: !useExternalMiner
    });

    tui.updateStats({
      state: state,
      threads: activeWorkersCount,
      pool: POOL_HOST,
      poolConnected: true,
      shares: engineStats.shares,
      difficulty: engineStats.difficulty,
      isPaused: engine ? engine.isEnginePaused() : false,
      hashrate: engineStats.hashrate
    });

    tui.updateWallet({
      address: walletInfo.address,
      brl: lastPrice.brl,
      usd: lastPrice.usd,
      energyCost: finance.cost,
      minedValue: finance.revenue,
      sessions: walletMeta.sessions,
      totalMined: walletMeta.lifetimeMined,
      totalCost: walletMeta.lifetimeCost,
      xmr: finance.xmr,
      initialXMR: walletMeta.initialXMR,
      minPayout: finance.minPayout,
      etaPayout: finance.etaPayout,
      eta1XMR: finance.eta1Unit,
      etaPayoutPool: finance.etaPayoutPool,
      eta1XMRPool: finance.eta1UnitPool,
      kwhPrice: walletMeta.energyCost
    });

    tui.updatePoolStats(lastPoolStats);

    progress += Math.floor(Math.random() * 3) + 1;
    if (progress > 100) progress = 0;
    tui.updateProgress(progress);

    tui.render();
  }, 1000);

  setInterval(() => {
    const finance = profitService.getFinanceReport();
    wallet.updateLifetimeStats(finance.revenue, finance.cost, finance.xmr);
  }, 30000);

  wallet.incrementSession();
  if (engine) {
    engine.start();
    engine.on('share_accepted', (res) => {
      if (res.result && res.result.difficulty) {
        profitService.addShare(res.result.difficulty);
      }
      tui.log(`✅ {green-fg}Share aceito pela pool!{/green-fg} (Res: ${JSON.stringify(res.result)})`);
      updateFinance();
    });

    engine.on('share_rejected', (err) => {
      if (Array.isArray(err) && (err[0] === 20 || err[0] === 17)) {
        tui.log(`❌ {red-fg}Erro de Protocolo/Endereço (Pool):{/red-fg} ${err[1] || 'Recusado'}`);
      } else {
        tui.log(`❌ {red-fg}Share rejeitado:{/red-fg} ${JSON.stringify(err)}`);
      }
    });
  }

  updateFinance();
  updatePoolData();
  initGPU();
  setInterval(updateFinance, 5 * 60 * 1000);
  setInterval(updatePoolData, 5 * 60 * 1000);

  tui.log(`Conectado à pool ${POOL_HOST}`);
  tui.log(`Carteira: ${walletInfo.address.substring(0, 8)}... | Sessão #${wallet.getWalletInfo().sessions}`);

  function handleExit() {
    originalLog("\n🛑 Encerrando minerador e salvando progresso...");
    const finance = profitService.getFinanceReport();
    wallet.updateLifetimeStats(finance.revenue, finance.cost, finance.xmr);
    if (useExternalMiner) minerWrapper.stop();

    setTimeout(() => {
      originalLog("✅ Progresso salvo com sucesso. Até logo!");
      process.exit(0);
    }, 800);
  }

  tui.on('exit', handleExit);
  tui.on('toggle_pause', () => engine && engine.togglePause());
  tui.on('increase_threads', () => engine && engine.adjustThreads(1));
  tui.on('decrease_threads', () => engine && engine.adjustThreads(-1));

  process.on('SIGINT', handleExit);
}

bootstrap();
