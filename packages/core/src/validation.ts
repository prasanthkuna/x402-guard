import type { X402PaymentContext, X402ResourceRef } from "./index.js";
import { parseResourceUrl } from "./index.js";

export class InvalidPaymentContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPaymentContextError";
  }
}

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export function canonicalizeResource(resource: X402ResourceRef): X402ResourceRef {
  let parsed: X402ResourceRef;
  try {
    parsed = parseResourceUrl(resource.url);
  } catch {
    throw new InvalidPaymentContextError("resource.url is not a valid URL");
  }

  const method = resource.method?.trim().toUpperCase() || "GET";
  if (resource.domain.toLowerCase() !== parsed.domain) {
    throw new InvalidPaymentContextError("resource.domain must match resource.url hostname");
  }
  if (resource.path !== parsed.path) {
    throw new InvalidPaymentContextError("resource.path must match resource.url pathname");
  }

  return { ...parsed, method };
}

export function validatePaymentContext(ctx: X402PaymentContext): X402PaymentContext {
  if (!ctx.agentId?.trim()) {
    throw new InvalidPaymentContextError("agentId is required");
  }
  if (!ctx.payer?.trim() || !EVM_ADDRESS.test(ctx.payer)) {
    throw new InvalidPaymentContextError("payer must be a valid EVM address");
  }
  if (!ctx.payTo?.trim() || !EVM_ADDRESS.test(ctx.payTo)) {
    throw new InvalidPaymentContextError("payTo must be a valid EVM address");
  }
  if (ctx.amountAtomic <= 0n) {
    throw new InvalidPaymentContextError("amountAtomic must be positive");
  }
  if (!ctx.asset?.trim()) {
    throw new InvalidPaymentContextError("asset is required");
  }
  if (!ctx.network?.trim()) {
    throw new InvalidPaymentContextError("network is required");
  }

  const resource = canonicalizeResource(ctx.resource);
  return { ...ctx, payer: ctx.payer, payTo: ctx.payTo, resource };
}
