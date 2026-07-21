import { NextResponse } from "next/server";
import { extractRawText } from "mammoth";
import { PasswordException, PDFParse } from "pdf-parse";
import { countWords, normalizeDocumentText } from "@/lib/document-text";
import { hasValidFileSignature, validateKnowledgeFile } from "@/lib/document-validation";
import type { KnowledgeDocumentType } from "@/types/knowledge-base";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  let formData: FormData;
  try { formData = await request.formData(); } catch { return errorResponse("Upload data could not be read.", 400); }
  const file = formData.get("file");
  if (!(file instanceof File)) return errorResponse("Choose a document to upload.", 400);

  const validation = validateKnowledgeFile(file);
  if (!validation.valid) return errorResponse(validation.error, 400);

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!hasValidFileSignature(bytes, validation.documentType)) return errorResponse("The file contents do not match its declared format.", 400);
    const rawText = await extractText(bytes, validation.documentType);
    const normalized = normalizeDocumentText(rawText);
    if (!normalized.text) {
      const message = validation.documentType === "pdf" ? "No readable text was found. Scanned PDFs require OCR, which is not supported yet." : "No readable text was found in this document.";
      return errorResponse(message, 422);
    }
    return NextResponse.json({ type: validation.documentType, extractedText: normalized.text, characterCount: normalized.text.length, wordCount: countWords(normalized.text), truncated: normalized.truncated });
  } catch (error: unknown) {
    if (error instanceof PasswordException || (error instanceof Error && /password|encrypted/i.test(error.message))) return errorResponse("Encrypted or password-protected documents are not supported.", 422);
    return errorResponse("The document is corrupted or could not be read.", 422);
  }
}

async function extractText(bytes: Uint8Array, type: KnowledgeDocumentType): Promise<string> {
  if (type === "txt") return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (type === "docx") return (await extractRawText({ buffer: Buffer.from(bytes) })).value;
  const parser = new PDFParse({ data: bytes });
  try { return (await parser.getText()).text; } finally { await parser.destroy(); }
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
