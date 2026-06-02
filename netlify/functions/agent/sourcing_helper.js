import { createHmac, timingSafeEqual } from "node:crypto";

function verifyHmac(req, body) {
  const secret = process.env.OPENCLAW_SHARED_SECRET;
  if (!secret) return false;
  const sig = req.headers.get("x-openclaw-signature") || "";
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export default async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const rawBody = await req.text();
  if (!verifyHmac(req, rawBody)) {
    return Response.json({ error: "invalid signature" }, { status: 401 });
  }
  return Response.json({
    agent: "sourcing_helper",
    answer:
      "(stub) 取得管道將於 v1.1 上線。台灣原生植物常見來源:特生中心、林業試驗所、台灣原生植物保育協會、各地苗圃。",
  });
};
