import type {
  AgentPolicyConfig,
  GuardDecision,
  PolicyDecision,
  X402PaymentContext,
} from "@x402-guard/core";
import { validatePaymentContext } from "@x402-guard/core";
import {
  authorizePayment,
  buildPaymentFingerprint,
  InMemoryGuardStateStore,
} from "@x402-guard/policy";
import { ReceiptLedger, type PaymentReceipt } from "@x402-guard/receipts";

export class PolicyViolationError extends Error {
  constructor(
    message: string,
    public readonly decision: GuardDecision,
    public readonly receipt: PaymentReceipt,
  ) {
    super(message);
    this.name = "PolicyViolationError";
  }
}

export class ReplayDetectedError extends Error {
  constructor(
    public readonly fingerprint: string,
    public readonly receipt?: PaymentReceipt,
  ) {
    super(`Replay detected for fingerprint: ${fingerprint}`);
    this.name = "ReplayDetectedError";
  }
}

export interface X402GuardOptions {
  policy: AgentPolicyConfig;
  policyVersion?: string;
  replayTtlMs?: number;
  stateStore?: import("@x402-guard/policy").GuardStateStore;
  onEscalate?: (ctx: X402PaymentContext, rules: string[]) => Promise<boolean>;
}

export type PaymentCallback = (
  amountAtomic: bigint,
  resourceUrl: string,
) => boolean | Promise<boolean>;

/**
 * Wraps an x402 payment callback with fail-closed policy, replay protection,
 * and tamper-evident receipts. Targets mark3labs/x402-go#26 pattern.
 */
export function withSpendingPolicy(
  callback: PaymentCallback | undefined,
  guard: X402Guard,
  toContext: (amountAtomic: bigint, resourceUrl: string) => X402PaymentContext,
): PaymentCallback {
  return async (amountAtomic, resourceUrl) => {
    const ctx = toContext(amountAtomic, resourceUrl);
    const decision = await guard.evaluate(ctx);
    if (decision.blocked) {
      throw new PolicyViolationError("Payment blocked by x402-guard policy", decision, guard.lastReceipt!);
    }
    if (decision.decision === "escalate") {
      throw new PolicyViolationError("Payment requires human approval", decision, guard.lastReceipt!);
    }
    if (callback) {
      const ok = await callback(amountAtomic, resourceUrl);
      if (ok) {
        await guard.commitAllowedSpend(ctx, decision.receiptId);
      } else if (decision.authorizationId) {
        await guard.releaseAuthorization(decision.authorizationId);
      }
      return ok;
    }
    await guard.commitAllowedSpend(ctx, decision.receiptId);
    return true;
  };
}

export class X402Guard {
  private readonly stateStore: import("@x402-guard/policy").GuardStateStore;
  private readonly ledger = new ReceiptLedger();
  private readonly authorizationByReceipt = new Map<
    string,
    { authorizationId: string; agentId: string; amountAtomic: bigint }
  >();
  readonly receipts: PaymentReceipt[] = [];
  lastReceipt: PaymentReceipt | undefined;

  constructor(private readonly options: X402GuardOptions) {
    this.stateStore = options.stateStore ?? new InMemoryGuardStateStore();
  }

  async releaseAuthorization(authorizationId: string): Promise<void> {
    await this.stateStore.releaseAuthorization(authorizationId);
  }

  /** Commits a reserved authorization after payment succeeds (M-08 / C-02). */
  async commitAllowedSpend(ctx: X402PaymentContext, receiptId?: string): Promise<void> {
    const normalized = validatePaymentContext(ctx);
    const pending = receiptId ? this.authorizationByReceipt.get(receiptId) : undefined;
    if (pending) {
      await this.stateStore.commitAuthorization(
        pending.authorizationId,
        pending.agentId,
        pending.amountAtomic,
      );
      this.authorizationByReceipt.delete(receiptId!);
      return;
    }
    if (this.stateStore.recordSpend) {
      await this.stateStore.recordSpend(normalized.agentId, normalized.amountAtomic);
    }
  }

  async evaluate(ctx: X402PaymentContext): Promise<GuardDecision> {
    const normalized = validatePaymentContext(ctx);
    const fingerprint = buildPaymentFingerprint(normalized);
    let auth = await authorizePayment(this.stateStore, {
      ctx: normalized,
      policy: this.options.policy,
      fingerprint,
      replayTtlMs: this.options.replayTtlMs ?? 300_000,
    });

    if (!auth.ok && auth.decision === "escalate" && this.options.onEscalate) {
      const approved = await this.options.onEscalate(normalized, auth.triggeredRules);
      if (approved) {
        auth = await authorizePayment(this.stateStore, {
          ctx: normalized,
          policy: this.options.policy,
          fingerprint,
          replayTtlMs: this.options.replayTtlMs ?? 300_000,
        });
      }
    }

    if (!auth.ok) {
      if (auth.triggeredRules.includes("replay.detected")) {
        const receipt = this.record(normalized, fingerprint, "block", auth.triggeredRules);
        throw new ReplayDetectedError(fingerprint, receipt);
      }
      const decision: PolicyDecision = auth.decision ?? "block";
      const receipt = this.record(normalized, fingerprint, decision, auth.triggeredRules);
      return {
        decision,
        triggeredRules: auth.triggeredRules,
        receiptId: receipt.receiptId,
        fingerprint,
        blocked: decision !== "allow",
      };
    }

    const receipt = this.record(normalized, fingerprint, "allow", []);
    this.authorizationByReceipt.set(receipt.receiptId, {
      authorizationId: auth.authorization.authorizationId,
      agentId: normalized.agentId,
      amountAtomic: normalized.amountAtomic,
    });

    return {
      decision: "allow",
      triggeredRules: [],
      receiptId: receipt.receiptId,
      fingerprint,
      blocked: false,
      authorizationId: auth.authorization.authorizationId,
    };
  }

  recordSettlement(receiptId: string, txHash: string): PaymentReceipt | undefined {
    const prior = this.receipts.find((entry) => entry.receiptId === receiptId);
    if (!prior || prior.decision !== "allow" || prior.txHash) {
      return undefined;
    }
    const settled = this.ledger.settle(prior, txHash);
    this.receipts.push(settled);
    if (this.lastReceipt?.receiptId === receiptId) {
      this.lastReceipt = settled;
    }
    return settled;
  }

  /** @deprecated Use recordSettlement(receiptId, txHash) */
  recordLastSettlement(txHash: string): PaymentReceipt | undefined {
    if (!this.lastReceipt) return undefined;
    return this.recordSettlement(this.lastReceipt.receiptId, txHash);
  }

  exportAuditJsonl(): string {
    return this.ledger.exportJsonl(this.receipts);
  }

  private record(
    ctx: X402PaymentContext,
    fingerprint: string,
    decision: PolicyDecision,
    triggeredRules: string[],
  ): PaymentReceipt {
    const receipt = this.ledger.append({
      decision,
      triggeredRules,
      context: ctx,
      fingerprint,
      policyVersion: this.options.policyVersion ?? "v0.1.0",
    });
    this.receipts.push(receipt);
    this.lastReceipt = receipt;
    return receipt;
  }
}

export type { AgentPolicyConfig, X402PaymentContext } from "@x402-guard/core";
export { defaultDevPolicy } from "@x402-guard/policy";
export type { PaymentReceipt } from "@x402-guard/receipts";
