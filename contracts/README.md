# Contracts

Soroban workspace for the LivePoll poll contract and its companion reward-token contract.

## What the contract does

- `live_poll` stores a single poll question with two choices
- `live_poll` restricts voting to one vote per Stellar address
- `live_poll.vote_for` mints reward points by calling into `poll_reward_token`
- `poll_reward_token` tracks balances, total minted rewards, minter ownership, and admin handoff

## Key files

- `Cargo.toml`: workspace configuration
- `live_poll/src/lib.rs`: contract implementation
- `live_poll/src/test.rs`: contract tests
- `poll_reward_token/src/lib.rs`: reward token implementation
- `poll_reward_token/src/test.rs`: reward token tests
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
- mints reward points through an inter-contract call after voting
- rejects double voting
- rejects reading poll state before initialization
- rejects invalid vote choices
- rejects direct reward minting from non-minter callers
- tracks reward-token admin transfer and total minted supply
- keeps error codes stable for frontend mapping

## Deploy helper behavior

The deploy script:

1. builds the contract
2. ensures the selected Stellar identity exists and is funded on testnet
3. deploys the contract with the requested alias
4. reads the deployed contract ID
5. writes the contract ID back into `frontend/.env`

## Latest deployed contracts

- Reward token contract ID: `CAEACAAUTW6JP5LGBFQHAXOLXNBVNPRPOFOHNRH5DEAA6AMWACA5YF3L`
- Reward token deploy transaction: `6194f8a682f7f0a3e613d238e8a6e3d9eb2e6a3cf48d628930228bd988c4414b`
- Poll contract ID: `CBRGNWEUASYW7IPGZTST7NQWCUUXPMZR236NIGVPQGPY6ZJAXQ5SATVY`
- Poll deploy transaction: `35403b04eb27d11eacb2d6035ae578baeb3db0ba0aa9fdb7bdd224733f141826`
- Verified advanced `vote_for` transaction: `4f45efe666c4789d20ce938cacdf08b4bd9fbc2b850dc37116c37c9d17ead53a`
