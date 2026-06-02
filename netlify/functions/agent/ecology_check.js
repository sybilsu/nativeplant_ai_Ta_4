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
    agent: "ecology_check",
    answer: "(stub) 生態相容性檢查將於 v1.1 上線。當前建議僅以 DB 屬性比對為主。",
  });
};
