export type KnowledgeDocumentType = "pdf" | "docx" | "txt";
export type KnowledgeDocumentStatus = "processing" | "ready" | "error";

export type KnowledgeDocument = {
  id: string;
  name: string;
  type: KnowledgeDocumentType;
  size: number;
  uploadedAt: string;
  status: KnowledgeDocumentStatus;
  characterCount: number;
  wordCount: number;
  extractedText: string;
  errorMessage: string | null;
  enabled: boolean;
};

export type GroundingReference = {
  id: string;
  name: string;
  referenceText: string;
  truncated: boolean;
};
