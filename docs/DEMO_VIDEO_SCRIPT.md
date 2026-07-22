# ProcessForge AI demo video script (3–5 minutes)

## 0:00–0:25 — The problem

“Operations teams lose time turning tribal knowledge into controlled, measurable procedures. ProcessForge AI converts an operational brief into a structured SOP, then evaluates its quality, governance, training readiness, and audit gaps.”

Show the landing page and move into the authenticated workspace.

Create a fictional “Finance Operations” workspace, point out the workspace owner badge, organize the demo SOP there, and switch between two owned workspaces. Do not make team, collaborator, member-management, or invitation claims. Workspace email invitations are not included in the current release.

## 0:25–1:20 — Generate an SOP

Use the fictional “Supplier invoice approval” brief. Point out live input readiness and local smart suggestions. Select a fictional knowledge source, generate, and show sequential progress. Explain Input Quality versus SOP Readiness, assumptions, source notes, owners, evidence, checklist, and training quiz.

## 1:20–2:05 — Analytics and compliance

Open SOP Analytics. Highlight deterministic quality breakdown and top risks. Open Compliance, show governance/audit readiness and schedule a 90-day review. Choose one finding and send its prefilled prompt to the AI Editor. Confirm the edit, show the new version, and mention undo/redo.

## 2:05–2:35 — Export and reuse

Export PDF and briefly show the multipage layout; mention DOCX and JSON. Open the public marketplace, search for a fictional template, preview it, and explain that copying creates an independent workspace SOP with attribution.

## 2:35–3:40 — Machine agent and x402

Call `GET /api/agent`, then show a valid unpaid `POST /api/agent/generate-sop` returning HTTP 402 with `eip155:1952`. Run `npm run verify:x402` and show the development mock retry returning 200 with SOP, analytics, and compliance JSON.

State clearly: “This demonstration uses the deterministic development mock/test flow. It does not transfer funds or call a blockchain. Production uses official OKX seller verification and settlement on X Layer Mainnet, advertised as `eip155:196`, after credentials, asset, recipient wallet, and public domain are configured and verified.”

## 3:40–4:10 — Close

“ProcessForge turns a brief into usable operational infrastructure: a controlled SOP, measurable quality signals, audit findings, training content, reusable templates, and a machine-callable paid agent surface.”

End on the dashboard. Do not claim certification, legal compliance, completed mainnet payment, or production readiness until the release blockers are closed.
