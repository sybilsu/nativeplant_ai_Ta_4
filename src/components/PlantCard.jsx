import { COLOR_VOCAB } from "./ColorTray.jsx";

function colorHex(key) {
  return COLOR_VOCAB.find((c) => c.key === key)?.hex || "#999";
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

function ColorDots({ keys, label }) {
  if (!keys || keys.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-xs" style={{ color: "var(--ink-tertiary)" }}>
        {label}
      </span>
      {keys.map((k) => (
        <span
          key={k}
          className="inline-flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded"
          style={{ background: "var(--mat-thin)", color: "var(--ink-secondary)" }}
          title={k}
        >
          <span
            className="inline-block rounded-full"
            style={{
              width: 8,
              height: 8,
              background: colorHex(k),
              border: k === "白" ? "0.5px solid var(--hairline-dark)" : "none",
            }}
            aria-hidden
          />
          {k}
        </span>
      ))}
    </span>
  );
}

export default function PlantCard({ plant, weak = false }) {
  const photoUrl = `/photos/${encodeURIComponent(plant.db_photo)}`;
  return (
    <article
      className={weak ? "glass-thin p-4" : "glass p-4"}
      style={{
        borderRadius: "20px",
        ...(weak ? { borderLeft: "2px solid var(--accent-honey)" } : {}),
      }}
    >
      <div className="flex gap-4">
        <img
          src={photoUrl}
          alt={plant.db_name}
          loading="lazy"
          className="rounded-xl flex-shrink-0 object-cover"
          style={{ width: 80, height: 80, background: "var(--mat-ultraThin)" }}
          onError={(e) => (e.currentTarget.style.opacity = 0.3)}
        />
        <div className="flex-1 min-w-0">
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
        <ColorDots keys={plant.flower_color} label="花" />
        <ColorDots keys={plant.fruit_color} label="果" />
        <ColorDots keys={plant.leaf_color} label="葉" />
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
