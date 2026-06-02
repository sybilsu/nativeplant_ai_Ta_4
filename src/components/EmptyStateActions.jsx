import { useState } from "react";
import { reportMissingPlant } from "../services/api.js";

export default function EmptyStateActions({ pool, weakPool, dbCount, dbTarget }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [ctx, setCtx] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState(null);

  const totalMain = ["灌木", "草本", "地被"].reduce(
    (s, c) => s + (pool[c]?.length || 0),
    0,
  );
  const totalWeak = ["灌木", "草本", "地被"].reduce(
    (s, c) => s + (weakPool?.[c]?.length || 0),
    0,
  );

  // Show empty-state actions only when the overall match is sparse
  if (totalMain >= 3) return null;

  async function submit(e) {
    e.preventDefault();
    setErr(null);
    if (!name.trim()) return;
    try {
      await reportMissingPlant({ plant_name: name.trim(), context: ctx.trim() });
      setSent(true);
      setName("");
      setCtx("");
    } catch (e) {
      setErr(e.message || "送出失敗");
    }
  }

  const pct = Math.min(100, Math.round((dbCount / dbTarget) * 100));

  return (
    <section className="glass-thin p-5 space-y-4">
      <div className="text-sm" style={{ color: "var(--ink-primary)" }}>
        {totalMain === 0
          ? "目前資料庫沒有 ≥4★ 強匹配。"
          : `強匹配只有 ${totalMain} 筆,弱匹配 ${totalWeak} 筆。`}
        <span className="ml-1" style={{ color: "var(--ink-tertiary)" }}>
          可能是 DB 規模有限,或圖中為非台灣原生風格。
        </span>
      </div>

      <div>
        <div className="flex justify-between text-xs mb-1" style={{ color: "var(--ink-tertiary)" }}>
          <span>資料庫進度</span>
          <span>{dbCount} / {dbTarget} 種 ({pct}%)</span>
        </div>
        <div
          className="h-2 rounded-full overflow-hidden"
          style={{ background: "var(--mat-ultraThin)" }}
        >
          <div
            className="h-full transition-all duration-500 ease-glass"
            style={{
              width: `${pct}%`,
              background: "var(--accent-evergreen)",
            }}
          />
        </div>
      </div>

      {sent ? (
        <div className="text-sm" style={{ color: "var(--accent-evergreen)" }}>
          ✓ 已收到回報,謝謝!之後 DB 擴充會優先考慮。
        </div>
      ) : (
        <>
          {!open ? (
            <button
              onClick={() => setOpen(true)}
              className="text-sm px-4 py-2 glass-thick"
              style={{
                color: "var(--accent-evergreen)",
                borderRadius: "9999px",
              }}
            >
              回報您想找的植物 →
            </button>
          ) : (
            <form onSubmit={submit} className="space-y-2 text-sm">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="植物名稱 (中文或學名)"
                className="w-full px-3 py-2 glass-ultraThin"
                style={{ borderRadius: "12px", color: "var(--ink-primary)" }}
                required
                maxLength={120}
              />
              <input
                value={ctx}
                onChange={(e) => setCtx(e.target.value)}
                placeholder="情境(選填,例如:庭園陽光位、花色偏好)"
                className="w-full px-3 py-2 glass-ultraThin"
                style={{ borderRadius: "12px", color: "var(--ink-primary)" }}
                maxLength={240}
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-1.5 glass-thick"
                  style={{
                    color: "var(--accent-evergreen)",
                    borderRadius: "9999px",
                  }}
                >
                  送出
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-3 py-1.5 text-xs"
                  style={{ color: "var(--ink-tertiary)" }}
                >
                  取消
                </button>
              </div>
              {err && <div style={{ color: "var(--accent-petal)" }}>⚠ {err}</div>}
              <div className="text-[11px]" style={{ color: "var(--ink-tertiary)" }}>
                我們不收集個資,只記錄植物名稱與情境文字。
              </div>
            </form>
          )}
        </>
      )}
    </section>
  );
}
