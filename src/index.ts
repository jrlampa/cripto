import { MiningEngine } from './MiningEngine';
import { WalletService } from './WalletService';

console.clear();
console.log("🚀 Cripto Miner V3 (Smart Monero Mode)");
console.log("---------------------------------------");

const POOL_HOST = 'xmr-eu1.nanopool.org';
const POOL_PORT = 14444;

const wallet = new WalletService();
const walletInfo = wallet.getWalletInfo();
console.log(`🏦 Carteira Monero: ${walletInfo.address}`);
console.log(`🔑 Seed (Guarde bem): ${walletInfo.mnemonic}`);

const engine = new MiningEngine(POOL_HOST, POOL_PORT, walletInfo.address);

async function updateDashboard() {
  const price = await wallet.fetchPrice();
  console.log(`\n💰 Valor Atual Monero (XMR):`);
  console.log(`💵 USD: $${price.usd.toFixed(2)}`);
  console.log(`🇧🇷 BRL: R$${price.brl.toFixed(2)}`);
  console.log(`---------------------------------------`);
}

// Inicia a mineração
engine.start();

// Atualiza preço a cada 5 minutos
updateDashboard();
setInterval(updateDashboard, 5 * 60 * 1000);

process.on('SIGINT', () => {
  console.log("\n🛑 Encerrando minerador e limpando threads...");
  process.exit();
});
