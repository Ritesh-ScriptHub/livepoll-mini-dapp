export function humanizeWalletError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (/connect a wallet to vote/i.test(message)) {
    return "You need to connect your wallet first before submitting a vote.";
  }

  if (/cancel|reject/i.test(message)) {
    return "The wallet request was rejected.";
  }

  if (/not found|not installed|not available/i.test(message)) {
    return "No supported Stellar wallet was found in this browser.";
  }

  if (/not found on stellar testnet/i.test(message)) {
    return "Wallet connected, but the selected address is not funded on Stellar testnet. Switch Freighter to testnet or fund that testnet address first.";
  }

  if (/insufficient/i.test(message)) {
    return "The account does not have enough XLM for the transaction.";
  }

  if (/rpc server is busy/i.test(message)) {
    return "The network is busy right now. Please try submitting the transaction again.";
  }

  if (/rejected the transaction before it was accepted/i.test(message)) {
    return "The Stellar network rejected this transaction. Please verify the wallet account, testnet funding, and whether this wallet already voted.";
  }

  if (/Error\(Contract,\s*#1\)/i.test(message)) {
    return "This contract has already been initialized. Deploy a new contract to create a different poll question.";
  }

  if (/Error\(Contract,\s*#2\)/i.test(message)) {
    return "This contract has been deployed but not initialized yet. Connect a wallet and use Initialize Poll to create the first on-chain poll.";
  }

  return message;
}

export function isContractNotInitializedError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /Error\(Contract,\s*#2\)/i.test(message);
}
