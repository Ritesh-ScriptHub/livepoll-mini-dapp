param(
  [string]$Identity = "poll-admin",
  [string]$Alias = "live-poll",
  [string]$FrontendEnvPath = "..\frontend\.env"
)

$ErrorActionPreference = "Stop"
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$contractsRoot = Resolve-Path (Join-Path $scriptRoot "..")
Set-Location $contractsRoot

Write-Host "Building contract..."
stellar contract build

Write-Host "Ensuring testnet identity is funded..."
$knownIdentities = stellar keys ls
if ($knownIdentities -match "(?m)^$([regex]::Escape($Identity))$") {
  stellar keys fund $Identity --network testnet
} else {
  stellar keys generate $Identity --network testnet --fund
}

$wasmPath = "target\wasm32v1-none\release\live_poll.wasm"

Write-Host "Deploying contract..."
$contractId = stellar contract deploy `
  --wasm $wasmPath `
  --source-account $Identity `
  --network testnet `
  --alias $Alias

if (-not $contractId) {
  Write-Host "Reading contract ID from alias..."
  $contractId = stellar contract alias show $Alias
}

Write-Host $contractId

$resolvedEnvPath = Resolve-Path (Join-Path $contractsRoot $FrontendEnvPath) -ErrorAction SilentlyContinue
if (-not $resolvedEnvPath) {
  Write-Warning "Frontend env file not found at $FrontendEnvPath. Skipping env update."
  exit 0
}

$envContent = Get-Content $resolvedEnvPath
if ($envContent -match "^VITE_STELLAR_CONTRACT_ID=") {
  $updated = $envContent -replace "^VITE_STELLAR_CONTRACT_ID=.*$", "VITE_STELLAR_CONTRACT_ID=$contractId"
} else {
  $updated = @($envContent + "VITE_STELLAR_CONTRACT_ID=$contractId")
}

Set-Content -Path $resolvedEnvPath -Value $updated
Write-Host "Updated frontend env: $resolvedEnvPath"
