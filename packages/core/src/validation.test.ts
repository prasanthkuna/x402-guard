import { describe, expect, it } from "vitest";
import {
  InvalidPaymentContextError,
  canonicalizeResource,
  parseResourceUrl,
  validatePaymentContext,
} from "./index.js";
import type { X402PaymentContext } from "./index.js";

const baseCtx = (): X402PaymentContext => ({
  agentId: "agent_demo",
  payer: "0x1111111111111111111111111111111111111111",
  payTo: "0x2222222222222222222222222222222222222222",
  amountAtomic: 100_000n,
  asset: "USDC",
  network: "eip155:84532",
  resource: parseResourceUrl("https://api.example.com/v1/data"),
});

describe("validatePaymentContext", () => {
  it("rejects non-positive amounts", () => {
    expect(() => validatePaymentContext({ ...baseCtx(), amountAtomic: 0n })).toThrow(
      InvalidPaymentContextError,
    );
    expect(() => validatePaymentContext({ ...baseCtx(), amountAtomic: -100n })).toThrow(
      InvalidPaymentContextError,
    );
  });

  it("rejects spoofed resource domain", () => {
    const ctx = {
      ...baseCtx(),
      resource: {
        ...parseResourceUrl("https://evil.example/pay"),
        domain: "allowed.example",
      },
    };
    expect(() => validatePaymentContext(ctx)).toThrow(InvalidPaymentContextError);
  });

  it("canonicalizes matching resource fields", () => {
    const validated = validatePaymentContext(baseCtx());
    expect(validated.resource.domain).toBe("api.example.com");
  });
});

describe("canonicalizeResource", () => {
  it("rejects domain/url mismatch", () => {
    expect(() =>
      canonicalizeResource({
        method: "GET",
        url: "https://evil.example/pay",
        domain: "allowed.example",
        path: "/pay",
      }),
    ).toThrow(InvalidPaymentContextError);
  });
});
