export type ReleaseFeature = { name: string; status: "ready" | "review" | "limited" | "out-of-scope"; steps: string };

export const releaseFeatures: ReleaseFeature[] = [
  { name: "Landing page", status: "ready", steps: "Open /, verify responsive sections and that primary actions reach sign-in or SOP creation." },
  { name: "Authentication", status: "review", steps: "Sign up, verify email, sign in, reset password, sign out, and confirm protected-route return URLs." },
  { name: "Dashboard and cloud sync", status: "review", steps: "Open /dashboard, verify counts, search/filter, offline status, retry, and cross-browser cloud records." },
  { name: "SOP generation and viewing", status: "review", steps: "Generate from /create, verify loading stages, scores, structured sections, history, cloud save, and fallback behavior." },
  { name: "AI Editor and undo/redo", status: "review", steps: "Edit an entire SOP and one section, verify versions, undo, redo, error recovery, and unchanged sections." },
  { name: "Readiness and smart suggestions", status: "ready", steps: "Type incomplete then detailed input and confirm deterministic live score, warning, and suggestions." },
  { name: "Analytics", status: "ready", steps: "Open /analytics, compare scores and findings with the SOP analytics card, then reanalyze unchanged content." },
  { name: "Compliance, audit exports, and review scheduling", status: "review", steps: "Open /compliance, schedule each interval, apply an AI-fix prompt, and inspect PDF/DOCX reports." },
  { name: "Knowledge Base and grounding", status: "review", steps: "Upload valid TXT/PDF/DOCX, reject malformed files, select sources, generate, and inspect source notes/truncation." },
  { name: "History and versioning", status: "review", steps: "Reopen, rename, compare, restore, delete, clear, and verify both local and cloud modes." },
  { name: "SOP PDF/DOCX/JSON exports", status: "review", steps: "Export short, long, Unicode, empty-list, and long-title SOPs and inspect filenames/page breaks." },
  { name: "Workspace creation", status: "review", steps: "Create a personal and additional workspace, then confirm new SOPs can be organized in the active workspace." },
  { name: "Workspace switching", status: "review", steps: "Switch between owned workspaces and confirm the active selection persists and scopes workspace-aware views." },
  { name: "Workspace ownership", status: "review", steps: "Confirm the owner badge, owner-only rename, and safe non-personal workspace deletion." },
  { name: "Workspace data isolation", status: "review", steps: "Using unrelated accounts, verify workspaces and SOPs cannot be read, updated, or deleted across owners." },
  { name: "No invitation controls", status: "ready", steps: "Inspect workspace, dashboard, header, authentication, and SOP views; no invitation or member-management controls should appear." },
  { name: "Public template marketplace", status: "review", steps: "Browse/search/filter/detail, publish sanitized content, copy, rate, favorite, and verify creator/private boundaries." },
  { name: "Agent metadata and health", status: "ready", steps: "Verify /api/agent and /api/agent/health return 200 without secrets." },
  { name: "Paid agent and x402 mock flow", status: "ready", steps: "Run npm run verify:x402 and confirm 400, 402, mock 200, idempotency, and eip155:1952." },
  { name: "Official X Layer production settlement", status: "limited", steps: "Requires production credentials, supported asset, recipient wallet, eip155:196, custom HTTPS domain, and funded end-to-end test." },
];
