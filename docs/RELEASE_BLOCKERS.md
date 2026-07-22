# ProcessForge AI release blockers

## Critical

- None confirmed by local static/build/smoke review. Any staging RLS cross-account data exposure or secret leakage becomes an immediate critical blocker.

## High

- Apply the full Supabase migration chain to a clean staging project and verify every RLS policy with unrelated users and workspace roles.
- Complete real authentication/email-verification/password-reset testing using production-like redirect URLs.
- Complete an official funded X Layer Mainnet x402 verification and settlement test on `eip155:196`; confirm replay and idempotent retry behavior.
- Configure and verify a supported production asset, recipient wallet, OKX credentials, custom HTTPS domain, and public documentation URL.
- Verify anonymous marketplace queries cannot expose private, draft, pending, rejected, unlisted-without-link, or source workspace data.

## Medium

- Complete manual PDF/DOCX layout review for long, Unicode and sparse SOP/audit reports.
- Add distributed production rate limiting for agent and expensive AI/document endpoints.
- Complete mobile and screen-reader review, including dialogs and tooltip interaction.
- Define marketplace moderation ownership and leave `MARKETPLACE_AUTO_APPROVE=false` in production.
- Document local knowledge-text confidentiality limits prominently in release communications.

## Optional

- Add durable automated browser tests and visual regression testing.
- Add OCR, malware scanning, encrypted cloud document storage and distributed job processing.
- Consolidate legacy local/cloud history modes after migration adoption is measured.
- Add observability dashboards and performance budgets.

Workspace invitation email delivery is intentionally excluded from the current release scope. It is not advertised and is not a release blocker.
