import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  Keypair,
  TransactionBuilder,
  rpc,
  scValToNative,
  nativeToScVal,
  xdr,
} from "@stellar/stellar-sdk";
import { CONTRACT_ID, NETWORK_PASSPHRASE, RPC_URL } from "../config";
import { normalizePoll } from "./poll";
import type { PollState } from "../types";

const server = new rpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith("http://") });

type RpcEventResponse = {
  events: Array<{
    id: string;
    ledger: number;
    ledgerClosedAt: string;
    txHash: string;
    topic: string[];
    value: string;
  }>;
  latestLedger: number;
  cursor?: string;
};

function assertContractId() {
  if (!CONTRACT_ID) {
    throw new Error("Set VITE_STELLAR_CONTRACT_ID before calling the contract.");
  }
}

function getNetworkPassphrase() {
  return NETWORK_PASSPHRASE;
}

function buildContract() {
  assertContractId();
  return new Contract(CONTRACT_ID);
}

async function loadAccount(address: string) {
  return server.getAccount(address);
}

async function buildReadOnlyTx(method: string, args: xdr.ScVal[] = []) {
  const source = new Account(Keypair.random().publicKey(), "0");
  const contract = buildContract();

  return new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();
}

export async function fetchPollState(): Promise<PollState> {
  const tx = await buildReadOnlyTx("get_poll");
  const simulation = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(simulation.error);
  }

  const result = simulation.result?.retval;
  if (!result) {
    throw new Error("The contract returned no poll data.");
  }

  return normalizePoll(scValToNative(result) as Record<string, unknown>);
}

export async function fetchVoteFor(address: string): Promise<number | null> {
  const tx = await buildReadOnlyTx("get_vote", [new Address(address).toScVal()]);
  const simulation = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(simulation.error);
  }

  const result = simulation.result?.retval;
  if (!result) {
    return null;
  }

  const native = scValToNative(result);
  return native === null || native === undefined ? null : Number(native);
}

export async function prepareWriteTx(
  sourceAddress: string,
  method: "init" | "vote",
  args: xdr.ScVal[],
) {
  const source = await loadAccount(sourceAddress);
  const contract = buildContract();

  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(60)
    .build();

  return server.prepareTransaction(tx);
}

export async function sendSignedTransaction(signedTxXdr: string) {
  const tx = TransactionBuilder.fromXDR(signedTxXdr, getNetworkPassphrase());
  const result = await server.sendTransaction(tx);

  if (result.status === "ERROR") {
    throw new Error("The network rejected the transaction before it was accepted.");
  }

  if (result.status === "TRY_AGAIN_LATER") {
    throw new Error("The Stellar RPC server is busy. Please try the transaction again.");
  }

  return result;
}

export async function pollTransaction(hash: string) {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "tx-status",
      method: "getTransaction",
      params: {
        hash,
      },
    }),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message || "Failed to fetch transaction status.");
  }

  return data.result as { status: "SUCCESS" | "FAILED" | "NOT_FOUND" | string };
}

export async function latestLedger(): Promise<number> {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "latest-ledger",
      method: "getLatestLedger",
      params: {},
    }),
  });

  const data = await response.json();
  return Number(data.result.sequence);
}

export async function getEvents(startLedger: number, cursor?: string): Promise<RpcEventResponse> {
  assertContractId();

  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "events",
      method: "getEvents",
      params: {
        ...(cursor ? { pagination: { cursor, limit: 25 } } : { startLedger, pagination: { limit: 25 } }),
        filters: [
          {
            type: "contract",
            contractIds: [CONTRACT_ID],
          },
        ],
      },
    }),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message || "Failed to fetch contract events.");
  }

  return data.result as RpcEventResponse;
}

export function encodeInitArgs(question: string, optionA: string, optionB: string, admin: string) {
  return [
    new Address(admin).toScVal(),
    nativeToScVal(question),
    nativeToScVal(optionA),
    nativeToScVal(optionB),
  ];
}

export function encodeVoteArgs(voter: string, choice: number) {
  return [new Address(voter).toScVal(), nativeToScVal(choice, { type: "u32" })];
}

export function decodeEventTopic(topic: string) {
  const parsed = xdr.ScVal.fromXDR(topic, "base64");
  const native = scValToNative(parsed);
  if (typeof native === "string") {
    return native;
  }

  if (native && typeof native === "object" && "toString" in native) {
    return native.toString();
  }

  return String(native);
}

export function decodeEventValue(value: string) {
  const parsed = xdr.ScVal.fromXDR(value, "base64");
  return scValToNative(parsed);
}
