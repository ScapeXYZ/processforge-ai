# ProcessForge AI release test checklist

Record `Pass`, `Fail`, or `Blocked` and link a screenshot, video, console capture, exported file, or query result in Evidence.

| Category / test | Preconditions | Steps | Expected result | Result | Evidence |
|---|---|---|---|---|---|
| Authentication: sign-up and verification | Staging Supabase; unused email | Sign up, open verification email, return to app | Verified session; personal workspace/profile created once | ___ | ___ |
| Authentication: login/reset/sign-out | Existing verified account | Login, request reset, change password, sign out | Neutral recovery message; new password works; protected routes redirect | ___ | ___ |
| Navigation | Signed out, then signed in | Exercise desktop/mobile navigation and browser back/forward | No 404s; correct public/protected destinations; visible focus | ___ | ___ |
| SOP generation | Signed-in editor; OpenAI configured | Generate concise and detailed SOPs; regenerate | Stages/timer persist; duplicate clicks blocked; prior SOP preserved on failure | ___ | ___ |
| SOP viewing | Generated and reopened SOP | Inspect every section, scores, source notes and badges | Schema data is readable; input vs SOP scores are explained | ___ | ___ |
| AI editing | Existing SOP | Edit entire SOP, one section, undo, redo, fail network | Only intended scope changes; versions created; prior data survives error | ___ | ___ |
| Readiness/suggestions | Empty form | Type from sparse to detailed input | Score and suggestions update deterministically; low score does not block | ___ | ___ |
| Analytics | Complete and incomplete SOPs | Reanalyze both and revisit page | Stable scores/findings; filters and improvement actions work | ___ | ___ |
| Compliance | SOP with control gaps | Analyze, open findings, queue AI fix | Deterministic scores; no legal/certification claims invented | ___ | ___ |
| Review scheduling | Cloud SOP | Select 30, 90, 180 and 365 days | Correct next review; refresh persists; upcoming list updates | ___ | ___ |
| Knowledge grounding | Valid and invalid TXT/PDF/DOCX | Upload, preview, enable, select, generate; try scan/encrypted/bad signature/large file | Useful validation; selected sources and truncation shown; prompt instructions ignored | ___ | ___ |
| Cloud sync | Two browsers/devices | Create/edit/restore in A, refresh B; simulate outage/conflict | Cloud state appears; local work survives failure; conflict is not overwritten silently | ___ | ___ |
| History/versions | Local and cloud records | Search, reopen, export, rename, compare, restore, delete | Correct snapshot/relationships; newest first; destructive confirmations | ___ | ___ |
| SOP exports | Long/Unicode/sparse SOP | Export PDF, DOCX, JSON | Safe filename; valid files; page breaks; no cut text or private metadata | ___ | ___ |
| Audit exports | Many long findings | Export compliance PDF/DOCX | Multipage, numbered/readable findings and review date | ___ | ___ |
| Workspaces | Owner/admin/editor/viewer accounts | Exercise SOP/comment/review/member operations | Owner/admin manage; editor edits; viewer read-only; RLS rejects escalation | ___ | ___ |
| Marketplace browse | Approved public templates | Search/filter/sort/open detail/profile | Public content only; no source SOP ID/private workspace data | ___ | ___ |
| Marketplace publish | Creator SOP with and without sensitive text | Publish, resolve warnings, confirm, manage state | Sensitive content blocks; explicit confirmation; only creator can mutate | ___ | ___ |
| Marketplace copy/rate/favorite | Non-creator authenticated account | Copy to selected workspace, rate twice, toggle favorite | Independent SOP with attribution; rating updates, no duplicate row; favorite toggles | ___ | ___ |
| Mobile responsiveness | 320/375/768 px viewports | Exercise forms, tables, dialogs, preview, dashboards | No horizontal loss, inaccessible controls, or obscured errors | ___ | ___ |
| Accessibility | Keyboard and screen reader | Tab all pages; submit errors; open dialogs/tooltips | Logical headings, labels/names, focus indicators, announced errors/status | ___ | ___ |
| Error/empty states | Empty account and blocked network | Open each dashboard/list and retry failures | Clear empty action; concise retry; no stale “Saved” state | ___ | ___ |
| Database permissions | Staging users in separate workspaces | Query/read/update foreign IDs and private template rows | RLS denies every unauthorized operation | ___ | ___ |
| Agent metadata/health | Running app | GET both free endpoints | HTTP 200; documented fields; no secrets | ___ | ___ |
| x402 mock | Development server | Run `npm run verify:x402` | 400/405/402/200 and `eip155:1952` pass; explicitly mock | ___ | ___ |
| x402 production | Funded approved setup | Official unpaid request, buyer authorization, paid retry, replay | `eip155:196`; official verification/settlement; replay rejected | ___ | ___ |
| Performance | Representative 50 SOPs/10 documents/templates | Profile dashboard, analytics, compliance, export, search | No runaway requests/calculations; acceptable interaction time | ___ | ___ |
| Security | Staging and browser developer tools | Inspect bundles/responses/logs; submit oversized/malformed/HTML/prompt-injection inputs | No secrets/XSS/private objects; bounded validation; safe errors/logs | ___ | ___ |
| Production environment | Production-like deployment | Run build, smoke harness, inspect URLs/env/cookies | HTTPS custom host, correct redirects/origins, mock disabled for live settlement | ___ | ___ |

Invitation email delivery is intentionally excluded from this release scope and is not an acceptance blocker or advertised capability.
