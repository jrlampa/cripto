import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProfitabilityService } from '../src/ProfitabilityService';
import axios from 'axios';

vi.mock('axios');

describe('ProfitabilityService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch network stats correctly', async () => {
    const mockStats = {
      status: true,
      data: {
        difficulty: 300000000000,
        block_reward: 0.6
      }
    };
    (axios.get as any).mockResolvedValue({ data: mockStats });

    const service = new ProfitabilityService();
    await service.fetchNetworkStats();

    // update com hashrate simulado
    service.update(50, 0, 1000, 800, 1000); // 1000 H/s, 1 segundo

    // Simula um share encontrado para gerar receita (necessário após refatoração PPS)
    service.addShare(10000);

    const report = service.getFinanceReport();
    expect(report.xmr).toBeGreaterThan(0);
  });

  it('should calculate cost based on CPU load', () => {
    const service = new ProfitabilityService();
    // Forçamos dificuldade para evitar NaN se o fetch falhar
    (service as any).networkDifficulty = 1000000;
    (service as any).blockReward = 0.6;

    service.update(100, 0, 1000, 800, 3600000); // 1 hora a 100% CPU

    const report = service.getFinanceReport();
    // 60W (CPU 100%) + 10W (GPU Idle) = 70W total
    expect(report.cost).toBeCloseTo((70 / 1000) * 1 * 1.10, 5);
  });

  it('should provide formatted ETAs', () => {
    const service = new ProfitabilityService();
    (service as any).smoothedRate = 0.0000001; // Taxa de XMR/ms

    const report = service.getFinanceReport(0.05); // Já minerou 0.05
    expect(report.etaPayout).toBeDefined();
    expect(typeof report.etaPayout).toBe('string');
  });
});
