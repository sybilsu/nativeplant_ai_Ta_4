// Blobs-backed DB store. identify/db-version read Blobs first (the enrich-cron
// output), and fall back to the bundled seed JSON when the Blob is empty (e.g.
// before the first cron run). This decouples DB freshness from redeploys —
// Netlify Functions have a read-only filesystem, so the committed JSON can only
// ever be a seed; the writable copy lives in Blobs.
import { getStore } from "@netlify/blobs";

const STORE = "plant-db";
const KEY = "enriched";

// Returns { db, updatedAt, source: "blob" } or null if no Blob / Blobs unavailable.
export async function readDbFromBlob() {
  try {
    const store = getStore(STORE);
    const res = await store.getWithMetadata(KEY, { type: "json" });
    if (res && Array.isArray(res.data)) {
      return {
        db: res.data,
        updatedAt: res.metadata?.updated_at || null,
        source: "blob",
      };
    }
  } catch {
    /* Blobs not configured (e.g. local plain `vite`) → caller falls back to seed */
  }
  return null;
}

export async function writeDbToBlob(db, updatedAt) {
  const store = getStore(STORE);
  await store.setJSON(KEY, db, {
    metadata: { updated_at: updatedAt, count: db.length },
  });
}
