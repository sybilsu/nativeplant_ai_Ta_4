// Shared Phase-A enrichment primitives, used by the enrich-cron function.
// `category` is pure-code (Role + LONGEVITY); colors use Haiku (cheap) per the
// cost-optimal model split. Prompt kept identical to scripts/enrich_csv.mjs.
// NOTE: scripts/enrich_csv.mjs still has its own copy (the offline CLI path);
// keep the two prompts in sync if either changes.

export const VOCAB = ["紅", "橙", "黃", "綠", "藍", "紫", "粉", "白", "黑", "棕", "灰", "銀"];

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
