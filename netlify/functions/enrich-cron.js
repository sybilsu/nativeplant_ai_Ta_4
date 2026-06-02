// Scheduled: Sundays 19:00 UTC = Mondays 03:00 Asia/Taipei.
// Re-runs Phase A color enrichment against the current taiwan native/2026_植物屬性表.csv.
// MVP: log only. Production should write a fresh data/plants_enriched.json back
// (requires writable storage; on Netlify, use Blobs).

export default async () => {
  console.log(
    JSON.stringify({
      type: "enrich_cron_fired",
      ts: new Date().toISOString(),
      note: "MVP: enrichment is committed manually via `npm run enrich`. Wire to Netlify Blobs in v1.1.",
    }),
  );
  return new Response("ok");
};

export const config = { schedule: "0 19 * * 0" };
