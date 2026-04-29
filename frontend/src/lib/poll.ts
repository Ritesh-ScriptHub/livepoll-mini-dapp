import type { PollState } from "../types";

export const defaultPoll: PollState = {
  question: "Which feature should we ship first?",
  optionA: "Better wallet support",
  optionB: "Live contract analytics",
  votesA: 0,
  votesB: 0,
  totalVotes: 0,
};

export function normalizePoll(raw: Record<string, unknown>): PollState {
  return {
    question: String(raw.question ?? ""),
    optionA: String(raw.option_a ?? raw.optionA ?? "Option A"),
    optionB: String(raw.option_b ?? raw.optionB ?? "Option B"),
    votesA: Number(raw.votes_a ?? raw.votesA ?? 0),
    votesB: Number(raw.votes_b ?? raw.votesB ?? 0),
    totalVotes: Number(raw.total_votes ?? raw.totalVotes ?? 0),
  };
}

export function calculateVotePercents(poll: PollState) {
  if (poll.totalVotes === 0) {
    return {
      votePercentA: 0,
      votePercentB: 0,
    };
  }

  const votePercentA = Math.round((poll.votesA / poll.totalVotes) * 100);

  return {
    votePercentA,
    votePercentB: Math.max(0, 100 - votePercentA),
  };
}
