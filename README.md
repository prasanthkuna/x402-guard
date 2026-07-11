# x402-guard

[![CI](https://github.com/prasanthkuna/x402-guard/actions/workflows/ci.yml/badge.svg)](https://github.com/prasanthkuna/x402-guard/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/prasanthkuna/x402-guard)](./LICENSE)

**Fail-closed policy, replay protection, and audit receipts for x402 agent payments.**

x402 lets agents pay for HTTP resources instantly. It does not stop a compromised agent from draining a wallet. **x402-guard** sits between agent intent and signature — the production layer the protocol intentionally leaves out.

Addresses open ecosystem gaps:

- [mark3labs/x402-go#26](https://github.com/mark3labs/x402-go/issues/26) — spending policy middleware
- [google-agentic-commerce/a2a-x402#60](https://github.com/google-agentic-commerce/a2a-x402/issues/60) — per-agent limits and provenance
- [x402-foundation/x402#2294](https://github.com/x402-foundation/x402/issues/2294) — settlement recovery (roadmap)

## Problem

| Concern | x402 core | x402-guard |
|---------|-----------|------------|
| Per-call spending caps | No | Yes |
| Rolling budgets | No | Yes |
| Domain / payee allowlists | No | Yes |
| Replay / idempotency | No | Yes |
| Audit receipts | No | JSONL hash chain |
| AP2 mandate gate | No | Escalate path |
| On-chain hard ceiling | No | [Railguard](https://github.com/prasanthkuna/railguard-new) hook (optional) |

## Install

```bash
npm install @x402-guard/middleware
```

## Quick start

```typescript
import { parseResourceUrl } from "@x402-guard/core";
import {
  X402Guard,
  defaultDevPolicy,
  withSpendingPolicy,
} from "@x402-guard/middleware";

const guard = new X402Guard({ policy: defaultDevPolicy("agent_demo") });

const pay = withSpendingPolicy(yourX402SignCallback, guard, (amount, url) => ({
  agentId: "agent_demo",
  payer: "0xYourAgentWallet",
  payTo: "0xMerchant",
  amountAtomic: amount,
  asset: "USDC",
  network: "eip155:84532",
  resource: parseResourceUrl(url),
}));

await pay(50_000n, "https://api.example.com/v1/data");
console.log(guard.lastReceipt);
guard.recordSettlement("0xabc...");
```

## Monorepo packages

| Package | Description |
|---------|-------------|
| `@x402-guard/core` | Shared types, URL parsing, canonical JSON |
| `@x402-guard/policy` | Spend tracker, replay guard, policy engine |
| `@x402-guard/receipts` | Tamper-evident audit ledger |
| `@x402-guard/middleware` | `X402Guard`, `withSpendingPolicy()` |
| `middleware-go` | Go wrapper — upstream PR target for x402-go |

## Related projects

| Repo | Role |
|------|------|
| [railguard-new](https://github.com/prasanthkuna/railguard-new) | ERC-7579 on-chain execution hook + SignGate |
| Railguard CDP | Invoice-to-USDC business policy (private product) |

## Development

```powershell
cd x402-guard
npm install
npm run build
npm run test
cd packages\middleware-go
go test ./...
cd ..\..\examples\guarded-payment
npm run start
```

## Roadmap

- [ ] `x402-fetch` / CDP AgentKit client integration
- [ ] AP2 mandate verifier module
- [ ] Settlement recovery adapter (#2294)
- [ ] Upstream PR to mark3labs/x402-go
- [ ] Railguard hook integration demo on Base Sepolia

## License

Apache-2.0
