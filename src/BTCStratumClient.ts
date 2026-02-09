import * as net from 'net';
import { EventEmitter } from 'events';

export class BTCStratumClient extends EventEmitter {
  private client: net.Socket;
  private id: number = 1;
  private retryCount: number = 0;
  private maxBackoffMs: number = 5 * 60 * 1000;
  private isConnecting: boolean = false;
  private extraNonce1: string = '';
  private extraNonce2Size: number = 4;
  private buffer: string = ''; // Buffer for partial TCP data

  constructor(private host: string, private port: number) {
    super();
    this.client = new net.Socket();
    this.client.setTimeout(60000); // 60s timeout
  }

  public connect(): void {
    this.isConnecting = true;
    this.id = 1; // Reset protocol IDs for each new connection handshake
    this.client.removeAllListeners();

    console.log(`🔌 Conectando à pool BTC/Alt: ${this.host}:${this.port}... (Tentativa ${this.retryCount + 1})`);

    this.client.connect(this.port, this.host, () => {
      console.log(`✅ Conectado à pool BTC/Alt: ${this.host}`);
      this.isConnecting = false;
      this.retryCount = 0;
      this.subscribe(); // Auto-subscribe on connect
      this.emit('connected');
    });

    this.client.on('data', (data) => {
      this.buffer += data.toString();
      let pos: number;
      while ((pos = this.buffer.indexOf('\n')) !== -1) {
        const line = this.buffer.substring(0, pos).trim();
        this.buffer = this.buffer.substring(pos + 1);

        if (line) {
          try {
            const json = JSON.parse(line);
            this.handleMessage(json);
          } catch (e) {
            console.error('❌ Erro ao processar mensagem JSON (BTC):', line);
          }
        }
      }
    });

    this.client.on('error', (err) => {
      console.error(`❌ Erro na conexão com a pool BTC/Alt (${this.host}):`, err.message);
      // Close event will follow and trigger reconnect
    });

    this.client.on('close', (hadError) => {
      if (this.isConnecting) return; // Prevent loop if close happens during connect
      console.log(`🔌 Conexão com a pool BTC/Alt encerrada${hadError ? ' por erro' : ''}.`);
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
    // Debug: Log raw response from pool only on error to keep TUI clean
    if (json.error) {
      console.error(`[BTC POOL ERR] ID: ${json.id}: ${JSON.stringify(json.error)}`);
    }

    if (json.id === 1 || (json.result && json.id < 3)) {
      // Response to mining.subscribe (usually ID 1)
      // result example: [ [ ["mining.set_difficulty", "subscription id 1"], ["mining.notify", "subscription id 2"] ], "extraNonce1", extraNonce2_size ]
      if (Array.isArray(json.result)) {
        this.extraNonce1 = json.result[1];
        this.extraNonce2Size = json.result[2];
        console.log(`✅ Subscribed! ExtraNonce1: ${this.extraNonce1}, EN2Size: ${this.extraNonce2Size}`);
        this.emit('subscribed', { extraNonce1: this.extraNonce1, extraNonce2Size: this.extraNonce2Size });
      }
    } else if (json.method === 'mining.notify') {
      // params: [job_id, prevhash, coinb1, coinb2, merkle_branch, version, nbits, ntime, clean_jobs]
      const params = json.params;
      const job = {
        job_id: params[0],
        prevhash: params[1],
        coinb1: params[2],
        coinb2: params[3],
        merkle_branch: params[4],
        version: params[5],
        nbits: params[6],
        ntime: params[7],
        clean_jobs: params[8]
      };
      //console.log(`📦 Novo Job BTC/Alt recebido: ${job.job_id.substring(0, 8)}...`);
      this.emit('job', job);
    } else if (json.method === 'mining.set_difficulty') {
      this.emit('difficulty', json.params[0]);
    } else if (json.result === true) {
      this.emit('authorized', true);
    } else if (json.result === false) {
      console.error('❌ Request failed (result: false)');
    } else if (json.error) {
      if (json.error[1] === 'Already subscribed') return; // Silence this specific harmless-ish error
      this.emit('share_rejected', json.error);
    }
  }

  public subscribe(): void {
    const request = {
      id: this.id++,
      method: "mining.subscribe",
      params: ["antigravity-btc-miner/1.0"]
    };
    this.client.write(JSON.stringify(request) + '\n');
  }

  public authorize(username: string, password: string = 'x'): void {
    const request = {
      id: this.id++,
      method: "mining.authorize",
      params: [username, password]
    };
    this.client.write(JSON.stringify(request) + '\n');
  }

  public submit(username: string, jobId: string, extraNonce2: string, ntime: string, nonce: string): void {
    const request = {
      id: this.id++,
      method: "mining.submit",
      params: [username, jobId, extraNonce2, ntime, nonce]
    };
    this.client.write(JSON.stringify(request) + '\n');
  }
}
