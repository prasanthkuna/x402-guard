# Vision

## One sentence

**x402-guard is the trust layer between agent intent and x402 settlement** — policy before signature, receipts on every attempt, optional on-chain enforcement via Railguard.

## Why this exists

The x402 protocol (Linux Foundation; Coinbase, Google, Stripe, AWS, Visa) standardizes HTTP-native micropayments for AI agents. It stops at verify → sign → settle. Spending caps, mandates, idempotency, audit, and buyer protection are implementer responsibilities.

Production teams rebuild the same middleware privately. Open GitHub issues document the gap.

## What we build

```
Agent decides → [x402-guard] → x402 sign/settle → (optional Railguard hook)
```

### In scope (v0.x)

- Fail-closed policy middleware (TypeScript + Go)
- Per-call and rolling-window budgets
- Domain and payee allowlists
- Replay / idempotency fingerprints
- Tamper-evident JSONL receipts
- Human escalation for mandate-required payments

### Out of scope

- Facilitator hosting (use CDP / x402.org)
- Service discovery (use Agentic.Market / Bazaar)
- Full AP2 implementation (integrate later)
- Invoice SaaS UI (Railguard CDP product repo)

## Success metrics

1. Upstream adoption — merged PR or reference in x402-go / a2a-x402
2. Demo — agent pays a Bazaar endpoint through guard on Base Sepolia
3. Hiring signal — recognized problem + solution at Coinbase, Google, Nethermind, Fireblocks

## Sibling repos

| Repo | Role |
|------|------|
| `x402-guard` | Pre-sign policy + audit |
| `railguard-new` | On-chain hook + SignGate |
| `coinbase` | CDP execution + invoice business policy |

## North star

When a CTO asks how to let agents pay safely in production, x402-guard is the first OSS answer linked from the x402 ecosystem.
