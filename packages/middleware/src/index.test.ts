import { describe, expect, it } from "vitest";
import { parseResourceUrl } from "@x402-guard/core";
import { defaultDevPolicy } from "@x402-guard/policy";
import { PolicyViolationError, ReplayDetectedError, X402Guard, withSpendingPolicy } from "./index.js";

describe("X402Guard", () => {
  it("blocks over-limit payments before callback", async () => {
    const guard = new X402Guard({ policy: defaultDevPolicy("agent_demo") });
    const resource = parseResourceUrl("https://api.example.com/v1/data");

    const decision = await guard.evaluate({
      agentId: "agent_demo",
      payer: "0x1111111111111111111111111111111111111111",
      payTo: "0x2222222222222222222222222222222222222222",
      amountAtomic: 9_000_000n,
      asset: "USDC",
      network: "eip155:84532",
      resource,
    });

    expect(decision.blocked).toBe(true);
    expect(decision.decision).toBe("block");
    expect(guard.lastReceipt?.decision).toBe("block");
  });

  it("allows compliant payment and records receipt", async () => {
    const guard = new X402Guard({ policy: defaultDevPolicy("agent_demo") });
    const resource = parseResourceUrl("https://api.example.com/v1/data");
    const decision = await guard.evaluate({
      agentId: "agent_demo",
      payer: "0x1111111111111111111111111111111111111111",
      payTo: "0x2222222222222222222222222222222222222222",
      amountAtomic: 50_000n,
      asset: "USDC",
      network: "eip155:84532",
      resource,
    });

    expect(decision.blocked).toBe(false);
    expect(guard.lastReceipt?.decision).toBe("allow");
  });

  it("withSpendingPolicy throws before callback on block", async () => {
    const guard = new X402Guard({ policy: defaultDevPolicy("agent_demo") });
    const pay = withSpendingPolicy(
      () => true,
      guard,
      (amount, url) => ({
        agentId: "agent_demo",
        payer: "0x1111111111111111111111111111111111111111",
        payTo: "0x2222222222222222222222222222222222222222",
        amountAtomic: amount,
        asset: "USDC",
        network: "eip155:84532",
        resource: parseResourceUrl(url),
      }),
    );

    await expect(pay(9_000_000n, "https://api.example.com/v1/data")).rejects.toBeInstanceOf(
      PolicyViolationError,
    );
  });

  it("ReplayDetectedError on duplicate fingerprint", async () => {
    const guard = new X402Guard({ policy: defaultDevPolicy("agent_demo") });
    const ctx = {
      agentId: "agent_demo",
      payer: "0x1111111111111111111111111111111111111111",
      payTo: "0x2222222222222222222222222222222222222222",
      amountAtomic: 50_000n,
      asset: "USDC",
      network: "eip155:84532",
      resource: parseResourceUrl("https://api.example.com/v1/data"),
      idempotencyKey: "idem-1",
    };
    await guard.evaluate(ctx);
    await expect(guard.evaluate(ctx)).rejects.toThrow(/Replay detected/);
  });
});
