import { describe, expect, it } from "vitest";
import { ReceiptLedger } from "./index.js";
import type { X402PaymentContext } from "@x402-guard/core";

const ctx = (): X402PaymentContext => ({
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

describe("ReceiptLedger", () => {
  it("chains receipt hashes", () => {
    const ledger = new ReceiptLedger();
    const first = ledger.append({
      decision: "allow",
      triggeredRules: [],
      context: ctx(),
      fingerprint: "fp-1",
      policyVersion: "v0.1.0",
    });
    const second = ledger.append({
      decision: "block",
      triggeredRules: ["amount.per_call_cap"],
      context: ctx(),
      fingerprint: "fp-2",
      policyVersion: "v0.1.0",
    });

    expect(first.previousHash).toBeUndefined();
    expect(second.previousHash).toBe(first.receiptHash);
    expect(second.receiptVersion).toBe("x402-guard.v1");
  });

  it("settle chains txHash from prior receipt", () => {
    const ledger = new ReceiptLedger();
    const allowed = ledger.append({
      decision: "allow",
      triggeredRules: [],
      context: ctx(),
      fingerprint: "fp-1",
      policyVersion: "v0.1.0",
    });
    const settled = ledger.settle(allowed, "0xabc");
    expect(settled.txHash).toBe("0xabc");
    expect(settled.previousHash).toBe(allowed.receiptHash);
    expect(settled.receiptHash).not.toBe(allowed.receiptHash);
  });
});
