$ErrorActionPreference = "Stop"

$minersDir = Join-Path $PSScriptRoot "..\miners"
if (-not (Test-Path $minersDir)) {
    New-Item -ItemType Directory -Path $minersDir | Out-Null
}

# Gminer 3.44
$url = "https://github.com/develsoftware/GMinerRelease/releases/download/3.44/gminer_3_44_windows64.zip"
$zipPath = Join-Path $minersDir "gminer.zip"

Write-Host "⬇️  Downloading Gminer (v3.44)..." -ForegroundColor Cyan
try {
    Invoke-WebRequest -Uri $url -OutFile $zipPath
} catch {
    Write-Error "Failed to download Gminer. Check internet/GitHub."
    exit 1
}

Write-Host "📦 Extracting..." -ForegroundColor Cyan
try {
    Expand-Archive -Path $zipPath -DestinationPath $minersDir -Force
} catch {
    Write-Error "Failed to extract zip."
    exit 1
}

Remove-Item $zipPath

$exePath = Join-Path $minersDir "miner.exe"
if (Test-Path $exePath) {
    Write-Host "✅ Gminer installed successfully at: $exePath" -ForegroundColor Green
    Write-Host "   You can now restart the miner to use GPU Mode." -ForegroundColor Green
} else {
    Write-Host "⚠️  Extracted, but 'miner.exe' not found. Check subfolders." -ForegroundColor Yellow
    Get-ChildItem $minersDir
}
