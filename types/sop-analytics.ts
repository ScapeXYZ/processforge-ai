export const analyticsScoreKeys = ["completeness", "clarity", "procedureStrength", "controlStrength", "complianceReadiness", "trainingReadiness", "knowledgeGrounding"] as const;
export type AnalyticsScoreKey = (typeof analyticsScoreKeys)[number];
export type FindingSeverity = "critical" | "high" | "medium" | "low" | "improvement";
export type SopRiskLevel = "critical" | "high" | "medium" | "low";

export type SopAnalyticsFinding = {
  id: string;
  severity: FindingSeverity;
  title: string;
  description: string;
  affectedSection: string;
  recommendation: string;
  suggestedEditorAction: string;
  resolved: boolean;
};

export type SopAnalyticsScores = Record<AnalyticsScoreKey, number>;

export type SopAnalytics = {
  schemaVersion: "1.0";
  fingerprint: string;
  analyzedAt: string;
  overallQuality: number;
  riskLevel: SopRiskLevel;
  scores: SopAnalyticsScores;
  findings: SopAnalyticsFinding[];
  badges: Array<"AI Enhanced" | "Knowledge Grounded" | "High Risk" | "Needs Review" | "Operationally Ready" | "Training Ready">;
};

export type AnalyticsVersionComparison = {
  scoreDelta: number;
  resolvedRisks: SopAnalyticsFinding[];
  newRisks: SopAnalyticsFinding[];
  improvedSections: string[];
  weakenedSections: string[];
};
