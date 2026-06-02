export default function Header({ dbCount, dbTarget, onReset, hasResult }) {
  return (
    <header
      className="sticky top-0 z-30 glass-ultraThick"
      style={{ borderRadius: 0, borderTop: 0, borderLeft: 0, borderRight: 0 }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h1
            className="font-display text-2xl sm:text-3xl tracking-tight"
            style={{ color: "var(--ink-primary)" }}
          >
            植徑
          </h1>
          <span
            className="font-display italic text-base"
            style={{ color: "var(--ink-secondary)" }}
          >
            v.2
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span
            className="text-xs px-3 py-1 glass-thin"
            style={{ color: "var(--ink-secondary)", borderRadius: "9999px" }}
            title="目前資料庫種數 / 目標"
          >
            DB {dbCount}/{dbTarget}
          </span>

          {hasResult && (
            <button
              onClick={onReset}
              className="text-xs px-3 py-1 glass-thin transition-colors hover:opacity-80"
              style={{
                color: "var(--accent-evergreen)",
                borderRadius: "9999px",
              }}
              aria-label="新查詢"
            >
              ↻ 新查詢
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
