# 1-Minute Demo Video Script

## Goal

Show the complete end-to-end mini-dApp flow in about 60 seconds.

## Shot list

1. Start on the LivePoll homepage.
   Mention: "This is a Soroban mini-dApp running on Stellar testnet."

2. Open the wallet picker and connect a supported wallet.
   Mention: "The frontend supports multiple Stellar wallets."

3. Show the wallet status card and contract ID.
   Mention: "The app is wired to a deployed testnet contract."

4. If using a fresh deployment, initialize the poll on-chain.
   Mention: "Initialization writes the poll question and both options into the contract."

5. Submit a vote.
   Mention: "The app prepares, signs, submits, and tracks the transaction."

6. Wait for the success state.
   Mention: "The UI shows a loading state and then confirms once the ledger includes the transaction."

7. Show updated totals and the live activity panel.
   Mention: "The frontend refreshes the poll data and streams contract events from RPC."

8. Close on the wallet status and final vote totals.
   Mention: "This completes the end-to-end contract, frontend, and integration flow."

## Recording checklist

- Use a funded Stellar testnet wallet
- Keep the browser on testnet
- Have the contract ID visible in the sidebar
- Keep the terminal ready in case you want to show the deploy/test commands
