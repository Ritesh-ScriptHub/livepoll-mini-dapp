export type WalletState = "idle" | "connecting" | "connected" | "error";
export type TxStatus = "idle" | "pending" | "success" | "failed";

export type PollState = {
  question: string;
  optionA: string;
  optionB: string;
  votesA: number;
  votesB: number;
  totalVotes: number;
};

export type PollVote = 0 | 1;

export type ActivityItem = {
  id: string;
  ledger: number;
  txHash: string;
  voter?: string;
  choice?: number;
  closedAt: string;
};

export type WalletAccount = {
  address: string;
  balance: number | null;
};

