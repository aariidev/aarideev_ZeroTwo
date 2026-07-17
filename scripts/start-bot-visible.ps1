$ErrorActionPreference = "Continue"
Set-Location "H:\Discord\02"
Get-Content "H:\Discord\02\.env" | ForEach-Object {
  if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
    $key = $matches[1]
    $val = $matches[2].Trim()
    # strip optional surrounding quotes
    if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
      $val = $val.Substring(1, $val.Length - 2)
    }
    [System.Environment]::SetEnvironmentVariable($key, $val, 'Process')
  }
}
$env:NODE_ENV = "development"
# quick music env sanity (no secrets printed)
$sp = @('SPOTIFY_CLIENT_ID','SPOTIFY_CLIENT_SECRET','SPOTIFY_REFRESH_TOKEN') | ForEach-Object {
  $v = [Environment]::GetEnvironmentVariable($_, 'Process')
  if ([string]::IsNullOrWhiteSpace($v)) { "$_=NO" } else { "$_=OK($($v.Length))" }
}
Write-Host "Music env: $($sp -join ' | ')" -ForegroundColor DarkCyan
Write-Host "Zero Two API + Bot (Dev Panel sync)..." -ForegroundColor Magenta
Set-Location "H:\Discord\02\artifacts\api-server"
node --enable-source-maps ./dist/index.mjs
Write-Host "Bot detenido. Enter para cerrar." -ForegroundColor Yellow
[void][System.Console]::ReadLine()
