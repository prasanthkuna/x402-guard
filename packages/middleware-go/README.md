# x402-guard middleware for Go (x402-go #26)

Fail-closed spending policy wrapper around `PaymentCallback`.

```go
import x402guard "github.com/prasanthkuna/x402-guard/middleware-go"
```

## Status

v0.1 — reference implementation for [mark3labs/x402-go#26](https://github.com/mark3labs/x402-go/issues/26).  
Upstream PR guide: [docs/UPSTREAM_X402_GO.md](../../docs/UPSTREAM_X402_GO.md)

## API

```go
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

## Build

```bash
go test ./...
```
