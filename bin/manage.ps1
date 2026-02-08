param (
    [Parameter(Mandatory=$true)]
    [ValidateSet("start", "stop", "pause", "status")]
    $action
)

$PID_FILE = "$PSScriptRoot/../miner.pid"

switch ($action) {
    "start" {
        if (Test-Path $PID_FILE) {
            Write-Host "⚠️ Minerador já parece estar rodando." -ForegroundColor Yellow
            return
        }
        Write-Host "🚀 Iniciando minerador em background..." -ForegroundColor Cyan
        Start-Process npm -ArgumentList "start" -WindowStyle Hidden -PassThru | Out-File $PID_FILE
        Write-Host "✅ Minerador iniciado com sucesso." -ForegroundColor Green
    }
    "stop" {
        if (-not (Test-Path $PID_FILE)) {
            Write-Host "❌ Nenhum minerador em execução encontrado." -ForegroundColor Red
            return
        }
        $pidVal = Get-Content $PID_FILE
        Stop-Process -Id $pidVal -Force -ErrorAction SilentlyContinue
        Remove-Item $PID_FILE
        Write-Host "🛑 Minerador parado." -ForegroundColor Red
    }
    "status" {
        if (Test-Path $PID_FILE) {
            Write-Host "💎 O minerador está RODANDO." -ForegroundColor Green
        } else {
            Write-Host "🌑 O minerador está PARADO." -ForegroundColor Gray
        }
    }
}
