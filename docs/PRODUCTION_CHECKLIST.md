# Production checklist

Every item starts incomplete and must have dated evidence before launch.

- [ ] All migrations applied in order and backed up
- [ ] RLS verified for owner, unrelated user, and anonymous user
- [ ] Service-role, OpenAI, and payment secrets configured server-side only
- [ ] Custom production domain connected; no localhost or unsupported `vercel.app` submission URL
- [ ] HTTPS and HSTS working
- [ ] Sign-up, verification, login, reset, callback, refresh, and sign-out tested
- [ ] Cross-user SOP, workspace, version, knowledge, analytics, and compliance isolation tested
- [ ] SOP generation, timeout, provider failure, local fallback, save failure, and retry tested
- [ ] PDF, DOCX, JSON, compliance exports tested with long and empty content
- [ ] Knowledge MIME, signature, size, parsing, injection, and deletion tested
- [ ] Marketplace publication, sanitization, public/private boundary, copy, rating, favorite, and delete tested
- [ ] Agent metadata, health, paid endpoint, idempotency, replay, and request limits tested
- [ ] Official x402 provider configured; mock disabled in production
- [ ] X Layer mainnet is exactly `eip155:196`
- [ ] Payment recipient, supported asset, amount, facilitator, and credentials independently verified
- [ ] Distributed production rate limiter configured and tested across instances
- [ ] Structured logs, redaction, alerts, retention, and operator access tested
- [ ] Privacy, Terms, Acceptable Use, AI Disclaimer, and Data Handling pages legally reviewed and published
- [ ] Backup restoration and application rollback rehearsed
- [ ] Health and readiness monitored from outside the hosting network

