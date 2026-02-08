import { exec } from 'child_process';

export interface GPUInfo {
  model: string;
  load: number;
  memoryUsed: number;
  temperature?: number;
}

export class GPUDetector {
  private lastInfo: GPUInfo | null = null;

  public async detect(): Promise<GPUInfo | null> {
    try {
      // Tenta detectar via nvidia-smi primeiro (NVIDIA)
      const nvidiaInfo = await this.getNvidiaInfo();
      if (nvidiaInfo) return nvidiaInfo;

      // Se não for NVIDIA, tenta via WMIC (AMD/Intel/Universal no Windows)
      const wmicInfo = await this.getWmicInfo();
      return wmicInfo;
    } catch (e) {
      return null;
    }
  }

  private getNvidiaInfo(): Promise<GPUInfo | null> {
    return new Promise((resolve) => {
      exec('nvidia-smi --query-gpu=gpu_name,utilization.gpu,memory.used --format=csv,noheader,nounits', (err, stdout) => {
        if (err || !stdout) return resolve(null);
        const parts = stdout.split(',').map(s => s.trim());
        if (parts.length < 3) return resolve(null);
        const name = parts[0] as string;
        const load = parts[1] as string;
        const mem = parts[2] as string;
        resolve({
          model: name,
          load: parseInt(load) || 0,
          memoryUsed: parseInt(mem) || 0
        });
      });
    });
  }

  private getWmicInfo(): Promise<GPUInfo | null> {
    return new Promise((resolve) => {
      exec('wmic path win32_VideoController get name', (err, stdout) => {
        if (err || !stdout) return resolve(null);
        const lines = stdout.split('\n').filter(l => l.trim() !== '' && !l.includes('Name'));
        if (lines.length === 0) return resolve(null);
        const modelName = (lines[0] || 'Desconhecido').trim();

        resolve({
          model: modelName,
          load: 0, // WMIC não dá carga em tempo real facilmente
          memoryUsed: 0
        });
      });
    });
  }
}
