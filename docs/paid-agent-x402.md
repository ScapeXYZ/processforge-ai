# ProcessForge paid agent (x402)

`POST /api/agent/generate-sop` is a machine-callable paid service. Every unpaid POST reaches the official payment wrapper before business-body validation and receives HTTP `402` with an x402 v2 requirement in the `payment-required` response header. The official OKX facilitator verifies and settles a proof-bearing retry before the route validates the business JSON. OpenAI generation starts only after successful settlement and validation.

## Request

Send `Content-Type: application/json`. Required JSON fields are `title`, `description`, `industry`, `department`, and `audience`. Optional fields are `company_context`, `requirements`, `compliance_frameworks`, `knowledge_context`, and `output_format` (`json`). No custom idempotency header is required: replay identity is derived only after official verification from the verified payment authorization and configured payment requirements. The maximum HTTP body is 32 KiB; individual fields have stricter schema limits.

```bash
curl -i -X POST "$PROCESSFORGE_URL/api/agent/generate-sop" \
  -H "Content-Type: application/json" \
  --data '{"title":"Invoice approval","description":"When an invoice arrives, Accounting validates and approves it within two business days.","industry":"Finance","department":"Accounting","audience":"Accounts payable","output_format":"json"}'
```

Decode the `payment-required` header with an x402-compatible client, authorize the advertised exact payment, then retry the identical JSON request with the resulting standard `payment-signature` header. Do not alter the resource, amount, asset, recipient, network, or request content on retry.

Successful JSON includes `request_id`, `service`, `status`, `sop`, deterministic `analytics`, deterministic `compliance`, `assumptions`, `warnings`, `generated_at`, `processing_time_ms`, and `schema_version`. Stable error codes include `INVALID_REQUEST`, `PAYMENT_REQUIRED`, `PAYMENT_INVALID`, `PAYMENT_SETTLEMENT_FAILED`, `PAYMENT_REPLAY_CONFLICT`, `REQUEST_IN_PROGRESS`, `RATE_LIMITED`, `SERVICE_BUSY`, `AI_TIMEOUT`, and `GENERATION_FAILED`.

## Configuration

Use `eip155:1952` for X Layer test/development and `eip155:196` for X Layer Mainnet. Prices are atomic token amounts. The configured asset must be the token contract supported by the facilitator on the selected network. Production fails closed unless x402 is enabled, network is exactly `eip155:196`, wallet/token/price are set, facilitator credentials are present, and mock mode is off.

When x402 is enabled and all seller credentials exist, the official OKX facilitator path is used. Run `npm run verify:x402` against a running server; optionally supply an official buyer proof as `OKX_X402_PAYMENT_HEADER` to exercise the facilitator path.

Free discovery endpoints are `GET /api/agent` and `GET /api/agent/health`. The health endpoint only checks configuration presence and never calls OpenAI.

## Idempotency and security

Request content is deterministically hashed. After official verification, the server derives a one-way replay key from the verified authorization nonce, payer, configured payment requirements, and canonical resource. Reusing that authorization with different content returns `409`; completed retries return the stored response. Replay keys and transaction references have unique database constraints, and generation is claimed atomically to prevent duplicate settlement or work. Raw signatures, authorization headers, prompts, full knowledge context, private keys, and provider secrets are never stored or logged.

Apply migrations through `supabase/migrations/202607240001_server_derived_x402_replay.sql`, set the server-only Supabase service role key, then configure OKX and OpenAI variables. Deploy production on a reachable custom HTTPS domain supported by the OKX submission process; do not submit a temporary `vercel.app` test hostname.
