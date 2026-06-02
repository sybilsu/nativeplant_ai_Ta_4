import { useState } from "react";
import Header from "./components/Header.jsx";
import UploadDropzone from "./components/UploadDropzone.jsx";
import IdentifiedList from "./components/IdentifiedList.jsx";
import ColorTray, { COLOR_VOCAB } from "./components/ColorTray.jsx";
import PoolByCategory from "./components/PoolByCategory.jsx";
import EmptyStateActions from "./components/EmptyStateActions.jsx";
import { identifyImage } from "./services/api.js";

const DB_TOTAL_TARGET = 1000;

export default function App() {
  const [pool, setPool] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState(null);
  const [colors, setColors] = useState([]);
  const [referenceUrl, setReferenceUrl] = useState(null);

  async function handleUpload(file) {
    setError(null);
    setPool(null);
    setLoading(true);
    setProgress("壓縮圖片中…");
    try {
      const url = URL.createObjectURL(file);
      setReferenceUrl(url);
      setProgress("辨識中…");
      const data = await identifyImage(file);
      setPool(data);
      setProgress("");
    } catch (e) {
      setError(e.message || "辨識失敗,請再試一次");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setPool(null);
    setColors([]);
    setError(null);
    if (referenceUrl) URL.revokeObjectURL(referenceUrl);
    setReferenceUrl(null);
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={
        referenceUrl
          ? { "--reference-image-url": `url(${referenceUrl})` }
          : undefined
      }
    >
      <Header dbCount={pool?.db_count ?? 25} dbTarget={DB_TOTAL_TARGET} onReset={reset} hasResult={!!pool} />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 pt-6 space-y-6">
        {!pool && (
          <section>
            <UploadDropzone onUpload={handleUpload} loading={loading} progress={progress} />
          </section>
        )}

        {error && (
          <div className="glass-thin p-4 text-sm" style={{ color: "var(--accent-petal)" }}>
            ⚠ {error}
          </div>
        )}

        {pool && (
          <>
            <IdentifiedList identified={pool.identified} model={pool.model} />
            <ColorTray selected={colors} onChange={setColors} />
            <PoolByCategory pool={pool.pool} weakPool={pool.weak_pool} selectedColors={colors} />
            <EmptyStateActions
              pool={pool.pool}
              weakPool={pool.weak_pool}
              dbCount={pool.db_count}
              dbTarget={DB_TOTAL_TARGET}
            />
          </>
        )}
      </main>

      <footer className="text-center text-xs py-4" style={{ color: "var(--ink-tertiary)" }}>
        植徑 v.2 · DB v{pool?.db_version ?? "—"} · no tracking · no analytics
      </footer>
    </div>
  );
}
