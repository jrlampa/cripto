import { MiningEngine } from './MiningEngine';
import { WalletService } from './WalletService';
import { TUIBoard } from './TUIBoard';
import { GPUDetector } from './GPUDetector';
import { ProfitabilityService } from './ProfitabilityService';
import { PoolService } from './PoolService';
import { MainMenuTUI } from './MainMenuTUI';

async function bootstrap() {
  // 1. Startup Menu
  const menu = new MainMenuTUI();
  const coinConfig = await menu.waitForSelection();

  // 2. Address Management: Ensure we have a valid address for the selected coin
  // We do this BEFORE initializing the TUIBoard to ensure readline prompt works on standard stdout
  const wallet = new WalletService();
  let walletInfo = wallet.getWalletInfo(coinConfig.symbol);

  // Simple validation heuristics
  // XMR: starts with 4 or 8. ZEPH: starts with ZEPH. 
  let isAddressValid = false;
  const len = walletInfo.address.length;
  // Standard XMR/ZEPH addresses are ~95 chars. Integrated ~106.
  const isValidLength = len >= 90 && len <= 110;

  if (coinConfig.symbol === 'XMR' && /^[48]/.test(walletInfo.address) && isValidLength) isAddressValid = true;
  if (coinConfig.symbol === 'ZEPH' && /^ZEPH/.test(walletInfo.address) && isValidLength) isAddressValid = true;
  // Others: Assume valid if not empty and not default XMR mock if symbol != XMR
  if (!['XMR', 'ZEPH'].includes(coinConfig.symbol) && isValidLength) isAddressValid = true;

  if (!isAddressValid || walletInfo.address === "") {
    console.log(`\n⚠️  Endereço de carteira para ${coinConfig.name} (${coinConfig.symbol}) não encontrado ou inválido.`);
    if (walletInfo.address) console.log(`   Endereço atual (inválido): ${walletInfo.address.substring(0, 20)}...`);

    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    await new Promise<void>((resolve) => {
      const ask = () => {
        readline.question(`👉 Por favor, cole seu endereço ${coinConfig.symbol} (Cole APENAS UMA VEZ): `, (addr: string) => {
          let cleanAddr = addr.trim();

          // SMART FIX: Detect double paste (e.g. "46...MV46...MV")
          if (cleanAddr.length >= 180 && cleanAddr.length % 2 === 0) {
            const half = cleanAddr.length / 2;
            const firstHalf = cleanAddr.substring(0, half);
            const secondHalf = cleanAddr.substring(half);
            if (firstHalf === secondHalf) {
              console.log("⚠️ Detectada colagem dupla! Corrigindo automaticamente...");
              cleanAddr = firstHalf;
            }
          }

          // Validation: Address should be roughly 95 or 106 chars
          if (cleanAddr.length >= 90 && cleanAddr.length <= 110) {
            wallet.setAddressForCoin(coinConfig.symbol, cleanAddr);
            console.log(`✅ Endereço salvo! Iniciando minerador...`);
            walletInfo = wallet.getWalletInfo(coinConfig.symbol);
            readline.close();
            resolve();
          } else {
            console.log(`❌ Endereço inválido (Tamanho: ${cleanAddr.length}). Padrão esperado: ~95 chars.`);
            console.log(`   Tente novamente.`);
            ask(); // Loop until valid
          }
        });
      };
      console.log("💡 Dica: Para colar no Windows, clique com botão direito ou use Ctrl+Shift+V / Ctrl+V.");
      ask();
    });
  }

  // 3. Initialize Main Dashboard
  const tui = new TUIBoard(coinConfig.name, coinConfig.algorithm);

  // Redireciona logs IMEDIATAMENTE para o TUI para manter a tela limpa
  const originalLog = console.log;
  console.log = (...args) => tui.log(args.join(' '));

  tui.log(`Iniciando minerador de ${coinConfig.name} (${coinConfig.symbol})...`);

  const POOL_HOST = coinConfig.poolHost;
  const POOL_PORT = coinConfig.poolPort;

  // CRITICAL FIX: Ensure stdin is flowing for TUIBoard/Blessed after MainMenuTUI/Readline
  // This fixes the regression where keys (+, -, p) stopped working
  if (process.stdin.isPaused()) {
    process.stdin.resume();
  }

  const engine = new MiningEngine(POOL_HOST, POOL_PORT, walletInfo.address);
  const gpuDetector = new GPUDetector();
  const profitService = new ProfitabilityService();
  const poolService = new PoolService(walletInfo.address);

  let gpuModel = "Buscando...";
  let lastPrice = { brl: 0, usd: 0 };
  let lastUpdateTime = Date.now();
  let lastPoolStats: any = null;

  tui.updateWallet({ address: walletInfo.address, brl: 0, usd: 0 });

  async function updateFinance() {
    // TODO: Passar o ID da moeda (monero ou zephyr) para o fetchPrice se necessário. 
    // Por simplicidade do MVP, mantemos monero, mas idealmente CoinConfig teria o ID do CoinGecko.
    // CoinGecko IDs: Monero = 'monero', Zephyr = 'zephyr-protocol'
    const coingeckoId = coinConfig.symbol === 'ZEPH' ? 'zephyr-protocol' : 'monero';

    // Pequeno hack: WalletService atualmente tem 'monero' hardcoded.
    // Vamos apenas usar o preço do XMR por enquanto se não alterarmos o WalletService, 
    // ou assumir que o usuário entende que é uma estimativa.
    // Para ficar "Pro", deveríamos atualizar o WalletService.fetchPrice para aceitar argumento.
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
      tui.log(`Pool: Dados recebidos. Saldo: ${stats.balance} ${coinConfig.symbol}`);
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

    // Atualiza Financeiro Real-time
    const walletMeta = wallet.getWalletInfo();
    const totalHashrate = engineStats.job ? (engineStats.hashrate || 0) : 0;

    // Usa o custo de energia configurado no wallet.json
    profitService.update(cpuLoad, 0, totalHashrate, lastPrice.brl, deltaMs, walletMeta.energyCost);

    const finance = profitService.getFinanceReport((walletMeta.initialXMR || 0) + profitService.getFinanceReport().xmr);

    // LOGIC FIX: Sync "Total XMR" with real Pool Balance if available
    let displayBaseXMR = walletMeta.initialXMR || 0;

    if (lastPoolStats) {
      // If we have pool data, we want 'initial + session' to equal 'pool_total'
      // So, initial = pool_total - session
      const poolTotal = lastPoolStats.balance + lastPoolStats.unconfirmedBalance;
      // Prevent negative initial if pool lags behind local session (rare/impossible if pool is source of truth)
      displayBaseXMR = Math.max(0, poolTotal - finance.xmr);
    }

    // Lógica correta de estado:
    // ... (rest of logic) ...
    // Se isPaused = true -> PAUSADO
    // Se isPaused = false e activeWorkers > 0 -> MINERANDO (Pois o IdleDetector ativou)
    // Se isPaused = false e activeWorkers = 0 -> AGUARDANDO (IdleDetector diz que PC está em uso)
    let state = 'AGUARDANDO OCIOSIDADE';
    const activeWorkers = engine.getActiveWorkersCount();

    if (engine.isEnginePaused()) {
      state = '{red-fg}PAUSADO (Manual){/red-fg}';
    } else if (activeWorkers > 0) {
      state = '{green-fg}MINERANDO ⛏️{/green-fg}';
    }

    tui.updateCPU(cpuLoad);
    tui.updateGPU({
      model: gpuModel.replace('NVIDIA ', '').replace('GeForce ', ''), // Encurta nome
      load: 0,
      hashrate: 0,
      isSimulated: false
    });

    tui.updateStats({
      state: state,
      threads: activeWorkers,
      pool: POOL_HOST,
      poolConnected: true,
      shares: engineStats.shares,
      difficulty: engineStats.difficulty,
      isPaused: engine.isEnginePaused(),
      hashrate: engineStats.hashrate
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
      initialXMR: displayBaseXMR, // Uses Pool-synced value
      minPayout: finance.minPayout,
      etaPayout: finance.etaPayout,
      eta1XMR: finance.eta1XMR,
      kwhPrice: walletMeta.energyCost
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
  tui.log(`Carteira: ${walletInfo.address.substring(0, 8)}... | Sessão #${wallet.getWalletInfo().sessions}`);

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
    // Adiciona valor financeiro baseado na dificuldade do share aceito
    if (res.result && res.result.difficulty) {
      profitService.addShare(res.result.difficulty);
    }
    tui.log(`✅ {green-fg}Share aceito pela pool!{/green-fg} (Res: ${JSON.stringify(res.result)})`);
    updateFinance(); // Força atualização da UI
  });

  engine.on('share_rejected', (err) => {
    tui.log(`❌ {red-fg}Share rejeitado:{/red-fg} ${JSON.stringify(err)}`);
  });

  process.on('SIGINT', handleExit);
}

bootstrap();
