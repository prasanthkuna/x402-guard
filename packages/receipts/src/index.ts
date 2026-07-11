import { createHash, randomUUID } from "node:crypto";
import { stableStringify, type PolicyDecision, type X402PaymentContext } from "@x402-guard/core";

export interface PaymentReceipt {
  receiptVersion: "x402-guard.v1";
  receiptId: string;
  decision: PolicyDecision;
  triggeredRules: string[];
  agentId: string;
  payer: string;
  payTo: string;
  amountAtomic: string;
  asset: string;
  network: string;
  resourceUrl: string;
  fingerprint: string;
  mandateId?: string;
  txHash?: string;
  policyVersion: string;
  createdAt: string;
  previousHash?: string;
  receiptHash: string;
}

export class ReceiptLedger {
  private lastHash: string | undefined;

  append(input: {
    decision: PolicyDecision;
    triggeredRules: string[];
    context: X402PaymentContext;
    fingerprint: string;
    policyVersion: string;
    txHash?: string;
  }): PaymentReceipt {
    const payload = {
      receiptVersion: "x402-guard.v1" as const,
      receiptId: `rcpt_${randomUUID()}`,
      decision: input.decision,
      triggeredRules: input.triggeredRules,
      agentId: input.context.agentId,
      payer: input.context.payer,
      payTo: input.context.payTo,
      amountAtomic: input.context.amountAtomic.toString(),
      asset: input.context.asset,
      network: input.context.network,
      resourceUrl: input.context.resource.url,
      fingerprint: input.fingerprint,
      mandateId: input.context.mandateId,
      txHash: input.txHash,
      policyVersion: input.policyVersion,
      createdAt: new Date().toISOString(),
      previousHash: this.lastHash,
    };

    const receiptHash = createHash("sha256")
      .update(stableStringify(payload))
      .digest("hex");

    const receipt: PaymentReceipt = { ...payload, receiptHash };
    this.lastHash = receiptHash;
    return receipt;
  }

  exportJsonl(receipts: PaymentReceipt[]): string {
    return receipts.map((r) => JSON.stringify(r)).join("\n");
  }

  /** Append settlement txHash as a new hash-chained receipt entry. */
  settle(previous: PaymentReceipt, txHash: string): PaymentReceipt {
    const payload = {
      receiptVersion: "x402-guard.v1" as const,
      receiptId: previous.receiptId,
      decision: previous.decision,
      triggeredRules: previous.triggeredRules,
      agentId: previous.agentId,
      payer: previous.payer,
      payTo: previous.payTo,
      amountAtomic: previous.amountAtomic,
      asset: previous.asset,
      network: previous.network,
      resourceUrl: previous.resourceUrl,
      fingerprint: previous.fingerprint,
      mandateId: previous.mandateId,
      txHash,
      policyVersion: previous.policyVersion,
      createdAt: new Date().toISOString(),
      previousHash: previous.receiptHash,
    };

    const receiptHash = createHash("sha256")
      .update(stableStringify(payload))
      .digest("hex");

    const receipt: PaymentReceipt = { ...payload, receiptHash };
    this.lastHash = receiptHash;
    return receipt;
  }
}
