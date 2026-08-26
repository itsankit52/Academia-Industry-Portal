$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
Set-Location $RootDir

Write-Host '==> Checking Node.js'
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Host '  Node.js not installed. Install Node 20+ from https://nodejs.org first.' -ForegroundColor Red
    exit 1
}
$nodeVersion = & node -p 'process.versions.node.split(".")[0]'
if ([int]$nodeVersion -lt 20) {
    Write-Host "  Node.js 20+ required. Current: $(node -v)" -ForegroundColor Red
    exit 1
}
Write-Host "   Node $(node -v) OK"

Write-Host '==> Checking pnpm'
$pnpmCmd = Get-Command pnpm -ErrorAction SilentlyContinue
if (-not $pnpmCmd) {
    Write-Host '   pnpm not found. Installing pnpm@9 globally...'
    & npm install -g pnpm@9
}
Write-Host "   pnpm $(pnpm --version) OK"

Write-Host '==> Installing dependencies'
& pnpm install

Write-Host '==> Setting up .env'
if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
    Write-Host '   Created .env from .env.example'
    Write-Host ''
    Write-Host '   Generating JWT secrets:'
    & node scripts/gen-secrets.mjs
    Write-Host ''
    Write-Host '   Paste the two secrets above into .env' -ForegroundColor Yellow
    Write-Host '   Also fill in MONGODB_URI (get from https://cloud.mongodb.com)' -ForegroundColor Yellow
}
else {
    Write-Host '   .env already exists - skipping'
}

Write-Host ''
Write-Host '==> Next steps:'
Write-Host '   1. Edit .env - set MONGODB_URI and paste JWT secrets'
Write-Host '   2. Validate: node scripts\check-env.mjs'
Write-Host '   3. Seed database: pnpm seed'
Write-Host '   4. Start dev: pnpm dev'
Write-Host ''
Write-Host '==> Setup complete' -ForegroundColor Green
