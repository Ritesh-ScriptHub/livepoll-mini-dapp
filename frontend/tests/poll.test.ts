import test from "node:test";
import assert from "node:assert/strict";
import { calculateVotePercents, normalizePoll } from "../src/lib/poll.ts";

test("normalizePoll supports Soroban snake_case payloads", () => {
  const poll = normalizePoll({
    question: "Choose",
    option_a: "A",
    option_b: "B",
    votes_a: 4,
    votes_b: 1,
    total_votes: 5,
  });

  assert.deepEqual(poll, {
    question: "Choose",
    optionA: "A",
    optionB: "B",
    votesA: 4,
    votesB: 1,
    totalVotes: 5,
  });
});

test("calculateVotePercents avoids negative or NaN percentages", () => {
  assert.deepEqual(
    calculateVotePercents({
      question: "Choose",
      optionA: "A",
      optionB: "B",
      votesA: 0,
      votesB: 0,
      totalVotes: 0,
    }),
    { votePercentA: 0, votePercentB: 0 },
  );
});
