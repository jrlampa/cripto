import { Worker } from 'worker_threads';
import * as os from 'os';
import { EventEmitter } from 'events';
import { IdleDetector } from './IdleDetector';
import { XMRStratumClient } from './XMRStratumClient';
import { BTCStratumClient } from './BTCStratumClient';

export class MiningEngine extends EventEmitter {
  private workers: Worker[] = [];
  private idleDetector: IdleDetector;
  private client: XMRStratumClient | BTCStratumClient;
  private readonly numCores = os.cpus().length;
  private currentJob: any = null;
  private sharesFound: number = 0;
  private difficulty: number = 0;
  private isPaused: boolean = false;
  private manualThreads: number | null = null; // null significa "usar lógica automática"
  private workerHashrates: Map<number, number> = new Map();

  constructor(host: string, port: number, private address: string, private algorithm: string = 'RandomX', private password: string = 'x') {
    super();
    this.idleDetector = new IdleDetector();

    const btcStyleAlgos = ['SHA256', 'Autolykos2', 'Octopus', 'KAWPOW'];
    if (btcStyleAlgos.includes(this.algorithm)) {
      this.client = new BTCStratumClient(host, port);
    } else {
      this.client = new XMRStratumClient(host, port);
    }

    this.idleDetector.on('change', (isIdle) => {
      console.log(isIdle ? "🌙 Sistema ocioso." : "⚡ Sistema em uso.");
      this.rebalanceThreads();
    });

    this.client.on('connected', () => {
      console.log(`✅ Conectado! Iniciando login/subscribe para ${this.algorithm}...`);
      if (this.client instanceof BTCStratumClient) {
        // BTC/Alt Stratum requires authorize step. Subscribe is now auto-called in connect().
        setTimeout(() => {
          (this.client as BTCStratumClient).authorize(this.address, this.password);
        }, 500);
      } else {
        (this.client as XMRStratumClient).login(this.address, this.password);
      }
    });

    this.client.on('job', (job) => {
      this.currentJob = job;
      this.updateWorkersJob();
    });

    this.client.on('difficulty', (diff) => {
      this.difficulty = diff;
    });

    this.client.on('share_accepted', (res) => {
      this.emit('share_accepted', res);
    });

    this.client.on('share_rejected', (err) => {
      this.emit('share_rejected', err);
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
    let totalHashrate = 0;
    this.workerHashrates.forEach(h => totalHashrate += h);

    return {
      shares: this.sharesFound,
      difficulty: this.difficulty,
      job: this.currentJob,
      hashrate: totalHashrate
    };
  }

  public start(): void {
    console.log(`🚀 Iniciando Engine ${this.algorithm} com ${this.numCores} núcleos.`);
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
        workerData: { id: i, algorithm: this.algorithm }
      });
      worker.on('message', (msg) => {
        if (msg.type === 'submit') {
          this.sharesFound++;
          if (this.client instanceof BTCStratumClient) {
            // BTC Stratum submit params handled in client, we just pass what worker sends
            // The worker for SHA256 needs to send: username, jobId, extraNonce2, ntime, nonce
            (this.client as BTCStratumClient).submit(this.address, msg.jobId, msg.extraNonce2, msg.ntime, msg.nonce);
          } else {
            (this.client as XMRStratumClient).submit(msg.jobId, msg.nonce, msg.result);
          }
        } else if (msg.type === 'hashrate') {
          this.workerHashrates.set(i, msg.hashrate);
        } else if (msg.type === 'log') {
          console.log(`[Worker ${i}] ${msg.message}`);
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
    this.workerHashrates.clear();
  }
}
