import { describe, it, expect, beforeEach, vi, type Mocked } from 'vitest';
import { ProfitabilityService } from '../src/ProfitabilityService';
import axios from 'axios';

vi.mock('axios');

describe('MultiCoinProfitability Integration', () => {
  let service: ProfitabilityService;

  beforeEach(() => {
    // Forcar o axios a retornar algo básico para não quebrar o constructor
    vi.mocked(axios.get).mockResolvedValue({
      data: { status: true, data: { difficulty: 1, block_reward: 1 } }
    });
    service = new ProfitabilityService();
    vi.clearAllMocks();
  });

  const coins = [
    { symbol: 'XMR', diff: 1000000, reward: 0.6, payout: 0.1 },
    { symbol: 'BTC', diff: 50000000, reward: 6.25, payout: 0.005 },
    { symbol: 'ERGO', diff: 2000000000, reward: 2.2, payout: 1.0 },
    { symbol: 'CFX', diff: 100000000, reward: 2.0, payout: 1.0 },
    { symbol: 'RVN', diff: 100000, reward: 2500, payout: 50.0 }
  ];

  it.each(coins)('should calculate theoretical rate and ETA for $symbol', async ({ symbol, diff, reward, payout }) => {
    // Mock network stats response
    if (symbol === 'BTC') {
      vi.mocked(axios.get)
        .mockResolvedValueOnce({ data: diff }) // getdifficulty
        .mockResolvedValueOnce({ data: reward }); // bcperblock
    } else {
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: {
          status: true,
          data: { difficulty: diff, block_reward: reward }
        }
      });
    }

    await service.fetchNetworkStats(symbol);

    // Initial state: calculando
    const report1 = service.getFinanceReport();
    expect(report1.etaPayout).toBe('calculando...');

    // Update with hashrate (e.g., 1000 H/s)
    service.update(50, 50, 1000, 1000, 1000, 1.10, symbol);

    const report2 = service.getFinanceReport();
    expect(report2.etaPayout).not.toBe('calculando...');
    expect(report2.minPayout).toBe(payout);
    expect(report2.coinAmount).toBe(0); // Before shares
  });

  it('should accumulate coins when adding shares', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: { status: true, data: { difficulty: 1000000, block_reward: 1 } }
    });

    await service.fetchNetworkStats('XMR');

    // Add a share with 1/10th of network difficulty
    service.addShare(100000);

    const report = service.getFinanceReport();
    // Formula: (100000 / 1000000) * 1 * 0.99 = 0.099
    expect(report.coinAmount).toBeCloseTo(0.099, 4);
  });
});
