# ProcessForge AI

ProcessForge AI turns operational briefs into structured, exportable standard operating procedures. It includes live input readiness, rule-based suggestions, grounded generation, AI editing, local history, version comparison, and PDF/DOCX/JSON exports.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Copy `.env.example` to `.env.local` and provide:

```bash
OPENAI_API_KEY=...
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

Only the public project URL and publishable/anon key belong in browser code. Never add a service-role key to a `NEXT_PUBLIC_` variable.

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

## Supabase authentication and cloud sync

ProcessForge uses the current `@supabase/ssr` cookie flow with PKCE. Next.js `proxy.ts` refreshes sessions and protects `/create`, `/workspace`, `/history`, `/versions`, `/knowledge-base`, `/dashboard`, and `/settings`. Login, signup, recovery, reset, and callback routes remain public.

To initialize the database, open Supabase SQL Editor and run [`supabase/migrations/202607210001_initial_cloud_schema.sql`](supabase/migrations/202607210001_initial_cloud_schema.sql). It creates profiles, SOPs, SOP versions, and knowledge-document metadata. Row Level Security is enabled on every table, with select/insert/update/delete policies scoped to `auth.uid()`.

Successful SOP generation, regeneration, AI edits, manual saves, and restores retain a local snapshot and attempt a cloud save. The workspace shows Saving, Saved, Offline, Save failed, or Cloud conflict. Updates use the last known `updated_at` value; a newer cloud record is not silently overwritten. Use the retry control after connectivity returns.

After the first login, the dashboard and settings page show **Local work found** when appropriate. Import requires confirmation, detects duplicate SOP document IDs and version numbers, reports imported/skipped/failed counts, and never deletes local data automatically.

## Local-storage limitation

SOP records, versions, profiles, and knowledge-document metadata synchronize through Supabase after sign-in. Local copies remain a resilience fallback. Extracted knowledge-document text intentionally remains in the current browser, so grounded generation on another device requires re-uploading the source document. Browser storage quotas vary.

## Security notes

- Document extraction runs on the server route and document content is never executed as code or rendered as HTML.
- Uploaded reference text is treated as untrusted data and cannot override system or developer instructions.
- The application does not claim compliance or invent unsupported company policies, quotations, or page references.
- Protected pages and API operations verify the Supabase user server-side; database ownership is additionally enforced with RLS.
- The public anon/publishable key is expected in the browser and is not a privileged service-role secret.
- Do not use extracted local documents on shared devices without clearing browser storage afterward.

## Known limitations and future cloud knowledge base

This phase is local-first rather than a full offline synchronization engine. Conflict detection is record-level, queued background sync is not included, and knowledge text is not uploaded. Future work can add encrypted object storage, organization access controls, durable extraction jobs, OCR, audit logs, retention policies, and vector search.

## Workspaces

Authenticated users receive a personal workspace automatically and can create additional workspaces to organize SOPs. The workspace screen supports creation, switching, an owner badge, owner-authorized rename, and safe deletion of non-personal workspaces. SOPs, versions, comments, activities, and workflow changes remain protected by workspace-scoped Row Level Security.

Run [`supabase/migrations/202607220001_team_collaboration.sql`](supabase/migrations/202607220001_team_collaboration.sql) after the Phase 10 migration. It backfills existing SOPs into personal workspaces and adds the `draft`, `in_review`, `approved`, and `archived` workflow.

Workspace email invitations are not included in the current release. Historical invitation tables, RPCs, policies, records, and migrations are retained as inactive legacy database objects for compatibility and audit history. Active application code does not query or mutate them. Legacy invitation API URLs return HTTP 410 without exposing private data.

Apply [`supabase/migrations/202607220012_retire_workspace_invitations.sql`](supabase/migrations/202607220012_retire_workspace_invitations.sql) to revoke all invitation table and RPC privileges from public, anonymous, and authenticated application roles while preserving historical data.

## SOP analytics and quality insights

ProcessForge calculates SOP analytics locally without an AI request. Overall Quality is a weighted combination of completeness (20%), clarity (15%), procedure strength (20%), control strength (18%), compliance readiness (10%), training readiness (10%), and knowledge grounding (7%). Structured SOP fields are evaluated first; concepts that do not yet have dedicated schema fields—such as KPIs, exceptions, compliance guidance, and record retention—are detected using deterministic text rules.

Risk findings use five severities: Critical means the record cannot be safely evaluated; High identifies missing accountability, triggers, approvals, escalation, measurable outcomes, or unsupported company-specific assumptions; Medium identifies operational gaps such as exceptions, KPIs, retention, checklists, training validation, vague steps, or a short procedure; Low identifies non-blocking governance gaps; Improvement highlights optional strengthening such as knowledge grounding. Rules and scores are deterministic and produce the same result for unchanged SOP content.

Analytics recalculate when an SOP is generated, edited, restored, opened after a knowledge-source change, or manually reanalyzed. Generation and cloud synchronization continue even if analytics metadata cannot be saved. Apply [`supabase/migrations/202607220007_sop_analytics.sql`](supabase/migrations/202607220007_sop_analytics.sql) after the earlier cloud and collaboration migrations to add `analytics`, `quality_score`, `risk_level`, and `analyzed_at` while preserving existing SOP rows.

Current limitations: keyword rules cannot determine whether a cited control is legally sufficient, do not replace compliance review, and may miss domain-specific terminology. Analytics are decision support, not certification or legal advice.

## OKX x402 paid agent

ProcessForge exposes free metadata at `GET /api/agent`, dependency readiness at `GET /api/agent/health`, and paid SOP generation at `POST /api/agent/generate-sop`. Valid unpaid requests receive an x402 v2 `402 Payment Required`. Missing or disabled seller configuration selects the deterministic mock 402→200 flow; complete enabled seller configuration verifies and settles through the official OKX facilitator before OpenAI is called. The result contains the SOP plus deterministic analytics and compliance analysis.

Apply [`supabase/migrations/202607220011_okx_x402_agent_service.sql`](supabase/migrations/202607220011_okx_x402_agent_service.sql), configure the `OKX_X402_*` variables shown in `.env.example`, and set the server-only `SUPABASE_SERVICE_ROLE_KEY`. X Layer test/development uses `eip155:1952`; production is hard-checked to `eip155:196`. See [`docs/paid-agent-x402.md`](docs/paid-agent-x402.md) for contracts, curl examples, paid retry behavior, idempotency, security assumptions, and deployment requirements.

The canonical marketplace profile image is [`assets/processforge-ai-avatar.png`](assets/processforge-ai-avatar.png). This repository stores the approved source asset only; it does not contain a supported command or metadata field that submits or updates the OKX marketplace PFP.

## Compliance and Audit Center

The Compliance Center evaluates process ownership, purpose, scope, responsibility separation, approvals, escalation, exception handling, KPIs, compliance notes, record retention, review cadence, controlled versions, and training validation. Scores are calculated locally and deterministically; no AI request is used for the assessment. Findings can prefill the existing AI Editor, but users must review and explicitly apply every proposed fix.

Review intervals support 30, 90, 180, and 365 days. Audit reports include an executive summary, prioritized findings, corrective actions, affected sections, and the scheduled review date, and can be exported as PDF or DOCX. Apply [`supabase/migrations/202607220008_compliance_audit_center.sql`](supabase/migrations/202607220008_compliance_audit_center.sql) after the analytics migration to store compliance scores, audit status, review dates, and findings. These checks support internal governance and do not constitute certification, legal advice, or a guarantee of regulatory compliance.

## Public SOP Template Marketplace

The marketplace separates public template records from private workspace SOPs. Approved public records can be discovered anonymously, while publishing, copying, rating, favoriting, and creator management require authentication and remain protected by Supabase Row Level Security. Copying creates a new editable workspace SOP with `source_template_id` attribution; the public template is never modified.

Publishing requires a public title, summary, description, category, tags, preview, and explicit confirmation that confidential information was removed. Deterministic scanning blocks likely email addresses, phone numbers, credentials, API tokens, private URLs, internal hostnames, account identifiers, personal names, and company-specific names. Detection is intentionally conservative and publishers remain responsible for manual review.

Moderation states are `draft`, `pending_review`, `approved`, `rejected`, and `archived`. Set server-only `MARKETPLACE_AUTO_APPROVE=true` only for local development; production should leave it false until an administrator moderation workflow is implemented. Apply [`supabase/migrations/202607220009_public_template_marketplace.sql`](supabase/migrations/202607220009_public_template_marketplace.sql) after the prior migrations.

Set the server-only `APP_BASE_URL` to the final custom HTTPS origin for canonical and Open Graph URLs. Do not depend on a temporary `vercel.app` hostname. Marketplace records include `is_free` and `paid_ready` fields so a future OKX pay-per-use entitlement layer can be added without changing public SOP content. Production x402 access remains disabled until official credentials are configured.
# Production security and deployment

Production uses the server-only `APP_BASE_URL` for canonical, agent, health, and payment resource URLs. It must be a custom HTTPS origin; localhost is the documented development fallback and an unsupported `vercel.app` address must not be submitted to OKX. Server readiness validates Supabase, service-role, OpenAI, URL, logging, and x402 configuration without printing values.

Global CSP, clickjacking, content-type, referrer, permissions, and production HSTS headers are configured in `next.config.ts`. Generation, AI editing, knowledge processing, and agent endpoints enforce bounded inputs and server-side controls. The current general-purpose limiter is process-local; multi-instance production deployments must provide a distributed store before launch.

x402 mock payment remains development-only on `eip155:1952`. Production cannot select the mock provider and requires the official provider, `eip155:196`, recipient, asset, amount, facilitator, and seller credentials. Missing configuration fails closed.

See [Production deployment](docs/PRODUCTION_DEPLOYMENT.md), [Production checklist](docs/PRODUCTION_CHECKLIST.md), and [Custom domain checklist](docs/CUSTOM_DOMAIN_CHECKLIST.md). Use `.env.production.example` as the placeholder-only production inventory. After deployment, run `DEPLOYMENT_URL=https://your-custom-domain.example npm run verify:deployment`; it performs no payment. Public legal pages are drafts requiring counsel review; ProcessForge does not claim ISO, SOC 2, GDPR, or regulatory certification. Workspace email invitations are not included in the current release.
