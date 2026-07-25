export type SettlementClassification =
  | "settled"
  | "pending"
  | "failed"
  | "unknown";

export function classifySettlement(result: {
  success?: boolean;
  status?: string;
}): SettlementClassification {
  if (result.success === true) {
    return "settled";
  }

  if (result.success === false) {
    if (result.status === "pending") {
      return "pending";
    }

    return "failed";
  }

  return "unknown";
}
