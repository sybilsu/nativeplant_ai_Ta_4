// Client-side image compression + identify API call.

async function compressImage(file, maxEdge = 1280, quality = 0.85) {
  const img = await createImageBitmap(file);
  const longEdge = Math.max(img.width, img.height);
  const ratio = longEdge > maxEdge ? maxEdge / longEdge : 1;
  const w = Math.round(img.width * ratio);
  const h = Math.round(img.height * ratio);

  const useOffscreen = typeof OffscreenCanvas !== "undefined";
  const canvas = useOffscreen ? new OffscreenCanvas(w, h) : document.createElement("canvas");
  if (!useOffscreen) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  const blob = useOffscreen
    ? await canvas.convertToBlob({ type: "image/jpeg", quality })
    : await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
  return new File([blob], "upload.jpg", { type: "image/jpeg" });
}

export async function identifyImage(file) {
  const compressed = await compressImage(file);
  const formData = new FormData();
  formData.append("image", compressed);

  const res = await fetch("/api/identify", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`(${res.status}) ${text.slice(0, 200)}`);
  }
  return res.json();
}

export async function reportMissingPlant({ plant_name, context }) {
  const res = await fetch("/api/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plant_name, context }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
