import { describe, expect, it } from "vitest";
import { InMemoryGuardStateStore } from "./storage.js";

describe("InMemoryGuardStateStore", () => {
  it("claims replay fingerprints atomically", async () => {
    const store = new InMemoryGuardStateStore();
    expect(await store.claimReplay("fp-1", 60_000)).toBe(true);
    expect(await store.claimReplay("fp-1", 60_000)).toBe(false);
  });

  it("commits reserved budget into spend totals", async () => {
    const store = new InMemoryGuardStateStore();
    const authorizationId = "auth_test";
    expect(
      await store.reserveBudget("agent_a", 100n, [{ windowSeconds: 86_400, maxAmountAtomic: 500n }], authorizationId),
    ).toBe(true);
    await store.commitAuthorization(authorizationId, "agent_a", 100n);
    expect(await store.sumSpendInWindow("agent_a", 86_400)).toBe(100n);
  });

  it("rejects oversize reservations", async () => {
    const store = new InMemoryGuardStateStore();
    expect(
      await store.reserveBudget("agent_a", 600n, [{ windowSeconds: 86_400, maxAmountAtomic: 500n }], "auth_fail"),
    ).toBe(false);
  });
});
