import { decodePaymentRequiredHeader, decodePaymentResponseHeader } from "@okxweb3/x402-core/http";
import { x402Client } from "@okxweb3/x402-core/client";
import { ExactEvmScheme, toClientEvmSigner } from "@okxweb3/x402-evm";
import { wrapFetchWithPayment } from "@okxweb3/x402-fetch";
import { createPublicClient, formatUnits, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const NETWORK = "eip155:196";
const CHAIN_ID = 196;
const ASSET = "0x779ded0c9e1022225f8e0630b35a9b54be713736";
const AMOUNT = "10000";
const RPC_URL = process.env.OKX_X402_RPC_URL || "https://rpc.xlayer.tech";
const deployment = new URL(process.env.DEPLOYMENT_URL || "https://processforgeai.xyz");
if (deployment.protocol !== "https:") throw new Error("Mainnet paid testing requires an HTTPS deployment.");
const endpoint = new URL("/api/agent/generate-sop", deployment).href;

const privateKey = process.env.OKX_X402_BUYER_PRIVATE_KEY;
if (!privateKey || !/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
  throw new Error("OKX_X402_BUYER_PRIVATE_KEY is required and must be a valid private key.");
}
const account = privateKeyToAccount(privateKey);
const publicClient = createPublicClient({ transport: http(RPC_URL) });
const chainId = await publicClient.getChainId();
if (chainId !== CHAIN_ID) throw new Error(`Mainnet RPC returned chain ID ${chainId}; expected ${CHAIN_ID}.`);

const body = {
  title: "Canonical X Layer mainnet payment",
  description: "Operations validates a request, records evidence, obtains approval, and escalates exceptions.",
  industry: "Technology",
  department: "Operations",
  audience: "Operations team",
  output_format: "json",
};
const idempotencyKey = `mainnet-paid-${crypto.randomUUID()}`;
const headers = { "content-type": "application/json", "idempotency-key": idempotencyKey };

const [metadataResponse, unpaid] = await Promise.all([
  fetch(new URL("/api/agent", deployment), { signal: AbortSignal.timeout(30_000) }),
  fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  }),
]);
const metadata = await metadataResponse.json().catch(() => null);
if (metadataResponse.status !== 200) throw new Error(`Agent metadata returned HTTP ${metadataResponse.status}.`);
if (unpaid.status !== 402) throw new Error(`Expected initial HTTP 402, received ${unpaid.status}.`);
const encoded = unpaid.headers.get("payment-required");
if (!encoded) throw new Error("Initial response did not include payment-required.");
const challenge = decodePaymentRequiredHeader(encoded);
const requirement = challenge?.accepts?.[0];
const configuredRecipient = metadata?.pricing?.pay_to;
if (challenge?.x402Version !== 2
  || requirement?.scheme !== "exact"
  || requirement?.network !== NETWORK
  || requirement?.asset?.toLowerCase() !== ASSET
  || String(requirement?.amount) !== AMOUNT
  || !/^0x[a-fA-F0-9]{40}$/.test(configuredRecipient || "")
  || requirement?.payTo?.toLowerCase() !== configuredRecipient.toLowerCase()
  || challenge?.resource?.url !== endpoint) {
  throw new Error("The server challenge does not match the canonical X Layer mainnet payment profile.");
}

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
const requiredAmount = BigInt(requirement.amount);
console.log(JSON.stringify({
  buyer_address: account.address,
  network: requirement.network,
  asset: requirement.asset,
  token_balance: formatUnits(tokenBalance, 6),
  required_amount: formatUnits(requiredAmount, 6),
  recipient: requirement.payTo,
  resource_url: challenge.resource.url,
}, null, 2));
if (tokenBalance < requiredAmount) throw new Error("The buyer has insufficient mainnet USD₮0.");
if (process.env.CONFIRM_MAINNET_X402_PAYMENT !== "YES") {
  throw new Error("Refusing mainnet payment. Review the values above, then set CONFIRM_MAINNET_X402_PAYMENT=YES.");
}

const signer = toClientEvmSigner(account, publicClient);
const client = new x402Client().register(NETWORK, new ExactEvmScheme(signer));
const fetchWithPayment = wrapFetchWithPayment(fetch, client);
let paid;
try {
  paid = await fetchWithPayment(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
} catch {
  console.error(JSON.stringify({
    http_status: null,
    error: {
      code: "PAYMENT_CLIENT_ERROR",
      message: "The official payment client failed before receiving a response.",
      reason: null,
      request_id: null,
    },
  }, null, 2));
  process.exit(1);
}
const result = await paid.json().catch(() => null);
if (paid.status !== 200) {
  const returnedChallenge = paid.headers.get("payment-required");
  let decodedChallenge = null;
  if (returnedChallenge) {
    try {
      decodedChallenge = decodePaymentRequiredHeader(returnedChallenge);
    } catch {
      decodedChallenge = { error: "The returned PAYMENT-REQUIRED header could not be decoded." };
    }
  }
  const requestId = result?.error?.request_id ?? result?.request_id ?? null;
  console.error(JSON.stringify({
    http_status: paid.status,
    request_id: requestId,
    response_headers: {
      payment_required: decodedChallenge,
    },
    response_body: result,
  }, null, 2));
  process.exitCode = 1;
} else {
  if (result?.status !== "completed" || !result?.sop) {
    throw new Error("HTTP 200 response did not contain a completed generated SOP.");
  }
  const paymentResponse = paid.headers.get("payment-response");
  if (!paymentResponse) throw new Error("Successful paid response did not include payment-response.");
  const settlement = decodePaymentResponseHeader(paymentResponse);
  if (!settlement?.transaction) throw new Error("Successful paid response did not include a settlement reference.");
  console.log(JSON.stringify({
    status: "completed",
    request_id: result.request_id,
    settlement_reference: settlement.transaction,
  }, null, 2));
}
