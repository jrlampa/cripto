"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdleDetector = void 0;
const child_process_1 = require("child_process");
const events_1 = require("events");
class IdleDetector extends events_1.EventEmitter {
    isIdle = false;
    checkInterval = null;
    IDLE_THRESHOLD_MS = 60000; // 1 minuto de ócio
    constructor() {
        super();
    }
    start() {
        console.log("🔍 Monitor de ócio iniciado...");
        this.checkInterval = setInterval(() => this.checkIdleTime(), 5000);
    }
    stop() {
        if (this.checkInterval)
            clearInterval(this.checkInterval);
    }
    checkIdleTime() {
        const psCommand = `Add-Type @"
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
"@; [IdleTime]::GetIdleTime()`;
        (0, child_process_1.exec)(`powershell -Command "${psCommand.replace(/"/g, '\\"')}"`, (error, stdout) => {
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
exports.IdleDetector = IdleDetector;
//# sourceMappingURL=IdleDetector.js.map