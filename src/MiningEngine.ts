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

  constructor(host: string, port: number, private address: string) {
    this.idleDetector = new IdleDetector();
    this.client = new XMRStratumClient(host, port);

    this.idleDetector.on('change', (isIdle) => this.handleStateChange(isIdle));

    this.client.on('connected', () => {
      this.client.login(this.address);
    });

    this.client.on('job', (job) => {
      this.currentJob = job;
      this.updateWorkersJob();
    });
  }

  public isIdle(): boolean {
    return this.idleDetector.isIdle;
  }

  public getActiveWorkersCount(): number {
    return this.workers.length;
  }

  public start(): void {
    console.log(`🚀 Iniciando Engine Monero com ${this.numCores} núcleos.`);
    this.idleDetector.start();
    this.client.connect();
    this.spawnWorkers(this.numCores);
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

  private handleStateChange(isIdle: boolean): void {
    if (isIdle) {
      console.log("🌙 Sistema ocioso. Liberando potência TOTAL!");
      this.spawnWorkers(this.numCores);
    } else {
      console.log("⚡ Sistema em uso. Reduzindo carga para liberar o PC.");
      this.spawnWorkers(Math.max(1, Math.floor(this.numCores / 4))); // Usa 25% dos cores
    }
  }
}
