export const RPC_URL =
  import.meta.env.VITE_STELLAR_RPC_URL || "https://soroban-testnet.stellar.org";

export const HORIZON_URL =
  import.meta.env.VITE_STELLAR_HORIZON_URL || "https://horizon-testnet.stellar.org";

export const NETWORK_PASSPHRASE =
  import.meta.env.VITE_STELLAR_NETWORK_PASSPHRASE ||
  "Test SDF Network ; September 2015";

export const CONTRACT_ID = import.meta.env.VITE_STELLAR_CONTRACT_ID || "";

export const MIN_BALANCE_XLM = 1.5;

