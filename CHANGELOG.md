# Changelog

## 0.1.0 — 2026-07-11

### Added

- `@x402-guard/core` — shared types, URL parsing, canonical JSON
- `@x402-guard/policy` — spend tracker, replay guard, policy engine + JSON schema
- `@x402-guard/receipts` — hash-chained audit ledger
- `@x402-guard/middleware` — `X402Guard`, `withSpendingPolicy()`
- `middleware-go` — Go spending policy scaffold (x402-go PR target)
- Example: `examples/guarded-payment`
- CI: Node 20 + Go 1.22

### Targets

- [mark3labs/x402-go#26](https://github.com/mark3labs/x402-go/issues/26)
- [google-agentic-commerce/a2a-x402#60](https://github.com/google-agentic-commerce/a2a-x402/issues/60)
