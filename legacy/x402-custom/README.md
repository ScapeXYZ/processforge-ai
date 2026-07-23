# Legacy custom x402 implementation

This directory contains the isolated pre-Phase-D payment implementation. Nothing
under this directory is imported by the application runtime.

## Runtime

- `runtime/config.ts`: legacy x402 configuration and production checks
- `runtime/x402.ts`: challenge, verification, settlement, and error mapping
- `runtime/facilitator-diagnostics.ts`: facilitator HTTP diagnostics
- `runtime/storage.ts`: legacy agent request, usage, and payment persistence helpers
- `runtime/mock.ts`: development mock SOP/payment flow support
- `runtime/crypto.ts`: deterministic payment/request fingerprinting helper

## Scripts

- `scripts/verify-agent-x402.mjs`: development mock verifier
- `scripts/verify-agent-x402-production.mjs`: production challenge verifier
- `scripts/test-agent-x402-real-payment.mjs`: explicit real-payment client
- `scripts/verify-okx-auth.mjs`: facilitator authentication diagnostic

The Supabase migrations and payment tables remain in their original locations so
applied migration history and production data are not disturbed.
