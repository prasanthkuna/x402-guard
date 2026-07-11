# Security remediation — pass 2 (2026-07-11)

## Closed in this pass

| Finding | Resolution |
|---------|------------|
| PAYMENT_MODE default demo | `apps/api/config.ts` fails module load without explicit `PAYMENT_MODE` |
| C-04 partial | Validate → sign → transactional `AuthorizeSession`; limits from intent; `consumed_session_id` set |
| H-02 calldata-only replay | Hook uses monotonic `sessionExecutionSeq` per session |
| H-10 (interface) | `GuardStateStore` + `InMemoryGuardStateStore`; middleware `stateStore` option |
| H-15 WorkOS tenant header | Org only from verified token claims |
| H-14 audit fork | `pg_advisory_xact_lock` + `audit_chain_heads` serialized append |
| Chain truth (partial) | `submitted → confirmed`; `execution_id` on payment intents |

## Migrations required

- `coinbase`: `004_payment_execution_states.up.sql`, `005_confirmed_state_and_audit_head.up.sql`
- `railguard-new`: `003_intent_limits_and_session_binding.sql`

## SignGate session API (breaking)

```json
POST /v1/sessions/register
{
  "decisionId": "dec_...",
  "sessionKey": "0x...",
  "nonceKey": "12345",
  "validAfter": 1,
  "validUntil": 9999999999
}
```

All token/recipient/limits derived server-side from ALLOW decision intent.

## Still open (10x backlog)

- Postgres `GuardStateStore` implementation
- SignGate reservation expiry + 1:1 reconciliation
- CDP confirmation depth watcher before `confirmed`
- Approval bound to policy snapshot hash
- Separation of duties enforce distinct approver/executor
- `bun audit` dependency upgrades
- Concurrency proof tests (100 parallel executes)
