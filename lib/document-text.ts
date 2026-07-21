import type { GroundingReference, KnowledgeDocument } from "@/types/knowledge-base";

export const MAX_EXTRACTED_CHARACTERS = 200_000;
export const MAX_GROUNDING_CHARACTERS = 36_000;
const MAX_DOCUMENT_GROUNDING_CHARACTERS = 12_000;

export type NormalizedText = { text: string; truncated: boolean };

export function normalizeDocumentText(value: string, limit = MAX_EXTRACTED_CHARACTERS): NormalizedText {
  const normalized = value
    .replace(/\0/g, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[\t\f\v ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (normalized.length <= limit) return { text: normalized, truncated: false };
  return { text: normalized.slice(0, limit).trimEnd(), truncated: true };
}

export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function selectRelevantPassages(documents: KnowledgeDocument[], context: { title: string; industry: string; department: string; description: string; audience: string }, totalLimit = MAX_GROUNDING_CHARACTERS): { references: GroundingReference[]; truncatedNames: string[]; totalCharacters: number } {
  const keywords = extractKeywords(Object.values(context).join(" "));
  const references: GroundingReference[] = [];
  const truncatedNames: string[] = [];
  let remaining = totalLimit;

  for (const document of documents.filter((item) => item.enabled && item.status === "ready")) {
    if (remaining <= 0) { truncatedNames.push(document.name); continue; }
    const paragraphs = document.extractedText.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
    const scored = paragraphs.map((paragraph, index) => ({ paragraph, index, score: relevanceScore(paragraph, keywords, index) })).sort((a, b) => b.score - a.score || a.index - b.index);
    const selected: typeof scored = [];
    const seen = new Set<number>();
    for (const candidate of [...scored.filter((item) => item.index < 3), ...scored]) {
      if (seen.has(candidate.index)) continue;
      seen.add(candidate.index);
      selected.push(candidate);
    }
    selected.sort((a, b) => a.index - b.index);
    const perDocumentLimit = Math.min(MAX_DOCUMENT_GROUNDING_CHARACTERS, remaining);
    let referenceText = "";
    for (const item of selected) {
      const next = referenceText ? `${referenceText}\n\n${item.paragraph}` : item.paragraph;
      if (next.length > perDocumentLimit) continue;
      referenceText = next;
    }
    if (!referenceText) referenceText = document.extractedText.slice(0, perDocumentLimit);
    const truncated = referenceText.length < document.extractedText.length;
    if (truncated) truncatedNames.push(document.name);
    references.push({ id: document.id, name: document.name, referenceText, truncated });
    remaining -= referenceText.length;
  }

  return { references, truncatedNames: [...new Set(truncatedNames)], totalCharacters: totalLimit - remaining };
}

function extractKeywords(value: string): string[] {
  const stopWords = new Set(["and", "the", "for", "with", "this", "that", "from", "into", "your", "process", "should", "will", "are"]);
  return [...new Set((value.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).filter((word) => !stopWords.has(word)))];
}

function relevanceScore(paragraph: string, keywords: string[], index: number): number {
  const lower = paragraph.toLowerCase();
  const keywordMatches = keywords.reduce((score, keyword) => score + (lower.includes(keyword) ? 3 : 0), 0);
  const headingBonus = paragraph.length < 120 && !/[.!?]$/.test(paragraph) ? 2 : 0;
  return keywordMatches + headingBonus + (index < 3 ? 4 - index : 0);
}
