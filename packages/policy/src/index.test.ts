import { describe, expect, it } from "vitest";
import {
  SpendTracker,
  buildPaymentFingerprint,
  defaultDevPolicy,
  evaluateAgentPolicy,
} from "./index.js";
import type { X402PaymentContext } from "@x402-guard/core";

const baseCtx = (): X402PaymentContext => ({
  agentId: "agent_demo",
  payer: "0x1111111111111111111111111111111111111111",
  payTo: "0x2222222222222222222222222222222222222222",
  amountAtomic: 100_000n,
  asset: "USDC",
  network: "eip155:84532",
  resource: {
    method: "GET",
    url: "https://api.example.com/v1/data",
    domain: "api.example.com",
    path: "/v1/data",
  },
});

describe("evaluateAgentPolicy", () => {
  it("allows within limits", () => {
    const policy = defaultDevPolicy("agent_demo");
    const result = evaluateAgentPolicy(baseCtx(), policy, new SpendTracker());
    expect(result.decision).toBe("allow");
  });

  it("blocks per-call cap", () => {
    const policy = defaultDevPolicy("agent_demo");
    const ctx = { ...baseCtx(), amountAtomic: 2_000_000n };
    const result = evaluateAgentPolicy(ctx, policy, new SpendTracker());
    expect(result.decision).toBe("block");
    expect(result.triggeredRules).toContain("amount.per_call_cap");
  });

  it("escalates when mandate missing for large payment", () => {
    const policy = defaultDevPolicy("agent_demo");
    const ctx = { ...baseCtx(), amountAtomic: 600_000n };
    const result = evaluateAgentPolicy(ctx, policy, new SpendTracker());
    expect(result.decision).toBe("escalate");
    expect(result.triggeredRules).toContain("mandate.required");
  });

  it("blocks blocked domain", () => {
    const policy = defaultDevPolicy("agent_demo");
    const ctx = {
      ...baseCtx(),
      resource: {
        ...baseCtx().resource,
        domain: "blocked.vendor",
        url: "https://blocked.vendor/pay",
      },
    };
    const result = evaluateAgentPolicy(ctx, policy, new SpendTracker());
    expect(result.decision).toBe("block");
    expect(result.triggeredRules).toContain("resource.blocked_domain");
  });

  it("blocks rolling window budget", () => {
    const policy = defaultDevPolicy("agent_demo");
    const tracker = new SpendTracker();
    tracker.record("agent_demo", 9_950_000n);
    const result = evaluateAgentPolicy(baseCtx(), policy, tracker);
    expect(result.decision).toBe("block");
    expect(result.triggeredRules.some((r) => r.includes("budget.window"))).toBe(true);
  });

  it("blocks negative amounts", () => {
    const policy = defaultDevPolicy("agent_demo");
    const result = evaluateAgentPolicy(
      { ...baseCtx(), amountAtomic: -100n },
      policy,
      new SpendTracker(),
    );
    expect(result.decision).toBe("block");
    expect(result.triggeredRules).toContain("amount.non_positive");
  });
});

describe("buildPaymentFingerprint", () => {
  it("is stable for identical context", () => {
    const a = buildPaymentFingerprint(baseCtx());
    const b = buildPaymentFingerprint(baseCtx());
    expect(a).toBe(b);
  });
});
