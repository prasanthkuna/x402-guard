# x402-guard middleware for Go (x402-go #26)

Fail-closed spending policy wrapper around `PaymentCallback`.

## Status

v0.1 scaffold — PR target for [mark3labs/x402-go#26](https://github.com/mark3labs/x402-go/issues/26).

## API sketch

```go
guard := x402guard.New(GuardConfig{
    AgentID: "agent_demo",
    MaxPerCall: big.NewInt(1_000_000),
})

wrapped := x402guard.WithSpendingPolicy(originalCallback, guard, func(amount *big.Int, resource string) PaymentContext {
    // map to context
})
```

## Build

```bash
go test ./...
```
