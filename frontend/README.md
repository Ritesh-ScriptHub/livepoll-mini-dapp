# Frontend

React + Vite client for the LivePoll Soroban mini-dApp.

## Frontend responsibilities

- connect to supported Stellar wallets
- read poll state from the deployed Soroban contract
- initialize and vote through signed transactions
- show transaction progress and completion states
- cache recent poll snapshots for faster perceived loading
- display recent contract events from Stellar RPC

## Important files

- `src/App.tsx`: main app experience
- `src/lib/stellar.ts`: Soroban RPC helpers
- `src/lib/wallet.ts`: wallet integration helpers
- `src/lib/cache.ts`: TTL-based cache helpers
- `src/lib/errors.ts`: user-facing error mapping
- `src/lib/poll.ts`: poll normalization and percent helpers
- `tests/*.test.ts`: frontend test coverage

## Commands

```powershell
cd frontend
& "C:\Program Files\nodejs\npm.cmd" install
& "C:\Program Files\nodejs\npm.cmd" run dev
& "C:\Program Files\nodejs\npm.cmd" run test
& "C:\Program Files\nodejs\npm.cmd" run build
```

## Environment

The app expects:

- `VITE_STELLAR_RPC_URL`
- `VITE_STELLAR_HORIZON_URL`
- `VITE_STELLAR_NETWORK_PASSPHRASE`
- `VITE_STELLAR_CONTRACT_ID`

The deploy script in `contracts/scripts/deploy-testnet.ps1` updates `VITE_STELLAR_CONTRACT_ID` automatically after a successful deployment.
