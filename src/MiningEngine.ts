import { Worker } from 'worker_threads';
import * as os from 'os';
import { IdleDetector } from './IdleDetector';
import { XMRStratumClient } from './XMRStratumClient';

export class MiningEngine {
  private workers: Worker[] = [];
  private idleDetector: IdleDetector;
  private client: XMRStratumClient;
  private readonly numCores = os.cpus().length;
  private currentJob: any = null;
  private sharesFound: number = 0;
  private difficulty: number = 0;
  private isPaused: boolean = false;
  private manualThreads: number | null = null; // null significa "usar lógica automática"

  constructor(host: string, port: number, private address: string) {
    this.idleDetector = new IdleDetector();
    this.client = new XMRStratumClient(host, port);

    this.idleDetector.on('change', (isIdle) => {
      console.log(isIdle ? "🌙 Sistema ocioso." : "⚡ Sistema em uso.");
      this.rebalanceThreads();
    });

    this.client.on('connected', () => {
      this.client.login(this.address);
    });

    this.client.on('job', (job) => {
      this.currentJob = job;
      this.updateWorkersJob();
    });

    this.client.on('difficulty', (diff) => {
      this.difficulty = diff;
    });
  }

  public togglePause(): void {
    this.isPaused = !this.isPaused;
    console.log(this.isPaused ? "⏸️ Mineração PAUSADA pelo usuário." : "▶️ Mineração RETOMADA pelo usuário.");
    this.rebalanceThreads();
  }

  public isEnginePaused(): boolean {
    return this.isPaused;
  }

  public adjustThreads(delta: number): void {
    const current = this.manualThreads ?? (this.idleDetector.isIdle ? this.numCores : Math.max(1, Math.floor(this.numCores / 4)));
    this.manualThreads = Math.max(1, Math.min(this.numCores, current + delta));
    console.log(`⚙️ Ajuste manual de threads: ${this.manualThreads} cores.`);
    this.rebalanceThreads();
  }

  public isIdle(): boolean {
    return this.idleDetector.isIdle;
  }

  public getActiveWorkersCount(): number {
    return this.isPaused ? 0 : this.workers.length;
  }

  public getStats() {
    return {
      shares: this.sharesFound,
      difficulty: this.difficulty,
      job: this.currentJob
    };
  }

  public start(): void {
    console.log(`🚀 Iniciando Engine Monero com ${this.numCores} núcleos.`);
    this.idleDetector.start();
    this.client.connect();
    this.rebalanceThreads();
  }

  private rebalanceThreads(): void {
    if (this.isPaused) {
      this.stopWorkers();
      return;
    }

    let targetThreads = this.manualThreads;
    if (targetThreads === null) {
      targetThreads = this.idleDetector.isIdle ? this.numCores : Math.max(1, Math.floor(this.numCores / 4));
    }

    if (this.workers.length !== targetThreads) {
      this.spawnWorkers(targetThreads);
    }
  }

  private updateWorkersJob(): void {
    this.workers.forEach(w => w.postMessage({ type: 'job', job: this.currentJob }));
  }

  private spawnWorkers(count: number): void {
    this.stopWorkers();
    console.log(`🔨 Ativando ${count} núcleos para mineração...`);
    const workerPath = './dist/MinerWorker.js';

    for (let i = 0; i < count; i++) {
      const worker = new Worker(workerPath, {
        workerData: { id: i }
      });
      worker.on('message', (msg) => {
        if (msg.type === 'submit') {
          this.sharesFound++;
          this.client.submit(msg.jobId, msg.nonce, msg.result);
        }
      });

      if (this.currentJob) {
        worker.postMessage({ type: 'job', job: this.currentJob });
      }
      this.workers.push(worker);
    }
  }

  private stopWorkers(): void {
    this.workers.forEach(w => w.terminate());
    this.workers = [];
  }
}
