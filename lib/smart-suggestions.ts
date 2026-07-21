import type { ReadinessInput } from "@/lib/readiness-score";

export type SuggestionCheck = {
  label: string;
  complete: boolean;
  completeMessage: string;
  missingMessage: string;
};

export type SmartSuggestionsResult = {
  recommendations: string[];
  checks: SuggestionCheck[];
};

const industryRules: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /\b(patient|admission|clinic|hospital|medical|healthcare|pharmacy)\b/i, value: "Healthcare" },
  { pattern: /\b(invoice|accounts payable|expense|financial|payment approval)\b/i, value: "Finance" },
  { pattern: /\b(restaurant|hotel|guest|reservation|hospitality|housekeeping)\b/i, value: "Hospitality" },
  { pattern: /\b(employee|onboarding|offboarding|hiring|recruit|payroll|leave request)\b/i, value: "Human Resources" },
  { pattern: /\b(order|refund|return|checkout|e-?commerce|online store|retail)\b/i, value: "E-commerce" },
  { pattern: /\b(software|saas|subscription|deployment|release|technical support)\b/i, value: "SaaS" },
  { pattern: /\b(bank|loan|credit|insurance|investment)\b/i, value: "Financial Services" },
  { pattern: /\b(factory|manufactur|production line|assembly|quality inspection)\b/i, value: "Manufacturing" },
  { pattern: /\b(student|school|course|teacher|education)\b/i, value: "Education" },
  { pattern: /\b(property|tenant|lease|real estate)\b/i, value: "Real Estate" },
  { pattern: /\b(shipping|delivery|freight|fleet|logistics|warehouse)\b/i, value: "Logistics" },
];

const departmentByIndustry: Record<string, string> = {
  healthcare: "Admissions",
  hospitality: "Operations",
  finance: "Accounting",
  "human resources": "HR",
  "e-commerce": "Customer Support",
  saas: "Customer Support",
  manufacturing: "Operations",
  education: "Administration",
  "real estate": "Property Operations",
  logistics: "Operations",
};

const departmentRules: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /\b(patient|admission|discharge)\b/i, value: "Admissions" },
  { pattern: /\b(invoice|expense|payment|reconcil|accounts payable)\b/i, value: "Accounting" },
  { pattern: /\b(employee|onboarding|offboarding|hiring|recruit|payroll)\b/i, value: "HR" },
  { pattern: /\b(refund|return|customer|complaint|support|ticket|escalation)\b/i, value: "Customer Support" },
  { pattern: /\b(restaurant|opening|closing|inventory|warehouse|delivery|fulfillment)\b/i, value: "Operations" },
  { pattern: /\b(lead|prospect|deal|sales|quote|pipeline)\b/i, value: "Sales" },
  { pattern: /\b(campaign|content|brand|marketing|social media)\b/i, value: "Marketing" },
  { pattern: /\b(vendor|supplier|purchase order|procurement)\b/i, value: "Procurement" },
  { pattern: /\b(access|password|device|security|system incident|IT support)\b/i, value: "Information Technology" },
  { pattern: /\b(audit|compliance|regulatory|policy review)\b/i, value: "Compliance" },
];

const checkRules: Array<Omit<SuggestionCheck, "complete"> & { pattern: RegExp }> = [
  { label: "Trigger", pattern: /\b(when|once|after|before|upon|trigger|starts?|begins?|initiated?|received?|submitted?)\b/i, completeMessage: "Trigger detected", missingMessage: "Add what starts the process" },
  { label: "Process Owner", pattern: /\b(owner|responsible|accountable|handled by|assigned to|manager|team lead|agent)\b/i, completeMessage: "Process Owner detected", missingMessage: "Add a Process Owner" },
  { label: "Success Criteria", pattern: /\b(success|criteria|complete when|done when|kpi|metric|target|verified|acceptance)\b/i, completeMessage: "Success Criteria detected", missingMessage: "Define Success Criteria" },
  { label: "Required Systems", pattern: /\b(system|software|platform|portal|tool|crm|erp|database|application)\b/i, completeMessage: "Required Systems detected", missingMessage: "Add Required Systems" },
  { label: "Required Documents", pattern: /\b(document|form|record|invoice|receipt|contract|template|checklist|attachment)\b/i, completeMessage: "Required Documents detected", missingMessage: "Add Required Documents" },
  { label: "Approval Workflow", pattern: /\b(approval|approve[ds]?|authorization|sign-?off|approval limit|reviewer)\b/i, completeMessage: "Approval Workflow detected", missingMessage: "Define Approval Workflow" },
  { label: "Compliance Requirements", pattern: /\b(compliance|regulation|regulatory|legal|policy|audit|privacy|gdpr|hipaa|pci)\b/i, completeMessage: "Compliance Requirements detected", missingMessage: "Add Compliance Requirements" },
  { label: "Expected Outcome", pattern: /\b(outcome|result|complete[ds]?|finish(?:ed)?|deliver(?:ed|able)?|resolve[ds]?|closed?|goal|ensure)\b/i, completeMessage: "Expected Outcome detected", missingMessage: "Add the Expected Outcome" },
];

export function getSmartSuggestions(input: ReadinessInput): SmartSuggestionsResult {
  const title = input.title.trim();
  const description = input.description.trim();
  const context = `${title} ${description}`.trim();
  const operationalContext = `${description} ${input.audience} ${input.department}`.trim();
  const recommendations: string[] = [];
  const detectedIndustry = industryRules.find((rule) => rule.pattern.test(title))?.value;

  if (!input.industry.trim() && detectedIndustry) recommendations.push(`Recommended industry: ${detectedIndustry}`);

  if (!input.department.trim()) {
    const industry = input.industry.trim().toLowerCase() || detectedIndustry?.toLowerCase() || "";
    const department = departmentByIndustry[industry] ?? departmentRules.find((rule) => rule.pattern.test(context))?.value;
    if (department) recommendations.push(`Recommended department: ${department}`);
  }

  return {
    recommendations,
    checks: checkRules.map((rule) => ({ label: rule.label, complete: rule.pattern.test(operationalContext), completeMessage: rule.completeMessage, missingMessage: rule.missingMessage })),
  };
}
