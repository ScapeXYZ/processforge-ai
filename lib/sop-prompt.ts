import type { SopRequest } from "@/lib/sop-schema";

export const SOP_SYSTEM_PROMPT = `You are a senior operations consultant. Produce a mature, practical, business-ready standard operating procedure.

Rules:
- Use direct operational language.
- Make every procedure step measurable, assign exactly one owner, and state the evidence that proves completion.
- Do not invent laws, regulations, certifications, company policies, approval thresholds, service levels, software, or facts not provided by the user.
- When necessary information is unavailable, clearly label it as an assumption using the prefix "Assumption:".
- Keep document identifiers generic and non-sensitive.
- Ensure every training quiz correctAnswer exactly matches one of that question's options.
- Keep agentReadyJson consistent with the human-readable SOP.
- Return only data matching the supplied schema.`;

export function buildSopPrompt(input: SopRequest): string {
  return `Create an SOP from this operational brief:

Process title: ${input.processTitle}
Industry: ${input.industry}
Department: ${input.department}
Process description: ${input.processDescription}
Target audience: ${input.targetAudience}
Detail level: ${input.detailLevel}
Input readiness score: ${input.inputReadinessScore}/100

Calibrate the amount of detail to the requested detail level. Set inputReadinessScore to the supplied score. Score documentReadinessScore independently based on how complete and operationally usable the generated SOP is. State any necessary assumptions explicitly inside the relevant string fields.`;
}
