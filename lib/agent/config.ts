export const AGENT_SERVICE = "processforge.generate-sop";
export const AGENT_VERSION = "1.0.0";
export const AGENT_SCHEMA_VERSION = "1.0";

export type X402Config = {
  enabled: boolean; serviceEnabled: boolean; mock: boolean; ready: boolean; provider: "mock" | "okx"; network: `eip155:${number}`;
  payTo: string; asset: string; price: string; facilitatorUrl: string;
  apiKey: string; secretKey: string; passphrase: string; timeoutSeconds: number;
};

export function getX402Config(): X402Config {
  const production = process.env.NODE_ENV === "production" && process.env.ENABLE_RELEASE_CHECK === "true";
  const network = (process.env.OKX_X402_NETWORK || (production ? "eip155:196" : "eip155:1952")) as `eip155:${number}`;
  const enabled = process.env.OKX_X402_ENABLED === "true";
  const hasSellerCredentials = Boolean(process.env.OKX_X402_API_KEY?.trim() && process.env.OKX_X402_SECRET_KEY?.trim() && process.env.OKX_X402_PASSPHRASE?.trim());
  const mock = !production && (!enabled || !hasSellerCredentials || process.env.OKX_X402_MOCK === "true");
  const config = {
    enabled, serviceEnabled: process.env.AGENT_PAID_GENERATION_ENABLED !== "false", mock, provider: mock ? "mock" as const : "okx" as const, network,
    payTo: process.env.OKX_X402_PAY_TO_ADDRESS?.trim() || (mock ? "0x0000000000000000000000000000000000000001" : ""),
    asset: process.env.OKX_X402_ASSET?.trim() || (mock ? "0x0000000000000000000000000000000000000002" : ""),
    price: process.env.OKX_X402_PRICE?.trim() || (mock ? "10000" : ""),
    facilitatorUrl: process.env.OKX_X402_FACILITATOR_URL?.trim() || "https://web3.okx.com",
    apiKey: process.env.OKX_X402_API_KEY?.trim() ?? "",
    secretKey: process.env.OKX_X402_SECRET_KEY?.trim() ?? "",
    passphrase: process.env.OKX_X402_PASSPHRASE?.trim() ?? "",
    timeoutSeconds: Math.min(300, Math.max(30, Number(process.env.OKX_X402_TIMEOUT_SECONDS) || 120)),
    ready: false,
  };
  config.ready = mock || (enabled && Boolean(config.payTo && config.asset && /^\d+$/.test(config.price)) && hasSellerCredentials);
  return config;
}

export function assertSafeProductionConfig(config: X402Config): void {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_RELEASE_CHECK === "true" && (config.mock || !config.enabled || !config.ready || config.network !== "eip155:196")) {
    throw new Error("Production x402 configuration is incomplete or unsafe.");
  }
}
