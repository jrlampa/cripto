import { exec } from 'child_process';
import { EventEmitter } from 'events';

export class IdleDetector extends EventEmitter {
  public isIdle: boolean = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly IDLE_THRESHOLD_MS = 60000; // 1 minuto de ócio

  constructor() {
    super();
  }

  public start(): void {
    console.log("🔍 Monitor de ócio iniciado...");
    this.checkInterval = setInterval(() => this.checkIdleTime(), 5000);
  }

  public isIdleState(): boolean {
    return this.isIdle;
  }

  public stop(): void {
    if (this.checkInterval) clearInterval(this.checkInterval);
  }

  private checkIdleTime(): void {
    const psScript = `
$code = @'
using System;
using System.Runtime.InteropServices;
public class IdleTime {
    [StructLayout(LayoutKind.Sequential)]
    struct LASTINPUTINFO {
        public static readonly int SizeOf = Marshal.SizeOf(typeof(LASTINPUTINFO));
        public uint cbSize;
        public uint dwTime;
    }
    [DllImport("user32.dll")]
    static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
    public static int GetIdleTime() {
        LASTINPUTINFO lastInputInfo = new LASTINPUTINFO();
        lastInputInfo.cbSize = (uint)Marshal.SizeOf(lastInputInfo);
        GetLastInputInfo(ref lastInputInfo);
        return ((int)Environment.TickCount - (int)lastInputInfo.dwTime);
    }
}
'@
Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
[IdleTime]::GetIdleTime()
`;

    const encodedScript = Buffer.from(psScript, 'utf16le').toString('base64');
    exec(`powershell -NoProfile -EncodedCommand ${encodedScript}`, (error, stdout) => {
      if (error) {
        console.error("❌ Erro ao verificar ócio:", error.message);
        return;
      }

      const idleTime = parseInt(stdout.trim(), 10);
      const currentlyIdle = idleTime > this.IDLE_THRESHOLD_MS;

      if (currentlyIdle !== this.isIdle) {
        this.isIdle = currentlyIdle;
        this.emit('change', this.isIdle);
        console.log(`🖥️ Estado do sistema alterado: ${this.isIdle ? 'ÓCIO' : 'EM USO'} (${Math.round(idleTime / 1000)}s)`);
      }
    });
  }
}
