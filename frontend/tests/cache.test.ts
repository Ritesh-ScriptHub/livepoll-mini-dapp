import test from "node:test";
import assert from "node:assert/strict";
import { clearCachedItem, getCachedItem, setCachedItem } from "../src/lib/cache.ts";

test("cache round-trips values in memory when localStorage is unavailable", () => {
  const key = "cache:memory";

  setCachedItem(key, { totalVotes: 3 });
  const cached = getCachedItem<{ totalVotes: number }>(key, 10_000);

  assert.ok(cached);
  assert.equal(cached.value.totalVotes, 3);
});

test("cache expires entries after the ttl", () => {
  const key = "cache:expired";

  setCachedItem(key, { value: "old" });
  const originalNow = Date.now;
  const savedAt = getCachedItem<{ value: string }>(key, 10_000)?.savedAt ?? 0;

  Date.now = () => savedAt + 10_001;

  try {
    assert.equal(getCachedItem(key, 10_000), null);
  } finally {
    Date.now = originalNow;
    clearCachedItem(key);
  }
});
