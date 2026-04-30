param(
  [string]$Identity = "poll-admin",
  [string]$PollAlias = "live-poll",
  [string]$RewardAlias = "live-poll-reward",
  [string]$FrontendEnvPath = "..\frontend\.env",
  [string]$Question = "Which advanced mode should we showcase?",
  [string]$OptionA = "Token vote flow",
  [string]$OptionB = "Responsive polish",
  [string]$RewardTokenName = "Poll Reward Token",
  [string]$RewardTokenSymbol = "VOTE"
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

$sourceAddress = stellar keys public-key $Identity
$pollWasmPath = "target\wasm32v1-none\release\live_poll.wasm"
$rewardWasmPath = "target\wasm32v1-none\release\poll_reward_token.wasm"

Write-Host "Deploying reward token contract..."
$rewardContractId = stellar contract deploy `
  --wasm $rewardWasmPath `
  --source-account $Identity `
  --network testnet `
  --alias $RewardAlias

if (-not $rewardContractId) {
  Write-Host "Reading reward token contract ID from alias..."
  $rewardContractId = stellar contract alias show $RewardAlias
}

Write-Host "Deploying poll contract..."
$pollContractId = stellar contract deploy `
  --wasm $pollWasmPath `
  --source-account $Identity `
  --network testnet `
  --alias $PollAlias

if (-not $pollContractId) {
  Write-Host "Reading poll contract ID from alias..."
  $pollContractId = stellar contract alias show $PollAlias
}

Write-Host "Initializing reward token contract..."
stellar contract invoke `
  --id $rewardContractId `
  --source-account $Identity `
  --network testnet `
  -- init `
  --admin $sourceAddress `
  --minter $pollContractId `
  --name $RewardTokenName `
  --symbol $RewardTokenSymbol

Write-Host "Initializing poll contract..."
stellar contract invoke `
  --id $pollContractId `
  --source-account $Identity `
  --network testnet `
  -- init `
  --admin $sourceAddress `
  --reward-token $rewardContractId `
  --question $Question `
  --option-a $OptionA `
  --option-b $OptionB

Write-Host "Poll contract: $pollContractId"
Write-Host "Reward token contract: $rewardContractId"

$resolvedEnvPath = Resolve-Path (Join-Path $contractsRoot $FrontendEnvPath) -ErrorAction SilentlyContinue
if (-not $resolvedEnvPath) {
  Write-Warning "Frontend env file not found at $FrontendEnvPath. Skipping env update."
  exit 0
}

$envContent = Get-Content $resolvedEnvPath
if ($envContent -match "^VITE_STELLAR_CONTRACT_ID=") {
  $updated = $envContent -replace "^VITE_STELLAR_CONTRACT_ID=.*$", "VITE_STELLAR_CONTRACT_ID=$pollContractId"
} else {
  $updated = @($envContent + "VITE_STELLAR_CONTRACT_ID=$pollContractId")
}

$updated = if ($updated -match "^VITE_STELLAR_REWARD_TOKEN_ID=") {
  $updated -replace "^VITE_STELLAR_REWARD_TOKEN_ID=.*$", "VITE_STELLAR_REWARD_TOKEN_ID=$rewardContractId"
} else {
  @($updated + "VITE_STELLAR_REWARD_TOKEN_ID=$rewardContractId")
}

$updated = if ($updated -match "^VITE_STELLAR_VOTE_TOKEN_ID=") {
  $updated -replace "^VITE_STELLAR_VOTE_TOKEN_ID=.*$", "VITE_STELLAR_VOTE_TOKEN_ID=$rewardContractId"
} else {
  @($updated + "VITE_STELLAR_VOTE_TOKEN_ID=$rewardContractId")
}

Set-Content -Path $resolvedEnvPath -Value $updated
Write-Host "Updated frontend env: $resolvedEnvPath"
