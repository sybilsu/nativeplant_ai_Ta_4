// POST /api/identify  (multipart form with `image` file)
// 1) Sonnet 4.6 Vision identifies shrub/herb/groundcover plants in the image.
// 2) Pure-code scoring against enriched DB per spec.md §3.2 priorities.
// 3) Returns { identified, pool, weak_pool, db_count, db_version, model }
//
// Cost: ~$0.03–0.04 per call (Sonnet) or ~$0.02 (Haiku fallback on 529).

import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Cached DB load (Netlify reuses function instances within an invocation lifecycle)
let _dbCache = null;
async function loadDb() {
  if (_dbCache) return _dbCache;
  const candidates = [
    resolve(__dirname, "../../data/plants_enriched.json"),
    resolve(process.cwd(), "data/plants_enriched.json"),
  ];
  for (const p of candidates) {
    try {
      const raw = await readFile(p, "utf-8");
      const s = await stat(p);
      _dbCache = {
        db: JSON.parse(raw),
        version: s.mtime.toISOString().slice(0, 10),
      };
      return _dbCache;
    } catch {
      /* try next */
    }
  }
  throw new Error("plants_enriched.json not found");
}

const VISION_PROMPT = `分析這張植物景觀照片,辨識其中可見的「灌木」、「草本」、「地被」三類植物。
排除:喬木、大樹、草坪草、苔蘚、無植物物件。

對每株(或每群明顯獨立的)植物輸出 JSON,欄位:
- id: "P1", "P2", ...
- common_name: 若可確認則填台灣慣用中文名;不確定時填 "未明_<簡短形態描述>"
- category: "灌木" | "草本" | "地被"
- form: 整體型態
- foliage: 葉形,使用標準植物學詞彙
- height_estimate_m: [min, max]
- spread_estimate_m: [min, max]
- ornament: 花/果觀賞性,只描述形態與季節,**不要描述顏色**;沒看到花果寫 "觀葉"
- confidence: "高" | "中" | "低"

只輸出 JSON,結構: {"identified": [...]}`;

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
  if (input.category !== db.category) return null;
  const fSim = jaccard(
    tokensIn(input.foliage, FOLIAGE_KW),
    tokensIn(db["FOLIAGE (葉形)"], FOLIAGE_KW),
  );
  const dbH = parseRange(db["HEIGHT (高度)"]);
  const dbS = parseRange(db["SPREAD (展幅)"]);
  const hOv = rangeOverlap(input.height_estimate_m, dbH);
  const sOv = rangeOverlap(input.spread_estimate_m, dbS);
  const oSim = jaccard(
    tokensIn(input.ornament, ORNAMENT_KW),
    tokensIn(
      `${db["FLW SEASON (花期)"]} ${db["STRUCT INT (結構期)"]}`,
      ORNAMENT_KW,
    ),
  );
  const score = 50 + fSim * 30 + hOv * 10 + sOv * 5 + oSim * 5;
  return {
    score: Math.round(score * 10) / 10,
    breakdown: {
      category: 50,
      foliage: +(fSim * 30).toFixed(1),
      height: +(hOv * 10).toFixed(1),
      spread: +(sOv * 5).toFixed(1),
      ornament: +(oSim * 5).toFixed(1),
    },
  };
}
function starsOf(s) {
  if (s >= 90) return 5;
  if (s >= 75) return 4;
  if (s >= 60) return 3;
  if (s >= 40) return 2;
  return 1;
}

function detectMime(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[8] === 0x57) return "image/webp";
  return "image/jpeg";
}

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504, 529]);

async function callVision(b64, mediaType, apiKey, model) {
  const body = JSON.stringify({
    model,
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: b64 } },
          { type: "text", text: VISION_PROMPT },
        ],
      },
    ],
  });
  const delays = [3000, 9000, 27000];
  let lastErr;
  for (let i = 0; i <= delays.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, delays[i - 1]));
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
      const cleaned = text
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      return { json: JSON.parse(cleaned), usage: data.usage, model };
    }
    const errText = await res.text();
    lastErr = new Error(`Vision API ${res.status}: ${errText}`);
    if (!RETRYABLE.has(res.status)) throw lastErr;
  }
  throw lastErr;
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  let imgBuf;
  try {
    const formData = await req.formData();
    const file = formData.get("image");
    if (!file || typeof file === "string") {
      return Response.json({ error: "missing image field" }, { status: 400 });
    }
    imgBuf = Buffer.from(await file.arrayBuffer());
    if (imgBuf.length > 5 * 1024 * 1024) {
      return Response.json({ error: "image > 5 MB; client compression failed" }, { status: 413 });
    }
  } catch (e) {
    return Response.json({ error: `parse error: ${e.message}` }, { status: 400 });
  }

  const mediaType = detectMime(imgBuf);
  const b64 = imgBuf.toString("base64");

  const primaryModel = process.env.SONNET_MODEL || "claude-sonnet-4-6";
  const fallbackModel = process.env.HAIKU_MODEL || "claude-haiku-4-5-20251001";

  let visionResult;
  try {
    visionResult = await callVision(b64, mediaType, apiKey, primaryModel);
  } catch (e) {
    if (/529|overloaded|Overloaded/.test(e.message)) {
      try {
        visionResult = await callVision(b64, mediaType, apiKey, fallbackModel);
      } catch (e2) {
        return Response.json({ error: `Vision failed (primary+fallback): ${e2.message}` }, { status: 502 });
      }
    } else {
      return Response.json({ error: e.message }, { status: 502 });
    }
  }

  const identified = visionResult.json.identified || [];
  const { db, version } = await loadDb();

  // Score each identified plant against DB plants in same category. Keep max per DB plant.
  const byCategory = { 灌木: new Map(), 草本: new Map(), 地被: new Map() };
  for (const inp of identified) {
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

  const pool = { 灌木: [], 草本: [], 地被: [] };
  const weak_pool = { 灌木: [], 草本: [], 地被: [] };
  for (const cat of ["灌木", "草本", "地被"]) {
    const arr = [...byCategory[cat].values()].sort((a, b) => b.score - a.score);
    pool[cat] = arr.filter((x) => x.stars >= 4);
    weak_pool[cat] = arr.filter((x) => x.stars === 3);
  }

  return Response.json({
    identified,
    pool,
    weak_pool,
    db_count: db.length,
    db_version: version,
    model: visionResult.model,
  });
};
