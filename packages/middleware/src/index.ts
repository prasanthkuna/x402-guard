import type {
  AgentPolicyConfig,
  GuardDecision,
  PolicyDecision,
  X402PaymentContext,
} from "@x402-guard/core";
import {
  ReplayGuard,
  SpendTracker,
  buildPaymentFingerprint,
  evaluateAgentPolicy,
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
  constructor(public readonly fingerprint: string) {
    super(`Replay detected for fingerprint: ${fingerprint}`);
    this.name = "ReplayDetectedError";
  }
}

export interface X402GuardOptions {
  policy: AgentPolicyConfig;
  policyVersion?: string;
  replayTtlMs?: number;
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
    const decision = await guard.evaluate(toContext(amountAtomic, resourceUrl));
    if (decision.blocked) {
      throw new PolicyViolationError("Payment blocked by x402-guard policy", decision, guard.lastReceipt!);
    }
    if (decision.decision === "escalate") {
      throw new PolicyViolationError("Payment requires human approval", decision, guard.lastReceipt!);
    }
    if (callback) {
      return callback(amountAtomic, resourceUrl);
    }
    return true;
  };
}

export class X402Guard {
  private readonly tracker = new SpendTracker();
  private readonly replay: ReplayGuard;
  private readonly ledger = new ReceiptLedger();
  readonly receipts: PaymentReceipt[] = [];
  lastReceipt: PaymentReceipt | undefined;

  constructor(private readonly options: X402GuardOptions) {
    this.replay = new ReplayGuard(options.replayTtlMs ?? 300_000);
  }

  async evaluate(ctx: X402PaymentContext): Promise<GuardDecision> {
    const fingerprint = buildPaymentFingerprint(ctx);
    if (this.replay.check(fingerprint)) {
      throw new ReplayDetectedError(fingerprint);
    }

    const evaluation = evaluateAgentPolicy(ctx, this.options.policy, this.tracker);

    if (evaluation.decision === "escalate" && this.options.onEscalate) {
      const approved = await this.options.onEscalate(ctx, evaluation.triggeredRules);
      if (!approved) {
        const receipt = this.record(ctx, fingerprint, "escalate", evaluation.triggeredRules);
        return {
          decision: "escalate",
          triggeredRules: evaluation.triggeredRules,
          receiptId: receipt.receiptId,
          fingerprint,
          blocked: true,
        };
      }
      evaluation.decision = "allow";
    }

    const blocked = evaluation.decision !== "allow";
    const receipt = this.record(ctx, fingerprint, evaluation.decision, evaluation.triggeredRules);

    if (!blocked) {
      this.tracker.record(ctx.agentId, ctx.amountAtomic);
    }

    const decision: GuardDecision = {
      decision: evaluation.decision,
      triggeredRules: evaluation.triggeredRules,
      receiptId: receipt.receiptId,
      fingerprint,
      blocked,
    };
    return decision;
  }

  recordSettlement(txHash: string): PaymentReceipt | undefined {
    if (!this.lastReceipt) return undefined;
    const settled = this.ledger.settle(this.lastReceipt, txHash);
    this.receipts.push(settled);
    this.lastReceipt = settled;
    return settled;
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

export { AgentPolicyConfig, X402PaymentContext } from "@x402-guard/core";
export { defaultDevPolicy } from "@x402-guard/policy";
export type { PaymentReceipt } from "@x402-guard/receipts";
