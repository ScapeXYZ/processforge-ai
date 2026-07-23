import { x402Client } from "@okxweb3/x402-core/client";
import { x402HTTPClient } from "@okxweb3/x402-core/http";
import { ExactEvmScheme, toClientEvmSigner } from "@okxweb3/x402-evm";
import { privateKeyToAccount } from "viem/accounts";

const base = new URL(process.env.DEPLOYMENT_URL || "https://processforgeai.xyz").origin;
const body = { title: "Real x402 payment test", description: "Operations validates a request, records evidence, obtains approval, and escalates exceptions.", industry: "Technology", department: "Operations", audience: "Operations team", output_format: "json" };
const idempotencyKey = `real-payment-${crypto.randomUUID()}`;
const headers = { "content-type": "application/json", "idempotency-key": idempotencyKey };
const unpaid = await fetch(`${base}/api/agent/generate-sop`, { method: "POST", headers, body: JSON.stringify(body) });
if (unpaid.status !== 402) throw new Error(`Expected 402, received ${unpaid.status}`);
const challengeBody = await unpaid.json(); const requirement = challengeBody?.x402?.accepts?.[0];
if (!requirement || requirement.network !== "eip155:196") throw new Error("Invalid production payment requirement.");
console.log(`REAL PAYMENT: ${requirement.amount} atomic units of ${requirement.extra?.assetSymbol || requirement.asset} to ${requirement.payTo}`);
if (process.env.CONFIRM_REAL_X402_PAYMENT !== "YES") throw new Error("Refusing real payment. Review the amount above, then set CONFIRM_REAL_X402_PAYMENT=YES.");
for (const name of ["OKX_X402_API_KEY", "OKX_X402_SECRET_KEY", "OKX_X402_PASSPHRASE", "OKX_X402_BUYER_PRIVATE_KEY"]) if (!process.env[name]) throw new Error(`Missing required official test credential: ${name}`);
const account = privateKeyToAccount(process.env.OKX_X402_BUYER_PRIVATE_KEY);
const core = new x402Client().register("eip155:196", new ExactEvmScheme(toClientEvmSigner(account)));
const client = new x402HTTPClient(core);
const paymentRequired = client.getPaymentRequiredResponse(name => unpaid.headers.get(name), challengeBody);
const paymentPayload = await client.createPaymentPayload(paymentRequired);
const paid = await fetch(`${base}/api/agent/generate-sop`, { method: "POST", headers: { ...headers, ...client.encodePaymentSignatureHeader(paymentPayload) }, body: JSON.stringify(body) });
const paidText = await paid.text();
let result; try { result = JSON.parse(paidText); } catch { result = null; }
if (paid.status !== 200 || result?.status !== "completed" || !result?.sop) {
  const safeError = result?.error && typeof result.error === "object" ? { code: result.error.code ?? null, message: result.error.message ?? "Payment request failed.", request_id: result.error.request_id ?? null } : { code: "UNEXPECTED_RESPONSE", message: `Paid request failed with HTTP ${paid.status}.`, request_id: null };
  console.error(JSON.stringify({ error: safeError }, null, 2));
  throw new Error(`Paid request failed with HTTP ${paid.status}; see safe structured error above.`);
}
const settlement = client.getPaymentSettleResponse(name => paid.headers.get(name));
if (!settlement?.transaction) throw new Error("Successful response did not include a settlement reference.");
console.log(JSON.stringify({ status: "completed", request_id: result.request_id, settlement_reference: settlement.transaction }, null, 2));
