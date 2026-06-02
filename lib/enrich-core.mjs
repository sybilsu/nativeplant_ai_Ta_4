// Shared Phase-A enrichment primitives, used by the enrich-cron function.
// `category` is pure-code (Role + LONGEVITY); colors are **measured-first**: if
// the operator recorded a colorimeter hex/Pantone for a field (data/color_overrides.csv)
// it is mapped deterministically to the 12-color vocab (lib/pantone.mjs); only
// fields with no measurement fall back to a Haiku guess. Prompt kept identical to
// scripts/enrich_csv.mjs (keep the two in sync if either changes).
import { resolveColor } from "./pantone.mjs";

export const VOCAB = ["紅", "橙", "黃", "綠", "藍", "紫", "粉", "白", "黑", "棕", "灰", "銀"];

// Parse data/color_overrides.csv → Map<中文名, {flower,fruit,leaf}: {hex,pantone}>.
// Hex/Pantone values never contain commas, so a naive split is safe here.
export function parseOverridesCsv(text) {
  const lines = (text || "").split(/\r?\n/).filter((l) => l.trim().length);
  if (!lines.length) return new Map();
  const header = lines.shift().split(",").map((s) => s.trim());
  const col = (name) => header.indexOf(name);
  const map = new Map();
  for (const line of lines) {
    const c = line.split(",");
    const get = (name) => {
      const i = col(name);
      const v = i >= 0 ? (c[i] || "").trim() : "";
      return v || null;
    };
    const name = get("name");
    if (!name) continue;
    map.set(name, {
      flower: { hex: get("flower_hex"), pantone: get("flower_pantone") },
      fruit: { hex: get("fruit_hex"), pantone: get("fruit_pantone") },
      leaf: { hex: get("leaf_hex"), pantone: get("leaf_pantone") },
    });
  }
  return map;
}

// Resolve flower/fruit/leaf colors for one row. Measured override wins (pure code,
// no API call); remaining fields trigger ONE Haiku call. Returns vocab arrays plus
// the measured hex/pantone and a per-field `*_source` ("measured" | "haiku").
export async function resolveColorsForRow(row, override, apiKey, model) {
  const fields = ["flower", "fruit", "leaf"];
  const measured = {};
  let allMeasured = true;
  for (const f of fields) {
    const r = override ? resolveColor(override[f]) : null;
    if (r) measured[f] = r;
    else allMeasured = false;
  }
  const haiku = allMeasured ? null : await extractColors(row, apiKey, model);
  const out = {};
  for (const f of fields) {
    if (measured[f]) {
      out[`${f}_color`] = measured[f].vocab;
      out[`${f}_hex`] = measured[f].hex;
      out[`${f}_pantone`] = measured[f].pantone;
      out[`${f}_source`] = "measured";
    } else {
      out[`${f}_color`] = haiku[`${f}_color`] || (f === "leaf" ? ["綠"] : []);
      out[`${f}_source`] = "haiku";
    }
  }
  return out;
}

export function deriveCategory(row) {
  if (row["Role (角色)"] === "Ground cover") return "地被";
  if (row["LONGEVITY (壽命)"] === "Shrub") return "灌木";
  return "草本"; // Annual / Perennial / etc.
}

export async function extractColors(row, apiKey, model) {
  const sourceText = [
    `中文名: ${(row["Name (中文名/學名)"] || "").split(" / ")[0]}`,
    `葉形: ${row["FOLIAGE (葉形)"] || ""}`,
    `花期: ${row["FLW SEASON (花期)"] || ""}`,
    `結構期: ${row["STRUCT INT (結構期)"] || ""}`,
    `備註: ${row["NOTES (備註)"] || ""}`,
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
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(cleaned);
}
