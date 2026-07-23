import "server-only";

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const XLAYER_ASSETS = {
  "eip155:196": {
    address: "0x779ded0c9e1022225f8e0630b35a9b54be713736",
    decimals: 6,
    name: "USD₮0",
    version: "1",
    mode: "mainnet",
  },
  "eip155:1952": {
    address: "0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c",
    decimals: 6,
    name: "USD₮0",
    version: "1",
    mode: "testnet",
  },
} as const;
type SupportedNetwork = keyof typeof XLAYER_ASSETS;

export type OfficialPaymentConfig = {
  requested: boolean;
  enabled: boolean;
  ready: boolean;
  errors: string[];
  provider: "okx-official";
  mode: "mainnet" | "testnet" | "invalid";
  network: SupportedNetwork | `eip155:${number}`;
  asset: string;
  assetAddress: string;
  assetDecimals: number;
  assetName: string;
  assetVersion: string;
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
  const network = (process.env.OKX_X402_NETWORK?.trim() || "eip155:196") as `eip155:${number}`;
  const expectedAsset = XLAYER_ASSETS[network as SupportedNetwork];
  const config: OfficialPaymentConfig = {
    requested,
    enabled,
    ready: false,
    errors: [],
    provider: "okx-official",
    mode: expectedAsset?.mode ?? "invalid",
    network,
    asset: process.env.OKX_X402_ASSET?.trim().toUpperCase() || "",
    assetAddress: process.env.OKX_X402_ASSET_ADDRESS?.trim() || "",
    assetDecimals: Number(process.env.OKX_X402_ASSET_DECIMALS),
    assetName: expectedAsset?.name ?? "",
    assetVersion: expectedAsset?.version ?? "",
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
    if (!expectedAsset) config.errors.push("official payments require eip155:196 or eip155:1952");
    if (config.asset !== "USDT") config.errors.push("official payments require the X Layer USD₮0 symbol USDT");
    if (!EVM_ADDRESS.test(config.assetAddress)
      || !expectedAsset
      || config.assetAddress.toLowerCase() !== expectedAsset.address) {
      config.errors.push("asset address does not match the selected X Layer network");
    }
    if (!expectedAsset || config.assetDecimals !== expectedAsset.decimals) {
      config.errors.push("asset decimals do not match the selected X Layer network");
    }
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
    const productionHost = (() => {
      try {
        return new URL(process.env.APP_BASE_URL || "http://localhost").hostname;
      } catch {
        return "";
      }
    })();
    const deployedProduction = process.env.NODE_ENV === "production"
      && (process.env.ENABLE_RELEASE_CHECK === "true"
        || process.env.VERCEL_ENV === "production"
        || process.env.RENDER === "true"
        || productionHost === "processforgeai.xyz");
    if (deployedProduction
      && config.mode === "testnet"
      && process.env.OKX_X402_ALLOW_TESTNET_IN_PRODUCTION !== "YES") {
      config.errors.push("deployed production requires explicit testnet authorization");
    }
  }

  config.ready = enabled && config.errors.length === 0;
  return config;
}
