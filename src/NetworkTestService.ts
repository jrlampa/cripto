import * as net from 'net';

export interface PoolCandidate {
  name: string;
  host: string;
  port: number;
}

export class NetworkTestService {
  /**
   * Measures TCP latency to a host:port.
   * Returns minimal latency in ms. Returns Infinity if connection fails or times out.
   */
  public async measureLatency(host: string, port: number, timeoutMs: number = 2000): Promise<number> {
    return new Promise((resolve) => {
      const start = Date.now();
      const socket = new net.Socket();
      let resolved = false;

      socket.setTimeout(timeoutMs);

      socket.on('connect', () => {
        if (!resolved) {
          const latency = Date.now() - start;
          resolved = true;
          socket.destroy();
          resolve(latency);
        }
      });

      socket.on('error', () => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve(Infinity);
        }
      });

      socket.on('timeout', () => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve(Infinity);
        }
      });

      socket.connect(port, host);
    });
  }

  /**
   * Tests a list of pools and returns the one with the lowest latency.
   * @param pools List of pools to test
   * @param onProgress Optional callback for progress updates
   */
  public async findBestPool(pools: PoolCandidate[], onProgress?: (pool: PoolCandidate, latency: number) => void): Promise<PoolCandidate> {
    if (pools.length === 0) throw new Error("No pools provided");
    let bestPool: PoolCandidate = pools[0]!;
    let minLatency = Infinity;

    // Run tests sequentially or in parallel? Parallel is faster.
    const promises = pools.map(async (pool) => {
      const latency = await this.measureLatency(pool.host, pool.port);
      if (onProgress) onProgress(pool, latency);
      return { pool, latency };
    });

    const results = await Promise.all(promises);

    results.forEach(res => {
      if (res.latency < minLatency) {
        minLatency = res.latency;
        bestPool = res.pool;
      }
    });

    return bestPool;
  }
}
