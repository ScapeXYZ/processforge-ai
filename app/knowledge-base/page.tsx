"use client";
import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { KnowledgeBaseUploader } from "@/components/processforge/knowledge-base-uploader";
import { KnowledgeDocumentCard } from "@/components/processforge/knowledge-document-card";
import { WorkflowLogo } from "@/components/processforge/workflow-logo";
import { WorkspaceHeader } from "@/components/processforge/workspace-header";
import { deleteKnowledgeDocument, getKnowledgeDocuments, updateKnowledgeDocument } from "@/lib/knowledge-base-manager";
import { deleteKnowledgeMetadata, syncKnowledgeMetadata } from "@/lib/cloud/knowledge-service";
import type { KnowledgeDocument } from "@/types/knowledge-base";

export default function KnowledgeBasePage(){
 const [documents,setDocuments]=useState<KnowledgeDocument[]>([]);const [storageError,setStorageError]=useState<string|null>(null);
 useEffect(()=>{const timer=setTimeout(()=>setDocuments(getKnowledgeDocuments()),0);return()=>clearTimeout(timer)},[]);
 const apply=(result:ReturnType<typeof updateKnowledgeDocument>)=>{setDocuments(result.documents);setStorageError(result.success?null:result.error)};
 const uploaded=(next:KnowledgeDocument[])=>{setDocuments(next);next.forEach(document=>void syncKnowledgeMetadata(document))};
 const toggle=(document:KnowledgeDocument)=>{const result=updateKnowledgeDocument(document.id,{enabled:!document.enabled});apply(result);const updated=result.documents.find(item=>item.id===document.id);if(result.success&&updated)void syncKnowledgeMetadata(updated)};
 const rename=(document:KnowledgeDocument,name:string)=>{const result=updateKnowledgeDocument(document.id,{name});apply(result);const updated=result.documents.find(item=>item.id===document.id);if(result.success&&updated)void syncKnowledgeMetadata(updated)};
 const remove=(document:KnowledgeDocument)=>{const result=deleteKnowledgeDocument(document.id);apply(result);if(result.success)void deleteKnowledgeMetadata(document.id)};
 return <main className="relative min-h-screen overflow-hidden bg-background text-foreground"><WorkflowLogo className="pointer-events-none fixed left-1/2 top-1/2 z-0 size-[36rem] -translate-x-1/2 -translate-y-1/2 text-foreground opacity-[0.035]"/><div className="relative z-10"><WorkspaceHeader/><div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10"><div className="mb-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-500">Company context</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">AI Knowledge Base</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Upload internal documents to ground SOP generation. Extracted text remains local; only document metadata syncs to your account.</p></div><KnowledgeBaseUploader onDocumentsChange={uploaded}/>{storageError&&<div role="alert" className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">{storageError}</div>}<div className="mt-8"><h2 className="text-sm font-medium">Local documents</h2><p className="mt-1 text-[11px] text-muted-foreground">{documents.length}/10 documents stored on this device · metadata synced when available</p></div>{documents.length===0?<div className="mt-4 flex min-h-64 items-center justify-center rounded-xl border border-dashed border-border bg-card/20 text-center"><div><BookOpen className="mx-auto size-6 text-muted-foreground"/><h2 className="mt-3 text-sm font-medium">No documents uploaded</h2><p className="mt-1 text-xs text-muted-foreground">Your processed knowledge sources will appear here.</p></div></div>:<div className="mt-4 grid gap-4 md:grid-cols-2">{documents.map(document=><KnowledgeDocumentCard key={document.id} document={document} onToggle={()=>toggle(document)} onRename={name=>rename(document,name)} onDelete={()=>remove(document)}/>)}</div>}</div></div></main>
}
