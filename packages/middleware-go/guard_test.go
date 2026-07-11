package x402guard

import (
	"math/big"
	"testing"
)

func TestGuardBlocksPerCallCap(t *testing.T) {
	guard := New(GuardConfig{
		AgentID:    "agent_demo",
		MaxPerCall: big.NewInt(100_000),
	})
	decision, rules := guard.Evaluate(PaymentContext{
		AgentID:      "agent_demo",
		AmountAtomic: big.NewInt(200_000),
		ResourceURL:  "https://api.example.com",
	})
	if decision != DecisionBlock {
		t.Fatalf("expected block, got %s", decision)
	}
	if len(rules) == 0 {
		t.Fatal("expected rules")
	}
}

func TestWithSpendingPolicyAllowsCompliantPayment(t *testing.T) {
	guard := New(GuardConfig{
		AgentID:    "agent_demo",
		MaxPerCall: big.NewInt(1_000_000),
	})
	called := false
	wrapped := WithSpendingPolicy(func(amount *big.Int, resource string) bool {
		called = true
		return true
	}, guard, func(amount *big.Int, resource string) PaymentContext {
		return PaymentContext{AgentID: "agent_demo", AmountAtomic: amount, ResourceURL: resource}
	})
	if !wrapped(big.NewInt(50_000), "https://api.example.com") {
		t.Fatal("expected allow")
	}
	if !called {
		t.Fatal("expected callback")
	}
}
