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
import { deriveCategory, parseOverridesCsv, resolveColorsForRow } from "../../lib/enrich-core.mjs";
import { writeDbToBlob } from "../../lib/db-store.mjs";

const moduleDir = dirname(fileURLToPath(import.meta.url));

async function readFirst(relPaths) {
  for (const rel of relPaths) {
    for (const p of [resolve(moduleDir, rel), resolve(process.cwd(), rel.replace("../../", ""))]) {
      try {
        return await readFile(p, "utf-8");
      } catch {
        /* try next */
      }
    }
  }
  return null;
}

async function loadSeed() {
  const raw = await readFirst(["../../data/plants_enriched.json"]);
  if (!raw) throw new Error("seed plants_enriched.json not found");
  return JSON.parse(raw);
}

async function loadOverrides() {
  const raw = await readFirst(["../../data/color_overrides.csv"]);
  return parseOverridesCsv(raw || ""); // empty Map if the file is absent
}

export default async () => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.HAIKU_MODEL || "claude-haiku-4-5-20251001";
  if (!apiKey) {
    console.error("enrich-cron: ANTHROPIC_API_KEY not set");
    return new Response("missing api key", { status: 500 });
  }

  const seed = await loadSeed();
  const overrides = await loadOverrides();
  const enriched = [];
  let failed = 0, measuredFields = 0;
  // Sequential to stay gentle on rate limits; 25 rows × Haiku ≈ a few seconds.
  // Scheduled functions run in the background context (15 min budget), so this
  // is not bound by the synchronous-function limit. Fields with a measured
  // color (color_overrides.csv) skip Haiku entirely.
  for (const row of seed) {
    const category = deriveCategory(row);
    const cn = (row["Name (中文名/學名)"] || "").split(" / ")[0].trim();
    try {
      const colors = await resolveColorsForRow(row, overrides.get(cn), apiKey, model);
      measuredFields += ["flower", "fruit", "leaf"].filter((f) => colors[`${f}_source`] === "measured").length;
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
    JSON.stringify({ type: "enrich_cron_done", updated_at: updatedAt, count: enriched.length, failed, measured_fields: measuredFields }),
  );
  return Response.json({ ok: true, updated_at: updatedAt, count: enriched.length, failed, measured_fields: measuredFields });
};

export const config = { schedule: "0 19 * * 0" };
