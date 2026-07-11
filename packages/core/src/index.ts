export type PolicyDecision = "allow" | "block" | "escalate";

export interface X402ResourceRef {
  method: string;
  url: string;
  domain: string;
  path: string;
}

export interface X402PaymentContext {
  agentId: string;
  payer: string;
  payTo: string;
  amountAtomic: bigint;
  asset: string;
  network: string;
  resource: X402ResourceRef;
  description?: string;
  reason?: string;
  mandateId?: string;
  idempotencyKey?: string;
}

export interface PolicyEvaluation {
  decision: PolicyDecision;
  triggeredRules: string[];
  evidence: Record<string, unknown>;
}

export interface SpendWindow {
  windowSeconds: number;
  maxAmountAtomic: bigint;
}

export interface AgentPolicyConfig {
  agentId: string;
  maxPerCallAtomic: bigint;
  allowedDomains: string[];
  blockedDomains: string[];
  allowedPayees: string[];
  windows: SpendWindow[];
  requireMandateAboveAtomic?: bigint;
}

export interface GuardDecision {
  decision: PolicyDecision;
  triggeredRules: string[];
  receiptId: string;
  fingerprint: string;
  blocked: boolean;
}

export function parseResourceUrl(url: string, method = "GET"): X402ResourceRef {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("resource URL must use http or https");
  }
  return {
    method: method.trim().toUpperCase() || "GET",
    url,
    domain: parsed.hostname.toLowerCase(),
    path: parsed.pathname || "/",
  };
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export {
  InvalidPaymentContextError,
  canonicalizeResource,
  validatePaymentContext,
} from "./validation.js";
