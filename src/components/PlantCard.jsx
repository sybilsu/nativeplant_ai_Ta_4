import { useState } from "react";
import { COLOR_VOCAB } from "./ColorTray.jsx";

function colorHex(key) {
  return COLOR_VOCAB.find((c) => c.key === key)?.hex || "#999";
}

// Three framings per species, filled by filename convention in /public/photos:
//   <中文名>_leaf.jpg / _close.jpg / _habit.jpg  (operator drops files; no DB edit)
// The existing single <中文名>.jpg is treated as the 近景 default until a real
// _close.jpg is supplied. Missing framings show a "待補" placeholder.
const PHOTO_SLOTS = [
  { key: "leaf", label: "葉", suffix: "_leaf", baseFallback: false },
  { key: "close", label: "近景", suffix: "_close", baseFallback: true },
  { key: "habit", label: "全株", suffix: "_habit", baseFallback: false },
];

function photoBase(dbPhoto) {
  // "台灣馬醉木.jpg" -> "台灣馬醉木"
  return (dbPhoto || "").replace(/\.[^.]+$/, "");
}

function PhotoThumb({ base, slot, alt, index = 0 }) {
  // src resolution order: variant -> (近景 only) base photo -> placeholder
  const variantUrl = base ? `/photos/${encodeURIComponent(base + slot.suffix)}.jpg` : null;
  const baseUrl = base ? `/photos/${encodeURIComponent(base)}.jpg` : null;
  const [src, setSrc] = useState(variantUrl);
  const [failed, setFailed] = useState(!variantUrl);

  function handleError() {
    if (slot.baseFallback && src !== baseUrl && baseUrl) {
      setSrc(baseUrl); // try the existing single photo as 近景
    } else {
      setFailed(true);
    }
  }

  return (
    <figure className="flex-1 min-w-0 m-0">
      {/* Photo tile floats above the glass plate (PhotoStrip) via its own drop
          shadow — depth/立體感 from the lift, not a border. `.photo-tile` (index.css)
          adds the entrance rise + hover lift; stagger via animation-delay. */}
      <div
        className="photo-tile"
        style={{ aspectRatio: "1 / 1", animationDelay: `${index * 90}ms` }}
      >
        {failed ? (
          <div
            className="absolute inset-0 flex items-center justify-center text-[10px]"
            style={{ color: "var(--ink-quaternary)" }}
          >
            待補
          </div>
        ) : (
          <img
            src={src}
            alt={`${alt} — ${slot.label}`}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
            onError={handleError}
          />
        )}
      </div>
      <figcaption
        className="text-center text-[10px] mt-1"
        style={{ color: "var(--ink-tertiary)" }}
      >
        {slot.label}
      </figcaption>
    </figure>
  );
}

function PhotoStrip({ dbPhoto, alt }) {
  const base = photoBase(dbPhoto);
  // Frosted-glass plate: the photos float on this surface (generous padding so
  // the glass reads as a surface, not a border; inset highlight + soft shadow
  // give it its own depth).
  return (
    <div
      className="glass-thin flex gap-2.5"
      style={{
        padding: 10,
        boxShadow: "inset 0 1px 0 var(--hairline-light), var(--shadow-glass-md)",
      }}
    >
      {PHOTO_SLOTS.map((slot, i) => (
        <PhotoThumb key={slot.key} base={base} slot={slot} alt={alt} index={i} />
      ))}
    </div>
  );
}

function Stars({ n }) {
  return (
    <span aria-label={`${n} 顆星`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          style={{ color: i < n ? "var(--star-filled)" : "var(--star-empty)" }}
        >
          ●
        </span>
      ))}
    </span>
  );
}

// `accentHex` (optional): the measured colorimeter hex for this field. When
// present the dot shows the true measured color instead of the vocab swatch.
function ColorDots({ keys, label, accentHex }) {
  if (!keys || keys.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-xs" style={{ color: "var(--ink-tertiary)" }}>
        {label}
      </span>
      {keys.map((k) => {
        const dotHex = accentHex || colorHex(k);
        return (
          <span
            key={k}
            className="inline-flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded"
            style={{ background: "var(--mat-thin)", color: "var(--ink-secondary)" }}
            title={accentHex ? `${k} · 實測 ${accentHex}` : k}
          >
            <span
              className="inline-block rounded-full"
              style={{
                width: 8,
                height: 8,
                background: dotHex,
                border: k === "白" ? "0.5px solid var(--hairline-dark)" : "none",
              }}
              aria-hidden
            />
            {k}
          </span>
        );
      })}
    </span>
  );
}

export default function PlantCard({ plant, weak = false }) {
  return (
    <article
      className={weak ? "glass-thin p-4" : "glass p-4"}
      style={{
        borderRadius: "20px",
        ...(weak ? { borderLeft: "2px solid var(--accent-honey)" } : {}),
      }}
    >
      <PhotoStrip dbPhoto={plant.db_photo} alt={plant.db_name} />

      <div className="mt-3">
        <h3 className="font-display text-lg leading-tight truncate" style={{ color: "var(--ink-primary)" }}>
          {plant.db_name}
        </h3>
        <div className="font-latin italic text-xs truncate" style={{ color: "var(--ink-secondary)" }}>
          {plant.db_latin}
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-xs">
          <Stars n={plant.stars} />
          <span style={{ color: "var(--ink-tertiary)" }}>
            {plant.score?.toFixed?.(1) ?? plant.score} 分
          </span>
          {weak && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: "var(--mat-thick)", color: "var(--accent-honey)" }}
            >
              弱匹配
            </span>
          )}
        </div>
      </div>

      <dl className="mt-3 text-xs space-y-1" style={{ color: "var(--ink-secondary)" }}>
        <div>
          <dt className="inline" style={{ color: "var(--ink-tertiary)" }}>
            葉形:
          </dt>
          <dd className="inline ml-1">{plant.db_foliage}</dd>
        </div>
        <div>
          <dt className="inline" style={{ color: "var(--ink-tertiary)" }}>
            高度:
          </dt>
          <dd className="inline ml-1">{plant.db_height}</dd>
          <span className="mx-2" style={{ color: "var(--ink-quaternary)" }}>·</span>
          <dt className="inline" style={{ color: "var(--ink-tertiary)" }}>
            花期:
          </dt>
          <dd className="inline ml-1">{plant.db_flw_season}</dd>
        </div>
      </dl>

      <div className="mt-2 flex flex-wrap gap-2">
        <ColorDots keys={plant.flower_color} label="花" accentHex={plant.flower_hex} />
        <ColorDots keys={plant.fruit_color} label="果" accentHex={plant.fruit_hex} />
        <ColorDots keys={plant.leaf_color} label="葉" accentHex={plant.leaf_hex} />
      </div>

      <div
        className="mt-3 pt-2 text-[11px]"
        style={{ borderTop: "0.5px solid var(--hairline-dark)", color: "var(--ink-tertiary)" }}
      >
        對應 {plant.matched_input} · 細項:類別 {plant.breakdown.category} · 葉 {plant.breakdown.foliage} · 高 {plant.breakdown.height} · 幅 {plant.breakdown.spread} · 觀賞 {plant.breakdown.ornament}
      </div>
    </article>
  );
}
