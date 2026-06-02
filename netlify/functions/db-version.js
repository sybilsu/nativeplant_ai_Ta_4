import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readDbFromBlob } from "../../lib/db-store.mjs";

const moduleDir = dirname(fileURLToPath(import.meta.url));

export default async () => {
  // Prefer the writable Blob copy (kept fresh by enrich-cron); its metadata
  // carries a real updated_at. Fall back to the bundled seed otherwise.
  const fromBlob = await readDbFromBlob();
  if (fromBlob) {
    return Response.json({
      updated_at: fromBlob.updatedAt,
      count: fromBlob.db.length,
      source: "blob",
    });
  }

  const candidates = [
    resolve(moduleDir, "../../data/plants_enriched.json"),
    resolve(process.cwd(), "data/plants_enriched.json"),
  ];
  for (const p of candidates) {
    try {
      const db = JSON.parse(await readFile(p, "utf-8"));
      // Seed has no meaningful mtime in the bundle (epoch), so report null.
      return Response.json({ updated_at: null, count: db.length, source: "seed" });
    } catch {
      /* try next */
    }
  }
  return Response.json({ error: "DB not found" }, { status: 500 });
};
