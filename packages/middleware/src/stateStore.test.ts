import { describe, expect, it, vi } from "vitest";
import { parseResourceUrl } from "@x402-guard/core";
import { InMemoryGuardStateStore, defaultDevPolicy } from "@x402-guard/policy";
import { X402Guard, withSpendingPolicy } from "./index.js";

describe("X402Guard stateStore", () => {
  it("uses injected store for replay and spend", async () => {
    const store = new InMemoryGuardStateStore();
    const guard = new X402Guard({
      policy: defaultDevPolicy("agent_demo"),
      stateStore: store,
    });
    const ctx = {
      agentId: "agent_demo",
      payer: "0x1111111111111111111111111111111111111111",
      payTo: "0x2222222222222222222222222222222222222222",
      amountAtomic: 50_000n,
      asset: "USDC",
      network: "eip155:84532",
      resource: parseResourceUrl("https://api.example.com/v1/data"),
    };
    await guard.evaluate(ctx);
    expect(await store.sumSpendInWindow("agent_demo", 86_400)).toBe(0n);
    await guard.commitAllowedSpend(ctx);
    expect(await store.sumSpendInWindow("agent_demo", 86_400)).toBe(50_000n);
    await expect(guard.evaluate(ctx)).rejects.toThrow(/Replay detected/);
  });

  it("withSpendingPolicy records spend only after successful callback", async () => {
    const store = new InMemoryGuardStateStore();
    const guard = new X402Guard({
      policy: defaultDevPolicy("agent_demo"),
      stateStore: store,
    });
    const callback = vi.fn(async () => true);
    const pay = withSpendingPolicy(
      callback,
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
    await pay(50_000n, "https://api.example.com/v1/data");
    expect(callback).toHaveBeenCalled();
    expect(await store.sumSpendInWindow("agent_demo", 86_400)).toBe(50_000n);
  });
});
