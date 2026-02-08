"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StratumClient = void 0;
const net = require("net");
const events_1 = require("events");
class StratumClient extends events_1.EventEmitter {
    host;
    port;
    client;
    id = 1;
    constructor(host, port) {
        super();
        this.host = host;
        this.port = port;
        this.client = new net.Socket();
    }
    connect() {
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
                }
                catch (e) {
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
    handleMessage(json) {
        if (json.method === 'mining.notify') {
            this.emit('job', json.params);
        }
        else if (json.method === 'mining.set_difficulty') {
            console.log(`🎯 Dificuldade ajustada pela pool: ${json.params[0]}`);
            this.emit('difficulty', json.params[0]);
        }
        else {
            this.emit('response', json);
        }
    }
    send(method, params) {
        const request = {
            id: this.id++,
            method: method,
            params: params
        };
        this.client.write(JSON.stringify(request) + '\n');
    }
    subscribe() {
        this.send('mining.subscribe', []);
    }
    authorize(user, pass = 'x') {
        this.send('mining.authorize', [user, pass]);
    }
    submit(worker, jobId, extraNonce2, ntime, nonce) {
        this.send('mining.submit', [worker, jobId, extraNonce2, ntime, nonce]);
    }
}
exports.StratumClient = StratumClient;
//# sourceMappingURL=StratumClient.js.map