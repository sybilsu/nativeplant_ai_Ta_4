// TEMPORARY demo photo fetcher — fills the 3 framing slots (_leaf/_close/_habit)
// per species with CC/PD-licensed images from Wikimedia Commons, so the multi-photo
// card layout looks populated for demos. NOT for production: the operator replaces
// these with their own photographs (same filenames). Attribution is written to
// public/photos/DEMO_PHOTOS_ATTRIBUTION.md.
//
// Usage: node scripts/fetch_demo_photos.mjs [maxSpecies]
import { readFile, writeFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PHOTOS = resolve(ROOT, "public/photos");
const SLOTS = ["_leaf", "_close", "_habit"];
const UA = "nativeplant-ai-ta4-demo/1.0 (contact: chuan.sybil@gmail.com)";

async function commonsImages(latinBinomial, n = 3) {
  const url =
    "https://commons.wikimedia.org/w/api.php?format=json&action=query" +
    "&generator=search&gsrnamespace=6&gsrlimit=8" +
    `&gsrsearch=${encodeURIComponent(latinBinomial)}` +
    "&prop=imageinfo&iiprop=url|mime|extmetadata&iiurlwidth=900";
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`Commons API ${res.status}`);
  const data = await res.json();
  const pages = Object.values(data?.query?.pages || {});
  const imgs = [];
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii || !/image\/(jpeg|png)/.test(ii.mime || "")) continue;
    const meta = ii.extmetadata || {};
    imgs.push({
      thumb: ii.thumburl || ii.url,
      title: p.title,
      license: meta.LicenseShortName?.value || "?",
      author: (meta.Artist?.value || "?").replace(/<[^>]+>/g, "").trim().slice(0, 80),
      descUrl: ii.descriptionurl,
    });
    if (imgs.length >= n) break;
  }
  return imgs;
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`download ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  return buf.length;
}

async function main() {
  const limit = parseInt(process.argv[2] || "999", 10);
  const db = JSON.parse(await readFile(resolve(ROOT, "data/plants_enriched.json"), "utf8"));
  const attribution = ["# Demo photo attribution (TEMPORARY)", "", "Source: Wikimedia Commons. Replace with own photos.", ""];
  let ok = 0, miss = 0;

  for (const row of db.slice(0, limit)) {
    const full = (row["Name (中文名/學名)"] || "").split(" / ");
    const cn = full[0]?.trim();
    const latin = (full[1] || "").trim().split(/\s+/).slice(0, 2).join(" ");
    if (!cn || !latin) { console.log(`skip (no name): ${cn}`); continue; }
    try {
      const imgs = await commonsImages(latin, 3);
      if (!imgs.length) { console.log(`  ✗ ${cn} (${latin}) — no Commons images`); miss++; continue; }
      attribution.push(`## ${cn} (${latin})`);
      for (let i = 0; i < SLOTS.length && i < imgs.length; i++) {
        const dest = resolve(PHOTOS, `${cn}${SLOTS[i]}.jpg`);
        const bytes = await download(imgs[i].thumb, dest);
        attribution.push(`- ${SLOTS[i]}: ${imgs[i].title} — ${imgs[i].license} — ${imgs[i].author} — ${imgs[i].descUrl} (${bytes}B)`);
      }
      attribution.push("");
      console.log(`  ✓ ${cn} (${latin}) — ${Math.min(imgs.length, 3)} imgs`);
      ok++;
    } catch (e) {
      console.log(`  ! ${cn} (${latin}) — ${e.message}`);
      miss++;
    }
  }

  await writeFile(resolve(PHOTOS, "DEMO_PHOTOS_ATTRIBUTION.md"), attribution.join("\n"), "utf8");
  console.log(`\nDone. ${ok} species filled, ${miss} missing/failed.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
