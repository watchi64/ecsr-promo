# dev.ps1 — Lance la preview locale de TP ECSR App.
# Usage : .\dev.ps1   puis ouvre http://localhost:8000
# Ctrl+C pour arreter.

$port = 8000

# Detecte l'IP locale pour tester depuis le telephone (meme wifi).
$ip = $null
try {
  $ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
    Select-Object -First 1 -ExpandProperty IPAddress)
} catch {}

Write-Host ""
Write-Host "Preview locale TP ECSR App" -ForegroundColor Green
Write-Host "  PC      : http://localhost:$port"
if ($ip) { Write-Host "  Mobile  : http://${ip}:$port   (meme wifi)" }
Write-Host "  Base    : Supabase PROD (les ecritures de test modifient les vraies donnees)" -ForegroundColor Yellow
Write-Host "  Ctrl+C pour arreter."
Write-Host ""

python -m http.server $port
