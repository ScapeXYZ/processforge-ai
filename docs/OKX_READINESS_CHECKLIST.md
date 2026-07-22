# OKX / x402 production readiness checklist

Do not mark an item complete without captured evidence.

| Requirement | Status | Evidence / action |
|---|---|---|
| Public metadata endpoint returns 200 | Complete locally | `GET /api/agent`; repeat on production host. |
| Health endpoint returns 200 | Complete locally | `GET /api/agent/health`; degraded is still live. |
| Correct development 402 and mock retry | Complete locally | `npm run verify:x402`, `eip155:1952`. |
| Reachable production endpoints | Not complete | Deploy and record external checks. |
| HTTPS | Not complete | Verify certificate and redirects on final host. |
| Custom production domain or supported alternative | Not complete | Do not submit localhost or unsupported `vercel.app` URL. |
| Production 402 response | Not complete | Capture headers/body from public host. |
| Official seller-side verification and settlement | Not complete | Test official OKX facilitator; mock is insufficient. |
| X Layer Mainnet `eip155:196` | Implemented, not externally verified | Set production env and capture metadata/402. |
| Supported production asset | Not complete | Confirm facilitator-supported contract/decimals. |
| Recipient wallet | Not complete | Configure and verify ownership. |
| Seller API credentials | Not complete | Provision server-only OKX credentials. |
| Price and timeout | Not complete | Approve atomic price and operational timeout. |
| Idempotency | Implemented locally | Test successful same-key retry and content mismatch. |
| Replay/duplicate settlement protection | Implemented, not mainnet-tested | Verify unique proof/transaction rejection. |
| Public documentation URL | Implemented locally | `/agent-docs`; verify production canonical host. |
| Registered agent user ID | Not complete | Obtain during OKX registration. |
| Self-testing after registration | Not complete | Execute after registration. |
| Repository/security audit | In progress | Use Phase 16 security review plus independent review. |
| Demo video | Not complete | Record using `DEMO_VIDEO_SCRIPT.md`. |
| Listing content | Not started | Listing is explicitly outside Phase 16. |
| No localhost URLs | Not complete | Inspect production metadata/docs/redirects. |
| No unsupported `vercel.app` submission URL | Not complete | Use approved custom/supported host. |

Never describe the development token flow as a real payment. Production evidence must come from official facilitator verification and settlement.

Workspace email invitations are not included in the current release and are unrelated to OKX readiness.
