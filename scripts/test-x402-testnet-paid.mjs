import { decodePaymentRequiredHeader, decodePaymentResponseHeader } from "@okxweb3/x402-core/http";
import { x402Client } from "@okxweb3/x402-core/client";
import { ExactEvmScheme, toClientEvmSigner } from "@okxweb3/x402-evm";
import { wrapFetchWithPayment } from "@okxweb3/x402-fetch";
import { createPublicClient, formatEther, formatUnits, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const NETWORK = "eip155:1952";
const CHAIN_ID = 1952;
const ASSET = "0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c";
const RPC_URL = process.env.OKX_X402_TESTNET_RPC_URL || "https://xlayertestrpc.okx.com/terigon";
const endpoint = new URL(
  "/api/agent/generate-sop",
  process.env.TESTNET_DEPLOYMENT_URL || process.env.DEPLOYMENT_URL || "http://localhost:3000",
).href;
const privateKey = process.env.OKX_X402_TESTNET_BUYER_PRIVATE_KEY;
if (!privateKey || !/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
  throw new Error("OKX_X402_TESTNET_BUYER_PRIVATE_KEY is required and must be a valid private key.");
}
const account = privateKeyToAccount(privateKey);
const publicClient = createPublicClient({ transport: http(RPC_URL) });
const chainId = await publicClient.getChainId();
if (chainId !== CHAIN_ID) throw new Error(`Testnet RPC returned chain ID ${chainId}; expected ${CHAIN_ID}.`);

const body = {
  title: "Canonical X Layer testnet payment",
  description: "Operations validates a request, records evidence, obtains approval, and escalates exceptions.",
  industry: "Technology",
  department: "Operations",
  audience: "Operations team",
  output_format: "json",
};
const headers = { "content-type": "application/json" };
const unpaid = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
if (unpaid.status !== 402) throw new Error(`Expected initial HTTP 402, received ${unpaid.status}.`);
const encoded = unpaid.headers.get("payment-required");
if (!encoded) throw new Error("Initial response did not include payment-required.");
const challenge = decodePaymentRequiredHeader(encoded);
const requirement = challenge?.accepts?.[0];
if (challenge?.x402Version !== 2
  || requirement?.scheme !== "exact"
  || requirement?.network !== NETWORK
  || requirement?.asset?.toLowerCase() !== ASSET
  || requirement?.extra?.name !== "USD₮0"
  || requirement?.extra?.version !== "1"
  || challenge?.resource?.url !== endpoint) {
  throw new Error("The server challenge does not match the canonical X Layer Testnet payment profile.");
}
if (!/^0x[a-fA-F0-9]{40}$/.test(requirement.payTo)) throw new Error("The challenge recipient is invalid.");
if (!/^\d+$/.test(requirement.amount)) throw new Error("The challenge amount is invalid.");

const erc20Abi = [{
  type: "function",
  name: "balanceOf",
  stateMutability: "view",
  inputs: [{ name: "account", type: "address" }],
  outputs: [{ name: "", type: "uint256" }],
}];
const tokenBalance = await publicClient.readContract({
  address: ASSET,
  abi: erc20Abi,
  functionName: "balanceOf",
  args: [account.address],
});
const nativeBalance = await publicClient.getBalance({ address: account.address });
const requiredAmount = BigInt(requirement.amount);
console.log(JSON.stringify({
  buyer_address: account.address,
  network: requirement.network,
  asset: requirement.asset,
  token_balance_atomic: tokenBalance.toString(),
  token_balance: formatUnits(tokenBalance, 6),
  native_balance: formatEther(nativeBalance),
  amount_atomic: requirement.amount,
  amount: formatUnits(requiredAmount, 6),
  recipient: requirement.payTo,
  resource: challenge.resource.url,
}, null, 2));
if (tokenBalance < requiredAmount) throw new Error("The buyer has insufficient test USD₮0.");
if (process.env.CONFIRM_TESTNET_X402_PAYMENT !== "YES") {
  throw new Error("Refusing testnet payment. Review the values above, then set CONFIRM_TESTNET_X402_PAYMENT=YES.");
}

const signer = toClientEvmSigner(account, publicClient);
const client = new x402Client().register(NETWORK, new ExactEvmScheme(signer));
let replayHeaders = null;
const recordingFetch = async (input, init) => {
  const outgoing = new Request(input, init);
  const paymentSignature = outgoing.headers.get("payment-signature");
  const xPayment = outgoing.headers.get("x-payment");
  if (paymentSignature || xPayment) {
    replayHeaders = {
      "content-type": "application/json",
      ...(paymentSignature ? { "payment-signature": paymentSignature } : {}),
      ...(xPayment ? { "x-payment": xPayment } : {}),
    };
  }
  return fetch(input, init);
};
const fetchWithPayment = wrapFetchWithPayment(recordingFetch, client);
const paid = await fetchWithPayment(endpoint, {
  method: "POST",
  headers,
  body: JSON.stringify(body),
});
const result = await paid.json().catch(() => null);
if (paid.status !== 200 || result?.status !== "completed") {
  throw new Error(`Paid request failed safely with HTTP ${paid.status} and code ${result?.error?.code ?? "UNKNOWN"}.`);
}
const paymentResponse = paid.headers.get("payment-response");
if (!paymentResponse) throw new Error("Successful paid response did not include payment-response.");
const settlement = decodePaymentResponseHeader(paymentResponse);
if (!settlement?.transaction) throw new Error("Successful paid response did not include a settlement reference.");

if (!replayHeaders) throw new Error("The official client did not emit a standard payment header.");
const idempotent = await fetch(endpoint, { method: "POST", headers: replayHeaders, body: JSON.stringify(body) });
const idempotentBody = await idempotent.json().catch(() => null);
if (idempotent.status !== 200
  || idempotentBody?.request_id !== result.request_id
  || idempotent.headers.get("x-idempotent-replay") !== "true") {
  throw new Error("Completed-result idempotency verification failed.");
}
const conflict = await fetch(endpoint, {
  method: "POST",
  headers: replayHeaders,
  body: JSON.stringify({ ...body, description: `${body.description} Changed content.` }),
});
const conflictBody = await conflict.json().catch(() => null);
if (conflict.status !== 409 || conflictBody?.error?.code !== "PAYMENT_REPLAY_CONFLICT") {
  throw new Error("Changed-body idempotency conflict verification failed.");
}
console.log(JSON.stringify({
  status: "completed",
  request_id: result.request_id,
  settlement_reference: settlement.transaction,
  idempotent_replay: "pass",
  changed_body_conflict: "pass",
}, null, 2));
