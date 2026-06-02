// Phase A: enrich the Taiwan native plant CSV with two derived fields.
//   - `category`: 灌木 / 草本 / 地被  (deterministic from Role + LONGEVITY, no LLM)
//   - flower_color / leaf_color / fruit_color: extracted from FOLIAGE+FLW SEASON+STRUCT INT+NOTES
//     using Haiku, normalized to a 12-color vocabulary.
//
// Outputs:
//   data/plants_enriched.csv
//   data/plants_enriched.json
//
// Usage: node scripts/enrich_csv.mjs

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SRC_CSV = resolve(ROOT, "taiwan native/2026_植物屬性表.csv");
const OUT_CSV = resolve(ROOT, "data/plants_enriched.csv");
const OUT_JSON = resolve(ROOT, "data/plants_enriched.json");

// Lightweight .env loader (no dotenv dep).
async function loadEnv() {
  const raw = await readFile(resolve(ROOT, ".env"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] = m[2];
  }
}

const VOCAB = ["紅", "橙", "黃", "綠", "藍", "紫", "粉", "白", "黑", "棕", "灰", "銀"];

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const header = lines.shift().split(",");
  return lines.map((line) => {
    const cells = line.split(",");
    const row = {};
    header.forEach((h, i) => (row[h] = (cells[i] ?? "").trim()));
    return row;
  });
}

function deriveCategory(row) {
  if (row["Role (角色)"] === "Ground cover") return "地被";
  if (row["LONGEVITY (壽命)"] === "Shrub") return "灌木";
  return "草本"; // Annual / Perennial / etc.
}

async function extractColors(row, apiKey, model) {
  const sourceText = [
    `中文名: ${row["Name (中文名/學名)"].split(" / ")[0]}`,
    `葉形: ${row["FOLIAGE (葉形)"]}`,
    `花期: ${row["FLW SEASON (花期)"]}`,
    `結構期: ${row["STRUCT INT (結構期)"]}`,
    `備註: ${row["NOTES (備註)"]}`,
  ].join("\n");

  const prompt = `從以下台灣原生植物資料中,擷取花色、葉色、果色,輸出 JSON 物件。

【規範詞彙】只可用:${VOCAB.join("、")}
【規則】
- leaf_color 預設 ["綠"],除非葉形描述明確提到其他色 (如 灰綠→["灰","綠"]; 深綠→["綠"])
- flower_color 來自 花/花序/花穗/花瓣 提及的顏色
- fruit_color 來自 果/果實/蒴果/莢果/萼片/漿果 提及的顏色
- 複合色拆分:紫紅→["紫","紅"]; 粉紅→["粉","紅"]; 銀白→["銀","白"]; 桃紅→["粉","紅"]; 淡紫→["紫"]
- 沒有資訊用空陣列 []
- 只輸出 JSON,不要任何解釋

資料:
${sourceText}

JSON:`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const text = data.content[0].text.trim();
  // Strip any markdown code fence Haiku may add
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(cleaned);
}

async function main() {
  await loadEnv();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.HAIKU_MODEL || "claude-haiku-4-5-20251001";
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const csv = await readFile(SRC_CSV, "utf8");
  const rows = parseCsv(csv);
  console.log(`Loaded ${rows.length} plants. Enriching with ${model} ...`);

  // Concurrency = 5 to keep things snappy without hammering the API
  const results = new Array(rows.length);
  const CONC = 5;
  let idx = 0;
  async function worker(id) {
    while (true) {
      const i = idx++;
      if (i >= rows.length) return;
      const r = rows[i];
      const category = deriveCategory(r);
      try {
        const colors = await extractColors(r, apiKey, model);
        results[i] = { ...r, category, ...colors };
        const name = r["Name (中文名/學名)"].split(" / ")[0];
        console.log(`  [${(i + 1).toString().padStart(2)}/${rows.length}] ${name} → ${category} | flower=${JSON.stringify(colors.flower_color)} fruit=${JSON.stringify(colors.fruit_color)}`);
      } catch (e) {
        console.error(`  [${i + 1}] FAILED: ${e.message}`);
        results[i] = { ...r, category, flower_color: [], leaf_color: ["綠"], fruit_color: [], _error: e.message };
      }
    }
  }
  await Promise.all(Array.from({ length: CONC }, (_, j) => worker(j)));

  // Write JSON
  await writeFile(OUT_JSON, JSON.stringify(results, null, 2), "utf8");

  // Write CSV (original columns + 4 new)
  const header = [...Object.keys(rows[0]), "category", "flower_color", "leaf_color", "fruit_color"];
  const lines = [header.join(",")];
  for (const r of results) {
    const row = header.map((h) => {
      const v = r[h];
      if (Array.isArray(v)) return `"${v.join("|")}"`;
      return v ?? "";
    });
    lines.push(row.join(","));
  }
  await writeFile(OUT_CSV, lines.join("\n"), "utf8");

  console.log(`\n✓ Wrote ${OUT_JSON}`);
  console.log(`✓ Wrote ${OUT_CSV}`);
  const failed = results.filter((r) => r._error).length;
  if (failed > 0) console.log(`⚠ ${failed} rows had errors (defaulted)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
