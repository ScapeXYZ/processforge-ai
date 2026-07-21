export type ReadinessInput = {
  title: string;
  industry: string;
  department: string;
  description: string;
  audience: string;
  detailLevel: string;
};

export type ReadinessStatus = "Needs more detail" | "Basic" | "Ready" | "Strong" | "Excellent";

export type ReadinessResult = {
  score: number;
  status: ReadinessStatus;
  suggestions: string[];
};

const triggerPattern = /\b(when|once|after|before|upon|trigger|starts?|begins?|initiated?|received?|request(?:ed)?|submitted?)\b/i;
const outcomePattern = /\b(outcome|result|complete[ds]?|completion|finish(?:ed)?|end(?:s|ed)?|deliver(?:ed|able)?|resolve[ds]?|closed?|successful(?:ly)?|goal|ensure)\b/i;
const controlPattern = /\b(constraint|approval|approve[ds]?|limit|deadline|timing|within|hour|day|week|escalat(?:e|ed|ion)|exception|must|policy|risk|sla)\b/i;

export function calculateReadinessScore(input: ReadinessInput): ReadinessResult {
  const description = input.description.trim();
  const hasTrigger = triggerPattern.test(description);
  const hasOutcome = outcomePattern.test(description);
  const hasControl = controlPattern.test(description);
  let score = 0;

  if (input.title.trim()) score += 10;
  if (input.industry.trim()) score += 10;
  if (input.department.trim()) score += 10;
  if (input.audience.trim()) score += 10;
  if (description) score += 15;
  if (description.length >= 200) score += 20;
  else if (description.length >= 100) score += 15;
  else if (description.length >= 40) score += 8;
  if (hasTrigger) score += 5;
  if (hasOutcome) score += 5;
  if (hasControl) score += 5;
  if (input.detailLevel.trim()) score += 5;

  const suggestions: string[] = [];
  if (!input.title.trim()) suggestions.push("Add a clear process title");
  if (!input.industry.trim()) suggestions.push("Add the industry context");
  if (!input.department.trim()) suggestions.push("Add the department responsible for the process");
  if (!input.audience.trim()) suggestions.push("Identify the people who will use this SOP");
  if (!description || description.length < 100) suggestions.push("Add more operational detail");
  if (!hasTrigger) suggestions.push("Describe what starts the process");
  if (!hasOutcome) suggestions.push("Add the expected final outcome");
  if (!hasControl) suggestions.push("Mention approval limits, timing, constraints or escalation rules");

  return { score: Math.min(100, score), status: readinessStatus(score), suggestions: suggestions.slice(0, 3) };
}

export function readinessStatus(score: number): ReadinessStatus {
  if (score >= 95) return "Excellent";
  if (score >= 85) return "Strong";
  if (score >= 70) return "Ready";
  if (score >= 50) return "Basic";
  return "Needs more detail";
}
