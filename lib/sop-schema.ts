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
}).strict();

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
}).strict();

export type SopRequest = z.infer<typeof sopRequestSchema>;
export type Sop = z.infer<typeof sopSchema>;
