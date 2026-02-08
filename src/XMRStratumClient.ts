import * as net from 'net';
import { EventEmitter } from 'events';

export class XMRStratumClient extends EventEmitter {
  private client: net.Socket;
  private id: number = 1;

  constructor(private host: string, private port: number) {
    super();
    this.client = new net.Socket();
  }

  public connect(): void {
    console.log(`🔌 Conectando à pool Monero: ${this.host}:${this.port}...`);
    this.client.connect(this.port, this.host, () => {
      console.log('✅ Conectado à pool!');
      this.emit('connected');
    });

    this.client.on('data', (data) => {
      const messages = data.toString().split('\n').filter(line => line.trim() !== '');
      messages.forEach(msg => {
        try {
          const json = JSON.parse(msg);
          this.handleMessage(json);
        } catch (e) {
          // Monero pools sometimes send multiple JSONs in one chunk or slightly malformed
          console.error('❌ Erro ao processar mensagem JSON:', msg);
        }
      });
    });

    this.client.on('error', (err) => {
      console.error('❌ Erro na conexão com a pool:', err.message);
      this.emit('error', err);
    });

    this.client.on('close', () => {
      console.log('🔌 Conexão com a pool encerrada.');
      this.emit('disconnected');
    });
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
