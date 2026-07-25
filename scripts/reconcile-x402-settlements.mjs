import { OKXFacilitatorClient } from "@okxweb3/x402-core";
import { createClient } from "@supabase/supabase-js";
import { classifySettlement } from "../lib/agent/settlement-classification.ts";

const inputs = process.argv.slice(2);
if (inputs.length === 0) {
  throw new Error("Provide one or more transaction hashes or application request IDs.");
}

const requiredEnvironment = [
  "OKX_X402_API_KEY",
  "OKX_X402_SECRET_KEY",
  "OKX_X402_PASSPHRASE",
  "OKX_X402_FACILITATOR_URL",
];
for (const name of requiredEnvironment) {
  if (!process.env[name]) throw new Error(`${name} is required.`);
}

const facilitator = new OKXFacilitatorClient({
  apiKey: process.env.OKX_X402_API_KEY,
  secretKey: process.env.OKX_X402_SECRET_KEY,
  passphrase: process.env.OKX_X402_PASSPHRASE,
  baseUrl: process.env.OKX_X402_FACILITATOR_URL,
  syncSettle: true,
});

let database = null;
function getDatabase() {
  if (database) return database;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase configuration is required when reconciling request IDs.");
  }
  database = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return database;
}

const results = [];
for (const input of inputs) {
  const transactionHash = /^0x[a-fA-F0-9]{64}$/.test(input)
    ? input
    : await transactionForRequest(input);
  results.push({
    input,
    status: transactionHash ? await officialStatus(transactionHash) : "unknown",
  });
}
console.log(JSON.stringify(results, null, 2));

async function transactionForRequest(requestId) {
  if (!/^[0-9a-fA-F-]{36}$/.test(requestId)) return null;
  const { data, error } = await getDatabase()
    .from("agent_payments")
    .select("transaction_hash")
    .eq("request_id", requestId)
    .maybeSingle();
  if (error) return null;
  return data?.transaction_hash ?? null;
}

async function officialStatus(transactionHash) {
  try {
    const result = await facilitator.getSettleStatus(transactionHash);
    const classification = classifySettlement(result);
    if (classification === "settled") return "completed";
    return classification;
  } catch {
    return "unknown";
  }
}
