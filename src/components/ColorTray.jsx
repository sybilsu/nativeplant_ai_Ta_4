// 12-color drag-drop tray. Uses HTML5 DnD (no external dep, per spec.md Q2 default).

export const COLOR_VOCAB = [
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

function Swatch({ color, dim, onDragStart, onClick, role }) {
  return (
    <button
      type="button"
      draggable={role !== "selected"}
      onDragStart={onDragStart}
      onClick={onClick}
      title={role === "selected" ? `點擊移除 ${color.key}` : `${color.key}色 (拖入或點選)`}
      aria-label={role === "selected" ? `已選 ${color.key},點擊移除` : `加入 ${color.key} 色`}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 transition-transform duration-200 ease-spring"
      style={{
        background: "var(--mat-thin)",
        backdropFilter: "var(--blur-thin)",
        WebkitBackdropFilter: "var(--blur-thin)",
        border: "0.5px solid var(--hairline-dark)",
        borderRadius: "14px",
        opacity: dim ? 0.45 : 1,
        cursor: role === "selected" ? "pointer" : "grab",
      }}
    >
      <span
        className="inline-block rounded-full"
        style={{
          width: 14,
          height: 14,
          background: color.hex,
          border: color.key === "白" ? "0.5px solid var(--hairline-dark)" : "none",
        }}
        aria-hidden
      />
      <span className="text-xs" style={{ color: "var(--ink-primary)" }}>
        {color.key}
      </span>
    </button>
  );
}

export default function ColorTray({ selected, onChange }) {
  function add(key) {
    if (!selected.includes(key)) onChange([...selected, key]);
  }
  function remove(key) {
    onChange(selected.filter((k) => k !== key));
  }
  function handleDragOver(e) {
    e.preventDefault();
  }
  function handleDrop(e) {
    e.preventDefault();
    const key = e.dataTransfer.getData("text/plain");
    if (key) add(key);
  }

  return (
    <section className="space-y-2">
      <div className="text-xs px-1" style={{ color: "var(--ink-tertiary)" }}>
        色彩篩選 · 拖入或點選色票
      </div>

      {/* Available swatches */}
      <div className="glass-thin p-3 flex flex-wrap gap-2">
        {COLOR_VOCAB.map((c) => (
          <Swatch
            key={c.key}
            color={c}
            dim={selected.includes(c.key)}
            onDragStart={(e) => e.dataTransfer.setData("text/plain", c.key)}
            onClick={() => add(c.key)}
            role="available"
          />
        ))}
      </div>

      {/* Drop tray */}
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="glass-thick p-3 flex flex-wrap gap-2 min-h-[56px] transition-all duration-200 ease-glass items-center"
        style={{ borderRadius: "9999px" }}
        aria-label="已選色票區"
      >
        {selected.length === 0 ? (
          <span className="text-xs px-2" style={{ color: "var(--ink-tertiary)" }}>
            拖入色票以縮小範圍 · 不選等於全部
          </span>
        ) : (
          <>
            {selected.map((key) => {
              const c = COLOR_VOCAB.find((x) => x.key === key);
              if (!c) return null;
              return (
                <Swatch
                  key={key}
                  color={c}
                  onClick={() => remove(key)}
                  role="selected"
                />
              );
            })}
            <button
              onClick={() => onChange([])}
              className="ml-auto text-xs px-2 py-0.5"
              style={{ color: "var(--accent-petal)" }}
              aria-label="清除全部選色"
            >
              × 清除
            </button>
          </>
        )}
      </div>
    </section>
  );
}
