# Security remediation — pass 3 (2026-07-11)

## Closed in this pass

| Finding | Resolution |
|---------|------------|
| H-10 durable state | `DbGuardStateStore` in coinbase (`x402_guard_replays`, `x402_guard_spends`); middleware uses `evaluateAgentPolicyWithStore` |
| M-08 spend before callback | `evaluate()` policy-only; `commitAllowedSpend` / `withSpendingPolicy` records spend after success |
| M-09 asset/network policy | `allowedAssets` / `allowedNetworks` enforced in policy evaluator |
| H-05 reservation TTL | `SweepExpired` + ZSET expiry index; session aggregate key 24h safety TTL |
| H-07 budget commit 1:1 | `CommitBudgetOnChainExecution` commits oldest open reservation only |
| Reserve maxTotalSpend client trust | Server loads `max_total_spend` from sessions table |
| Persistence errors ignored | SignGate handlers fail on `SaveReservation` / `SaveUserOp` errors |
| CDP confirmation depth | Live mode waits for 1 on-chain confirmation via viem before `confirmed` |
| M-14 approval binding | `approvals.policy_run_id` FK; `ensurePayable` rejects stale approvals |
| M-15 separation of duties | `assertExecutorDiffersFromApprover` on execute |
| PAYMENT_MODE encore check | Lazy `resolvePaymentMode()` — fails at execution, not module load |
| Concurrency claim proof | `execution-claim.test.ts` — 100 parallel claimers, exactly one winner |
| Workspace audit noise | Root workspaces exclude `apps/video` from default install graph |

## Migrations required

- `coinbase`: `006_approval_and_x402_state.up.sql` (plus prior 004–005)
- `railguard-new`: `003_intent_limits_and_session_binding.sql` (unchanged)

## Still open (lower priority)

- SignGate Redis spend sync from watcher (M-01)
- Watcher reorg / confirmation depth on hook path
- `bun audit` dependency upgrades (video app isolated; advisories remain in dev deps)
- Postgres `GuardStateStore` in x402-guard OSS package (coinbase ships `DbGuardStateStore`)

## Test commands

```powershell
cd x402-guard; bun test
cd railguard-new/signgate; go test ./...
cd coinbase; bun test apps/api
```
