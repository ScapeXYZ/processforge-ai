import "server-only";
import { getOfficialPaymentConfig } from "@/lib/agent/official-payment-config";

export type AgentPaymentStatus = {
  enabled: boolean;
  status: "ready" | "testnet-ready" | "missing" | "disabled";
  provider: "okx-official" | null;
  network: string | null;
  asset: string | null;
  assetAddress: string | null;
  assetDecimals: number | null;
  amount: string | null;
  payTo: string | null;
  facilitatorAuthentication: "configured" | "missing" | "disabled";
};

export function getAgentPaymentStatus(): AgentPaymentStatus {
  const config = getOfficialPaymentConfig();
  return {
    enabled: config.ready,
    status: config.ready
      ? config.mode === "testnet" ? "testnet-ready" : "ready"
      : config.requested ? "missing" : "disabled",
    provider: config.requested ? config.provider : null,
    network: config.network || null,
    asset: config.asset || null,
    assetAddress: config.assetAddress || null,
    assetDecimals: Number.isInteger(config.assetDecimals) ? config.assetDecimals : null,
    amount: config.amount || null,
    payTo: config.payTo || null,
    facilitatorAuthentication: config.ready
      ? "configured"
      : config.requested ? "missing" : "disabled",
  };
}
