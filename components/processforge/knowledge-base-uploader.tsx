"use client";

import { useRef, useState } from "react";
import { FileUp, LoaderCircle, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isDuplicateKnowledgeFile, MAX_KNOWLEDGE_DOCUMENTS, validateKnowledgeFile } from "@/lib/document-validation";
import { getKnowledgeDocuments, saveKnowledgeDocument } from "@/lib/knowledge-base-manager";
import type { KnowledgeDocument, KnowledgeDocumentType } from "@/types/knowledge-base";

type UploadItem = { name: string; progress: number; status: "uploading" | "processing" | "success" | "error"; message?: string };
type ProcessResponse = { type: KnowledgeDocumentType; extractedText: string; characterCount: number; wordCount: number; truncated: boolean };

export function KnowledgeBaseUploader({ onDocumentsChange }: { onDocumentsChange: (documents: KnowledgeDocument[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);

  const handleFiles = async (files: File[]) => {
    let documents = getKnowledgeDocuments();
    for (const file of files) {
      if (documents.length >= MAX_KNOWLEDGE_DOCUMENTS) { addUpload({ name: file.name, progress: 0, status: "error", message: "The local knowledge base is limited to 10 documents." }); continue; }
      const validation = validateKnowledgeFile(file);
      if (!validation.valid) { addUpload({ name: file.name, progress: 0, status: "error", message: validation.error }); continue; }
      if (isDuplicateKnowledgeFile(file, documents)) { addUpload({ name: file.name, progress: 0, status: "error", message: "This document is already in the knowledge base." }); continue; }
      addUpload({ name: file.name, progress: 0, status: "uploading" });
      try {
        const result = await processFile(file, (progress, status) => updateUpload(file.name, { progress, status }));
        const document: KnowledgeDocument = { id: createId(), name: file.name, type: result.type, size: file.size, uploadedAt: new Date().toISOString(), status: "ready", characterCount: result.characterCount, wordCount: result.wordCount, extractedText: result.extractedText, errorMessage: result.truncated ? "Extracted text was capped at the local document limit." : null, enabled: true };
        const saved = saveKnowledgeDocument(document);
        if (!saved.success) throw new Error(saved.error);
        documents = saved.documents;
        updateUpload(file.name, { progress: 100, status: "success", message: result.truncated ? "Ready — extracted text was capped." : "Document ready." });
        onDocumentsChange(documents);
      } catch (error) {
        updateUpload(file.name, { progress: 100, status: "error", message: error instanceof Error ? error.message : "Document processing failed." });
      }
    }
  };

  const addUpload = (upload: UploadItem) => setUploads((current) => [upload, ...current.filter((item) => item.name !== upload.name)].slice(0, 5));
  const updateUpload = (name: string, update: Partial<UploadItem>) => setUploads((current) => current.map((item) => item.name === name ? { ...item, ...update } : item));

  return <section>
    <div onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (event.currentTarget === event.target) setIsDragging(false); }} onDrop={(event) => { event.preventDefault(); setIsDragging(false); void handleFiles(Array.from(event.dataTransfer.files)); }} className={`rounded-xl border border-dashed p-8 text-center transition-colors ${isDragging ? "border-emerald-400 bg-emerald-500/10" : "border-border bg-card/30 hover:border-emerald-500/40"}`}>
      <input ref={inputRef} type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" multiple className="sr-only" onChange={(event) => { void handleFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} aria-label="Choose knowledge documents" />
      <span className="mx-auto flex size-12 items-center justify-center rounded-xl border border-border bg-background text-emerald-400"><UploadCloud className="size-5" /></span><h2 className="mt-4 text-sm font-medium">Drop company documents here</h2><p className="mx-auto mt-2 max-w-md text-xs leading-5 text-muted-foreground">Upload policy, process and reference documents for grounded SOP generation.</p><Button type="button" variant="outline" className="mt-4" onClick={() => inputRef.current?.click()}><FileUp /> Choose files</Button><p className="mt-3 text-[10px] text-muted-foreground">PDF, DOCX or TXT · Maximum 10 MB per file · Up to 10 documents</p>
    </div>
    {uploads.length > 0 && <div className="mt-4 space-y-2" aria-live="polite">{uploads.map((upload) => <div key={upload.name} className={`rounded-lg border px-3 py-2.5 ${upload.status === "error" ? "border-amber-500/20 bg-amber-500/5" : "border-border bg-card/40"}`}><div className="flex items-center justify-between gap-3 text-[11px]"><span className="flex min-w-0 items-center gap-2 truncate text-foreground">{upload.status === "uploading" || upload.status === "processing" ? <LoaderCircle className="size-3 animate-spin text-emerald-400" /> : null}{upload.name}</span><span className={upload.status === "error" ? "text-amber-300" : upload.status === "success" ? "text-emerald-400" : "text-muted-foreground"}>{upload.message ?? (upload.status === "processing" ? "Processing document…" : `${upload.progress}% uploaded`)}</span></div>{upload.status === "uploading" && <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${upload.progress}%` }} /></div>}</div>)}</div>}
  </section>;
}

function processFile(file: File, onProgress: (progress: number, status: "uploading" | "processing") => void): Promise<ProcessResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/knowledge-base/process");
    xhr.responseType = "json";
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100), "uploading"); };
    xhr.upload.onload = () => onProgress(100, "processing");
    xhr.onerror = () => reject(new Error("The upload failed. Check your connection and retry."));
    xhr.onload = () => { const response: unknown = xhr.response; if (xhr.status >= 200 && xhr.status < 300) resolve(response as ProcessResponse); else reject(new Error(typeof response === "object" && response !== null && "error" in response && typeof response.error === "string" ? response.error : "Document processing failed.")); };
    const formData = new FormData(); formData.append("file", file); xhr.send(formData);
  });
}

function createId(): string { return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
