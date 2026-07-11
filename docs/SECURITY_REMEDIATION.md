# Security remediation log (2026-07-11)

Tracks fixes applied from the three-project security audit.

## x402-guard

| Finding | Fix |
|---------|-----|
| C-05 negative amounts | `validatePaymentContext` rejects `amountAtomic <= 0`; policy blocks `amount.non_positive` |
| H-09 domain spoofing | Domain/path must match parsed URL via `canonicalizeResource` |
| H-11 settlement binding | `recordSettlement(receiptId, txHash)` — no `lastReceipt` coupling |
| M-11 replay receipts | Replay attempts record `replay.detected` receipt before throw |
| Low receipt ID reuse | Settlement entries use new `rcpt_settle_*` IDs |

## coinbase (railguard-cdp)

| Finding | Fix |
|---------|-----|
| C-01 double execution | `prepared -> executing` atomic transition |
| C-02 broadcast/DB split | `submitted` intermediate state; ambiguous failures -> `unknown` |
| C-03 live/demo fallback | `PAYMENT_MODE=demo\|live` required; no silent demo on live errors |
| H-12 agent mismatch | Org-scoped agent `org:<organizationID>` |
| H-13 claim before validation | Policy/x402 run before executing claim |
| M-17 wrong payer | `resolveCdpPayerAddress()` uses CDP account, not invoice wallet |
| M-18 demo hash collision | Demo seed includes intent ID + idempotency key |

Migration: `apps/api/migrations/004_payment_execution_states.up.sql`

## railguard-new

| Finding | Fix |
|---------|-----|
| C-04 cosign without ALLOW | `registerSession` requires consumable `decisionId` bound to intent |
| H-01 hook front-run | `setAdapter` restricted to immutable `deployer` |
| H-04 validator revert | `ECDSA.tryRecover` returns false on malformed sigs |
| H-08 receipt ALLOW default | `GetReceipt` fails closed on missing decision |

Migration: `db/migrations/002_policy_decision_consumption.sql`

## Deferred (documented, not in this pass)

- H-02 execution digest / UserOp nonce binding
- H-05 Redis reservation expiry repair
- H-06/H-07 reservation authority and 1:1 reconciliation
- H-10 durable x402 state (Redis/Postgres)
- H-14/H-15 approval binding and separation of duties
- H-16 chain confirmation before `executed`
- H-15 WorkOS org header trust
- H-16 dependency advisories (`bun audit`)
