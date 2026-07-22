# Production deployment

This runbook is platform-neutral. It does not authorize an OKX listing, and workspace email invitations remain outside the release.

## Hosting requirements

Choose a Node.js host that supports Next.js App Router server routes, server-only environment variables, Node runtimes, custom-domain HTTPS, persistent outbound HTTPS, and request durations of at least 120 seconds for paid generation and 90 seconds for browser generation. A static-only host is not supported. Provider-specific features must remain optional adapters.

## 1. Prepare the release

1. Select and record the exact Git commit. Merge only reviewed changes into the chosen production branch; a Git push alone is not a release approval.
2. Run `npm ci`, `npm run lint`, and `npm run build` in CI.
3. Back up Supabase before applying migrations. Record the backup identifier and restoration procedure.
4. Apply unapplied files from `supabase/migrations` in filename order. Applied migrations are forward-only; never edit or rerun historical files.
5. Verify RLS with an anonymous session, an owner, and an unrelated authenticated account.

## 2. Create the hosting service

1. Create a Node.js web service and connect the GitHub repository using read-only deployment access where supported.
2. Select the reviewed production branch or an immutable release tag. Use a separate preview/develop branch for staging.
3. Set the install command to `npm ci`, build command to `npm run build`, and start command to `npm start`.
4. Ensure the platform passes its assigned `PORT` to Next.js and allows the configured API timeouts.
5. Copy `.env.production.example` into the host secret manager and replace every placeholder. Do not commit a production environment file.

## 3. Supabase production configuration

1. Create a separate production Supabase project and save its URL, publishable/anon key, and service-role key in the host. The service-role key is server-only.
2. Apply migrations in repository order, then verify RLS, functions, views, triggers, and grants.
3. In Authentication → URL Configuration, set Site URL to the final `APP_BASE_URL`.
4. Add exact redirect URLs for `APP_BASE_URL/auth/callback`, plus local `http://localhost:3000/auth/callback` only for the development project. Email confirmation and password recovery both use this callback; the safe `next` value selects `/dashboard` or `/reset-password`.
5. Configure email confirmation and recovery templates. OAuth callback setup is only required if an OAuth provider is later enabled.
6. Knowledge file extraction is currently performed by the application and text is stored locally for this phase; if Supabase Storage is introduced, add owner-only bucket policies before use.

## 4. Domain, DNS, and HTTPS

1. Add the selected custom domain to the host and obtain its requested A, AAAA, ALIAS, or CNAME values.
2. Add records at the authoritative DNS provider, remove conflicting records, and wait for propagation.
3. Verify the host-issued certificate, redirect HTTP to HTTPS, and choose one canonical www/non-www hostname.
4. Set `APP_BASE_URL` to that exact HTTPS origin with no path or trailing slash. Redeploy after changing it.
5. Follow `CUSTOM_DOMAIN_CHECKLIST.md`, then confirm metadata, authentication emails, canonical URLs, and payment resources use the same origin.

## 5. x402 rollout

Development remains `OKX_X402_MOCK=true` on `eip155:1952`. Production must set mock false. Keep `AGENT_PAID_GENERATION_ENABLED=false` and `OKX_X402_ENABLED=false` until official seller credentials, recipient, asset, amount, and facilitator have been independently verified.

Test the official provider in the supported test flow first. For mainnet, set `OKX_X402_NETWORK=eip155:196`, configure official credentials, enable x402, then enable paid generation. The installed OKX adapter verifies and settles server-side before generation. Settlement failure returns no paid result; payment references and idempotency records prevent replay and duplicate generation. Do not claim mainnet success until an official credential-backed transaction has been tested.

During an incident, set `AGENT_PAID_GENERATION_ENABLED=false` and redeploy. This disables paid generation without weakening browser features or payment verification.

## 6. Verify and observe

1. Run `DEPLOYMENT_URL=https://your-domain.example npm run verify:deployment`. It performs no payment.
2. Check `/api/health`, `/api/agent/health`, `/api/agent`, and the documentation/legal routes externally.
3. Inspect structured logs for deploy version, request failures, rate limits, generation errors, and payment events. Never log bodies, payment signatures, cookies, or credentials.
4. Configure uptime probes for `/api/health` and alerts for unavailable health, sustained 5xx/429 responses, payment rejection spikes, and OpenAI failures.
5. A multi-instance deployment must replace the documented process-local rate limiter with a distributed store.

## Backup and rollback

Before migration, capture a Supabase backup and deployed commit. To roll back application code, restore the previous immutable deployment and matching environment snapshot. Database migrations are forward-only by default: assess compatibility and restore a tested backup only when necessary. Verify RLS and health before reopening traffic. Disable paid generation during any uncertain payment or data incident.

