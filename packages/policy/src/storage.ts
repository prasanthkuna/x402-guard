import type { X402PaymentContext } from "@x402-guard/core";

export interface GuardStateStore {
  /** Returns true when fingerprint was seen inside TTL (duplicate). */
  hasReplay(fingerprint: string, nowMs?: number): Promise<boolean>;
  markReplay(fingerprint: string, ttlMs: number, nowMs?: number): Promise<void>;
  sumSpendInWindow(agentId: string, windowSeconds: number, nowMs?: number): Promise<bigint>;
  recordSpend(agentId: string, amountAtomic: bigint, nowMs?: number): Promise<void>;
}

/** Process-local dev/test store. Production must use a transactional Postgres implementation. */
export class InMemoryGuardStateStore implements GuardStateStore {
  private readonly replays = new Map<string, number>();
  private readonly spends: Array<{ agentId: string; amountAtomic: bigint; atMs: number }> = [];

  async hasReplay(fingerprint: string, nowMs = Date.now()): Promise<boolean> {
    const expiresAt = this.replays.get(fingerprint);
    return expiresAt !== undefined && expiresAt > nowMs;
  }

  async markReplay(fingerprint: string, ttlMs: number, nowMs = Date.now()): Promise<void> {
    this.replays.set(fingerprint, nowMs + ttlMs);
  }

  async sumSpendInWindow(agentId: string, windowSeconds: number, nowMs = Date.now()): Promise<bigint> {
    const cutoff = nowMs - windowSeconds * 1000;
    return this.spends
      .filter((entry) => entry.agentId === agentId && entry.atMs >= cutoff)
      .reduce((sum, entry) => sum + entry.amountAtomic, 0n);
  }

  async recordSpend(agentId: string, amountAtomic: bigint, nowMs = Date.now()): Promise<void> {
    if (amountAtomic <= 0n) throw new Error("cannot record non-positive spend");
    this.spends.push({ agentId, amountAtomic, atMs: nowMs });
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
