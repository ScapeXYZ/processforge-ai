import { z } from "zod";

const nonEmptyText = z.string().trim().min(1);

export const sopRequestSchema = z.object({
  processTitle: nonEmptyText,
  industry: nonEmptyText,
  department: nonEmptyText,
  processDescription: nonEmptyText,
  targetAudience: nonEmptyText,
  detailLevel: z.enum(["concise", "standard", "detailed"]),
  inputReadinessScore: z.number().int().min(0).max(100),
  knowledgeSources: z.array(z.object({ id: nonEmptyText, name: nonEmptyText, referenceText: z.string().max(12_000), truncated: z.boolean() }).strict()).max(10),
}).strict().refine((request) => request.knowledgeSources.reduce((total, source) => total + source.referenceText.length, 0) <= 40_000, { message: "Knowledge reference content exceeds the safe prompt limit.", path: ["knowledgeSources"] });

export const sopSchema = z.object({
  title: nonEmptyText,
  documentId: nonEmptyText,
  version: nonEmptyText,
  documentReadinessScore: z.number().int().min(0).max(100),
  inputReadinessScore: z.number().int().min(0).max(100),
  estimatedCompletionTime: nonEmptyText,
  purpose: nonEmptyText,
  scope: nonEmptyText,
  roles: z.array(z.object({
    role: nonEmptyText,
    responsibility: nonEmptyText,
  }).strict()).min(1),
  prerequisites: z.array(nonEmptyText),
  procedureSteps: z.array(z.object({
    stepNumber: z.number().int().positive(),
    title: nonEmptyText,
    instruction: nonEmptyText,
    owner: nonEmptyText,
    evidence: nonEmptyText,
  }).strict()).min(1),
  escalationRules: z.array(nonEmptyText),
  qualityChecklist: z.array(nonEmptyText),
  trainingQuiz: z.array(z.object({
    question: nonEmptyText,
    options: z.array(nonEmptyText).min(2),
    correctAnswer: nonEmptyText,
  }).strict()),
  agentReadyJson: z.object({
    schemaVersion: nonEmptyText,
    processName: nonEmptyText,
    objective: nonEmptyText,
    trigger: nonEmptyText,
    completionCriteria: z.array(nonEmptyText),
    requiredInputs: z.array(nonEmptyText),
    steps: z.array(z.object({
      order: z.number().int().positive(),
      action: nonEmptyText,
      owner: nonEmptyText,
      evidence: nonEmptyText,
    }).strict()),
    escalationConditions: z.array(nonEmptyText),
  }).strict(),
  knowledgeSources: z.object({
    documentIds: z.array(nonEmptyText),
    documentNames: z.array(nonEmptyText),
    sourceNotes: z.object({
      documentsUsed: z.array(nonEmptyText),
      importantAssumptions: z.array(nonEmptyText),
      missingInformation: z.array(nonEmptyText),
      generalBestPracticesAdded: z.boolean(),
    }).strict(),
  }).strict(),
}).strict();

export type SopRequest = z.infer<typeof sopRequestSchema>;
export type Sop = z.infer<typeof sopSchema>;

export const emptyKnowledgeSources: Sop["knowledgeSources"] = { documentIds: [], documentNames: [], sourceNotes: { documentsUsed: [], importantAssumptions: [], missingInformation: [], generalBestPracticesAdded: true } };

export function migrateSopSnapshot(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value) || "knowledgeSources" in value) return value;
  return { ...value, knowledgeSources: emptyKnowledgeSources };
}
