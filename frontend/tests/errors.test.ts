import test from "node:test";
import assert from "node:assert/strict";
import { humanizeWalletError } from "../src/lib/errors.ts";

test("humanizeWalletError maps wallet rejection errors", () => {
  const message = humanizeWalletError(new Error("User rejected the transaction"));
  assert.equal(message, "The wallet request was rejected.");
});

test("humanizeWalletError maps contract initialization errors", () => {
  const message = humanizeWalletError(new Error("Error(Contract, #1)"));
  assert.equal(message, "This contract has already been initialized. Deploy a new contract to create a different poll question.");
});
