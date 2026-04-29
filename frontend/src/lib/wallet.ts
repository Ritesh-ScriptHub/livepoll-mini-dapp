import { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit/stellar-wallets-kit.mjs";
import { WalletNetwork } from "@creit.tech/stellar-wallets-kit/types.mjs";
import { FREIGHTER_ID, FreighterModule } from "@creit.tech/stellar-wallets-kit/modules/freighter.module.mjs";
import { XBULL_ID, xBullModule } from "@creit.tech/stellar-wallets-kit/modules/xbull.module.mjs";
import { ALBEDO_ID, AlbedoModule } from "@creit.tech/stellar-wallets-kit/modules/albedo.module.mjs";
import { LOBSTR_ID, LobstrModule } from "@creit.tech/stellar-wallets-kit/modules/lobstr.module.mjs";
import { RABET_ID, RabetModule } from "@creit.tech/stellar-wallets-kit/modules/rabet.module.mjs";
import { HANA_ID, HanaModule } from "@creit.tech/stellar-wallets-kit/modules/hana.module.mjs";
import { HORIZON_URL, NETWORK_PASSPHRASE } from "../config";
import type { WalletAccount } from "../types";

export type WalletOption = {
  id: string;
  name: string;
};

let walletKit: StellarWalletsKit | null = null;
const supportedModules = [
  new FreighterModule(),
  new xBullModule(),
  new AlbedoModule(),
  new LobstrModule(),
  new RabetModule(),
  new HanaModule(),
];

export const WALLET_OPTIONS: WalletOption[] = [
  { id: FREIGHTER_ID, name: "Freighter" },
  { id: XBULL_ID, name: "xBull" },
  { id: ALBEDO_ID, name: "Albedo" },
  { id: LOBSTR_ID, name: "LOBSTR" },
  { id: RABET_ID, name: "Rabet" },
  { id: HANA_ID, name: "Hana" },
];

function getKit() {
  if (!walletKit) {
    walletKit = new StellarWalletsKit({
      network: WalletNetwork.TESTNET,
      selectedWalletId: FREIGHTER_ID,
      modules: supportedModules,
    });
  }

  return walletKit;
}

async function connectSelectedWallet(walletId: string, walletName: string) {
  const kit = getKit();
  await kit.setWallet(walletId);
  const { address } = await kit.getAddress();
  return { address, walletName };
}

export async function chooseWallet(walletId: string): Promise<{ address: string; walletName: string }> {
  const wallet = WALLET_OPTIONS.find((option) => option.id === walletId);
  if (!wallet) {
    throw new Error("Please select a supported Stellar wallet.");
  }

  return connectSelectedWallet(wallet.id, wallet.name);
}

export async function signTransaction(transactionXdr: string, address: string) {
  const kit = getKit();
  return kit.signTransaction(transactionXdr, {
    address,
    networkPassphrase: NETWORK_PASSPHRASE,
  });
}

export async function disconnectWalletSession() {
  if (!walletKit) {
    return;
  }

  try {
    await walletKit.disconnect();
  } catch {
    // Keep local UI usable even if a wallet adapter does not expose a full disconnect flow.
  }
}

export async function fetchAccount(address: string): Promise<WalletAccount> {
  const response = await fetch(`${HORIZON_URL}/accounts/${address}`);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("This wallet is connected, but that address was not found on Stellar testnet.");
    }
    throw new Error("Could not load the Stellar account from Horizon.");
  }

  const data = await response.json();
  const nativeBalance = data.balances?.find((balance: { asset_type: string }) => balance.asset_type === "native");

  return {
    address,
    balance: nativeBalance ? Number(nativeBalance.balance) : null,
  };
}
