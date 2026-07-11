# Security remediation — pass 6 (2026-07-11 portfolio + proof)

## Closed in this pass

| Item | Resolution |
|------|------------|
| P0 portfolio packaging | `docs/PORTFOLIO.md`, `FAILURE_MODES_FIXED.md`, README front door |
| P0 source of truth table | README + PORTFOLIO |
| P0 CDP vs hook clarity | Documented in PORTFOLIO + railguard-cdp README |
| P1 fault-injection (x402) | `packages/policy/src/fault-injection.test.ts` |
| P1 payment state invariants | `coinbase/apps/api/paymentState.ts` + tests |
| P1 watcher confirmation depth | `computeSafeHead` + unit test |
| P2 HSM/MPC path | `THREAT_MODEL.md` production key custody table |
| P2 CDP confirmation depth | `CDP_CONFIRMATION_DEPTH` env via `runtimeConfig.ts` |

---

# Security remediation — pass 5 (2026-07-11 re-audit completion)

## Closed in this pass

| Finding | Resolution |
|---------|------------|
| H-02 executionId in hook event | `ExecutionAllowed` emits `executionDigest`; watcher + store reconcile by digest |
| H-03 server-side reserve binding | `GetSessionReserveSnapshot` + `reserveBudget` validates agent, intent, limits, validity |
| H-09 watcher reorg depth | Block-by-block ingest with confirmation depth; cursor stores block hash |
| H-10 Redis aggregate TTL | Session key TTL derived from `valid_until`; `KeepTTL` on partial release |
| P0 coinbase lint/encore | Biome ignores video/scripts; `encore check` passes with sibling x402-guard build |
| P0 CI x402-guard sibling | PR workflow checks out and builds x402-guard before typecheck |

## Migrations required

- `railguard-new`: `db/migrations/004_execution_digest.sql`
- **Breaking**: `ExecutionAllowed` event signature changed — redeploy hook contract

## Still open

- P4 Postgres integration fault-injection at full API boundaries (unit tests on primitives shipped in pass 6)
- Deep reorg rewind state machine (confirmation depth configurable)
- `bun audit` dependency upgrades in railguard-cdp non-deploy workspaces

## Closed since pass 5

- Canonical E2E (`e2e-happy-path.ps1`) with Docker + Foundry
- Linux `npm ci` / SDK lockfile sync
- Coinbase `encore check` with sibling x402-guard build

## Test commands

```powershell
cd x402-guard; bun test
cd railguard-new/signgate; go test ./...
cd coinbase; bun run lint; bun test apps/api packages; encore check
```

---

# Security remediation — pass 4 (2026-07-11 re-audit)

## Closed in this pass

| Finding | Resolution |
|---------|------------|
| C-01 mutable intent limits | Limits included in canonical intent hash; `SaveIntent` uses `ON CONFLICT DO NOTHING` |
| C-02 x402 budget race | `authorizePayment` + atomic `reserveBudget` / `commitAuthorization` / `releaseAuthorization` |
| C-03 post-broadcast failed | `broadcastedTxHash` tracking; post-broadcast errors become `unknown`, never `failed` |
| H-01 reservation expiry leak | Durable ZSET member `reservationId\|sessionId\|amount`; metadata TTL 2x deadline |
| H-04 idempotent reserve retry | `GetReservationIDByIdempotency` on duplicate `SaveReservation` |
| H-05 approval binding | `policy_snapshot_hash`; execute uses non-persisting policy eval |
| H-06 audit lock | `appendAudit` runs lock/head/insert/head-update in one DB transaction |
| H-07 reverted tx confirmed | `waitForTransferConfirmation` requires `receipt.status === "success"` |
| H-08 reconciler | `reconcileSubmittedPayments` cron every 5m |
| H-11 replay race | `claimReplay` atomic insert in Postgres and in-memory store |
| H-12 spend after confirm | x402 budget committed before `confirmed`; release on post-broadcast failure |
| P0 E2E session register | `e2e-happy-path.ps1` sends `decisionId` body |
| P0 forge fmt | `forge fmt` applied to hook + validator |

## Migrations required

- `coinbase`: `007_atomic_budget_and_snapshot.up.sql`
- `railguard-new`: intent hash change is backward-incompatible for existing ALLOW decisions on mutated intents

## Still open

- P4 fault-injection integration tests

## Test commands

```powershell
cd x402-guard; npm run build; bun test
cd railguard-new/signgate; go test ./...
cd coinbase; bun test apps/api
```
