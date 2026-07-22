export type ComplianceSeverity="critical"|"high"|"medium"|"low"|"improvement";
export type ComplianceRiskRating="critical"|"high"|"medium"|"low";
export type AuditStatus="not_ready"|"needs_review"|"ready";
export type ComplianceFinding={id:string;severity:ComplianceSeverity;title:string;description:string;recommendation:string;affectedSection:string;aiFixAction:string;resolved:boolean};
export type SopCompliance={schemaVersion:"1.0";fingerprint:string;analyzedAt:string;complianceScore:number;auditReadiness:number;documentationQuality:number;governanceScore:number;riskRating:ComplianceRiskRating;auditStatus:AuditStatus;findings:ComplianceFinding[];nextReviewAt:string|null;lastReviewedAt:string|null;reviewIntervalDays:30|90|180|365|null};
export type ComplianceContext={versionCount?:number;nextReviewAt?:string|null;lastReviewedAt?:string|null;reviewIntervalDays?:30|90|180|365|null};
