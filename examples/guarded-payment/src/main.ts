import { parseResourceUrl } from "@x402-guard/core";
import {
  X402Guard,
  defaultDevPolicy,
  withSpendingPolicy,
} from "@x402-guard/middleware";

const agentId = process.env.AGENT_ID ?? "agent_demo";
const payer =
  process.env.PAYER_ADDRESS ?? "0x1111111111111111111111111111111111111111";

const guard = new X402Guard({
  policy: defaultDevPolicy(agentId),
  policyVersion: "demo-v0.1.0",
});

const guardedPay = withSpendingPolicy(
  async (amountAtomic, resourceUrl) => {
    console.log("[x402] would sign payment", {
      amountAtomic: amountAtomic.toString(),
      resourceUrl,
    });
    return true;
  },
  guard,
  (amountAtomic, resourceUrl) => ({
    agentId,
    payer,
    payTo: "0x2222222222222222222222222222222222222222",
    amountAtomic,
    asset: "USDC",
    network: "eip155:84532",
    resource: parseResourceUrl(resourceUrl),
    description: "guarded-payment demo",
  }),
);

async function main() {
  const url =
    process.env.X402_RESOURCE_URL ?? "https://api.example.com/v1/premium-data";
  const amount = BigInt(process.env.X402_AMOUNT_ATOMIC ?? "50000");

  console.log("=== x402-guard demo ===");
  const ok = await guardedPay(amount, url);
  console.log("allowed:", ok);
  console.log("receipt:", guard.lastReceipt);

  guard.recordSettlement(
    "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
  );
  console.log("\n--- audit jsonl ---");
  console.log(guard.exportAuditJsonl());

  console.log("\n=== blocked payment demo ===");
  try {
    await guardedPay(9_000_000n, url);
  } catch (e) {
    console.log("blocked as expected:", (e as Error).name);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
