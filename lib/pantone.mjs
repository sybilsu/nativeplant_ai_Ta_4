// Measured-color → 12-color-vocab mapping (deterministic, no LLM).
//
// A colorimeter (e.g. Nix / Pantone Capsure) outputs both a Pantone code AND a
// measured sRGB value. We map the measured HEX to the nearest of the app's 12
// filter colors via CIELAB ΔE, so the drag-drop ColorTray keeps working while the
// data underneath is ground-truth instead of a Haiku guess. The Pantone code is
// carried through as a human-facing label only — there is no open formula from a
// Pantone code to RGB, so HEX is the input the math relies on.

// MUST stay in sync with COLOR_VOCAB in src/components/ColorTray.jsx.
export const VOCAB_HEX = [
  { key: "紅", hex: "#C7384B" },
  { key: "橙", hex: "#E89446" },
  { key: "黃", hex: "#D8B842" },
  { key: "綠", hex: "#5A8C5C" },
  { key: "藍", hex: "#3F6B91" },
  { key: "紫", hex: "#7E5BAA" },
  { key: "粉", hex: "#E3A6B5" },
  { key: "白", hex: "#F5F1E6" },
  { key: "黑", hex: "#222428" },
  { key: "棕", hex: "#7E5C3D" },
  { key: "灰", hex: "#9AA0A6" },
  { key: "銀", hex: "#C8CDD3" },
];

// Optional Pantone-code → HEX lookup for rows where only a code (no measured hex)
// is recorded. Operator-extensible. Prefer recording the measured HEX instead.
export const PANTONE_HEX = {
  // "PANTONE 17-1463 TCX": "#DD4124",  // example format — fill as needed
};

export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function srgbToLinear(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function rgbToLab([r, g, b]) {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
  // sRGB → XYZ (D65)
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function deltaE(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); // CIE76
}

const VOCAB_LAB = VOCAB_HEX.map((v) => ({ key: v.key, lab: rgbToLab(hexToRgb(v.hex)) }));

// HEX → single nearest vocab key (e.g. "#C71585" → "粉"), or null if hex invalid.
export function hexToVocab(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const lab = rgbToLab(rgb);
  let best = null, bestD = Infinity;
  for (const v of VOCAB_LAB) {
    const d = deltaE(lab, v.lab);
    if (d < bestD) { bestD = d; best = v.key; }
  }
  return best;
}

// Resolve a measured color spec → { vocab: [key], hex, pantone } or null.
// Prefers an explicit measured hex; falls back to the Pantone lookup table.
export function resolveColor({ hex, pantone } = {}) {
  let useHex = hex && hexToRgb(hex) ? hex : null;
  if (!useHex && pantone && PANTONE_HEX[pantone.trim()]) useHex = PANTONE_HEX[pantone.trim()];
  if (!useHex) return null;
  const key = hexToVocab(useHex);
  return key ? { vocab: [key], hex: useHex, pantone: pantone || null } : null;
}
