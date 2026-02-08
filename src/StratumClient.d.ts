import { EventEmitter } from 'events';
export declare class StratumClient extends EventEmitter {
    private host;
    private port;
    private client;
    private id;
    constructor(host: string, port: number);
    connect(): void;
    private handleMessage;
    send(method: string, params: any[]): void;
    subscribe(): void;
    authorize(user: string, pass?: string): void;
    submit(worker: string, jobId: string, extraNonce2: string, ntime: string, nonce: string): void;
}
//# sourceMappingURL=StratumClient.d.ts.map