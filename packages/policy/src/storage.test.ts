import { describe, expect, it } from "vitest";
import { InMemoryGuardStateStore } from "./storage.js";

describe("InMemoryGuardStateStore", () => {
  it("tracks replay fingerprints within TTL", async () => {
    const store = new InMemoryGuardStateStore();
    expect(await store.hasReplay("fp-1")).toBe(false);
    await store.markReplay("fp-1", 60_000);
    expect(await store.hasReplay("fp-1")).toBe(true);
  });

  it("sums spend inside rolling windows", async () => {
    const store = new InMemoryGuardStateStore();
    await store.recordSpend("agent_a", 100n);
    await store.recordSpend("agent_a", 50n);
    expect(await store.sumSpendInWindow("agent_a", 86_400)).toBe(150n);
  });

  it("rejects non-positive spend", async () => {
    const store = new InMemoryGuardStateStore();
    await expect(store.recordSpend("agent_a", 0n)).rejects.toThrow();
  });
});
