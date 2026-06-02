# SOP — nativeplant_ai_Ta_4 Image-to-Native-Plant Matching Pipeline

**Version:** 1.0 (2026-06-02, based on 5-run prototype)
**Owner:** chuan.sybil@gmail.com
**Status:** Prototype validated. Production build pending in Antigravity (Step 5).

---

## 1. Pipeline Overview

```
┌─ Input ─────────────┐    ┌─ Phase A (one-time) ───────────┐
│ 1 reference image   │    │ Plant DB CSV  → enrich (Haiku)  │
│ (JPG/PNG/WebP ≤5MB) │    │   add: category, flower_color,  │
└──────────┬──────────┘    │        leaf_color, fruit_color  │
           │               └────────────────┬────────────────┘
           ▼                                ▼
┌─ Step 1: Identify + Score ───────────────────────────────┐
│  1.1  Resize image to ≤1280px long edge (if >2MB)        │
│  1.2  Sonnet 4.6 Vision → identify shrub/herb/groundcover│
│  1.3  Pure-code scoring per priority:                    │
│         ① category match (gate) 50 pts                    │
│         ② foliage Jaccard       30 pts                    │
│         ③ height/spread overlap 15 pts                    │
│         ④ ornament Jaccard       5 pts                    │
│  1.4  Filter ≥75 pts (4★) → ranked pool by category       │
└──────────────────────┬───────────────────────────────────┘
                       ▼
┌─ Step 2: Color Filter (per user selection) ──────────────┐
│  Pure-code filter:                                        │
│  shortlist = pool.filter(p =>                             │
│    p.flower_color OR p.fruit_color ∋ chosen_colors)       │
└───────────────────────────────────────────────────────────┘
```

**Design principles:**
- Rule 5 applied: LLM only for judgment (color extraction, vision identification). Scoring/filtering are deterministic code.
- Two-phase enrichment: Phase A runs once per DB version; Step 1/2 run per user query.

---

## 2. Phase A — DB Enrichment (one-time per DB version)

**Script:** `scripts/enrich_csv.mjs`
**Model:** Haiku 4.5 (`claude-haiku-4-5-20251001`)
**Cost:** ~$0.01 per 25 plants (~$0.40 for target 1000)
**Idempotent:** Yes — re-run when CSV changes.

**Procedure:**
1. Read `taiwan native/2026_植物屬性表.csv`
2. For each row:
   - Derive `category` deterministically: `Role=="Ground cover"` → 地被; `LONGEVITY=="Shrub"` → 灌木; else → 草本
   - Call Haiku with FOLIAGE+FLW SEASON+STRUCT INT+NOTES → extract `flower_color`, `leaf_color`, `fruit_color` as arrays of normalized 12-color vocabulary
3. Write `data/plants_enriched.csv` and `.json`

**Normalized color vocabulary:**
`紅、橙、黃、綠、藍、紫、粉、白、黑、棕、灰、銀`

**Decomposition rules:** 紫紅→[紫,紅]; 粉紅→[粉,紅]; 銀白→[銀,白]; 桃紅→[粉,紅]; 淡紫→[紫]; 灰綠→[灰,綠]

### 2.1 Measured colors (colorimeter → Pantone) — overrides the Haiku guess

The Haiku color in §2 is a fallback. When the operator measures a real color, that
value is **ground truth**: it maps deterministically to the 12-vocab (no LLM) and the
field skips Haiku (more accurate + cheaper). Logic in `lib/pantone.mjs`
(`hexToVocab` = nearest of 12 by CIELAB ΔE).

**Edit file:** `data/color_overrides.csv` — pre-seeded with all species names, one row each.
Open in Excel/any editor. Columns:

| name | flower_hex | flower_pantone | fruit_hex | fruit_pantone | leaf_hex | leaf_pantone |
|---|---|---|---|---|---|---|
| 野牡丹 | `#9B5FA6` | PANTONE 2080C | | | `#3C6B3E` | |

**Procedure:**
1. Measure flower/fruit/leaf with the colorimeter → record the **sRGB HEX** (and the
   Pantone code if you want it shown as a label).
2. Fill the relevant cell(s) for that species. Leave blank = keep the Haiku guess for
   that field. HEX is required for the mapping — a Pantone code alone is **not**
   convertible (no open Pantone→RGB table; the lookup in `lib/pantone.mjs` is empty
   by design).
3. Commit + deploy, then **Functions → enrich-cron → Trigger run** (or wait for the
   Sunday cron). Filled fields now render their true measured color in the card and
   stop costing a Haiku call.

**Caveat:** the 12 buckets are coarse at vivid/edge hues (hot-pink→紅, indigo→紫) because
the vocab swatches are muted. Fine for typical flower colors; if a bucket feels wrong,
tune `VOCAB_HEX` in `lib/pantone.mjs` **and** `COLOR_VOCAB` in `src/components/ColorTray.jsx`
together (they must match).

---

## 3. Step 1 — Image Identification + Scoring

**Script:** `scripts/run_step1.mjs`
**Models:** Sonnet 4.6 (preferred) → Haiku 4.5 (fallback on overload / cost-saver)
**Cost per run:** Sonnet ~$0.03–0.04; Haiku ~$0.02
**Retry:** 4 attempts, exponential backoff (5s / 15s / 45s) on 408/429/500/502/503/504/529

> **Production differs from this CLI prototype.** The deployed `/api/identify` Netlify function is **Haiku-primary** with a 12s × 2 bounded retry — Sonnet Vision exceeds Netlify's ~26s synchronous-function limit (see spec.md F1.4). This section documents the offline experiment script, which has no such limit and may use Sonnet.

### 3.1 Vision identification prompt (verbatim — must NOT mention color)

```
分析這張植物景觀照片,辨識其中可見的「灌木」、「草本」、「地被」三類植物。
排除:喬木、大樹、草坪草、苔蘚、無植物物件。

對每株(或每群明顯獨立的)植物輸出 JSON,欄位:
- id, common_name, category, form, foliage,
  height_estimate_m: [min,max], spread_estimate_m: [min,max],
  ornament (花/果觀賞,只描述形態與季節,不要顏色),
  confidence: 高/中/低
```

### 3.2 Scoring (pure code, priority-weighted)

| Priority | Dimension | Weight | Method |
|---|---|---|---|
| 1 | 整體型態 (category match) | 50 (hard gate) | Exact string match; mismatch → discard pair |
| 2 | 葉形 (foliage) | 30 | Jaccard over 27 leaf-shape keywords |
| 3 | 高度 + 展幅 | 15 (10+5) | Numeric range overlap ratio |
| 4 | 花/果觀賞性 | 5 | Jaccard over 26 ornament keywords (season + form, NO color) |

**Star mapping:** 90+ → ★★★★★; 75–89 → ★★★★; 60–74 → ★★★; 40–59 → ★★; <40 → ★

**Dedup:** Across multiple input plants, keep MAX score per DB plant within each category.

**Output:** ≥4★ only into the pool. 3★ stays in raw JSON for UI's "弱匹配" expandable section.

### 3.3 Output files

```
experiment/run_NN/
├── input.jpg                  # may be resized
├── step1_identified.json      # raw Vision output
├── step1_ranked_pool.json     # scored + filtered pool
└── step1_ranked_pool.md       # human-readable
```

---

## 4. Step 2 — Color Filter

**Pure code.** No LLM call.

```
shortlist[cat] = pool[cat].filter(p =>
  [...p.flower_color, ...p.fruit_color].some(c => chosen_colors.includes(c))
)
```

**UI (in production app):** drag-drop color swatches → user composes a color palette → filter applies live. See `design.md` §3.4.

**Output:** `experiment/run_NN/step2_<color>_shortlist.md` (prototype filters hardcoded "紫"; production accepts arbitrary palette).

---

## 5. Empty-State Handling (critical UX rule)

**When pool[cat].length === 0 for some cat, OR all categories empty:**

1. **Layer 1 — always show AI identification result.** Never blackbox. User must see what AI saw.
2. **Layer 2 — show 主推薦 (≥4★)** if any.
3. **Layer 3 — expandable 弱匹配 (3★ from raw JSON)** labeled "品質警告".
4. **Layer 4 — action box:**
   - 進度條:「DB N/1000 種」
   - 按鈕:「回報您要找的植物」(no PII — just plant name / context tag)
   - 按鈕:「改用相近風格推薦」(future: cross-category soft match)

**Rules:**
- Never auto-promote 3★ to ≥4★. Hard separation.
- Never hide identification even on full miss.

---

## 6. Cost Discipline (model selection cheat sheet)

| Task | Model | $/M in | $/M out | Why |
|---|---|---|---|---|
| CSV color enrichment (one-shot) | Haiku 4.5 | $1 | $5 | Structured extraction from short text |
| Image identification — **production** (per query) | Haiku 4.5 | $1 | $5 | Sonnet can't fit Netlify's ~26s sync limit; Haiku is fast + cost-optimal (~6 plants/call) |
| Image identification — offline CLI / future background fn | Sonnet 4.6 | $3 | $15 | Higher accuracy (~12 plants/call); only where there is no function timeout |
| Scoring | none (code) | — | — | Deterministic |
| Color filter | none (code) | — | — | Deterministic |
| Documents / SOP refresh | Opus 4.7 | $15 | $75 | Use sparingly. Once per major spec revision. |

**Per-user query budget target:** ≤ $0.02 (1 Haiku vision call, production). 1000 queries/month ≈ $20. (A Sonnet path would be ~$0.05/query ≈ $50/mo.)

**Hardening for production:**
- Image compression before send (long-edge ≤1280px) → ~50% token savings on vision
- Cache identified-plant JSON keyed by image hash → repeat uploads = 0 API
- Cache pool JSON keyed by (image hash, DB version) → fully deterministic, 0 API for return visits

---

## 7. Prototype Findings (5-run experiment, 2026-06-02)

| Run | Model | Identified | 4★ pool size | Style observed |
|---|---|---|---|---|
| 01 | Sonnet 4.6 | 15 | 2 | UK/European perennial garden |
| 02 | Sonnet 4.6 | 10 | 1 | European meadow with grasses + Aconitum |
| 03 | Haiku 4.5 (Sonnet 529) | 6 | 1 | Mixed perennial with grasses |
| 04 | Haiku 4.5 | 7 | 1 | European cottage with Allium + Digitalis |
| 05 | Haiku 4.5 | 6 | 1 | Modern building with shrub planting |

**Total API cost:** ~$0.11
**Recurring matches:** 青葙 (3×), 阿里山油菊 (1×), 台灣金絲桃 (1×), 麥門冬 (1×). 青葙 is the universal fallback for linear/lanceolate herb forms.

**Critical conclusion:** Algorithm works. **25-plant DB is the bottleneck.** Production needs DB expansion to ≥200 species before this tool is useful for general landscape design queries.

**Sub-findings:**
- Sonnet identifies ~2× more plants per image than Haiku (12.5 vs 6.3 avg). _However, production runs Haiku_ — Sonnet Vision exceeds Netlify's ~26s synchronous-function limit (see spec.md F1.4); a Sonnet path would need a background function. Acceptable for now since the 25-species DB is the real bottleneck.
- European garden styles produce low match rates against Taiwan native DB — expected, by design.
- Image 5 (modern Taiwanese-style planting) produced higher DB hit rate per identified plant.
- Vision models occasionally mis-categorize shrubs vs trees (run_05 included 白千層/蒲葵 as 喬木). Script filters silently — acceptable, but log for QA.

---

## 8. Repeatable Run Procedure (manual / cron)

```bash
# One-time setup
cd nativeplant_ai_Ta_4
node scripts/enrich_csv.mjs

# Per-image experiment
cp <source.jpg> experiment/run_NN/input.jpg
node scripts/run_step1.mjs NN
# → outputs: step1_identified.json, step1_ranked_pool.{json,md}, step2_*_shortlist.md

# To use Haiku instead of Sonnet (for cost or fallback):
SONNET_MODEL=claude-haiku-4-5-20251001 node scripts/run_step1.mjs NN
```

For automated periodic DB refresh, wrap `enrich_csv.mjs` in a Netlify Scheduled Function (see `deployment.md` §5).
