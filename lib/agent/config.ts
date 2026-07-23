export const AGENT_SERVICE = "processforge.generate-sop";
export const AGENT_VERSION = "1.1.0";
export const AGENT_SCHEMA_VERSION = "1.0";
export const PRODUCTION_ORIGIN = "https://processforgeai.xyz";

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const OFFICIAL_XLAYER_ASSETS: Record<string, Record<string, { address: string; decimals: number; name?: string; version?: string }>> = {
  "eip155:196": {
    USDT: { address: "0x779ded0c9e1022225f8e0630b35a9b54be713736", decimals: 6, name: "USD₮0", version: "1" },
    USDG: { address: "0x4ae46a509f6b1d9056937ba4500cb143933d2dc8", decimals: 6 },
  },
};

export type X402Config = {
  enabled: boolean; serviceEnabled: boolean; mock: boolean; ready: boolean; errors: string[]; provider: "development-mock" | "okx-official"; network: `eip155:${number}`;
  payTo: string; asset: string; assetAddress: string; assetDecimals: number; assetName: string; assetVersion: string; price: string; facilitatorUrl: string;
  apiKey: string; secretKey: string; passphrase: string; timeoutSeconds: number;
};

export function isProductionRelease(): boolean { return process.env.NODE_ENV === "production" && (process.env.ENABLE_RELEASE_CHECK === "true" || process.env.VERCEL_ENV === "production"); }
export function isEvmAddress(value: string): boolean { return EVM_ADDRESS.test(value); }

export function getX402Config(): X402Config {
  const production = isProductionRelease();
  const network = (process.env.OKX_X402_NETWORK || (production ? "eip155:196" : "eip155:1952")) as `eip155:${number}`;
  const enabled = process.env.OKX_X402_ENABLED === "true";
  const serviceEnabled = process.env.AGENT_PAID_GENERATION_ENABLED === "true" || (!production && process.env.AGENT_PAID_GENERATION_ENABLED !== "false");
  const mock = !production && process.env.OKX_X402_MOCK !== "false";
  const asset = (process.env.OKX_X402_ASSET?.trim() || (mock ? "MOCK_USDT" : "")).toUpperCase();
  const assetAddress = process.env.OKX_X402_ASSET_ADDRESS?.trim() || (mock ? "0x0000000000000000000000000000000000000002" : "");
  const assetDecimals = Number(process.env.OKX_X402_ASSET_DECIMALS ?? (mock ? "6" : "NaN"));
  const officialAsset = OFFICIAL_XLAYER_ASSETS[network]?.[asset];
  const config: X402Config = {
    enabled, serviceEnabled, mock, ready: false, errors: [], provider: mock ? "development-mock" : "okx-official", network,
    payTo: process.env.OKX_X402_PAY_TO_ADDRESS?.trim() || (mock ? "0x0000000000000000000000000000000000000001" : ""),
    asset, assetAddress, assetDecimals, assetName: officialAsset?.name || (mock ? "Mock USD₮0" : ""), assetVersion: officialAsset?.version || (mock ? "1" : ""),
    price: process.env.OKX_X402_PRICE?.trim() || (mock ? "10000" : ""),
    facilitatorUrl: process.env.OKX_X402_FACILITATOR_URL?.trim() || "https://web3.okx.com",
    apiKey: process.env.OKX_X402_API_KEY?.trim() ?? "", secretKey: process.env.OKX_X402_SECRET_KEY?.trim() ?? "", passphrase: process.env.OKX_X402_PASSPHRASE?.trim() ?? "",
    timeoutSeconds: Math.min(300, Math.max(30, Number(process.env.OKX_X402_TIMEOUT_SECONDS) || 120)),
  };
  if (!config.serviceEnabled) config.errors.push("service disabled");
  if (production && !enabled) config.errors.push("official payments disabled");
  if (production && mock) config.errors.push("mock forbidden in production");
  if (production && network !== "eip155:196") config.errors.push("production network must be eip155:196");
  if (!isEvmAddress(config.payTo)) config.errors.push("invalid recipient address");
  if (!isEvmAddress(config.assetAddress)) config.errors.push("invalid asset address");
  if (!/^\d+$/.test(config.price) || BigInt(config.price || "0") <= BigInt(0)) config.errors.push("price must be a positive atomic-unit integer");
  if (!Number.isInteger(assetDecimals) || assetDecimals < 0 || assetDecimals > 255) config.errors.push("invalid asset decimals");
  if (production) {
    if (!officialAsset || officialAsset.address.toLowerCase() !== assetAddress.toLowerCase() || officialAsset.decimals !== assetDecimals || !officialAsset.name || !officialAsset.version) config.errors.push("asset is not an approved X Layer network asset");
    if (!config.apiKey || !config.secretKey || !config.passphrase) config.errors.push("missing OKX facilitator credentials");
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) config.errors.push("missing durable payment storage");
  }
  config.ready = config.errors.length === 0 && (mock || enabled);
  return config;
}

export function assertSafeProductionConfig(config: X402Config): void {
  if (!config.ready || (isProductionRelease() && (config.mock || config.provider !== "okx-official" || config.network !== "eip155:196"))) throw new Error("Production x402 configuration is incomplete or unsafe.");
}
