$ErrorActionPreference = "Continue"
Set-Location "H:\Discord\02"
Get-Content "H:\Discord\02\.env" | ForEach-Object {
  if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
    $key = $matches[1]
    $val = $matches[2].Trim()
    if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
      $val = $val.Substring(1, $val.Length - 2)
    }
    [System.Environment]::SetEnvironmentVariable($key, $val, 'Process')
  }
}
$env:NODE_ENV = "development"
Write-Host "Zero Two Dev Watcher arrancando..." -ForegroundColor Magenta
node "H:\Discord\02\scripts\dev-watch.mjs"
Write-Host "Watcher detenido. Enter para cerrar." -ForegroundColor Yellow
[void][System.Console]::ReadLine()
