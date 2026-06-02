import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default async () => {
  const candidates = [
    resolve(__dirname, "../../data/plants_enriched.json"),
    resolve(process.cwd(), "data/plants_enriched.json"),
  ];
  for (const p of candidates) {
    try {
      const raw = await readFile(p, "utf-8");
      const s = await stat(p);
      const db = JSON.parse(raw);
      return Response.json({
        updated_at: s.mtime.toISOString(),
        count: db.length,
      });
    } catch {
      /* try next */
    }
  }
  return Response.json({ error: "DB not found" }, { status: 500 });
};
