import { describe, expect, it } from "vitest";
import { InMemoryGuardStateStore } from "./storage.js";
import { authorizePayment } from "./authorize.js";
import { defaultDevPolicy } from "./index.js";
import type { X402PaymentContext } from "@x402-guard/core";

const baseCtx = (amountAtomic: bigint): X402PaymentContext => ({
  agentId: "agent_demo",
  payer: "0x1111111111111111111111111111111111111111",
  payTo: "0x2222222222222222222222222222222222222222",
  amountAtomic,
  asset: "USDC",
  network: "eip155:84532",
  resource: {
    method: "GET",
    url: "https://api.example.com/v1/data",
    domain: "api.example.com",
    path: "/v1/data",
  },
});

describe("authorizePayment", () => {
  it("enforces rolling window caps through reserved authorizations", async () => {
    const store = new InMemoryGuardStateStore();
    const policy = {
      ...defaultDevPolicy("agent_demo"),
      requireMandateAboveAtomic: undefined,
      maxPerCallAtomic: 10_000_000n,
    };

    const first = await authorizePayment(store, {
      ctx: baseCtx(9_500_000n),
      policy,
      fingerprint: "fp-1",
      replayTtlMs: 60_000,
    });
    expect(first.ok).toBe(true);
    if (first.ok) {
      await store.commitAuthorization(first.authorization.authorizationId, "agent_demo", 9_500_000n);
    }

    const second = await authorizePayment(store, {
      ctx: baseCtx(500_000n),
      policy,
      fingerprint: "fp-2",
      replayTtlMs: 60_000,
    });
    expect(second.ok).toBe(true);
    if (second.ok) {
      await store.commitAuthorization(second.authorization.authorizationId, "agent_demo", 500_000n);
    }

    const third = await authorizePayment(store, {
      ctx: baseCtx(500_000n),
      policy,
      fingerprint: "fp-3",
      replayTtlMs: 60_000,
    });
    expect(third.ok).toBe(false);
  });
});
