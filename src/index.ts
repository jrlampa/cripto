import { MiningEngine } from './MiningEngine';
import { WalletService } from './WalletService';
import { TUIBoard } from './TUIBoard';
import { GPUDetector } from './GPUDetector';
import { ProfitabilityService } from './ProfitabilityService';
import { NanopoolService, GenericPoolService, IPoolService } from './PoolService';
import { MainMenuTUI } from './MainMenuTUI';

async function bootstrap() {
  // 1. Startup Menu
  const menu = new MainMenuTUI();
  const coinConfig = await menu.waitForSelection();

  // 2. Address Management: Ensure we have a valid address for the selected coin
  // We do this BEFORE initializing the TUIBoard to ensure readline prompt works on standard stdout
  const wallet = new WalletService();
  // FORCE REFRESH: Get specific wallet info for the selected coin
  let walletInfo = wallet.getWalletInfo(coinConfig.symbol);

  // SMART FIX: Detect double paste on stored value too (fixes carry-over issues)
  if (walletInfo.address.length >= 20 && walletInfo.address.length % 2 === 0) {
    const half = walletInfo.address.length / 2;
    if (walletInfo.address.substring(0, half) === walletInfo.address.substring(half)) {
      walletInfo.address = walletInfo.address.substring(0, half);
    }
  }

  // Simple validation heuristics
  let isAddressValid = false;
  const len = walletInfo.address.length;
  const isValidLength = len >= 90 && len <= 110;

  // DEBUG LOGS (Temporário)
  // console.log(`[DEBUG] Coin: ${coinConfig.symbol}, Address Len: ${len}, IsValidLen: ${isValidLength}`);

  if (coinConfig.symbol === 'XMR') {
    isAddressValid = /^[48]/.test(walletInfo.address) && isValidLength;
  } else if (coinConfig.symbol === 'ZEPH') {
    isAddressValid = /^ZEPH/.test(walletInfo.address) && isValidLength;
  } else if (coinConfig.symbol === 'BTC') {
    const looksLikeXMR = (walletInfo.address.startsWith('4') || walletInfo.address.startsWith('8')) && walletInfo.address.length > 90;
    if (walletInfo.address.length > 3 && walletInfo.address.length < 60 && !looksLikeXMR) {
      isAddressValid = true;
    } else {
      isAddressValid = false;
      walletInfo.address = "";
    }
  } else if (coinConfig.symbol === 'RVN') {
    isAddressValid = /^R/.test(walletInfo.address) && walletInfo.address.length >= 30;
  } else if (coinConfig.symbol === 'CFX') {
    isAddressValid = /^cfx:/.test(walletInfo.address) || walletInfo.address.length > 30;
  } else if (coinConfig.symbol === 'ERGO') {
    isAddressValid = /^9/.test(walletInfo.address) && walletInfo.address.length >= 30;
  } else if (coinConfig.symbol === 'BNB' || coinConfig.symbol === 'ETH') {
    isAddressValid = /^0x[a-fA-F0-9]{40}$/.test(walletInfo.address);
  } else if (coinConfig.symbol === 'SOL') {
    isAddressValid = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletInfo.address);
  } else {
    isAddressValid = walletInfo.address.length > 5;
  }

  // Debug Final
  // console.log(`[DEBUG] Result isAddressValid: ${isAddressValid}`);

  // Se o usuário digitou senha no menu, usa ela. Senão, tenta carregar do wallet.
  let walletPassword = (coinConfig as any).password || wallet.getPasswordForCoin(coinConfig.symbol);

  const isBTC = coinConfig.algorithm === 'SHA256';
  const label = isBTC ? 'Nome do Worker (ex: user.001)' : 'Endereço de carteira';

  if (!isAddressValid || walletInfo.address === "" || (isBTC && !walletPassword)) {
    console.log(`\n⚠️  Configuração para ${coinConfig.name} (${coinConfig.symbol}) incompleta.`);
    if (walletInfo.address) console.log(`   Valor atual (Address/Worker): ${walletInfo.address.substring(0, 20)}...`);

    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    // Função auxiliar para perguntar
    const question = (q: string): Promise<string> => {
      return new Promise(resolve => readline.question(q, resolve));
    }

    // Loop de pergunta do Address/Worker
    while (!isAddressValid) {
      let addr = await question(`👉 Por favor, digite seu ${label} (APENAS UMA VEZ): `);
      let cleanAddr = addr.trim();

      // SMART FIX: Detect double paste (now more aggressive for shorter worker names)
      if (cleanAddr.length >= 20 && cleanAddr.length % 2 === 0) {
        const half = cleanAddr.length / 2;
        if (cleanAddr.substring(0, half) === cleanAddr.substring(half)) {
          console.log("⚠️ Detectada colagem dupla! Corrigindo automaticamente...");
          cleanAddr = cleanAddr.substring(0, half);
        }
      }

      let valid = false;
      if (isBTC) valid = cleanAddr.length > 3;
      else valid = cleanAddr.length >= 90 && cleanAddr.length <= 110;

      if (valid) {
        walletInfo.address = cleanAddr;
        isAddressValid = true;
        console.log(`✅ ${label} válido!`);
      } else {
        console.log(`❌ Valor inválido (Tamanho: ${cleanAddr.length}). Tente novamente.`);
      }
    }

    // Pergunta da Senha (Apenas BTC)
    if (isBTC && !walletPassword) {
      let pass = await question(`👉 Digite a senha para o worker (ou Enter para '123456'): `);
      walletPassword = pass.trim() || '123456';
    }

    // Salvar tudo
    wallet.setAddressForCoin(coinConfig.symbol, walletInfo.address, walletPassword);
    console.log(`✅ Configuração salva! Iniciando minerador...`);

    readline.close();
  } else if ((coinConfig as any).password && (coinConfig as any).password !== 'x') {
    // Caso o endereço já fosse válido mas a senha mudou (via menu), atualizamos o wallet.json
    wallet.setAddressForCoin(coinConfig.symbol, walletInfo.address, walletPassword);
  }

  // 3. Initialize Main Dashboard
  const tui = new TUIBoard(coinConfig.name, coinConfig.symbol, coinConfig.algorithm);

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

  const engine = new MiningEngine(POOL_HOST, POOL_PORT, walletInfo.address, coinConfig.algorithm, walletPassword);
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
  let lastPoolStats: any = null;

  tui.updateWallet({ address: walletInfo.address, brl: 0, usd: 0 });

  async function updateFinance() {
    // TODO: Passar o ID da moeda (monero ou zephyr) para o fetchPrice se necessário. 
    // Por simplicidade do MVP, mantemos monero, mas idealmente CoinConfig teria o ID do CoinGecko.
    // Pegamos o preço da moeda atual
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
      tui.log(`Pool: Dados recebidos. Saldo: ${stats.balance.toFixed(6)} ${coinConfig.symbol}`);
    } else {
      // If null (Generic Pool), we don't update lastPoolStats with null to avoid wiping previous data if any, 
      // or simply leave it as is. TUI handles null.
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
    const walletMeta = wallet.getWalletInfo(coinConfig.symbol);
    const totalHashrate = engineStats.job ? (engineStats.hashrate || 0) : 0;

    // Usa o custo de energia configurado no wallet.json e a moeda selecionada
    profitService.update(cpuLoad, 0, totalHashrate, lastPrice.brl, deltaMs, walletMeta.energyCost, coinConfig.symbol, engineStats.difficulty);

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
      eta1XMR: finance.eta1Unit,
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
    // Categorização de erros de pool (Stratum)
    // 17 = Incompatible protocol / Invalid job
    // 20 = Invalid address / Authentication failed (comum na 2Miners/Nanopool)
    if (Array.isArray(err) && (err[0] === 20 || err[0] === 17)) {
      tui.log(`❌ {red-fg}Erro de Protocolo/Endereço (Pool):{/red-fg} ${err[1] || 'Recusado'}`);
    } else {
      tui.log(`❌ {red-fg}Share rejeitado:{/red-fg} ${JSON.stringify(err)}`);
    }
  });

  process.on('SIGINT', handleExit);
}

bootstrap();
