import axios from 'axios';

export interface PoolStats {
  balance: number;
  unconfirmedBalance: number;
  hashrate: number;
  avgHashrate: {
    h1: number;
    h3: number;
    h6: number;
    h12: number;
    h24: number;
  };
}

export interface PoolStats {
  balance: number;
  unconfirmedBalance: number;
  hashrate: number;
  avgHashrate: {
    h1: number;
    h3: number;
    h6: number;
    h12: number;
    h24: number;
  };
}

export interface IPoolService {
  fetchStats(): Promise<PoolStats | null>;
}

export class NanopoolService implements IPoolService {
  private readonly baseUrl = 'https://api.nanopool.org/v1/xmr/user';

  constructor(private address: string) { }

  public async fetchStats(): Promise<PoolStats | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/${this.address}`, {
        timeout: 10000
      });

      if (response.data && response.data.status) {
        const d = response.data.data;
        return {
          balance: parseFloat(d.balance) || 0,
          unconfirmedBalance: parseFloat(d.unconfirmed_balance) || 0,
          hashrate: parseFloat(d.hashrate) || 0,
          avgHashrate: {
            h1: parseFloat(d.avgHashrate.h1) || 0,
            h3: parseFloat(d.avgHashrate.h3) || 0,
            h6: parseFloat(d.avgHashrate.h6) || 0,
            h12: parseFloat(d.avgHashrate.h12) || 0,
            h24: parseFloat(d.avgHashrate.h24) || 0,
          }
        };
      }
      return null;
    } catch (error: any) {
      return null;
    }
  }
}

export class GenericPoolService implements IPoolService {
  constructor() { }

  public async fetchStats(): Promise<PoolStats | null> {
    // Generic pools (stratum only) don't have a standardized HTTP API we can rely on easily without more config.
    // For now, we return null so the IO layer acts accordingly (Generic info).
    return null;
  }
}
