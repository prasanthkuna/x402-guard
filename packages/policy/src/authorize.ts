import type { PolicyDecision } from "@x402-guard/core";
import { randomUUID } from "node:crypto";
import type { AuthorizePaymentInput, AuthorizePaymentResult, GuardStateStore } from "./storage.js";
import { evaluatePolicyRules } from "./storage.js";

export async function authorizePayment(
  store: GuardStateStore,
  input: AuthorizePaymentInput,
): Promise<AuthorizePaymentResult & { decision?: PolicyDecision; domain?: string }> {
  const nowMs = input.nowMs ?? Date.now();
  const { rules, escalations, domain } = evaluatePolicyRules(input.ctx, input.policy);
  if (rules.length > 0) {
    return { ok: false, triggeredRules: [...rules, ...escalations], decision: "block", domain };
  }
  if (escalations.length > 0) {
    return { ok: false, triggeredRules: escalations, decision: "escalate", domain };
  }

  const claimed = await store.claimReplay(input.fingerprint, input.replayTtlMs, nowMs);
  if (!claimed) {
    return { ok: false, triggeredRules: ["replay.detected"] };
  }

  const authorizationId = `auth_${randomUUID()}`;
  const reserved = await store.reserveBudget(
    input.ctx.agentId,
    input.ctx.amountAtomic,
    input.policy.windows,
    authorizationId,
    nowMs,
  );
  if (!reserved) {
    return {
      ok: false,
      triggeredRules: input.policy.windows.map(
        (window) => `budget.window_${window.windowSeconds}s_exceeded`,
      ),
      decision: "block",
      domain,
    };
  }

  return { ok: true, authorization: { authorizationId }, decision: "allow", domain };
}
