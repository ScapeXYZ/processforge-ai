# ProcessForge paid agent (x402)

`POST /api/agent/generate-sop` is a machine-callable paid service. Input validation is free and happens before payment. A valid unpaid request receives HTTP `402`, a JSON x402 v2 requirement, and the same requirement in the `payment-required` response header. The seller verifies and settles an official `payment-signature` with the OKX facilitator before starting OpenAI generation.

## Request

Send `Content-Type: application/json` and a stable `Idempotency-Key` header (8–200 characters). Required JSON fields are `title`, `description`, `industry`, `department`, and `audience`. Optional fields are `company_context`, `requirements`, `compliance_frameworks`, `knowledge_context`, and `output_format` (`json`). The maximum HTTP body is 32 KiB; individual fields have stricter schema limits.

```bash
curl -i -X POST "$PROCESSFORGE_URL/api/agent/generate-sop" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: invoice-approval-v1" \
  --data '{"title":"Invoice approval","description":"When an invoice arrives, Accounting validates and approves it within two business days.","industry":"Finance","department":"Accounting","audience":"Accounts payable","output_format":"json"}'
```

Decode the `payment-required` header with an x402-compatible client, authorize the advertised exact payment, then retry the identical request and idempotency key with the resulting `payment-signature` header. Do not alter the resource, amount, asset, recipient, network, or request content on retry.

Successful JSON includes `request_id`, `service`, `status`, `sop`, deterministic `analytics`, deterministic `compliance`, `assumptions`, `warnings`, `generated_at`, `processing_time_ms`, and `schema_version`. Stable error codes include `INVALID_REQUEST`, `PAYMENT_REQUIRED`, `PAYMENT_INVALID`, `PAYMENT_REPLAYED`, `PAYMENT_SETTLEMENT_FAILED`, `IDEMPOTENCY_CONFLICT`, `REQUEST_IN_PROGRESS`, `RATE_LIMITED`, `SERVICE_BUSY`, `AI_TIMEOUT`, and `GENERATION_FAILED`.

## Configuration

Use `eip155:1952` for X Layer test/development and `eip155:196` for X Layer Mainnet. Prices are atomic token amounts. The configured asset must be the token contract supported by the facilitator on the selected network. Production fails closed unless x402 is enabled, network is exactly `eip155:196`, wallet/token/price are set, facilitator credentials are present, and mock mode is off.

When x402 is disabled, seller credentials are absent, or `OKX_X402_MOCK=true`, the deterministic mock provider emits a real-format x402 requirement plus an `x-mock-payment-token`. Retry the identical body and `Idempotency-Key` with that token in `payment-signature` to receive a deterministic mock SOP, analytics, and compliance response. No blockchain or OpenAI request occurs. When x402 is enabled and all seller credentials exist, the official OKX facilitator path is used. Run `npm run verify:x402` against a running server; optionally supply an official buyer proof as `OKX_X402_PAYMENT_HEADER` to exercise the facilitator path.

Free discovery endpoints are `GET /api/agent` and `GET /api/agent/health`. The health endpoint only checks configuration presence and never calls OpenAI.

## Idempotency and security

Request content is deterministically hashed. Reusing a key with different content returns `409`; completed retries return the stored response. Payment payload hashes and transaction references have unique database constraints to prevent replay and duplicate settlement. Raw signatures, authorization headers, prompts, full knowledge context, private keys, and provider secrets are never stored or logged. The in-process rate/concurrency guard supplements database uniqueness but should be replaced or supplemented with a distributed limiter for multi-instance production.

Apply `supabase/migrations/202607220011_okx_x402_agent_service.sql`, set the server-only Supabase service role key, then configure OKX and OpenAI variables. Deploy production on a reachable custom HTTPS domain supported by the OKX submission process; do not submit a temporary `vercel.app` test hostname.
