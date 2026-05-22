param(
  [string]$Token = ""
)

if ([string]::IsNullOrWhiteSpace($Token)) {
  if (-not [string]::IsNullOrWhiteSpace($env:WRITE_API_TOKEN)) {
    $Token = $env:WRITE_API_TOKEN
  }
}

if ([string]::IsNullOrWhiteSpace($Token)) {
  Write-Host "ERROR: token is required" -ForegroundColor Red
  Write-Host 'Usage: .\scripts\test-publish-houn.ps1 -Token "your-token"'
  Write-Host 'Or set env var: $env:WRITE_API_TOKEN="your-token"'
  exit 1
}

$payload = @{
  date = "21/05/2026"
  time = "11:59"
  barSellOneBaht = "55,200,000"
  barBuyOneBaht = "54,670,000"
  printSellOneBaht = "55,300,000"
  printBuyOneBaht = "53,890,000"
  printSellOneSalueng = "13,825,000"
  printBuyOneSalueng = "13,473,000"
  printSellFiveHoun = "6,912,000"
  printBuyFiveHoun = "6,737,000"
} | ConvertTo-Json -Compress

curl.exe -i -X POST "http://127.0.0.1:3210/api/publish-wordpress" `
  -H "Content-Type: application/json" `
  -H "X-Write-Token: $Token" `
  --data-raw $payload
