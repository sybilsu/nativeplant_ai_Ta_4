# spec.md — nativeplant_ai_Ta_4 PRD (for Antigravity build)

**Version:** 1.0 — 2026-06-02
**Owner:** chuan.sybil@gmail.com
**Reads with:** `sop.md` (algorithm), `design.md` (UI tokens), `deployment.md` (build steps)
**Predecessor:** Ta_1 (https://nativplanaita1.netlify.app/)

---

## 1. Product Vision

A web app where a landscape designer **drops a reference image** of any planting scene → the app identifies the shrub/herb/groundcover plants in the image → recommends **Taiwan native species** that visually match the form/foliage/scale/ornament of the source → user further filters by **dragged color palette** to converge on a planting list they can actually source.

**One-sentence pitch:**
> 給我一張你想模仿的植物畫面,我給你能在台灣種出來、且形態相符的原生候選清單。

**Why this beats Ta_1:** Ta_1 was "identify and substitute one plant at a time" — slow, single-plant focus. Ta_4 is **scene-level form-matching + palette filtering** — closer to how designers actually compose plantings.

---

## 2. Primary User & Stories

**User type:** Landscape architect / designer / horticulture student, comfortable with Chinese plant terminology, working in Taiwan.

**Top user stories:**

1. **As a designer**, I drop a reference photo of a foreign perennial garden, and within 30 seconds get a categorized table of Taiwan native plants whose form mimics the source.
2. **As a designer**, I drag color swatches into a palette tray to narrow the list to species matching my client's color brief — without losing the form similarity.
3. **As a designer**, when the system finds nothing for a category, I clearly see the AI's identification result and a "report this for DB expansion" CTA — so I never feel the tool is broken.
4. **As an operator**, the plant database refreshes weekly without my touching anything — new species get added by a scheduled job, and color/category derived fields stay in sync.
5. **As an operator**, I can talk to specialized agents (color-coordination assistant, ecology-fit advisor, sourcing helper) from one chat interface (OpenClaw) without re-uploading data.

---

## 3. Functional Requirements

### 3.1 Image Upload & Identification (Step 1)

| ID | Requirement |
|---|---|
| F1.1 | Drag-drop or click-upload single image. JPG, PNG, WebP. Up to 10 MB on client (server compresses). |
| F1.2 | Client-side compression to ≤1280px long edge, JPEG q85, before POST. |
| F1.3 | Server-side POST `/api/identify` (multipart `image`) → returns ranked pool JSON. ~10s typical (Haiku Vision); bounded ≤~25s to fit Netlify's synchronous-function limit. |
| F1.4 | Server runs **Haiku 4.5 Vision** (`HAIKU_MODEL`). _v1 reality:_ Sonnet 4.6 Vision empirically needs >16s for this workload and cannot fit Netlify's ~26s synchronous-function limit alongside a fallback, so identify is Haiku-primary (fast, cost-optimal). One retry on transient 408/429/5xx/529 (12s cap each, ≤~25s total); on persistent failure return a friendly retryable 503. Sonnet-quality vision would require moving identify to a background function + client polling (deferred). |
| F1.5 | Identification output includes for each plant: `id, common_name, category, form, foliage, height_estimate_m, spread_estimate_m, ornament, confidence` (per `sop.md` §3.1). NO color in identification output. |
| F1.6 | The full identification list is **always shown to the user**, regardless of whether any DB matches exist. (Transparency rule.) |

### 3.2 Scoring & Pool Generation

| ID | Requirement |
|---|---|
| F2.1 | Scoring is **pure code** (zero LLM cost). Implementation matches `sop.md` §3.2 verbatim. |
| F2.2 | Priority order: 整體型態 (50, hard gate) > 葉形 (30) > 高度/展幅 (15) > 花/果觀賞性 (5). No color in scoring. |
| F2.3 | Three pools surfaced: 灌木 / 草本 / 地被. Within each, sort by score descending. |
| F2.4 | Primary pool = ≥4★ (score ≥ 75). Weak pool = 3★ (60-74), shown only in expandable section labeled "弱匹配". |
| F2.5 | Pool result cached server-side keyed by SHA-256 of (image bytes, DB version, scoring weights). 30-day TTL. Return cached without API call when match. |

### 3.3 Color Palette Filter (Step 2)

| ID | Requirement |
|---|---|
| F3.1 | "Color tray" UI: 12 named swatches (`紅、橙、黃、綠、藍、紫、粉、白、黑、棕、灰、銀`). User drags swatches into a "selected" tray; clicks a swatch in tray to remove. |
| F3.2 | Selected colors form an OR filter on `flower_color ∪ fruit_color` of pool plants. Empty selection = no filter. |
| F3.3 | Filter applies **live** (≤100ms re-render) — pure client-side, no network. |
| F3.4 | Show count "N / M 株符合選色" above results. |
| F3.5 | Optional: Pantone code input (text field) — passed to color-advisor agent (see §5) for soft mapping; **does not affect the deterministic filter**. |

### 3.4 Empty-State / Low-Match Handling (Critical)

| ID | Requirement |
|---|---|
| F4.1 | If a category pool is empty (0 ≥4★), show explicit empty card: "目前 DB X 種,本類別暫無強匹配。" |
| F4.2 | If 3★ matches exist for that category, render a folded "也可以參考(弱匹配)" section with the same card style + ●●●○○ visual + warning border. |
| F4.3 | Show DB progress bar "25 / 1000 種,目標 N 種" sourced from a runtime config endpoint. |
| F4.4 | "回報您要找的植物" button → opens lightweight form (free-text plant name + optional reference URL). NO email, NO image upload, NO IP logging. Writes to private append-only list (Netlify Blobs / Supabase) reviewed offline by operator. |

### 3.5 Database & Enrichment

| ID | Requirement |
|---|---|
| F5.1 | Canonical DB = `taiwan native/2026_植物屬性表.csv` (operator-edited). `enrich_csv.mjs` produces `data/plants_enriched.json`, shipped as the bundled **seed**. Production reads from **Netlify Blobs** first (store `plant-db`, key `enriched`) and falls back to the bundled seed when the Blob is empty. |
| F5.2 | Scheduled function `enrich-cron` re-runs Haiku enrichment weekly (Sun 19:00 UTC = Mon 03:00 Asia/Taipei) and writes the result to Netlify Blobs — Functions have a read-only filesystem, so the writable copy lives in Blobs, not `data/`. See `deployment.md` §5–6. |
| F5.3 | _Deferred (v1 re-runs all rows each cron)._ Target: incremental enrichment — only re-run Haiku extraction on rows whose source NOTES changed since last run (per-row hash). At 25 rows the full re-run is cheap; revisit as the DB grows. |
| F5.4 | DB version stamp (UTC timestamp of last successful enrichment) exposed at `/api/db-version` and shown in app footer. |

### 3.6 OpenClaw Integration (chat UI front-end only)

| ID | Requirement |
|---|---|
| F6.1 | OpenClaw acts purely as a chat front-end. It MUST NOT hold `ANTHROPIC_API_KEY`. |
| F6.2 | OpenClaw → Ta_4 communication uses signed webhook with HMAC-SHA256 shared secret + 30s nonce window. |
| F6.3 | Webhook surface (server side, in Netlify Functions): `/api/agent/<agent-name>` with body `{ user_message, context_ref }` → returns structured JSON response. |
| F6.4 | Image data NEVER passes through OpenClaw. If user uploads via OpenClaw, OpenClaw posts a presigned upload URL to Ta_4, then Ta_4 handles the image directly. |
| F6.5 | No PII in OpenClaw long-term memory (configure memory namespace to allowlist plant-domain terms only, OR disable long-term memory entirely). |

### 3.7 Multi-Agent Architecture (extensible)

The system supports N specialized agents behind a common interface. Initial agents in v1:

| Agent | Role | Model | Has DB access? |
|---|---|---|---|
| `identifier` | Vision identification (Step 1) | Haiku 4.5 (see F1.4) | Read |
| `palette_advisor` | Suggest color palettes from a reference image or Pantone | Haiku 4.5 | Read |
| `ecology_check` | Warn if pool species have ecological conflicts (e.g., overlapping niche, allelopathy) | Haiku 4.5 | Read |
| `sourcing_helper` | Suggest nurseries / research centers for a given species | Haiku 4.5 + web search (whitelisted domains) | Read |

**Architectural rule:** Each agent is a stateless function under `/netlify/functions/agent/<name>.js`. They share a thin orchestration layer (`agentRouter.js`) that handles routing, auth, caching, and rate-limit. New agents are dropped in as new function files — no central registration.

---

## 4. Non-Functional Requirements

### 4.1 Cost Budget (recurring per user query)

| Operation | Target cost | Hard ceiling |
|---|---|---|
| Single identify+score | $0.04 | $0.10 |
| Cache hit (repeat upload) | $0 | $0.001 |
| Weekly DB enrichment (1000 plants) | $0.40 | $1 |
| Multi-agent conversation (5 turns) | $0.05 | $0.20 |

**Monthly budget alarm:** If aggregate API spend exceeds $50/month, post alert to operator email. Configure on Anthropic Console.

### 4.2 Security & Privacy

| Constraint | Implementation |
|---|---|
| `ANTHROPIC_API_KEY` server-only | Only in Netlify env vars. NEVER in `VITE_*` prefix. NEVER in OpenClaw. |
| OpenClaw runs isolated | VPS or Docker container; not on user dev machine. |
| No user PII storage | No email/phone/address collection. Optional "report missing plant" form stores only plant name + free-text context. |
| No telemetry / tracking | No Google Analytics, no Hotjar, no Sentry user data. Server-side error logs scrubbed of user content. |
| No 3rd-party uploads | Images stay within Netlify Functions runtime; never sent to external image hosts. |
| ClawHub Skills | Forbidden in production. Operator-written skills only. |
| Skill capabilities | No `exec`, no shell, no auto-tool-creation. Declarative skill manifest only. |
| Webhook auth | HMAC-SHA256 shared secret; rotate every 90 days. IP allowlist for OpenClaw VPS. |
| Audit | All `/api/agent/*` calls logged (no payload) to operator-only console for 90 days. |

### 4.3 Performance

| Metric | Target |
|---|---|
| Upload → identification UI render | p95 ≤ 6s, p99 ≤ 12s |
| Color palette filter re-render | ≤ 100ms |
| Page first paint | ≤ 1.5s on 3G |
| Bundle size (gzipped) | ≤ 250 KB JS |

### 4.4 Accessibility

- All buttons have `aria-label`; images have `alt`.
- Color palette UI MUST have text labels next to swatches (color-blind users can't drag by hue alone).
- Keyboard-only navigation works end-to-end.
- WCAG AA contrast on glass surfaces — see `design.md` §4 contrast rules.

---

## 5. Data Model

```typescript
// Canonical enriched plant record (data/plants_enriched.json)
interface Plant {
  "NO.": string;                            // "01"
  "Photo (植物圖)": string;                  // "台灣馬醉木.jpg"
  "Name (中文名/學名)": string;              // "台灣馬醉木 / Pieris taiwanensis Hayata"
  "Role (角色)": "Structure" | "Primary" | "Filler" | "Ground cover";
  "HEIGHT (高度)": string;                  // "1-2m"
  "SPREAD (展幅)": string;
  "N/m² (株數)": string;
  "FOLIAGE (葉形)": string;
  "FLW SEASON (花期)": string;
  "STRUCT INT (結構期)": string;
  "LONGEVITY (壽命)": "Shrub" | "Annual" | "Perennial";
  "SPREADING (蔓延)": string;
  "PERSIST (持久)": string;
  "SELF-SOW (自播)": string;
  "LIGHT (光照)": string;
  "SOIL (土壤)": string;
  "ZONE (耐寒)": string;
  "NOTES (備註)": string;

  // Phase A enriched
  category: "灌木" | "草本" | "地被";
  flower_color: ColorTag[];
  leaf_color: ColorTag[];
  fruit_color: ColorTag[];
}

type ColorTag = "紅"|"橙"|"黃"|"綠"|"藍"|"紫"|"粉"|"白"|"黑"|"棕"|"灰"|"銀";
```

```typescript
// Pool returned to UI after Step 1
interface RankedPool {
  db_version: string;          // ISO timestamp
  identified: IdentifiedPlant[];
  pool: {
    灌木: Match[];
    草本: Match[];
    地被: Match[];
  };
  weak_pool: { 灌木: Match[]; 草本: Match[]; 地被: Match[] };  // 3★
  empty_categories: string[];  // for UI empty-state rendering
}

interface Match {
  db_name: string;
  db_latin: string;
  db_photo: string;            // filename in /taiwan native/
  score: number;
  stars: 1|2|3|4|5;
  matched_input: string;       // "P1", "P3", ...
  breakdown: { category: number; foliage: number; height: number; spread: number; ornament: number };
  flower_color: ColorTag[];
  leaf_color: ColorTag[];
  fruit_color: ColorTag[];
}
```

---

## 6. API Surface (Netlify Functions)

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/identify` | POST (multipart or base64) | none (rate-limited by IP) | Run Step 1 pipeline. Returns RankedPool. |
| `/api/db-version` | GET | none | Latest enrichment timestamp + count. |
| `/api/agent/<name>` | POST | HMAC-SHA256 | OpenClaw → Ta_4 agent invocation. |
| `/api/report` | POST | rate-limited | "Plant not found" feedback form. |
| `enrich-cron` (scheduled fn, not public HTTP) | — | Netlify scheduler | Weekly Phase A re-run → writes Blobs. Manual: dashboard "Functions → enrich-cron → Trigger run". |

**Rate limits:** 60 req/min per IP on `/api/identify` and `/api/report`. Burst: 10.

---

## 7. Routing & Layout (high level)

```
Page         / (single-page, no client router needed in v1)
├── <Header />                  # logo, DB-version chip, "new query" button
├── <UploadDropzone />          # drag-drop + click
├── <IdentifiedList />          # always visible after upload (transparency)
├── <ColorTray />               # 12 swatches + selected palette
├── <PoolByCategory />          # 灌木 / 草本 / 地被 tabs OR stacked sections
│     ├── <PlantCard />         # ≥4★, frosted glass card
│     └── <WeakMatchAccordion>  # 3★, folded by default
├── <EmptyStateActions />       # progress, report button
└── <Footer />                  # version, no analytics
```

Design details for each component in `design.md`.

---

## 8. Out-of-Scope (v1)

- User accounts / login
- Saving query history (anonymous single-session only)
- Mobile app (responsive web is fine)
- Multi-language (繁體中文 + 拉丁學名 only)
- Embedded e-commerce / nursery booking
- Crowd-sourced DB edits by end users (operator-curated only)
- Auto-translating European plant names to Taiwanese names beyond what Vision provides

---

## 9. Success Criteria (definition of done for v1)

1. ✅ Upload any planting image → see categorized Taiwan native pool within 10s p95.
2. ✅ Drag 1+ color swatches → live filter works on client.
3. ✅ Empty state always shows (a) AI identification (b) DB progress (c) report button.
4. ✅ Weekly cron successfully re-enriches DB; version stamp updates.
5. ✅ OpenClaw can invoke `/api/agent/palette_advisor` and `/api/agent/sourcing_helper` via signed webhook; receives structured JSON within 5s p95.
6. ✅ End-to-end zero `ANTHROPIC_API_KEY` exposure to client or OpenClaw (verified by network inspection + OpenClaw config audit).
7. ✅ All 5 prototype runs (`experiment/run_01–05`) reproducible from current `plants_enriched.json` — i.e., production scoring matches prototype.

---

## 10. Open Questions for Antigravity Build (resolve before coding)

| # | Question | Default if unresolved |
|---|---|---|
| Q1 | Use Netlify Blobs or Supabase for cache + report storage? | Netlify Blobs (lower ops) |
| Q2 | Color swatch component: build from scratch or `@dnd-kit`? | `@dnd-kit` (mature, a11y-friendly) |
| Q3 | Image compression: client-side (`browser-image-compression`) or server-side (sharp)? | Client-side (saves bandwidth) |
| Q4 | OpenClaw deployment target VPS? | Cloudflare Workers? — confirm with operator |
| Q5 | DB expansion path: manual operator-edit CSV vs scraper? | Manual edit + reviewed PRs (safer, slower) |
