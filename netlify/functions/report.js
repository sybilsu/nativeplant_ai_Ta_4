// POST /api/report — "plant not found" feedback.
// MVP: log to function logs only (privacy-first; no DB write, no PII).
// Future: write to Netlify Blobs with operator review queue.

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const name = String(body.plant_name || "").slice(0, 120).trim();
  const ctx = String(body.context || "").slice(0, 240).trim();
  if (!name) {
    return Response.json({ error: "plant_name required" }, { status: 400 });
  }
  // Log only — operator reviews via Netlify Functions log (no PII collected)
  console.log(
    JSON.stringify({
      type: "missing_plant_report",
      ts: new Date().toISOString(),
      plant_name: name,
      context: ctx,
    }),
  );
  return Response.json({ ok: true });
};
