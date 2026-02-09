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
      // Close will follow
    });

    this.client.on('close', (hadError) => {
      if (this.isConnecting) return;
      console.log(`🔌 Conexão com a pool encerrada${hadError ? ' por erro' : ''}.`);
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
    // Debug: Log raw response from pool for user verification
    if (json.id || json.result || json.error) {
      const logStr = `[POOL RAW] ID: ${json.id}, Result: ${JSON.stringify(json.result)}, Error: ${JSON.stringify(json.error)}`;
      console.log(logStr.length > 200 ? logStr.substring(0, 200) + '...' : logStr);
    }

    // Protocolo Monero Stratum (JSON-RPC 2.0 ou similar)
    if (json.method === 'job') {
      console.log(`📦 Novo Job XMR recebido: ${json.params.job_id?.substring(0, 8) || '---'}`);

      // FIX: Calculate difficulty from target if available
      if (json.params.target) {
        const diff = this.calculateDifficultyFromTarget(json.params.target);
        if (diff > 0) this.emit('difficulty', diff);
      }

      this.emit('job', json.params);
    } else if (json.result && json.result.job) {
      // Resposta ao login geralmente contém o primeiro job
      console.log(`📦 Novo Job XMR recebido (Login): ${json.result.job.job_id?.substring(0, 8) || '---'}`);

      // FIX: Calculate difficulty from target if available
      if (json.result.job.target) {
        const diff = this.calculateDifficultyFromTarget(json.result.job.target);
        if (diff > 0) this.emit('difficulty', diff);
      }

      this.emit('job', json.result.job);
      this.emit('login_success', json.result);
    } else if (json.method === 'mining.set_difficulty') {
      this.emit('difficulty', json.params[0]);
    } else if (json.result && (json.result.status === 'OK' || json.result === 'OK')) {
      // Resposta de sucesso a um submit
      this.emit('share_accepted', json);
    } else if (json.error) {
      this.emit('share_rejected', json.error);
    } else {
      this.emit('response', json);
    }
  }

  public login(address: string, password: string = 'x'): void {
    const loginId = (password && password !== 'x' && !password.includes('@')) ? `${address}.${password}` : address;
    console.log(`🔑 Login no Pool: ${loginId.substring(0, 15)}...`);
    const request = {
      id: this.id++,
      method: 'login',
      params: {
        login: loginId,
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

  private calculateDifficultyFromTarget(targetHex: string): number {
    try {
      // Monero Difficulty = (2^256 - 1) / Target
      // Target is Little-Endian 32-bit (or 64-bit hex) usually.
      // Example: "000022f3..." means high difficulty (small number).
      // If target is 32-bit (8 hex chars), it might be "f3220000".

      // Standard Monero Stratum uses a 32-bit integer target sometimes, or a full 256-bit target.
      // Nanopool typically sends a 32-bit target (e.g., 8769324) or a hex string.

      // Let's assume standard Hex Target (Little Endian)
      const targetRev = Buffer.from(targetHex, 'hex').reverse().toString('hex');
      const targetVal = BigInt('0x' + targetRev.padEnd(64, 'f'));

      const MAX_TARGET = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF');
      const diff = MAX_TARGET / targetVal;

      return Number(diff);
    } catch (e) {
      console.error('⚠️ Erro ao calcular dificuldade do target:', e);
      return 0;
    }
  }
}
