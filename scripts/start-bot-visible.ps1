$ErrorActionPreference = "Continue"
Set-Location "H:\Discord\02"
Get-Content "H:\Discord\02\.env" | ForEach-Object {
  if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$') {
    [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
  }
}
$env:NODE_ENV = "development"
Write-Host "Zero Two API + Bot (Dev Panel sync)..." -ForegroundColor Magenta
Set-Location "H:\Discord\02\artifacts\api-server"
node --enable-source-maps ./dist/index.mjs
Write-Host "Bot detenido. Enter para cerrar." -ForegroundColor Yellow
[void][System.Console]::ReadLine()
