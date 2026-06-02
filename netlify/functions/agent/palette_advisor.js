// Stub for OpenClaw → palette_advisor agent.
// MVP: accepts HMAC-signed POST, returns canned response.
// v1.1: call Haiku to map Pantone/free-text palette → 12-color vocabulary.

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
  const { user_message } = JSON.parse(rawBody);
  return Response.json({
    agent: "palette_advisor",
    answer:
      "(stub) 您提到的色彩風格,我建議以紫、粉、白為主軸,搭配灰綠葉作為背景。實際 Pantone 對映將於 v1.1 上線。",
    received: user_message?.slice(0, 200) || "",
  });
};
