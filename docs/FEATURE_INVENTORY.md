# ProcessForge AI feature and route inventory

Reviewed: 2026-07-22. Status means code-path readiness, not production acceptance.

| Area | Routes / implementation | Access | Review status |
|---|---|---|---|
| Landing | `/` | Public | Ready; primary creation action becomes authenticated when Supabase is configured. |
| Authentication | `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/callback`, `/auth/signout` | Public entry; signed-in users redirect from auth pages | Requires live Supabase/email manual test. |
| Dashboard | `/dashboard` | Protected | Cloud summary, analytics, workspace activity, reviews and knowledge counts exist. |
| SOP workspace | `/create`, `/api/generate-sop`, `/api/edit-sop` | Protected | Generation, preview, staged loading, fallback, AI editor, undo/redo, scores and source grounding exist. |
| Analytics | `/analytics` | Protected | Deterministic scoring, findings, filters and dashboard summary exist. |
| Compliance | `/compliance` | Protected | Deterministic audit scores, findings, AI-fix handoff, 30/90/180/365 review schedule, PDF/DOCX audit exports exist. |
| Knowledge Base | `/knowledge-base`, `/api/knowledge-base/process` | Protected | TXT/PDF/DOCX validation/extraction, local text storage, cloud metadata and grounding exist; OCR is not supported. |
| History / versions | `/history`, `/versions` | Protected | Local and cloud history, reopen, restore, rename, delete, compare and analytics comparison exist. |
| Exports | SOP preview and compliance center | Protected UI | SOP PDF/DOCX/JSON and audit PDF/DOCX exist. Browser download behavior requires manual QA. |
| Workspaces | `/workspaces` | Protected | Creation, switching, owner badge, owner-authorized rename/delete, SOP organization, comments/activity and review workflow exist. No invitation or member-management UI is active. |
| Marketplace | `/marketplace`, `/marketplace/[slug]`, `/creators/[id]`, `/templates`, `/api/templates/publish` | Public browse/detail/profile; protected creator actions | Search/filter/detail/publish/sanitize/copy/rate/favorite/manage exist. Live RLS and migration verification required. |
| Agent service | `/api/agent`, `/api/agent/health`, `/api/agent/generate-sop`, `/agent-docs` | Public machine endpoints | Metadata/health and mock 402→200 pass locally. Official production settlement remains unverified. |
| Internal release QA | `/release-check` | Development only; production requires `ENABLE_RELEASE_CHECK=true` | Browser-local pass/fail/blocked evidence tracker. |

## Unfinished, limited, duplicated, or misleading areas

- Workspace email invitations are not included in the current release. UI, hooks, polling, email integration, acceptance page, and active service calls were removed. Legacy API routes return structured HTTP 410.
- `/history` and `/versions` support both legacy local storage and authenticated cloud data. This is intentional compatibility, but it creates two modes that require separate tests.
- Phase 14 has an original marketplace migration plus an idempotent repair migration. Both are retained; the repair migration is authoritative for partially created schemas.
- Agent verification has `verify:agent` and `verify:x402` aliases pointing to the same focused script. `verify:release` is the broader release harness.
- The development mock payment result is not a blockchain transaction and must always be described as mock. Official X Layer settlement requires credentials and funded end-to-end testing.
- Knowledge document text is local-first; cloud sync stores metadata, not a durable cloud document corpus.
- Marketplace moderation is foundational only. Production should not enable automatic approval without an operational review process.

## Database audit

Active tables used: `profiles`, `sops`, `sop_versions`, `knowledge_documents`, `workspaces`, `workspace_members`, `sop_comments`, `sop_activity`, `template_categories`, `marketplace_creator_profiles`, `sop_templates`, `template_tags`, `template_ratings`, `template_favorites`, `template_usage`, `agent_requests`, `agent_payments`, and `agent_usage`. `workspace_invitations` is retained only as an inactive legacy table.

Active RPC/functions used or depended upon: `set_updated_at`, `handle_new_user`, `workspace_role_for`, `is_workspace_member`, `can_edit_workspace`, `can_manage_workspace`, `shares_workspace_with`, `create_workspace`, `is_public_template`, marketplace aggregate refresh functions, and trigger helpers. Invitation RPCs remain inactive legacy objects and are not called by the application.

View: `public_marketplace_templates`. It is the anonymous marketplace boundary and must expose only approved, published public template data.

Triggers: profile/SOP/document/workspace/comment timestamps, profile and personal-workspace creation, marketplace timestamps, and rating/favorite/usage counters.

RLS expectations: authenticated users access only their profile, workspace-authorized SOP/version/comment/activity rows, and their knowledge metadata; marketplace creators manage only their templates; anonymous access is limited to approved public marketplace records/categories/creator display data and permitted usage inserts; agent payment tables are service-role only.

Phase 17 adds `202607220012_retire_workspace_invitations.sql`. It preserves legacy invitation objects and records while revoking their table/RPC access from public, anonymous, and authenticated application roles. Database state must still be checked by applying migrations to a clean staging project and inspecting policies in Supabase.
