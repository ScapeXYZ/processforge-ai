import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { analyzeSop } from "@/lib/analytics/sop-analytics";
import { analyzeCompliance } from "@/lib/compliance/compliance-engine";
import { calculateReadinessScore } from "@/lib/readiness-score";
import { buildSopPrompt, SOP_SYSTEM_PROMPT } from "@/lib/sop-prompt";
import { sopSchema, type SopRequest } from "@/lib/sop-schema";
import type { AgentSopRequest } from "@/lib/agent/contract";

export async function generateAgentSop(input: AgentSopRequest) {
  const context = [input.description, input.company_context && `Company context: ${input.company_context}`, input.requirements.length && `Requirements: ${input.requirements.join("; ")}`, input.compliance_frameworks.length && `Compliance frameworks to consider without inventing obligations: ${input.compliance_frameworks.join(", ")}`].filter(Boolean).join("\n\n");
  const readiness = calculateReadinessScore({ title: input.title, industry: input.industry, department: input.department, description: context, audience: input.audience, detailLevel: "detailed" });
  const source = input.knowledge_context ? [{ id: "agent-reference", name: "Caller-provided knowledge context", referenceText: input.knowledge_context, truncated: false }] : [];
  const request: SopRequest = { processTitle: input.title, industry: input.industry, department: input.department, processDescription: context, targetAudience: input.audience, detailLevel: "detailed", inputReadinessScore: readiness.score, knowledgeSources: source };
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_NOT_CONFIGURED");
  const response = await new OpenAI({ apiKey, timeout: 35_000, maxRetries: 0 }).responses.parse({ model: "gpt-5-mini", store: false, reasoning: { effort: "low" }, instructions: SOP_SYSTEM_PROMPT, input: buildSopPrompt(request), text: { format: zodTextFormat(sopSchema, "processforge_agent_sop") } });
  if (!response.output_parsed) throw new Error("INVALID_PROVIDER_OUTPUT");
  const sop = { ...response.output_parsed, inputReadinessScore: readiness.score, knowledgeSources: { ...response.output_parsed.knowledgeSources, documentIds: source.map(x => x.id), documentNames: source.map(x => x.name), sourceNotes: { ...response.output_parsed.knowledgeSources.sourceNotes, documentsUsed: source.map(x => x.name) } } };
  return { sop, analytics: analyzeSop(sop), compliance: analyzeCompliance(sop), assumptions: sop.knowledgeSources.sourceNotes.importantAssumptions, warnings: [...sop.knowledgeSources.sourceNotes.missingInformation, ...(sop.knowledgeSources.sourceNotes.generalBestPracticesAdded ? ["General operational best practices were added where supplied context was incomplete."] : [])] };
}
