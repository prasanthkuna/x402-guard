import { describe, expect, it } from "vitest";
import { authorizePayment } from "./authorize.js";
import { defaultDevPolicy } from "./index.js";
import type { X402PaymentContext } from "@x402-guard/core";
import { InMemoryGuardStateStore } from "./storage.js";

const baseCtx = (amount: bigint): X402PaymentContext => ({
  agentId: "agent_demo",
  payer: "0x1111111111111111111111111111111111111111",
  payTo: "0x2222222222222222222222222222222222222222",
  amountAtomic: amount,
  asset: "USDC",
  network: "eip155:84532",
  resource: {
    method: "GET",
    url: "https://api.example.com/v1/data",
    domain: "api.example.com",
    path: "/v1/data",
  },
});

describe("fault injection — authorization boundaries", () => {
  it("releases reserved budget when authorization is abandoned (simulated callback failure)", async () => {
    const store = new InMemoryGuardStateStore();
    const policy = {
      ...defaultDevPolicy("agent_demo"),
      requireMandateAboveAtomic: undefined,
      maxPerCallAtomic: 10_000_000n,
    };

    const auth = await authorizePayment(store, {
      ctx: baseCtx(1_000_000n),
      policy,
      fingerprint: "fp-release",
      replayTtlMs: 60_000,
    });
    expect(auth.ok).toBe(true);
    if (!auth.ok) return;

    await store.releaseAuthorization(auth.authorization.authorizationId);
    expect(await store.sumSpendInWindow("agent_demo", 86_400)).toBe(0n);

    const retry = await authorizePayment(store, {
      ctx: baseCtx(9_900_000n),
      policy,
      fingerprint: "fp-release-2",
      replayTtlMs: 60_000,
    });
    expect(retry.ok).toBe(true);
  });

  it("concurrent duplicate fingerprints: exactly one authorization wins", async () => {
    const store = new InMemoryGuardStateStore();
    const policy = {
      ...defaultDevPolicy("agent_demo"),
      requireMandateAboveAtomic: undefined,
    };

    const results = await Promise.all(
      Array.from({ length: 50 }, () =>
        authorizePayment(store, {
          ctx: baseCtx(100n),
          policy,
          fingerprint: "fp-race",
          replayTtlMs: 60_000,
        }),
      ),
    );
    expect(results.filter((r) => r.ok).length).toBe(1);
  });

  it("commit after reserve is required before window reflects spend", async () => {
    const store = new InMemoryGuardStateStore();
    const policy = {
      ...defaultDevPolicy("agent_demo"),
      requireMandateAboveAtomic: undefined,
      maxPerCallAtomic: 10_000_000n,
    };

    const auth = await authorizePayment(store, {
      ctx: baseCtx(500n),
      policy,
      fingerprint: "fp-pending",
      replayTtlMs: 60_000,
    });
    expect(auth.ok).toBe(true);
    if (!auth.ok) return;

    expect(await store.sumSpendInWindow("agent_demo", 86_400)).toBe(0n);
    await store.commitAuthorization(auth.authorization.authorizationId, "agent_demo", 500n);
    expect(await store.sumSpendInWindow("agent_demo", 86_400)).toBe(500n);
  });
});
