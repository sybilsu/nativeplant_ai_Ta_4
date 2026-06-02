# deployment.md — Step-by-Step Antigravity Build & Netlify Deploy

**Version:** 1.0 — 2026-06-02
**Audience:** Owner (chuan.sybil@gmail.com) — non-engineer-friendly walkthrough.
**Pre-reads:** `spec.md`, `design.md`, `sop.md`.
**Total time estimate:** 90–120 min the first time you do this; ~15 min for subsequent re-builds.

> **Status (2026-06-03):** 植徑 v.2 is already built and **deployed live** at https://nativeplant-ai-ta-4.netlify.app via the Netlify CLI (`netlify deploy --build --prod`). It was scaffolded in Claude Code rather than Antigravity; the walkthrough below is retained as reference / re-build guide. Outstanding owner actions: **(1)** enable git-push auto-deploy (Phase 5 note), **(2)** seed the production Blob (Phase 6.2).

> **Reading rule:** Follow steps **in order**. Don't jump ahead. If a step looks different in your Antigravity version, use the **goal** column on the right to verify you achieved what the step intended, not the exact button names.

---

## Phase 0 — Prerequisites Checklist (10 min)

Before you open Antigravity, confirm you have these. Tick each box.

| ✓ | Item | Why | Where to get |
|---|---|---|---|
| ☐ | A GitHub account | Antigravity pushes the project here; Netlify pulls from here | github.com |
| ☐ | A Netlify account | Hosting + serverless functions + scheduled cron | netlify.com |
| ☐ | The same `ANTHROPIC_API_KEY` you used in Ta_1 | The new app calls Claude same way | already in `Ta_1/.env` |
| ☐ | This repo folder zipped or pushed (so Antigravity can read it) | Antigravity needs `spec.md`, `design.md`, `data/`, `scripts/` | this directory |
| ☐ | Node 20+ installed locally | For previewing the build | nodejs.org |
| ☐ | Antigravity installed | The IDE you're about to use | antigravity.google (or the link you used) |

**If any box is unticked, STOP and resolve it. Don't proceed.**

---

## Phase 1 — Open the Project in Antigravity (5 min)

| Step | Action | Goal / Verify |
|---|---|---|
| 1.1 | Launch Antigravity | The home screen / dashboard opens |
| 1.2 | Click **"Open Folder"** (or equivalent: New Project from Folder) | A file picker appears |
| 1.3 | Select `C:\Users\g1375\web app\nativeplant_ai_Ta_4` | Antigravity loads the folder. You should see `spec.md`, `design.md`, `sop.md`, `data/`, `scripts/`, `taiwan native/` in the file tree. |
| 1.4 | Open the built-in agent / chat panel (look for "Agents" or "Chat") | A text input ready to receive your prompt to the build agent |

**Goal at end of Phase 1:** Antigravity sees your project, you can talk to its build agent.

---

## Phase 2 — Brief the Build Agent (10 min)

Paste this prompt **verbatim** into the agent chat. It tells Antigravity what to build.

```
Build a React 18 + Vite 5 + Tailwind CSS 3 web app named "nativeplant_ai_Ta_4"
inside this folder. Use:

  • spec.md          — full PRD; this is the contract
  • design.md        — iOS frosted glass design system (use these tokens verbatim)
  • sop.md           — algorithm definitions; the scoring logic must match exactly
  • data/plants_enriched.json — the canonical plant dataset, ship with the app
  • taiwan native/*.jpg — plant photos, copy to public/photos/

Constraints (non-negotiable, from spec.md §4.2):
  - ANTHROPIC_API_KEY ONLY in Netlify Functions env, NEVER in client / VITE_*
  - Vision identification + agent calls go through Netlify Functions
  - No analytics, no tracking, no third-party SDKs
  - No user PII storage
  - WCAG AA contrast on all glass surfaces

Deliverables:
  - package.json with scripts: dev, build, preview, netlify:dev
  - netlify.toml configured for functions/, dist/, redirects /api/* → /.netlify/functions/*
  - netlify/functions/identify.js   (Step 1 vision + scoring; reuse scripts/run_step1.mjs logic)
  - netlify/functions/enrich-cron.js (Scheduled, weekly Sunday 03:00 Asia/Taipei)
  - netlify/functions/agent/[name].js with stub for: palette_advisor, ecology_check, sourcing_helper
  - src/ with components per spec.md §7 layout
  - Tailwind config extending design.md tokens
  - README with one-paragraph quickstart

Test plan:
  - Upload experiment/run_01/input.jpg → see Identified list, 灌木/草本/地被 sections, ≥4★ pool match阿里山油菊+青葙
  - Drag 紫 swatch → empty result (matches prototype)
  - Empty 灌木 section shows "目前 DB 25/1000 種" empty state
  - Network inspection: no ANTHROPIC_API_KEY in any client request

When done, run `npm run dev` and report the URL.
```

| Step | Action | Goal / Verify |
|---|---|---|
| 2.1 | Paste prompt above into agent chat | Agent starts scaffolding |
| 2.2 | Watch the build log — Antigravity may ask clarification questions | Answer with: "follow spec.md as-is unless impossible". Resist scope creep. |
| 2.3 | Wait for agent to finish initial build (~5–15 min) | File tree fills with `src/`, `netlify/`, etc. |

**Common Antigravity blockers:**
- If it asks "which animation library?" → answer: **none required; use CSS transitions per design.md §7**
- If it asks "include a header logo image?" → answer: **text logo only, Playfair Display "植徑 v.2"**
- If it asks "user authentication?" → answer: **NO — out of scope per spec.md §8**

---

## Phase 3 — Local Verification (15 min)

Before pushing anything, prove it works locally.

| Step | Action | Goal / Verify |
|---|---|---|
| 3.1 | In Antigravity terminal (or system terminal in this folder): `npm install` | Dependencies install without error |
| 3.2 | Create `.env` if not auto-created: copy from `Ta_4/.env` (which already has the key) | `.env` contains `ANTHROPIC_API_KEY=sk-ant-...` |
| 3.3 | Install Netlify CLI globally if not present: `npm install -g netlify-cli` | `netlify --version` prints a version |
| 3.4 | Run `netlify dev` (this runs Vite + Functions together) | Browser opens to `http://localhost:8888` |
| 3.5 | Drop `experiment/run_01/input.jpg` onto the upload zone | Within ~10s you see the Identified list + a 草本 pool. (Counts may differ slightly from the Sonnet prototype since v1 runs Haiku Vision — see spec.md F1.4.) |
| 3.6 | Open browser DevTools → Network tab → click `/api/identify` request → check that NO `ANTHROPIC_API_KEY` appears in request/response headers or body | Key is never visible client-side |
| 3.7 | Drag the 紫 swatch into the palette tray | "0 / 2 株符合選色" — same as prototype Step 2 result |

**If any step fails:**
- Don't try to fix in Antigravity blindly. Open the relevant file in the editor, find the discrepancy from `spec.md`, ask the agent to align: "Fix `<file>` so that <expected behavior from spec.md §X.Y>".
- If the agent loops, you can manually edit a single file and re-run. Antigravity respects manual edits.

---

## Phase 4 — Push to GitHub (5 min)

| Step | Action | Goal / Verify |
|---|---|---|
| 4.1 | In Antigravity (or terminal): `git init` if not already a repo | `.git/` folder appears |
| 4.2 | Confirm `.gitignore` includes `.env`, `node_modules/`, `dist/`, `experiment/run_*/input.jpg` | (it already does — see `nativeplant_ai_Ta_4/.gitignore`) |
| 4.3 | On github.com, create a new private repo named `nativeplant_ai_Ta_4` | Empty repo with HTTPS URL |
| 4.4 | Run: `git add . && git commit -m "init: Ta_4 from Antigravity build"` then `git branch -M main` then `git remote add origin <url>` then `git push -u origin main` | GitHub shows your code |

---

## Phase 5 — Deploy to Netlify (10 min)

> **Already deployed via CLI.** The steps below (Import from Git) are how you **enable git-push auto-deploy** on the existing site `nativeplant-ai-ta-4` — Site configuration → Build & deploy → Continuous deployment → **Link repository** → GitHub → `sybilsu/nativeplant_ai_Ta_4` → branch `main`. Env vars (Phase 5.3) are already set. Until linked, redeploy with `netlify deploy --build --prod`.

| Step | Action | Goal / Verify |
|---|---|---|
| 5.1 | On netlify.com → **Add new site → Import from Git → GitHub → nativeplant_ai_Ta_4** | Build settings auto-populate |
| 5.2 | Confirm: Build command `npm run build`, Publish directory `dist`, Functions directory `netlify/functions` | Settings match `netlify.toml` |
| 5.3 | Site settings → **Environment variables** → add: `ANTHROPIC_API_KEY=<your key>`, `HAIKU_MODEL=claude-haiku-4-5-20251001` (and `SONNET_MODEL=claude-sonnet-4-6`, currently unused by identify — kept for future Sonnet path) | Env vars listed |
| 5.4 | (Optional but recommended) **Build → Scheduled functions** → confirm `enrich-cron.js` shows up. Set cron to `0 19 * * 0` (Sunday 19:00 UTC = Monday 03:00 Asia/Taipei) | Schedule chip appears |
| 5.5 | Trigger first deploy: **Deploys → Trigger deploy → Deploy site** | Build log shows green ✓ within 3 min |
| 5.6 | Open the assigned URL (e.g., `https://nativeplant-ai-ta-4.netlify.app`) and run the same upload test as Phase 3 | Production matches local behavior |

**If build fails:**
- 99% of the time it's a missing env var or a Node version mismatch. Set `NODE_VERSION=20` in `netlify.toml` or Netlify env vars.

---

## Phase 6 — Verify Scheduled Cron (10 min)

| Step | Action | Goal / Verify |
|---|---|---|
| 6.1 | Netlify dashboard → **Functions → enrich-cron** | Function listed |
| 6.2 | Click **"Trigger run"** to test manually (this also **seeds the production Blob** the first time) | Logs show `{"type":"enrich_cron_done","count":25}` (Haiku re-enrichment → written to Netlify Blobs store `plant-db`) |
| 6.3 | Confirm `/api/db-version` flips from the seed to the Blob copy | JSON changes from `"source":"seed","updated_at":null` to `"source":"blob"` with a real `"updated_at"` timestamp |
| 6.4 | (Wait until Monday 03:00 TPE) confirm cron auto-fired in logs | Function ran without manual trigger |

---

## Phase 7 — OpenClaw Integration (separate path, do AFTER Phase 6 stable)

> **Do NOT do this on the same machine where Ta_1's `.env` lives.** OpenClaw should run in an **isolated VPS / Docker container** per `spec.md` §4.2.

### 7.1 Prepare an isolated host

| Option | Pros | Cons |
|---|---|---|
| Cloudflare Workers + Durable Objects | No server to patch; HMAC verification easy | Limited filesystem |
| DigitalOcean Droplet (US$6/mo) | Full control | Need to patch security updates |
| Docker on home server | Free, isolated | Home IP exposed |

**Recommended for v1:** DigitalOcean Droplet (Ubuntu 24.04, 1 vCPU, 1 GB RAM).

### 7.2 Install OpenClaw on the host

```bash
# On the DigitalOcean droplet (SSH)
curl -fsSL https://openclaw.ai/install.sh | sh
openclaw init --no-skills    # no ClawHub community skills (spec.md §4.2)
openclaw config set telemetry false
openclaw config set memory.long_term.enabled false   # spec.md §3.6 F6.5
```

### 7.3 Configure OpenClaw → Ta_4 webhook bridge

Create `~/.openclaw/skills/talk_to_ta4.yaml`:

```yaml
name: talk_to_ta4
description: Forward user message to Ta_4 agent webhook
inputs:
  - name: user_message
    type: string
  - name: agent
    type: string
    enum: [palette_advisor, ecology_check, sourcing_helper]
action:
  type: http
  url: https://nativeplant-ai-ta-4.netlify.app/api/agent/{{ agent }}
  method: POST
  headers:
    Content-Type: application/json
    X-OpenClaw-Signature: "{{ hmac_sha256(env.SHARED_SECRET, body) }}"
  body:
    user_message: "{{ user_message }}"
    nonce: "{{ now_unix() }}"
```

Set the shared secret on BOTH sides:

```bash
# On the droplet
openclaw env set SHARED_SECRET <generate-with: openssl rand -hex 32>

# On Netlify dashboard, Environment Variables, add the SAME value as:
# OPENCLAW_SHARED_SECRET
```

### 7.4 Connect a single messaging channel (start with LINE)

Per `spec.md` §4.2 — only enable ONE channel to start.

```bash
openclaw channel add line --token <your-line-bot-token>
openclaw channel restart line
```

Send a test message to your LINE bot: "顏色建議:紫粉色系適合搭配什麼台灣原生灌木?" → should route through `talk_to_ta4` → return JSON from `/api/agent/palette_advisor`.

### 7.5 Lock down

```bash
# UFW firewall — only allow inbound from your home IP for SSH
ufw default deny incoming
ufw allow from <your-home-ip> to any port 22
ufw allow 443/tcp
ufw enable

# Disable OpenClaw's default HTTP port unless reverse-proxied behind nginx with TLS
openclaw config set http.bind 127.0.0.1:8080
```

---

## Phase 8 — Maintenance Checklist (monthly)

| ✓ | Task |
|---|---|
| ☐ | Check Anthropic Console: month-to-date spend < $50 |
| ☐ | Netlify dashboard: build deploys green, cron logs no errors |
| ☐ | OpenClaw droplet: `apt update && apt upgrade` |
| ☐ | Rotate `OPENCLAW_SHARED_SECRET` every 90 days |
| ☐ | Review `report.json` (missing-plant feedback) — pick top 10 to add to DB |
| ☐ | Re-run `node scripts/enrich_csv.mjs` after DB changes; commit; push (cron will pick up on next Sunday) |

---

## Troubleshooting

| Symptom | First check | Fix |
|---|---|---|
| `CORS error` | Request URL in Network tab | Use `/api/identify`, never `https://api.anthropic.com/...` directly from client |
| `API key not found` | Netlify env vars panel | Add `ANTHROPIC_API_KEY` to BOTH local `.env` and Netlify Dashboard |
| `Image too large` | Size in console log | Verify client-side compression is running before POST; fallback: server-side sharp |
| identify returns 503 "辨識服務忙線" | Haiku overloaded (429/529) or >12s×2 | Transient — client can resubmit (response carries `retryable:true`). Check anthropic.com/status. |
| Cron didn't fire | Netlify Functions → Scheduled → cron expression | Verify expression is UTC and matches Sunday 19:00 |
| OpenClaw can't reach Ta_4 | OpenClaw logs `talk_to_ta4` | Verify HMAC secret matches both sides; verify TLS cert valid |
| Empty results for valid image | Check `step1_identified.json` from prototype | DB is the bottleneck — see `sop.md` §7. Not a bug. |

---

## What to do AFTER v1 ships (not part of this deployment)

1. **Expand DB to 200 species** — operator-curated CSV expansion. This is the single biggest quality unlock.
2. **Add weak-match (3★) UI** — once `data` shows users hitting empty states often.
3. **Implement `palette_advisor` agent properly** (currently a stub) — Pantone → 12-color mapping with Claude judgment.
4. **Bilingual mode** — English UI for international landscape architects (post-DB expansion).
5. **Multi-image upload** — designer wants to mix references; identify across multiple, pool union.
