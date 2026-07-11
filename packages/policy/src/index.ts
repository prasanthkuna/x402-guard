import type {
  AgentPolicyConfig,
  PolicyDecision,
  PolicyEvaluation,
  X402PaymentContext,
} from "@x402-guard/core";
import { canonicalizeResource } from "@x402-guard/core";

export interface SpendRecord {
  agentId: string;
  amountAtomic: bigint;
  atMs: number;
}

export class SpendTracker {
  private readonly records: SpendRecord[] = [];

  record(agentId: string, amountAtomic: bigint, atMs = Date.now()): void {
    if (amountAtomic <= 0n) {
      throw new Error("cannot record non-positive spend");
    }
    this.records.push({ agentId, amountAtomic, atMs });
  }

  sumInWindow(agentId: string, windowSeconds: number, nowMs = Date.now()): bigint {
    const cutoff = nowMs - windowSeconds * 1000;
    return this.records
      .filter((r) => r.agentId === agentId && r.atMs >= cutoff)
      .reduce((sum, r) => sum + r.amountAtomic, 0n);
  }
}

export class ReplayGuard {
  private readonly seen = new Map<string, number>();

  constructor(private readonly ttlMs: number) {}

  check(fingerprint: string, nowMs = Date.now()): boolean {
    const expiresAt = this.seen.get(fingerprint);
    if (expiresAt !== undefined && expiresAt > nowMs) {
      return true;
    }
    this.seen.set(fingerprint, nowMs + this.ttlMs);
    return false;
  }
}

export function buildPaymentFingerprint(ctx: X402PaymentContext): string {
  return [
    ctx.agentId,
    ctx.payer.toLowerCase(),
    ctx.payTo.toLowerCase(),
    ctx.amountAtomic.toString(),
    ctx.asset.toLowerCase(),
    ctx.network,
    ctx.resource.url,
    ctx.idempotencyKey ?? "",
  ].join("|");
}

export function evaluateAgentPolicy(
  ctx: X402PaymentContext,
  policy: AgentPolicyConfig,
  tracker: SpendTracker,
): PolicyEvaluation {
  const rules: string[] = [];
  const escalations: string[] = [];

  if (ctx.amountAtomic <= 0n) {
    rules.push("amount.non_positive");
  }

  let domain: string;
  try {
    domain = canonicalizeResource(ctx.resource).domain;
  } catch {
    rules.push("resource.invalid");
    domain = ctx.resource.domain;
  }

  if (ctx.agentId !== policy.agentId) {
    rules.push("agent.mismatch");
  }

  if (ctx.amountAtomic > policy.maxPerCallAtomic) {
    rules.push("amount.per_call_cap");
  }

  if (policy.blockedDomains.includes(domain)) {
    rules.push("resource.blocked_domain");
  }

  if (
    policy.allowedDomains.length > 0 &&
    !policy.allowedDomains.includes(domain)
  ) {
    rules.push("resource.unknown_domain");
  }

  if (
    policy.allowedPayees.length > 0 &&
    !policy.allowedPayees.some((p) => p.toLowerCase() === ctx.payTo.toLowerCase())
  ) {
    rules.push("payee.not_allowlisted");
  }

  if (policy.allowedAssets?.length && !policy.allowedAssets.map((a) => a.toLowerCase()).includes(ctx.asset.toLowerCase())) {
    rules.push("asset.not_allowlisted");
  }

  if (policy.allowedNetworks?.length && !policy.allowedNetworks.includes(ctx.network)) {
    rules.push("network.not_allowlisted");
  }

  for (const window of policy.windows) {
    const spent = tracker.sumInWindow(ctx.agentId, window.windowSeconds);
    if (spent + ctx.amountAtomic > window.maxAmountAtomic) {
      rules.push(`budget.window_${window.windowSeconds}s_exceeded`);
    }
  }

  if (
    policy.requireMandateAboveAtomic !== undefined &&
    ctx.amountAtomic > policy.requireMandateAboveAtomic &&
    !ctx.mandateId
  ) {
    escalations.push("mandate.required");
  }

  const decision: PolicyDecision =
    rules.length > 0 ? "block" : escalations.length > 0 ? "escalate" : "allow";

  return {
    decision,
    triggeredRules: [...rules, ...escalations],
    evidence: {
      agentId: ctx.agentId,
      domain,
      amountAtomic: ctx.amountAtomic.toString(),
      mandateId: ctx.mandateId ?? null,
    },
  };
}

export function defaultDevPolicy(agentId: string): AgentPolicyConfig {
  return {
    agentId,
    maxPerCallAtomic: 1_000_000n,
    allowedDomains: [],
    blockedDomains: ["blocked.vendor"],
    allowedPayees: [],
    windows: [{ windowSeconds: 86_400, maxAmountAtomic: 10_000_000n }],
    requireMandateAboveAtomic: 500_000n,
  };
}

export type { GuardStateStore, ReceiptStore, PersistedPaymentReceipt } from "./storage.js";
export { InMemoryGuardStateStore } from "./storage.js";
export { evaluateAgentPolicyWithStore } from "./evaluateWithStore.js";
