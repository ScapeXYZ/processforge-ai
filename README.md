# ProcessForge AI

ProcessForge AI turns operational briefs into structured, exportable standard operating procedures. It includes live input readiness, rule-based suggestions, grounded generation, AI editing, local history, version comparison, and PDF/DOCX/JSON exports.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Production checks:

```bash
npm run lint
npm run build
```

## AI Knowledge Base

The local Knowledge Base accepts:

- PDF (`application/pdf`), limited to text-based PDFs
- DOCX (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`)
- TXT (`text/plain`, UTF-8)

Limits are 10 MB per file and 10 documents per browser knowledge base. Files are validated by extension, MIME type, size, emptiness, and server-side file signature before extraction. Password-protected, encrypted, corrupt, scanned, or otherwise unreadable documents are rejected. OCR is not included in this phase.

### How grounding works

1. Documents are uploaded to a server-only processing route for text extraction. No OpenAI API key is exposed to the browser.
2. Extracted text is normalized, stripped of null characters, and capped before being returned to the browser.
3. Users enable documents and select Knowledge Sources in the SOP workspace.
4. A lightweight local relevance selector uses the process title, industry, department, description, and audience to prefer opening paragraphs, headings, and keyword-relevant passages.
5. The selected passages are sent to the SOP route inside an explicit untrusted-reference boundary. Document text is factual and policy context only; instructions embedded in documents are ignored.
6. Generated SOPs record the source names, assumptions, missing information, and whether general best practices were added.

No embeddings or vector database are used yet.

## Local-storage limitation

Knowledge documents, extracted text, SOP history, and version history are stored in the current browser’s `localStorage`. Data does not synchronize across browsers or devices and can be removed by clearing site data. Browser storage quotas vary; large extracted documents can exhaust the available quota even within the upload limits.

## Security notes

- Document extraction runs on the server route and document content is never executed as code or rendered as HTML.
- Uploaded reference text is treated as untrusted data and cannot override system or developer instructions.
- The application does not claim compliance or invent unsupported company policies, quotations, or page references.
- This local phase has no authentication, database, cloud storage, payments, or sharing controls. Do not use it for highly sensitive documents on shared devices.

## Future cloud knowledge base

A future phase can add authenticated encrypted object storage, organization-level access controls, durable metadata, background processing, OCR, audit logs, retention policies, and vector search. Those cloud capabilities are intentionally out of scope for the current local implementation.
