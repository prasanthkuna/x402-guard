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

- H-02 executionId in `ExecutionAllowed` event + watcher identity reconciliation
- H-03 server-side reserve binding to full session snapshot
- H-09 watcher reorg / confirmation depth
- H-10 Redis aggregate TTL vs session lifetime
- P0 coinbase lint/encore typecheck + dependency audit cleanup
- P4 fault-injection integration tests

## Test commands

```powershell
cd x402-guard; npm run build; bun test
cd railguard-new/signgate; go test ./...
cd coinbase; bun test apps/api
```
