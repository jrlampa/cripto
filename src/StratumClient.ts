import * as net from 'net';
import { EventEmitter } from 'events';

export class StratumClient extends EventEmitter {
  private client: net.Socket;
  private id: number = 1;

  constructor(private host: string, private port: number) {
    super();
    this.client = new net.Socket();
  }

  public connect(): void {
    console.log(`🔌 Conectando a ${this.host}:${this.port}...`);
    this.client.connect(this.port, this.host, () => {
      console.log('✅ Conectado ao servidor Stratum!');
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
      console.error('❌ Erro na conexão:', err.message);
      this.emit('error', err);
    });

    this.client.on('close', () => {
      console.log('🔌 Conexão encerrada.');
      this.emit('disconnected');
    });
  }

  private handleMessage(json: any): void {
    if (json.method === 'mining.notify') {
      this.emit('job', json.params);
    } else if (json.method === 'mining.set_difficulty') {
      console.log(`🎯 Dificuldade ajustada pela pool: ${json.params[0]}`);
      this.emit('difficulty', json.params[0]);
    } else {
      this.emit('response', json);
    }
  }

  public send(method: string, params: any[]): void {
    const request = {
      id: this.id++,
      method: method,
      params: params
    };
    this.client.write(JSON.stringify(request) + '\n');
  }

  public subscribe(): void {
    this.send('mining.subscribe', []);
  }

  public authorize(user: string, pass: string = 'x'): void {
    this.send('mining.authorize', [user, pass]);
  }

  public submit(worker: string, jobId: string, extraNonce2: string, ntime: string, nonce: string): void {
    this.send('mining.submit', [worker, jobId, extraNonce2, ntime, nonce]);
  }
}
