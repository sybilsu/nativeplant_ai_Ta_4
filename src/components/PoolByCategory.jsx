import { useState, useMemo } from "react";
import PlantCard from "./PlantCard.jsx";

const CATEGORIES = ["灌木", "草本", "地被"];

function filterByColors(list, selectedColors) {
  if (!selectedColors || selectedColors.length === 0) return list;
  return list.filter((p) => {
    const all = [...(p.flower_color || []), ...(p.fruit_color || [])];
    return selectedColors.some((c) => all.includes(c));
  });
}

function WeakSection({ items, selectedColors }) {
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => filterByColors(items, selectedColors), [items, selectedColors]);
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs px-3 py-1.5 glass-thin"
        style={{ color: "var(--accent-honey)", borderRadius: "9999px" }}
      >
        {open ? "收合 ▴" : `也可以參考 (弱匹配 ${filtered.length}) ▾`}
      </button>
      {open && (
        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((p) => (
            <PlantCard key={`weak-${p.db_name}`} plant={p} weak />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PoolByCategory({ pool, weakPool, selectedColors }) {
  return (
    <section className="space-y-6">
      {CATEGORIES.map((cat) => {
        const main = filterByColors(pool[cat] || [], selectedColors);
        const weak = filterByColors(weakPool?.[cat] || [], selectedColors);
        return (
          <div key={cat}>
            <h2 className="font-display text-xl mb-3 flex items-center gap-3" style={{ color: "var(--ink-primary)" }}>
              {cat}
              <span className="text-xs font-body" style={{ color: "var(--ink-tertiary)" }}>
                {main.length} 筆 ≥4★
                {selectedColors.length > 0 && pool[cat]?.length > main.length && (
                  <> · 共 {pool[cat].length} 筆,{selectedColors.join("/")}色 篩剩 {main.length} 筆</>
                )}
              </span>
            </h2>

            {main.length === 0 ? (
              <div
                className="glass-thin p-5 text-sm"
                style={{
                  borderLeft: "2px dashed var(--hairline-dark)",
                  color: "var(--ink-secondary)",
                }}
              >
                {(pool[cat] || []).length === 0
                  ? `本類別暫無 ≥4★ 強匹配。`
                  : `已選色票後無符合結果。`}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {main.map((p) => (
                  <PlantCard key={p.db_name} plant={p} />
                ))}
              </div>
            )}

            <WeakSection items={weakPool?.[cat]} selectedColors={selectedColors} />
          </div>
        );
      })}
    </section>
  );
}
