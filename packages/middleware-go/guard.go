package x402guard

import (
	"math/big"
	"sync"
	"time"
)

type PolicyDecision string

const (
	DecisionAllow    PolicyDecision = "allow"
	DecisionBlock    PolicyDecision = "block"
	DecisionEscalate PolicyDecision = "escalate"
)

type PaymentContext struct {
	AgentID      string
	Payer        string
	PayTo        string
	AmountAtomic *big.Int
	ResourceURL  string
}

type GuardConfig struct {
	AgentID       string
	MaxPerCall    *big.Int
	DailyLimit    *big.Int
	WindowSeconds int64
}

type Guard struct {
	cfg     GuardConfig
	mu      sync.Mutex
	spent   map[string]*big.Int
	window  time.Time
}

func New(cfg GuardConfig) *Guard {
	if cfg.WindowSeconds == 0 {
		cfg.WindowSeconds = 86400
	}
	return &Guard{
		cfg:    cfg,
		spent:  map[string]*big.Int{},
		window: time.Now(),
	}
}

func (g *Guard) Evaluate(ctx PaymentContext) (PolicyDecision, []string) {
	rules := []string{}
	if ctx.AmountAtomic == nil {
		rules = append(rules, "amount.missing")
		return DecisionBlock, rules
	}
	if ctx.AmountAtomic.Sign() <= 0 {
		rules = append(rules, "amount.non_positive")
	}
	if ctx.AgentID != g.cfg.AgentID {
		rules = append(rules, "agent.mismatch")
	}
	if g.cfg.MaxPerCall != nil && ctx.AmountAtomic.Cmp(g.cfg.MaxPerCall) > 0 {
		rules = append(rules, "amount.per_call_cap")
	}
	if len(rules) > 0 {
		return DecisionBlock, rules
	}

	g.mu.Lock()
	defer g.mu.Unlock()

	if g.cfg.WindowSeconds > 0 && time.Since(g.window) > time.Duration(g.cfg.WindowSeconds)*time.Second {
		g.spent = map[string]*big.Int{}
		g.window = time.Now()
	}

	if g.cfg.DailyLimit != nil {
		current := g.spent[ctx.AgentID]
		if current == nil {
			current = big.NewInt(0)
		}
		next := new(big.Int).Add(current, ctx.AmountAtomic)
		if next.Cmp(g.cfg.DailyLimit) > 0 {
			return DecisionBlock, []string{"budget.daily_exceeded"}
		}
		g.spent[ctx.AgentID] = next
	}
	return DecisionAllow, nil
}

type PaymentCallback func(amount *big.Int, resource string) bool

func WithSpendingPolicy(
	callback PaymentCallback,
	guard *Guard,
	toContext func(amount *big.Int, resource string) PaymentContext,
) PaymentCallback {
	return func(amount *big.Int, resource string) bool {
		decision, _ := guard.Evaluate(toContext(amount, resource))
		if decision != DecisionAllow {
			return false
		}
		if callback == nil {
			return true
		}
		return callback(amount, resource)
	}
}
