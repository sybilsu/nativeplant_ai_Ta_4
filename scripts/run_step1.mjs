// Phase B: per-run Step 1 (Vision identify + score) + Step 2 (purple filter).
//
// Usage: node scripts/run_step1.mjs <run_number>
//   e.g. node scripts/run_step1.mjs 1
//
// Reads:   experiment/run_NN/input.jpg
//          data/plants_enriched.json
// Writes:  experiment/run_NN/step1_identified.json     (Sonnet Vision output)
//          experiment/run_NN/step1_ranked_pool.json    (scored ≥4★ pool)
//          experiment/run_NN/step1_ranked_pool.md      (human-readable)
//          experiment/run_NN/step2_purple_shortlist.md (Step 2 result)
//
// Cost model: ONE Sonnet vision call per run. All scoring is pure code.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

async function loadEnv() {
  const raw = await readFile(resolve(ROOT, ".env"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; // CLI env wins
  }
}

const VISION_PROMPT = `分析這張植物景觀照片,辨識其中可見的「灌木」、「草本」、「地被」三類植物。
排除:喬木、大樹、草坪草、苔蘚、無植物物件。

對每株(或每群明顯獨立的)植物輸出一個 JSON 物件,欄位:
- id: "P1", "P2", ...
- common_name: 若可確認則填台灣慣用中文名;不確定時填 "未明_<簡短形態描述>"
- category: "灌木" | "草本" | "地被"
- form: 整體型態 (例:「叢生灌木」「直立草本」「匍匐地被」「蔓延灌木」「攀緣藤本」)
- foliage: 葉形,使用標準植物學詞彙 (披針形/橢圓形/卵形/線形/羽狀複葉/掌狀複葉/革質/對生/互生/全緣/鋸齒緣 等可組合)
- height_estimate_m: [min, max] 估算高度範圍
- spread_estimate_m: [min, max] 估算單株展幅範圍
- ornament: 花/果觀賞性,只描述形態與季節,**不要描述顏色** (例如「夏季穗狀花序」「秋季漿果」)。沒看到花果寫 "觀葉"
- confidence: "高" | "中" | "低"

只輸出 JSON,結構:
{"identified": [...]}`;

async function callSonnetVision(imagePath, apiKey, model) {
  const buf = await readFile(imagePath);
  const b64 = buf.toString("base64");
  // Detect by magic bytes — filename ext can lie when png was renamed .jpg
  let ext = "jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) ext = "png";
  else if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) ext = "gif";
  else if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[8] === 0x57) ext = "webp";

  const body = JSON.stringify({
    model,
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: `image/${ext}`, data: b64 } },
          { type: "text", text: VISION_PROMPT },
        ],
      },
    ],
  });

  const RETRYABLE = new Set([408, 429, 500, 502, 503, 504, 529]);
  const delays = [5000, 15000, 45000]; // backoff for attempts 1, 2, 3
  let lastErr;
  for (let attempt = 0; attempt < delays.length + 1; attempt++) {
    if (attempt > 0) {
      const wait = delays[attempt - 1];
      console.log(`  ↻ retry ${attempt}/${delays.length} after ${wait / 1000}s ...`);
      await new Promise((r) => setTimeout(r, wait));
    }
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body,
    });
    if (res.ok) {
      const data = await res.json();
      const text = data.content[0].text.trim();
      const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
      return { json: JSON.parse(cleaned), usage: data.usage };
    }
    const errBody = await res.text();
    lastErr = new Error(`Vision API ${res.status}: ${errBody}`);
    if (!RETRYABLE.has(res.status)) throw lastErr;
  }
  throw lastErr;
}

// ─── Scoring (pure code, no LLM) ────────────────────────────────────────────

const FOLIAGE_KW = [
  "披針", "橢圓", "卵", "線形", "圓", "心形", "掌狀", "羽狀", "腎", "楔",
  "球", "針", "革質", "膜質", "肉質", "紙質", "對生", "互生", "輪生", "基生",
  "叢生", "複葉", "全緣", "鋸齒", "深裂", "三出", "摺扇",
];

const ORNAMENT_KW = [
  "春", "夏", "秋", "冬", "穗狀", "頭狀", "繖狀", "單花", "花穗", "蒴果",
  "漿果", "核果", "莢果", "球果", "5瓣", "管狀", "唇形", "蝶形", "輪繖",
  "螺旋", "風車", "壺形", "宿存萼", "宿存", "觀葉", "觀果",
];

function tokensIn(text, kws) {
  if (!text) return new Set();
  return new Set(kws.filter((k) => text.includes(k)));
}

function jaccard(a, b) {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const uni = a.size + b.size - inter;
  return uni === 0 ? 0 : inter / uni;
}

function parseRange(str) {
  if (!str) return null;
  // first numeric range; e.g. "0.3-0.6m (地被)/3-6m (攀緣)" → [0.3, 0.6]
  const m = str.match(/([\d.]+)\s*[-–]\s*([\d.]+)/);
  return m ? [parseFloat(m[1]), parseFloat(m[2])] : null;
}

function rangeOverlap(a, b) {
  if (!a || !b) return 0;
  const lo = Math.max(a[0], b[0]);
  const hi = Math.min(a[1], b[1]);
  if (hi < lo) return 0;
  const uniLo = Math.min(a[0], b[0]);
  const uniHi = Math.max(a[1], b[1]);
  if (uniHi - uniLo === 0) return 1;
  return (hi - lo) / (uniHi - uniLo);
}

function scorePair(input, db) {
  // Strict category gate (Priority 1, weight 50)
  if (input.category !== db.category) return null;

  // Foliage similarity (Priority 2, weight 30)
  const fSim = jaccard(
    tokensIn(input.foliage, FOLIAGE_KW),
    tokensIn(db["FOLIAGE (葉形)"], FOLIAGE_KW),
  );

  // Height + spread overlap (Priority 3, weight 15: 10 for height, 5 for spread)
  const dbH = parseRange(db["HEIGHT (高度)"]);
  const dbS = parseRange(db["SPREAD (展幅)"]);
  const hOv = rangeOverlap(input.height_estimate_m, dbH);
  const sOv = rangeOverlap(input.spread_estimate_m, dbS);

  // Ornament similarity (Priority 4, weight 5)
  const oSim = jaccard(
    tokensIn(input.ornament, ORNAMENT_KW),
    tokensIn(`${db["FLW SEASON (花期)"]} ${db["STRUCT INT (結構期)"]}`, ORNAMENT_KW),
  );

  const score = 50 + fSim * 30 + hOv * 10 + sOv * 5 + oSim * 5;
  return {
    score: Math.round(score * 10) / 10,
    breakdown: { category: 50, foliage: +(fSim * 30).toFixed(1), height: +(hOv * 10).toFixed(1), spread: +(sOv * 5).toFixed(1), ornament: +(oSim * 5).toFixed(1) },
  };
}

function starsOf(s) {
  if (s >= 90) return 5;
  if (s >= 75) return 4;
  if (s >= 60) return 3;
  if (s >= 40) return 2;
  return 1;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const runNum = process.argv[2];
  if (!runNum) throw new Error("Usage: node scripts/run_step1.mjs <run_number>");
  const padded = String(runNum).padStart(2, "0");
  const runDir = resolve(ROOT, `experiment/run_${padded}`);
  const inputImage = resolve(runDir, "input.jpg");

  await loadEnv();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.SONNET_MODEL || "claude-sonnet-4-6";
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  // 1. Vision: identify plants
  console.log(`[run_${padded}] Calling ${model} Vision on ${inputImage} ...`);
  const { json: identified, usage } = await callSonnetVision(inputImage, apiKey, model);
  await writeFile(resolve(runDir, "step1_identified.json"), JSON.stringify(identified, null, 2), "utf8");
  console.log(`  → identified ${identified.identified.length} plants. tokens: in=${usage.input_tokens} out=${usage.output_tokens}`);

  // 2. Load enriched DB
  const db = JSON.parse(await readFile(resolve(ROOT, "data/plants_enriched.json"), "utf8"));

  // 3. Score: for each identified plant, score against DB plants in same category.
  //    Aggregate by DB plant (max score across input plants).
  const byCategory = { 灌木: new Map(), 草本: new Map(), 地被: new Map() };
  for (const inp of identified.identified) {
    if (!byCategory[inp.category]) continue;
    for (const d of db) {
      const r = scorePair(inp, d);
      if (!r) continue;
      const dbName = d["Name (中文名/學名)"].split(" / ")[0];
      const prev = byCategory[inp.category].get(dbName);
      if (!prev || r.score > prev.score) {
        byCategory[inp.category].set(dbName, {
          db_name: dbName,
          db_latin: d["Name (中文名/學名)"].split(" / ")[1] || "",
          db_photo: d["Photo (植物圖)"],
          db_role: d["Role (角色)"],
          db_foliage: d["FOLIAGE (葉形)"],
          db_height: d["HEIGHT (高度)"],
          db_spread: d["SPREAD (展幅)"],
          db_flw_season: d["FLW SEASON (花期)"],
          db_struct_int: d["STRUCT INT (結構期)"],
          flower_color: d.flower_color,
          leaf_color: d.leaf_color,
          fruit_color: d.fruit_color,
          score: r.score,
          stars: starsOf(r.score),
          matched_input: inp.id,
          breakdown: r.breakdown,
        });
      }
    }
  }

  // 4. Filter ≥4★, sort by score desc within category
  const pool = {};
  for (const cat of ["灌木", "草本", "地被"]) {
    pool[cat] = [...byCategory[cat].values()]
      .filter((x) => x.stars >= 4)
      .sort((a, b) => b.score - a.score);
  }

  await writeFile(
    resolve(runDir, "step1_ranked_pool.json"),
    JSON.stringify({ run: `run_${padded}`, identified_input_count: identified.identified.length, pool }, null, 2),
    "utf8",
  );

  // 5. Human-readable MD
  const md = [];
  md.push(`# Step 1 — run_${padded} ranked pool (≥4★)\n`);
  md.push(`**Input image identification (Sonnet Vision):** ${identified.identified.length} plants\n`);
  md.push(`\n| ID | 名稱 | 類別 | 型態 | 葉形 | 高度 m | 展幅 m | 觀賞 |\n|---|---|---|---|---|---|---|---|`);
  for (const p of identified.identified) {
    md.push(`| ${p.id} | ${p.common_name} | ${p.category} | ${p.form} | ${p.foliage} | ${p.height_estimate_m.join("-")} | ${p.spread_estimate_m.join("-")} | ${p.ornament} |`);
  }
  md.push(`\n---\n`);
  for (const cat of ["灌木", "草本", "地被"]) {
    md.push(`\n## ${cat} (${pool[cat].length} 筆 ≥4★)\n`);
    if (pool[cat].length === 0) { md.push(`_(無)_\n`); continue; }
    md.push(`| 植物 | 學名 | 分數 | ★ | 葉形 (DB) | 高度 | 觀賞 (DB) | 配對來源 |`);
    md.push(`|---|---|---|---|---|---|---|---|`);
    for (const p of pool[cat]) {
      md.push(`| ${p.db_name} | *${p.db_latin}* | ${p.score} | ${"●".repeat(p.stars)}${"○".repeat(5 - p.stars)} | ${p.db_foliage} | ${p.db_height} | ${p.db_struct_int} | ${p.matched_input} |`);
    }
  }
  md.push(`\n---\n_Cost note: 1 Sonnet vision call (~$${((usage.input_tokens * 3 + usage.output_tokens * 15) / 1e6).toFixed(4)}). Scoring: pure code._\n`);
  await writeFile(resolve(runDir, "step1_ranked_pool.md"), md.join("\n"), "utf8");

  // 6. Step 2 purple filter
  const purpleMd = [`# Step 2 — run_${padded} 紫色 shortlist (from Step 1 ≥4★ pool)\n`];
  for (const cat of ["灌木", "草本", "地被"]) {
    const purple = pool[cat].filter((p) =>
      [...p.flower_color, ...p.fruit_color].includes("紫"),
    );
    purpleMd.push(`\n## ${cat} (${purple.length} 筆含紫色)\n`);
    if (purple.length === 0) { purpleMd.push(`_(無)_\n`); continue; }
    purpleMd.push(`| 植物 | ★ | 花色 | 果色 | 葉色 |`);
    purpleMd.push(`|---|---|---|---|---|`);
    for (const p of purple) {
      purpleMd.push(`| ${p.db_name} | ${"●".repeat(p.stars)}${"○".repeat(5 - p.stars)} | ${p.flower_color.join("、")} | ${p.fruit_color.join("、") || "—"} | ${p.leaf_color.join("、")} |`);
    }
  }
  await writeFile(resolve(runDir, "step2_purple_shortlist.md"), purpleMd.join("\n"), "utf8");

  // Console summary
  console.log(`\n✓ Step 1 pool: 灌木=${pool["灌木"].length} 草本=${pool["草本"].length} 地被=${pool["地被"].length}`);
  console.log(`✓ Written: step1_identified.json, step1_ranked_pool.{json,md}, step2_purple_shortlist.md`);
}

main().catch((e) => { console.error(e); process.exit(1); });
