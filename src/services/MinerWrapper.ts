import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface MinerConfig {
  coin: string;
  algorithm: string;
  poolUrl: string;
  user: string;
  pass: string;
}

export class MinerWrapper {
  private child: ChildProcess | null = null;
  private buffer: string = '';

  /**
   * Checks if Gminer binary exists.
   */
  public hasExternalMiner(): boolean {
    const minerPath = path.join(process.cwd(), 'miners', 'miner.exe');
    return fs.existsSync(minerPath);
  }

  /**
   * Starts Gminer for KAWPOW/Autolykos2/Octopus.
   */
  public startMiner(config: MinerConfig, onLog: (msg: string) => void, onHashrate: (val: number) => void): boolean {
    const minerPath = path.join(process.cwd(), 'miners', 'miner.exe');
    if (!fs.existsSync(minerPath)) return false;

    let algoArg = 'kawpow';
    if (config.algorithm === 'Autolykos2') algoArg = 'autolykos2';
    if (config.algorithm === 'Octopus') algoArg = 'octopus';

    // Gminer args: --algo <algo> --server <host> --port <port> --user <user> --pass <pass>
    // poolUrl comes as "host:port" or "stratum+tcp://host:port"
    // Gminer separates server and port usually, but supports --server host:port too.

    // Clean protocol for Gminer if needed, but usually host:port works
    let server = config.poolUrl.replace('stratum+tcp://', '');

    const args = [
      '--algo', algoArg,
      '--server', server,
      '--user', config.user,
      '--pass', config.pass,
      '--api', '12000', // Optional API
      '--color', '0'    // Use --color 0 if supported for no color, or rely on TUI escaping
    ];

    onLog(`🚀 Iniciando Gminer: ${minerPath} ${args.join(' ')}`);

    this.child = spawn(minerPath, args, { shell: true });

    this.child.stdout?.on('data', (data) => {
      const str = data.toString();
      this.buffer += str;

      // Log relevant info - VERBOSE
      // if (str.includes('Share') || str.includes('Speed') || str.includes('Error') || str.includes('GPU')) {
      onLog(`[Gminer] ${str.trim()}`);
      // }

      // Parse Hashrate
      // Example: "Speed: 10.50 MH/s" or similar
      const hashrateMatch = str.match(/Speed: (\d+\.\d+) MH\/s/);
      if (hashrateMatch) {
        const mh = parseFloat(hashrateMatch[1]);
        onHashrate(mh * 1000000);
      }
    });

    this.child.stderr?.on('data', (data) => {
      const errStr = data.toString();
      // Gminer often prints status to stderr too
      onLog(`[Gminer] ${errStr.trim()}`);
    });

    this.child.on('close', (code) => {
      onLog(`⚠️ Gminer encerrou com código ${code}.`);
      this.child = null;
    });

    return true;
  }

  public stop() {
    if (this.child) {
      this.child.kill();
      this.child = null;
    }
  }
}
