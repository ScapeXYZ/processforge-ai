import "server-only";

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const XLAYER_NETWORK = "eip155:196";
const XLAYER_USDT0 = "0x779ded0c9e1022225f8e0630b35a9b54be713736";

export type OfficialPaymentConfig = {
  requested: boolean;
  enabled: boolean;
  ready: boolean;
  errors: string[];
  provider: "okx-official";
  network: `eip155:${number}`;
  asset: string;
  assetAddress: string;
  assetDecimals: number;
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
  facilitatorUrl: string;
  apiKey: string;
  secretKey: string;
  passphrase: string;
};

export function getOfficialPaymentConfig(): OfficialPaymentConfig {
  const requested = process.env.AGENT_PAID_GENERATION_ENABLED === "true"
    || process.env.OKX_X402_ENABLED === "true";
  const enabled = process.env.AGENT_PAID_GENERATION_ENABLED === "true"
    && process.env.OKX_X402_ENABLED === "true"
    && process.env.OKX_X402_MOCK === "false";
  const config: OfficialPaymentConfig = {
    requested,
    enabled,
    ready: false,
    errors: [],
    provider: "okx-official",
    network: (process.env.OKX_X402_NETWORK?.trim() || XLAYER_NETWORK) as `eip155:${number}`,
    asset: process.env.OKX_X402_ASSET?.trim().toUpperCase() || "",
    assetAddress: process.env.OKX_X402_ASSET_ADDRESS?.trim() || "",
    assetDecimals: Number(process.env.OKX_X402_ASSET_DECIMALS),
    amount: process.env.OKX_X402_PRICE?.trim() || "",
    payTo: process.env.OKX_X402_PAY_TO_ADDRESS?.trim() || "",
    maxTimeoutSeconds: Number(process.env.OKX_X402_TIMEOUT_SECONDS || 120),
    facilitatorUrl: process.env.OKX_X402_FACILITATOR_URL?.trim() || "https://web3.okx.com",
    apiKey: process.env.OKX_X402_API_KEY?.trim() || "",
    secretKey: process.env.OKX_X402_SECRET_KEY?.trim() || "",
    passphrase: process.env.OKX_X402_PASSPHRASE?.trim() || "",
  };

  if (requested && !enabled) config.errors.push("payment flags must enable official payments together and keep mock disabled");
  if (enabled) {
    if (config.network !== XLAYER_NETWORK) config.errors.push("official payments require eip155:196");
    if (config.asset !== "USDT") config.errors.push("official payments require the configured X Layer USDT symbol");
    if (!EVM_ADDRESS.test(config.assetAddress)
      || config.assetAddress.toLowerCase() !== XLAYER_USDT0) {
      config.errors.push("official payments require the approved X Layer USDT0 contract");
    }
    if (config.assetDecimals !== 6) config.errors.push("X Layer USDT0 requires 6 decimals");
    if (!/^\d+$/.test(config.amount) || BigInt(config.amount || "0") <= BigInt(0)) {
      config.errors.push("price must be a positive atomic-unit integer");
    }
    if (!EVM_ADDRESS.test(config.payTo)) config.errors.push("recipient must be an EVM address");
    if (!Number.isInteger(config.maxTimeoutSeconds)
      || config.maxTimeoutSeconds < 30
      || config.maxTimeoutSeconds > 300) {
      config.errors.push("payment timeout must be an integer from 30 to 300 seconds");
    }
    try {
      const url = new URL(config.facilitatorUrl);
      if (url.origin !== "https://web3.okx.com" || url.pathname !== "/") {
        config.errors.push("facilitator must be https://web3.okx.com");
      }
    } catch {
      config.errors.push("facilitator URL is invalid");
    }
    if (!config.apiKey || !config.secretKey || !config.passphrase) {
      config.errors.push("official facilitator credentials are missing");
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      config.errors.push("durable payment storage is missing");
    }
  }

  config.ready = enabled && config.errors.length === 0;
  return config;
}
