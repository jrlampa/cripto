import * as net from 'net';
import { EventEmitter } from 'events';

export class XMRStratumClient extends EventEmitter {
  private client: net.Socket;
  private id: number = 1;
  private retryCount: number = 0;
  private maxBackoffMs: number = 5 * 60 * 1000; // 5 minutos
  private isConnecting: boolean = false;

  constructor(private host: string, private port: number) {
    super();
    this.client = new net.Socket();
  }

  public connect(): void {
    if (this.isConnecting) return;
    this.isConnecting = true;

    // Limpa listeners antigos para evitar vazamento de memória e múltiplas execuções no reconnect
    this.client.removeAllListeners();

    console.log(`🔌 Conectando à pool Monero: ${this.host}:${this.port}... (Tentativa ${this.retryCount + 1})`);

    this.client.connect(this.port, this.host, () => {
      console.log('✅ Conectado à pool!');
      this.isConnecting = false;
      this.retryCount = 0; // Reseta contador ao sucesso
      this.emit('connected');
    });

    this.client.on('data', (data) => {
      const messages = data.toString().split('\n').filter(line => line.trim() !== '');
      messages.forEach(msg => {
        try {
          const json = JSON.parse(msg);
          this.handleMessage(json);
        } catch (e) {
          console.error('❌ Erro ao processar mensagem JSON:', msg);
        }
      });
    });

    this.client.on('error', (err) => {
      console.error('❌ Erro na conexão com a pool:', err.message);
      this.isConnecting = false;
      this.handleReconnect();
    });

    this.client.on('close', () => {
      console.log('🔌 Conexão com a pool encerrada.');
      this.isConnecting = false;
      this.handleReconnect();
      this.emit('disconnected');
    });
  }

  private handleReconnect(): void {
    const backoff = Math.min(this.maxBackoffMs, Math.pow(2, this.retryCount) * 5000);
    this.retryCount++;
    console.log(`🔄 Tentando reconectar em ${backoff / 1000}s...`);
    setTimeout(() => this.connect(), backoff);
  }

  private handleMessage(json: any): void {
    // Protocolo Monero Stratum (JSON-RPC 2.0 ou similar)
    if (json.method === 'job') {
      this.emit('job', json.params);
    } else if (json.result && json.result.job) {
      // Resposta ao login geralmente contém o primeiro job
      this.emit('job', json.result.job);
      this.emit('login_success', json.result);
    } else if (json.method === 'mining.set_difficulty') {
      this.emit('difficulty', json.params[0]);
    } else if (json.result && (json.result === true || json.result.status === 'OK' || json.result === 'OK')) {
      // Resposta de sucesso a um submit
      this.emit('share_accepted', json);
    } else if (json.error) {
      this.emit('share_rejected', json.error);
    } else {
      this.emit('response', json);
    }
  }

  public login(address: string, password: string = 'x'): void {
    const request = {
      id: this.id++,
      method: 'login',
      params: {
        login: address,
        pass: password,
        agent: 'antigravity-xmr-miner/1.0'
      }
    };
    this.client.write(JSON.stringify(request) + '\n');
  }

  public submit(jobId: string, nonce: string, result: string): void {
    const request = {
      id: this.id++,
      method: 'submit',
      params: {
        id: jobId,
        job_id: jobId,
        nonce: nonce,
        result: result
      }
    };
    this.client.write(JSON.stringify(request) + '\n');
  }

  public keepAlive(): void {
    const request = {
      id: this.id++,
      method: 'keepalived', // Alguns usam 'keepalived' ou apenas 'getjob'
      params: { id: this.id }
    };
    this.client.write(JSON.stringify(request) + '\n');
  }
}
