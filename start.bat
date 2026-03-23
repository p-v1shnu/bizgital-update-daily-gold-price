@echo off
cd /d "%~dp0"
start "Gold Price Poster Server" /min cmd /c node server.js
powershell -NoProfile -ExecutionPolicy Bypass -Command "$url='http://127.0.0.1:3210'; $ready=$false; for ($i=0; $i -lt 80; $i++) { try { Invoke-WebRequest -Uri $url -UseBasicParsing | Out-Null; $ready=$true; break } catch { Start-Sleep -Milliseconds 250 } }; if ($ready) { Start-Process $url } else { Write-Host 'Server did not become ready in time.' }"
