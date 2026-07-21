import type { KnowledgeDocument, KnowledgeDocumentType } from "@/types/knowledge-base";

export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_KNOWLEDGE_DOCUMENTS = 10;

const allowedMimeTypes: Record<KnowledgeDocumentType, readonly string[]> = {
  pdf: ["application/pdf"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/octet-stream"],
  txt: ["text/plain"],
};

export type FileDescriptor = { name: string; type: string; size: number };
export type FileValidationResult = { valid: true; documentType: KnowledgeDocumentType } | { valid: false; error: string };

export function validateKnowledgeFile(file: FileDescriptor): FileValidationResult {
  if (!file.name.trim()) return { valid: false, error: "The file must have a valid name." };
  if (file.size === 0) return { valid: false, error: "Empty files cannot be uploaded." };
  if (file.size > MAX_FILE_SIZE) return { valid: false, error: "Files must be 10 MB or smaller." };
  const extension = getFileExtension(file.name);
  if (!extension || !(["pdf", "docx", "txt"] as string[]).includes(extension)) return { valid: false, error: "Only PDF, DOCX and TXT files are supported." };
  const documentType = extension as KnowledgeDocumentType;
  if (!file.type || !allowedMimeTypes[documentType].includes(file.type.toLowerCase())) return { valid: false, error: `The file MIME type does not match a valid ${documentType.toUpperCase()} document.` };
  return { valid: true, documentType };
}

export function isDuplicateKnowledgeFile(file: FileDescriptor, documents: KnowledgeDocument[]): boolean {
  const normalizedName = file.name.trim().toLowerCase();
  return documents.some((document) => document.name.trim().toLowerCase() === normalizedName && document.size === file.size);
}

export function hasValidFileSignature(bytes: Uint8Array, type: KnowledgeDocumentType): boolean {
  if (type === "pdf") return bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  if (type === "docx") return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  return !bytes.slice(0, Math.min(bytes.length, 8_192)).some((byte) => byte === 0);
}

function getFileExtension(name: string): string | null {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? null;
}
