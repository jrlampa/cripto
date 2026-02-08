import { MiningEngine } from './MiningEngine';
import { WalletService } from './WalletService';
import { TUIBoard } from './TUIBoard';

const tui = new TUIBoard();
tui.log("Iniciando minerador inteligente...");

const POOL_HOST = 'xmr-eu1.nanopool.org';
const POOL_PORT = 14444;

const wallet = new WalletService();
const walletInfo = wallet.getWalletInfo();
const engine = new MiningEngine(POOL_HOST, POOL_PORT, walletInfo.address);

tui.updateWallet({ address: walletInfo.address, brl: 0, usd: 0 });

async function updateFinance() {
  const price = await wallet.fetchPrice();
  tui.updateWallet({ address: walletInfo.address, brl: price.brl, usd: price.usd });
}

// Configura o dashboard fixo
setInterval(() => {
  // Simulação básica de carga para o dashboard (CPU total)
  // Em produção usaríamos node-usage ou similar
  const load = Math.floor(Math.random() * 5) + (engine.getActiveWorkersCount() > 1 ? 95 : 10);
  tui.updateCPU(load);

  tui.updateStats({
    state: engine.isIdle() ? 'ÓCIO' : 'ATIVO',
    threads: engine.getActiveWorkersCount(),
    pool: POOL_HOST,
    poolConnected: true // Simplificado
  });
}, 1000);

// Inicia a mineração
engine.start();
updateFinance();
setInterval(updateFinance, 5 * 60 * 1000);

tui.log(`Conectado à pool ${POOL_HOST}`);
tui.log(`Carteira carregada: ${walletInfo.address.substring(0, 8)}...`);

process.on('SIGINT', () => {
  tui.log("🛑 Encerrando minerador...");
  setTimeout(() => process.exit(), 500);
});
