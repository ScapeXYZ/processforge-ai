# Production deployment

> This runbook requires operator verification. It does not authorize an OKX marketplace listing. Workspace email invitations are not included in this release.

## Required services

- A production Supabase project with Auth, PostgreSQL, RLS, backups, and the repository migrations applied in filename order.
- OpenAI API access for browser and agent generation.
- A custom HTTPS domain such as `https://app.processforge.ai`.
- For production x402 only: official OKX seller/facilitator credentials, an X Layer recipient wallet, and the supported asset.

## Environment

Copy `.env.example` into the deployment secret manager. Set `APP_BASE_URL` to the custom HTTPS origin. Configure the Supabase URL, publishable/anon key, server-only service-role key, and OpenAI key. Secrets must never be prefixed `NEXT_PUBLIC_`. Set `LOG_LEVEL=info` and replace the documented in-memory rate limiter with a distributed production adapter when horizontally scaling.

Development keeps `OKX_X402_MOCK=true`, `OKX_X402_ENABLED=false`, and `OKX_X402_NETWORK=eip155:1952`. Production requires mock false, enabled true, `eip155:196`, recipient, asset, integer amount, facilitator URL, and seller credentials. Missing production payment configuration fails closed. Do not submit a localhost or unsupported `vercel.app` URL to OKX.

## Deploy

1. Back up the production database and record the current application version.
2. Apply every unapplied migration from `supabase/migrations` in filename order. Never rewrite an applied migration.
3. Verify RLS and grants using separate owner, second-user, and anonymous sessions.
4. Configure the custom domain and HTTPS before setting `APP_BASE_URL`.
5. Run `npm ci`, `npm run lint`, `npm run build`, and start with `npm start`.
6. Verify `/api/agent/health`, `/api/agent`, authentication callbacks, private-route redirects, marketplace public reads, generation, uploads, and exports.
7. Run `npm run verify:x402` and `npm run verify:release` against test/development. Do not fake a mainnet payment.

## Health, monitoring, backups

Health reports `healthy`, `degraded`, or `unavailable` without performing generation or disclosing configuration values. Forward structured JSON server logs to the operator's monitoring system, alert on 5xx/429/payment failures, and redact request bodies and credentials. Configure Supabase point-in-time recovery or scheduled backups and test restoration.

## Rollback

Stop traffic, deploy the last known-good immutable build, restore the previous environment set, and roll back data only from a tested backup after reviewing forward migration compatibility. Database migrations are forward-only by default; do not delete new columns during an incident. Re-run health and isolation checks before reopening traffic.

