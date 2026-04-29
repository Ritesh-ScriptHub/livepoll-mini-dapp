# Contracts

Soroban workspace for the LivePoll contract.

## What the contract does

- stores a single poll question with two choices
- restricts voting to one vote per Stellar address
- exposes read methods for poll state, admin, and wallet vote history
- emits `init` and `vote` events for frontend activity tracking

## Key files

- `Cargo.toml`: workspace configuration
- `live_poll/src/lib.rs`: contract implementation
- `live_poll/src/test.rs`: contract tests
- `scripts/deploy-testnet.ps1`: testnet deployment helper

## Commands

```powershell
cd contracts
cargo test
stellar contract build
.\scripts\deploy-testnet.ps1
```

## Test coverage

- initializes a poll and records a vote
- rejects double voting
- rejects reading poll state before initialization
- rejects invalid vote choices
- keeps error codes stable for frontend mapping

## Deploy helper behavior

The deploy script:

1. builds the contract
2. ensures the selected Stellar identity exists and is funded on testnet
3. deploys the contract with the requested alias
4. reads the deployed contract ID
5. writes the contract ID back into `frontend/.env`

## Latest deployed contract

- Contract ID: `CDGFRHDXK5YMXO5DUPB7M3CHC34L3KIJAHUHRZ6XETEUX5APZO3I74KX`
- Transaction: `f72a461608d5a6eb746e1473f183d32ff4b88b24bcc04f3bf50addcd1de8b875`
