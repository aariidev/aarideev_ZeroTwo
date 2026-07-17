# Start Zero Two dashboard in a visible console (Windows).
# Re-links native optional deps that are missing when node_modules
# was installed on Linux/Replit.

$ErrorActionPreference = "Continue"
Set-Location "H:\Discord\02"

function Ensure-Junction {
  param([string]$Target, [string]$Link)
  if (-not (Test-Path -LiteralPath $Target)) {
    Write-Host "  [skip] missing target: $Target" -ForegroundColor DarkYellow
    return
  }
  $parent = Split-Path -Parent $Link
  if (-not (Test-Path -LiteralPath $parent)) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  }
  if (Test-Path -LiteralPath $Link) {
    Remove-Item -LiteralPath $Link -Force -Recurse -ErrorAction SilentlyContinue
  }
  New-Item -ItemType Junction -Path $Link -Target $Target | Out-Null
  Write-Host "  [ok] $Link" -ForegroundColor DarkGray
}

Write-Host "Arrancando Dashboard de Zero Two..." -ForegroundColor Magenta
Write-Host "Reparando binarios nativos de Windows (rollup/lightningcss)..." -ForegroundColor DarkCyan

$pnpm = "H:\Discord\02\node_modules\.pnpm"

# Rollup win32 binary (required by Vite)
$rollupNative = Join-Path $pnpm "@rollup+rollup-win32-x64-msvc@4.59.0\node_modules\@rollup\rollup-win32-x64-msvc"
if (-not (Test-Path -LiteralPath $rollupNative)) {
  # fallback: any installed version
  $found = Get-ChildItem (Join-Path $pnpm "@rollup+rollup-win32-x64-msvc@*") -Directory -ErrorAction SilentlyContinue |
    ForEach-Object { Join-Path $_.FullName "node_modules\@rollup\rollup-win32-x64-msvc" } |
    Where-Object { Test-Path $_ } |
    Select-Object -First 1
  if ($found) { $rollupNative = $found }
}

Get-ChildItem $pnpm -Directory -Filter "rollup@*" -ErrorAction SilentlyContinue | ForEach-Object {
  Ensure-Junction -Target $rollupNative -Link (Join-Path $_.FullName "node_modules\@rollup\rollup-win32-x64-msvc")
}

# Lightningcss win32 binary (Tailwind v4 / Vite)
$lcNative = Join-Path $pnpm "lightningcss-win32-x64-msvc@1.31.1\node_modules\lightningcss-win32-x64-msvc"
$lcDir = Join-Path $pnpm "lightningcss@1.31.1\node_modules\lightningcss"
if (Test-Path -LiteralPath $lcNative) {
  $nodeFile = Get-ChildItem -LiteralPath $lcNative -Filter "*.node" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($nodeFile -and (Test-Path -LiteralPath $lcDir)) {
    Copy-Item -LiteralPath $nodeFile.FullName -Destination (Join-Path $lcDir "lightningcss.win32-x64-msvc.node") -Force
    Write-Host "  [ok] lightningcss native binary" -ForegroundColor DarkGray
  }
  Ensure-Junction -Target $lcNative -Link (Join-Path $lcDir "node_modules\lightningcss-win32-x64-msvc")
}

$env:PORT = "5173"
$env:BASE_PATH = "/"
$env:NODE_ENV = "development"
# Avoid hard-fail on ignored lifecycle scripts during filter runs
$env:npm_config_strict_dep_builds = "false"

# VS Code Dev Tunnel (optional) — set host without protocol for Vite HMR
if (-not $env:TUNNEL_HOST) {
  $env:TUNNEL_HOST = "zj4nchh4-5173.uks1.devtunnels.ms"
}

Write-Host ""
Write-Host "URL: http://localhost:5173/" -ForegroundColor Cyan
Write-Host "API proxy -> http://localhost:8080" -ForegroundColor DarkGray
Write-Host ""

# Prefer direct vite (skips full monorepo install gate); fallback to filter run
$viteJs = "H:\Discord\02\artifacts\dashboard\node_modules\vite\bin\vite.js"
$dashDir = "H:\Discord\02\artifacts\dashboard"

if (Test-Path -LiteralPath $viteJs) {
  Set-Location $dashDir
  node $viteJs --config vite.config.ts --host 0.0.0.0
} else {
  Set-Location "H:\Discord\02"
  pnpm --filter @workspace/dashboard run dev
}

Write-Host ""
Write-Host "El dashboard se detuvo. Pulsa Enter para cerrar." -ForegroundColor Yellow
[void][System.Console]::ReadLine()
