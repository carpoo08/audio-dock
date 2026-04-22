$port = 8000
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$ipv4Addresses = Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object {
    $_.IPAddress -notlike "169.254.*" -and
    $_.IPAddress -ne "127.0.0.1" -and
    $_.PrefixOrigin -ne "WellKnown"
  } |
  Select-Object -ExpandProperty IPAddress

Write-Host ""
Write-Host "Audio Dock server"
Write-Host "Folder: $root"
Write-Host "Port: $port"
Write-Host ""
Write-Host "Open on this PC:"
Write-Host "  http://localhost:$port"
Write-Host ""
Write-Host "Open on your phone (same Wi-Fi):"

if ($ipv4Addresses) {
  foreach ($ip in $ipv4Addresses) {
    Write-Host "  http://$ip`:$port"
  }
} else {
  Write-Host "  IPv4 address not found. Check your network connection."
}

Write-Host ""
Write-Host "Keep this window open while using the site."
Write-Host "Press Ctrl+C to stop the server."
Write-Host ""

Set-Location $root
py -m http.server $port --bind 0.0.0.0
