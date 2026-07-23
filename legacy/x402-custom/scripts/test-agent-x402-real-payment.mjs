import { x402Client } from "@okxweb3/x402-core/client";
import { decodePaymentRequiredHeader, x402HTTPClient } from "@okxweb3/x402-core/http";
import { ExactEvmScheme, toClientEvmSigner } from "@okxweb3/x402-evm";
import { createPublicClient, erc20Abi, formatEther, formatUnits, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { xLayer } from "viem/chains";

const base = new URL(process.env.DEPLOYMENT_URL || "https://processforgeai.xyz").origin;
const endpoint = `${base}/api/agent/generate-sop`;
const body = { title: "Real x402 payment test", description: "Operations validates a request, records evidence, obtains approval, and escalates exceptions.", industry: "Technology", department: "Operations", audience: "Operations team", output_format: "json" };
const idempotencyKey = `real-payment-${crypto.randomUUID()}`;
const headers = { "content-type": "application/json", "idempotency-key": idempotencyKey };
const unpaid = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
if (unpaid.status !== 402) throw new Error(`Expected 402, received ${unpaid.status}`);
const encodedChallenge = unpaid.headers.get("payment-required");
if (!encodedChallenge) throw new Error("Missing PAYMENT-REQUIRED header.");
const paymentRequired = decodePaymentRequiredHeader(encodedChallenge);
const requirement = paymentRequired.accepts?.[0];
validateChallenge(paymentRequired, requirement, endpoint);

if (!process.env.OKX_X402_BUYER_PRIVATE_KEY) throw new Error("OKX_X402_BUYER_PRIVATE_KEY is required for public-address and balance preflight.");
const account = privateKeyToAccount(process.env.OKX_X402_BUYER_PRIVATE_KEY);
const publicClient = createPublicClient({ chain: xLayer, transport: http(process.env.OKX_X402_RPC_URL || "https://rpc.xlayer.tech") });
const [chainId, tokenBalance, nativeBalance] = await Promise.all([
  publicClient.getChainId(),
  publicClient.readContract({ address: requirement.asset, abi: erc20Abi, functionName: "balanceOf", args: [account.address] }),
  publicClient.getBalance({ address: account.address }),
]);
if (chainId !== 196) throw new Error(`RPC chain mismatch: expected 196, received ${chainId}.`);
const requiredAmount = BigInt(requirement.amount);
const tokenDecimals = 6;
console.log(JSON.stringify({ mode: process.env.DIAGNOSE_REAL_X402_PAYMENT === "YES" ? "diagnosis" : "payment", buyer_address: account.address, network: requirement.network, asset_symbol: "USDT", asset_contract: requirement.asset, token_balance_atomic: tokenBalance.toString(), token_balance: formatUnits(tokenBalance, tokenDecimals), required_amount_atomic: requirement.amount, required_amount: formatUnits(requiredAmount, tokenDecimals), native_balance: formatEther(nativeBalance), native_gas_required_by_transfer_method: false, transfer_method: requirement.extra.assetTransferMethod ?? "eip3009", recipient: requirement.payTo, resource: paymentRequired.resource.url }, null, 2));
if (tokenBalance < requiredAmount) throw new Error("Buyer preflight failed: insufficient USDT0 balance.");
if (process.env.DIAGNOSE_REAL_X402_PAYMENT === "YES") { console.log("Diagnosis complete: no signature was created and no paid retry was submitted."); process.exit(0); }

console.log(`REAL PAYMENT: ${requirement.amount} atomic units of USDT to ${requirement.payTo}`);
if (process.env.CONFIRM_REAL_X402_PAYMENT !== "YES") throw new Error("Refusing real payment. Review the amount above, then set CONFIRM_REAL_X402_PAYMENT=YES.");
for (const name of ["OKX_X402_API_KEY", "OKX_X402_SECRET_KEY", "OKX_X402_PASSPHRASE"]) if (!process.env[name]) throw new Error(`Missing required official test credential: ${name}`);
const core = new x402Client().register("eip155:196", new ExactEvmScheme(toClientEvmSigner(account)));
const client = new x402HTTPClient(core);
const officialChallenge = client.getPaymentRequiredResponse(name => unpaid.headers.get(name));
const paymentPayload = await client.createPaymentPayload(officialChallenge);
validateCreatedPayload(paymentPayload, requirement, account.address, endpoint);
const paid = await fetch(endpoint, { method: "POST", headers: { ...headers, ...client.encodePaymentSignatureHeader(paymentPayload) }, body: JSON.stringify(body) });
const paidText = await paid.text();
let result; try { result = JSON.parse(paidText); } catch { result = null; }
if (paid.status !== 200 || result?.status !== "completed" || !result?.sop) {
  const safeError = result?.error && typeof result.error === "object" ? { code: result.error.code ?? null, message: result.error.message ?? "Payment request failed.", reason: result.error.reason ?? null, reason_message: result.error.reason_message ?? null, request_id: result.error.request_id ?? null } : { code: "UNEXPECTED_RESPONSE", message: `Paid request failed with HTTP ${paid.status}.`, reason: null, reason_message: null, request_id: null };
  console.error(JSON.stringify({ error: safeError }, null, 2));
  throw new Error(`Paid request failed with HTTP ${paid.status}; see safe structured error above.`);
}
const settlement = client.getPaymentSettleResponse(name => paid.headers.get(name));
if (!settlement?.transaction) throw new Error("Successful response did not include a settlement reference.");
console.log(JSON.stringify({ status: "completed", request_id: result.request_id, settlement_reference: settlement.transaction }, null, 2));

function validateChallenge(challenge, accepted, expectedResource) {
  const expectedAsset = "0x779ded0c9e1022225f8e0630b35a9b54be713736";
  if (challenge.x402Version !== 2) throw new Error(`Expected x402Version 2, received ${challenge.x402Version}.`);
  if (!accepted || accepted.scheme !== "exact" || accepted.network !== "eip155:196") throw new Error("Challenge does not advertise exact on eip155:196.");
  if (accepted.asset.toLowerCase() !== expectedAsset) throw new Error(`Unexpected asset contract ${accepted.asset}.`);
  if (accepted.amount !== "10000") throw new Error(`Expected amount 10000, received ${accepted.amount}.`);
  if (!/^0x[a-fA-F0-9]{40}$/.test(accepted.payTo)) throw new Error("Challenge recipient is not an EVM address.");
  if (process.env.OKX_X402_PAY_TO_ADDRESS && accepted.payTo.toLowerCase() !== process.env.OKX_X402_PAY_TO_ADDRESS.toLowerCase()) throw new Error("Challenge recipient does not match OKX_X402_PAY_TO_ADDRESS.");
  if (accepted.extra?.name !== "USD₮0" || accepted.extra?.version !== "1") throw new Error("Challenge USDT0 EIP-712 domain metadata is invalid.");
  if ((accepted.extra?.assetTransferMethod ?? "eip3009") !== "eip3009") throw new Error(`Unsupported transfer method ${accepted.extra?.assetTransferMethod}.`);
  if (!Number.isInteger(accepted.maxTimeoutSeconds) || accepted.maxTimeoutSeconds <= 0) throw new Error("Challenge timeout is invalid.");
  if (challenge.resource?.url !== expectedResource) throw new Error(`Challenge resource mismatch: expected ${expectedResource}.`);
}

function validateCreatedPayload(payload, accepted, buyerAddress, expectedResource) {
  if (payload.x402Version !== 2 || payload.resource?.url !== expectedResource) throw new Error("Official buyer payload resource or version mismatch.");
  for (const field of ["scheme", "network", "asset", "amount", "payTo"]) if (String(payload.accepted?.[field]).toLowerCase() !== String(accepted[field]).toLowerCase()) throw new Error(`Official buyer payload changed accepted.${field}.`);
  const authorization = payload.payload?.authorization;
  if (!authorization || String(authorization.from).toLowerCase() !== buyerAddress.toLowerCase()) throw new Error("Official buyer payload payer mismatch.");
  const now = Math.floor(Date.now() / 1000); const validAfter = Number(authorization.validAfter); const validBefore = Number(authorization.validBefore);
  if (!Number.isFinite(validAfter) || !Number.isFinite(validBefore) || now < validAfter || now >= validBefore) throw new Error("Official buyer authorization is not currently valid.");
  if (validBefore - validAfter > accepted.maxTimeoutSeconds + 10) throw new Error("Official buyer authorization exceeds the advertised timeout.");
}
