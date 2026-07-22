# ProcessForge AI security review

Reviewed 2026-07-22 through static repository inspection and local smoke tests. This is an engineering review, not a penetration test.

## Findings and disposition

### Critical

No confirmed critical defect was found in the reviewed code. Production release still requires staging RLS and official payment tests.

### High

- **Production x402 not end-to-end verified.** Server uses the official facilitator only when enabled credentials exist; unique payment and transaction constraints provide replay protection. Block production paid launch until a funded X Layer Mainnet test passes.
- **Marketplace privacy depends on applied repair migration/RLS.** Client reads the `public_marketplace_templates` view. Apply and verify the repair migration in staging before exposing marketplace data.

### Medium

- Agent rate/concurrency limits are in-memory and therefore per instance. Database uniqueness protects payment replay/idempotency, but production should add a distributed limiter.
- Knowledge extraction parses untrusted documents server-side. File size/type/signature checks exist; isolate and monitor parsing in production and add malware scanning before enterprise uploads.
- Cloud knowledge content remains local. Browser storage is not a confidential document vault; users must be warned not to upload secrets until encrypted managed storage exists.
- Marketplace sanitization is deterministic and conservative, not a guarantee of de-identification. Explicit publisher confirmation and moderation remain required.
- Client-side cloud services rely on RLS for object authorization. Staging tests must attempt direct foreign workspace/template IDs for every operation.

### Low / informational

- `NEXT_PUBLIC_SUPABASE_URL`, anon key, application/site URLs are intentionally public. Service role, OpenAI, Resend, and OKX credentials are server-only.
- React escaping is used; no `dangerouslySetInnerHTML`, `eval`, or `new Function` application use was found. Invitation email HTML uses explicit escaping but is out of release scope.
- AI routes require authenticated sessions, validate Zod payloads, set provider timeouts, and return sanitized errors. Provider logs contain names/status/codes/durations, not prompts or secrets.
- Knowledge prompts delimit reference text as untrusted and explicitly prevent document instructions from overriding application instructions.
- Agent bodies are capped at 32 KiB; payment payloads are matched to resource/network/asset/amount/recipient; raw proofs are not stored.
- The release QA route stores only browser-local notes and is production-hidden unless `ENABLE_RELEASE_CHECK=true`.

## Required production verification

1. Inspect client bundles and network responses for server-only values.
2. Test RLS using two unrelated accounts and all four workspace roles.
3. Confirm private/draft/rejected templates never appear in anonymous view queries.
4. Exercise oversized JSON, multipart, malformed file, stored-markup and prompt-injection cases.
5. Review production logs for input, email, token, signature and authorization leakage.
6. Perform official x402 settle/replay/idempotency tests on `eip155:196`.
7. Add platform/WAF request limits and distributed rate limiting before high-volume launch.
