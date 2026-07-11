# Upstream PR: x402-go spending middleware

Target: [mark3labs/x402-go#26](https://github.com/mark3labs/x402-go/issues/26)

## PR title

`feat(middleware): fail-closed spending policy wrapper (x402-guard)`

## Summary

Adds optional `WithSpendingPolicy` middleware that evaluates per-call caps and rolling budgets **before** the payment callback signs or submits an x402 payment.

Reference implementation: https://github.com/prasanthkuna/x402-guard/tree/main/packages/middleware-go

## Motivation

x402 enables instant agent payments but does not enforce spending limits. Production agents need fail-closed policy at the middleware layer — the gap called out in #26 and [a2a-x402#60](https://github.com/google-agentic-commerce/a2a-x402/issues/60).

## API (proposed)

```go
import x402guard "github.com/prasanthkuna/x402-guard/middleware-go"

guard := x402guard.New(x402guard.GuardConfig{
    AgentID:    "agent_demo",
    MaxPerCall: big.NewInt(1_000_000),
    DailyLimit: big.NewInt(10_000_000),
})

wrapped := x402guard.WithSpendingPolicy(originalCallback, guard, func(amount *big.Int, resource string) x402guard.PaymentContext {
    return x402guard.PaymentContext{
        AgentID:      "agent_demo",
        AmountAtomic: amount,
        ResourceURL:  resource,
    }
})
```

## Test plan

```bash
cd packages/middleware-go
go test ./...
```

## Follow-ups (not in v0.1 PR)

- Domain / payee allowlists
- Replay / idempotency guard
- Hash-chained audit receipts (see TS `@x402-guard/receipts`)
- AP2 mandate escalation path

## Fork workflow

```powershell
gh repo fork mark3labs/x402-go --clone
cd x402-go
# copy packages/middleware-go/guard.go + guard_test.go into appropriate path
# match x402-go package layout and naming conventions
git checkout -b feat/spending-policy-middleware
git commit -am "feat: spending policy middleware"
gh pr create --repo mark3labs/x402-go --title "feat(middleware): fail-closed spending policy wrapper"
```
