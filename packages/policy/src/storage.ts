import type { AgentPolicyConfig, SpendWindow, X402PaymentContext } from "@x402-guard/core";
import { canonicalizeResource } from "@x402-guard/core";

export interface PaymentAuthorization {
  authorizationId: string;
}

export interface AuthorizePaymentInput {
  ctx: X402PaymentContext;
  policy: AgentPolicyConfig;
  fingerprint: string;
  replayTtlMs: number;
  nowMs?: number;
}

export type AuthorizePaymentResult =
  | { ok: true; authorization: PaymentAuthorization }
  | { ok: false; triggeredRules: string[] };

export interface GuardStateStore {
  /** Atomically claim replay fingerprint. Returns true when this caller owns the claim. */
  claimReplay(fingerprint: string, ttlMs: number, nowMs?: number): Promise<boolean>;
  /**
   * Atomically reserve budget across all policy windows under one authorization handle.
   * Returns null when any window would be exceeded.
   */
  reserveBudget(
    agentId: string,
    amountAtomic: bigint,
    windows: SpendWindow[],
    authorizationId: string,
    nowMs?: number,
  ): Promise<boolean>;
  commitAuthorization(authorizationId: string, agentId: string, amountAtomic: bigint, nowMs?: number): Promise<void>;
  releaseAuthorization(authorizationId: string): Promise<void>;
  /** @deprecated use claimReplay */
  hasReplay?(fingerprint: string, nowMs?: number): Promise<boolean>;
  /** @deprecated use claimReplay */
  markReplay?(fingerprint: string, ttlMs: number, nowMs?: number): Promise<void>;
  sumSpendInWindow(agentId: string, windowSeconds: number, nowMs?: number): Promise<bigint>;
  /** @deprecated use commitAuthorization */
  recordSpend?(agentId: string, amountAtomic: bigint, nowMs?: number): Promise<void>;
}

export function evaluatePolicyRules(
  ctx: X402PaymentContext,
  policy: AgentPolicyConfig,
): { rules: string[]; escalations: string[]; domain: string } {
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

  if (policy.allowedDomains.length > 0 && !policy.allowedDomains.includes(domain)) {
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

  if (
    policy.requireMandateAboveAtomic !== undefined &&
    ctx.amountAtomic > policy.requireMandateAboveAtomic &&
    !ctx.mandateId
  ) {
    escalations.push("mandate.required");
  }

  return { rules, escalations, domain };
}

type BudgetReservation = {
  agentId: string;
  amountAtomic: bigint;
  atMs: number;
  status: "reserved" | "committed" | "released";
};

/** Process-local dev/test store. Production must use a transactional Postgres implementation. */
export class InMemoryGuardStateStore implements GuardStateStore {
  private readonly replays = new Map<string, number>();
  private readonly spends: Array<{ agentId: string; amountAtomic: bigint; atMs: number }> = [];
  private readonly reservations = new Map<string, BudgetReservation>();
  private lock: Promise<void> = Promise.resolve();

  private async withLock<T>(fn: () => Promise<T> | T): Promise<T> {
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    const prev = this.lock;
    this.lock = prev.then(() => next);
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  async claimReplay(fingerprint: string, ttlMs: number, nowMs = Date.now()): Promise<boolean> {
    return this.withLock(() => {
      const expiresAt = this.replays.get(fingerprint);
      if (expiresAt !== undefined && expiresAt > nowMs) {
        return false;
      }
      this.replays.set(fingerprint, nowMs + ttlMs);
      return true;
    });
  }

  async reserveBudget(
    agentId: string,
    amountAtomic: bigint,
    windows: SpendWindow[],
    authorizationId: string,
    nowMs = Date.now(),
  ): Promise<boolean> {
    return this.withLock(() => {
      for (const window of windows) {
        const spent = this.sumInWindowLocked(agentId, window.windowSeconds, nowMs);
        const reserved = this.reservedInWindowLocked(agentId, window.windowSeconds, nowMs);
        if (spent + reserved + amountAtomic > window.maxAmountAtomic) {
          return false;
        }
      }
      this.reservations.set(authorizationId, {
        agentId,
        amountAtomic,
        atMs: nowMs,
        status: "reserved",
      });
      return true;
    });
  }

  async commitAuthorization(
    authorizationId: string,
    agentId: string,
    amountAtomic: bigint,
    nowMs = Date.now(),
  ): Promise<void> {
    await this.withLock(() => {
      const reservation = this.reservations.get(authorizationId);
      if (!reservation || reservation.status !== "reserved") {
        throw new Error(`authorization not reserved: ${authorizationId}`);
      }
      if (reservation.agentId !== agentId || reservation.amountAtomic !== amountAtomic) {
        throw new Error("authorization facts mismatch");
      }
      reservation.status = "committed";
      this.spends.push({ agentId, amountAtomic, atMs: nowMs });
    });
  }

  async releaseAuthorization(authorizationId: string): Promise<void> {
    await this.withLock(() => {
      const reservation = this.reservations.get(authorizationId);
      if (!reservation || reservation.status !== "reserved") {
        return;
      }
      reservation.status = "released";
    });
  }

  async sumSpendInWindow(agentId: string, windowSeconds: number, nowMs = Date.now()): Promise<bigint> {
    return this.withLock(() => this.sumInWindowLocked(agentId, windowSeconds, nowMs));
  }

  private sumInWindowLocked(agentId: string, windowSeconds: number, nowMs: number): bigint {
    const cutoff = nowMs - windowSeconds * 1000;
    return this.spends
      .filter((entry) => entry.agentId === agentId && entry.atMs >= cutoff)
      .reduce((sum, entry) => sum + entry.amountAtomic, 0n);
  }

  private reservedInWindowLocked(agentId: string, windowSeconds: number, nowMs: number): bigint {
    const cutoff = nowMs - windowSeconds * 1000;
    return [...this.reservations.values()]
      .filter(
        (entry) =>
          entry.agentId === agentId &&
          entry.status === "reserved" &&
          entry.atMs >= cutoff,
      )
      .reduce((sum, entry) => sum + entry.amountAtomic, 0n);
  }
}

export interface PersistedPaymentReceipt {
  receiptId: string;
  decision: "allow" | "block" | "escalate";
  fingerprint: string;
  context: X402PaymentContext;
  txHash?: string;
}

export interface ReceiptStore {
  append(receipt: PersistedPaymentReceipt): Promise<void>;
  get(receiptId: string): Promise<PersistedPaymentReceipt | undefined>;
  settle(receiptId: string, txHash: string): Promise<PersistedPaymentReceipt | undefined>;
}
