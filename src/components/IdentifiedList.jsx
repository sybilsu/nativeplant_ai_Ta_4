import { useState } from "react";

export default function IdentifiedList({ identified, model }) {
  const [expanded, setExpanded] = useState(false);
  if (!identified || identified.length === 0) return null;

  const shown = expanded ? identified : identified.slice(0, 3);

  return (
    <section className="glass-ultraThin p-4 sm:p-5">
      <header className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium" style={{ color: "var(--ink-secondary)" }}>
          AI 看到了 <strong style={{ color: "var(--ink-primary)" }}>{identified.length}</strong> 株植物
          {model && (
            <span className="ml-2 text-xs" style={{ color: "var(--ink-tertiary)" }}>
              · {model.replace("claude-", "").replace(/-\d{8}$/, "")}
            </span>
          )}
        </div>
        {identified.length > 3 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs"
            style={{ color: "var(--accent-evergreen)" }}
          >
            {expanded ? "收合 ▴" : `展開全部 ▾`}
          </button>
        )}
      </header>

      <div className="overflow-x-auto -mx-2 px-2">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr style={{ color: "var(--ink-tertiary)" }}>
              <th className="text-left py-1.5 pr-3 font-medium">ID</th>
              <th className="text-left py-1.5 pr-3 font-medium">名稱</th>
              <th className="text-left py-1.5 pr-3 font-medium">類別</th>
              <th className="text-left py-1.5 pr-3 font-medium">葉形</th>
              <th className="text-left py-1.5 pr-3 font-medium">高度</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.id} className="border-t" style={{ borderColor: "var(--hairline-dark)" }}>
                <td className="py-1.5 pr-3" style={{ color: "var(--ink-tertiary)" }}>{p.id}</td>
                <td className="py-1.5 pr-3" style={{ color: "var(--ink-primary)" }}>{p.common_name}</td>
                <td className="py-1.5 pr-3">
                  <span className="inline-block px-1.5 py-0.5 text-[10px] rounded" style={{ background: "var(--mat-ultraThick)", color: "var(--ink-secondary)" }}>
                    {p.category}
                  </span>
                </td>
                <td className="py-1.5 pr-3" style={{ color: "var(--ink-secondary)" }}>{p.foliage}</td>
                <td className="py-1.5 pr-3" style={{ color: "var(--ink-secondary)" }}>
                  {p.height_estimate_m?.join("–")} m
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
