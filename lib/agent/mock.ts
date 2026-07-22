import { analyzeSop } from "@/lib/analytics/sop-analytics";
import { analyzeCompliance } from "@/lib/compliance/compliance-engine";
import { calculateReadinessScore } from "@/lib/readiness-score";
import type { AgentSopRequest } from "@/lib/agent/contract";
import type { Sop } from "@/lib/sop-schema";

export function generateMockAgentSop(input: AgentSopRequest) {
  const readiness = calculateReadinessScore({ title: input.title, industry: input.industry, department: input.department, description: input.description, audience: input.audience, detailLevel: "detailed" });
  const owner = input.department || "Process owner";
  const sop: Sop = {
    title: input.title, documentId: `PF-MOCK-${simpleHash(input.title).slice(0, 8).toUpperCase()}`, version: "1.0", documentReadinessScore: Math.max(82, readiness.score), inputReadinessScore: readiness.score, estimatedCompletionTime: "Varies by operational volume",
    purpose: `Define a controlled, measurable method for ${input.title.toLowerCase()} while preserving appropriate evidence and accountability.`,
    scope: `Applies to ${input.audience} in ${owner} from the documented trigger through completion, review, and exception escalation.`,
    roles: [{ role: `${owner} Process Owner`, responsibility: "Own this process, approve controlled exceptions, review performance, and maintain the SOP." }, { role: "Process Operator", responsibility: "Complete each procedure step and retain the required evidence." }, { role: "Approver", responsibility: "Review defined approval cases and record the decision." }],
    prerequisites: ["Confirm authorized access to required systems and records.", "Confirm current forms, approval limits, and escalation contacts before starting."],
    procedureSteps: [
      { stepNumber: 1, title: "Confirm trigger", instruction: `Confirm that the process has started according to this brief: ${input.description}`, owner: "Process Operator", evidence: "Timestamped intake or request record" },
      { stepNumber: 2, title: "Validate inputs", instruction: "Verify required information is complete, current, and within the operator's authority before proceeding.", owner: "Process Operator", evidence: "Completed validation checklist" },
      { stepNumber: 3, title: "Perform controlled work", instruction: "Complete the required operational actions in sequence and record decisions, exceptions, and system references.", owner: "Process Operator", evidence: "System transaction history or completed work record" },
      { stepNumber: 4, title: "Obtain approval", instruction: "Route cases requiring approval to the authorized approver and do not continue until the decision is recorded.", owner: "Approver", evidence: "Dated approval or rejection record" },
      { stepNumber: 5, title: "Verify completion", instruction: "Confirm the expected outcome, reconcile the evidence, notify relevant stakeholders, and close the process record.", owner: `${owner} Process Owner`, evidence: "Completion checklist and closure timestamp" },
    ],
    escalationRules: ["Escalate incomplete, unauthorized, overdue, or failed cases to the Process Owner within one business day.", "Pause processing and escalate any policy, compliance, data-security, or approval ambiguity before continuing."],
    qualityChecklist: ["Trigger and required inputs were validated.", "Every action has an accountable owner and retained evidence.", "Required approvals and exceptions were recorded.", "The final outcome was verified before closure."],
    trainingQuiz: [{ question: "What must happen before a case requiring approval continues?", options: ["Record authorization from the approver", "Continue and request approval later", "Delete the case"], correctAnswer: "Record authorization from the approver" }, { question: "What should an operator do when required information is incomplete?", options: ["Escalate or obtain the missing information", "Invent the missing information", "Close the record as complete"], correctAnswer: "Escalate or obtain the missing information" }],
    agentReadyJson: { schemaVersion: "1.0", processName: input.title, objective: `Complete ${input.title} consistently with documented evidence.`, trigger: "An authorized request or defined operational event is received.", completionCriteria: ["Required actions are complete", "Approvals and evidence are recorded", "The outcome is verified"], requiredInputs: ["Authorized request", "Complete process information", "Required systems and documents"], steps: [1,2,3,4,5].map((order) => ({ order, action: ["Confirm trigger", "Validate inputs", "Perform controlled work", "Obtain required approval", "Verify and close"][order - 1], owner: order === 4 ? "Approver" : "Process Operator", evidence: "Timestamped process evidence" })), escalationConditions: ["Missing information", "Approval or authority ambiguity", "Control failure or overdue processing"] },
    knowledgeSources: { documentIds: [], documentNames: [], sourceNotes: { documentsUsed: [], importantAssumptions: ["Mock verification output uses generic operational roles and requires validation before production use."], missingInformation: ["Confirm company-specific systems, policies, approval limits, KPIs, and retention periods."], generalBestPracticesAdded: true } },
  };
  return { sop, analytics: analyzeSop(sop), compliance: analyzeCompliance(sop), assumptions: sop.knowledgeSources.sourceNotes.importantAssumptions, warnings: ["Development mock output: no OpenAI request or blockchain settlement occurred.", ...sop.knowledgeSources.sourceNotes.missingInformation] };
}

function simpleHash(value: string): string { let hash = 2166136261; for (let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619);} return (hash>>>0).toString(16).padStart(8,"0"); }
