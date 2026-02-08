import { EventEmitter } from 'events';
export declare class IdleDetector extends EventEmitter {
    private isIdle;
    private checkInterval;
    private readonly IDLE_THRESHOLD_MS;
    constructor();
    start(): void;
    stop(): void;
    private checkIdleTime;
}
//# sourceMappingURL=IdleDetector.d.ts.map