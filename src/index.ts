import { Block } from './Block';

console.log("🚀 Cripto Miner V1: Iniciando...");

const difficulty = 4; // Número de zeros à esquerda necessários
const firstBlock = new Block(1, Date.now(), "Dados do primeiro bloco");

console.time('Tempo de mineração');
firstBlock.mineBlock(difficulty);
console.timeEnd('Tempo de mineração');

const secondBlock = new Block(2, Date.now(), "Dados do segundo bloco", firstBlock.hash);

console.time('Tempo de mineração');
secondBlock.mineBlock(difficulty);
console.timeEnd('Tempo de mineração');

console.log("\n📦 Blockchain finalizado (por enquanto):");
console.log(JSON.stringify([firstBlock, secondBlock], null, 2));
