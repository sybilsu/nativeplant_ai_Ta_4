// Scheduled: Sundays 19:00 UTC = Mondays 03:00 Asia/Taipei.
// Re-runs Phase A color enrichment (Haiku) against the bundled seed dataset and
// writes the fresh result to Netlify Blobs, so identify/db-version serve it
// WITHOUT a redeploy (Functions have a read-only filesystem). New species still
// arrive via redeploy — which updates the seed — and this job refreshes the
// derived colors + the DB timestamp on schedule.
// Seed the Blob on demand with: `netlify functions:invoke enrich-cron`.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { deriveCategory, extractColors } from "../../lib/enrich-core.mjs";
import { writeDbToBlob } from "../../lib/db-store.mjs";

const moduleDir = dirname(fileURLToPath(import.meta.url));

async function loadSeed() {
  const candidates = [
    resolve(moduleDir, "../../data/plants_enriched.json"),
    resolve(process.cwd(), "data/plants_enriched.json"),
  ];
  for (const p of candidates) {
    try {
      return JSON.parse(await readFile(p, "utf-8"));
    } catch {
      /* try next */
    }
  }
  throw new Error("seed plants_enriched.json not found");
}

export default async () => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.HAIKU_MODEL || "claude-haiku-4-5-20251001";
  if (!apiKey) {
    console.error("enrich-cron: ANTHROPIC_API_KEY not set");
    return new Response("missing api key", { status: 500 });
  }

  const seed = await loadSeed();
  const enriched = [];
  let failed = 0;
  // Sequential to stay gentle on rate limits; 25 rows × Haiku ≈ a few seconds.
  // Scheduled functions run in the background context (15 min budget), so this
  // is not bound by the synchronous-function limit.
  for (const row of seed) {
    const category = deriveCategory(row);
    try {
      const colors = await extractColors(row, apiKey, model);
      enriched.push({ ...row, category, ...colors });
    } catch (e) {
      failed++;
      enriched.push({
        ...row,
        category,
        flower_color: [],
        leaf_color: ["綠"],
        fruit_color: [],
        _error: e.message,
      });
    }
  }

  const updatedAt = new Date().toISOString();
  await writeDbToBlob(enriched, updatedAt);
  console.log(
    JSON.stringify({ type: "enrich_cron_done", updated_at: updatedAt, count: enriched.length, failed }),
  );
  return Response.json({ ok: true, updated_at: updatedAt, count: enriched.length, failed });
};

export const config = { schedule: "0 19 * * 0" };
