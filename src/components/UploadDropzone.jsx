import { useRef, useState } from "react";

export default function UploadDropzone({ onUpload, loading, progress }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  function pickFile(file) {
    if (!file) return;
    if (!/^image\/(jpe?g|png|webp)$/i.test(file.type)) {
      alert("僅支援 JPG / PNG / WebP 圖片");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("圖片大於 10 MB,請壓縮後再試");
      return;
    }
    onUpload(file);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        pickFile(e.dataTransfer.files?.[0]);
      }}
      onClick={() => inputRef.current?.click()}
      className="glass-ultraThin p-10 sm:p-16 text-center cursor-pointer transition-all duration-200 ease-glass"
      style={{
        borderRadius: "28px",
        borderStyle: "dashed",
        borderWidth: dragOver ? "2px" : "1px",
        borderColor: dragOver ? "var(--accent-evergreen)" : "var(--hairline-dark)",
        transform: dragOver ? "scale(1.01)" : "scale(1)",
        opacity: loading ? 0.7 : 1,
      }}
      role="button"
      tabIndex={0}
      aria-label="上傳植物景觀照片"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => pickFile(e.target.files?.[0])}
      />

      {loading ? (
        <div className="space-y-3">
          <div className="text-lg font-display" style={{ color: "var(--ink-primary)" }}>
            {progress || "處理中…"}
          </div>
          <div className="inline-block h-1 w-32 rounded-full overflow-hidden" style={{ background: "var(--ink-quaternary)" }}>
            <div
              className="h-full"
              style={{
                background: "var(--accent-evergreen)",
                width: "40%",
                animation: "ud-shimmer 1.2s ease-in-out infinite alternate",
              }}
            />
          </div>
          <style>{`@keyframes ud-shimmer { from { transform: translateX(-20%); } to { transform: translateX(180%); } }`}</style>
        </div>
      ) : (
        <>
          <div className="text-4xl mb-3" aria-hidden>📷</div>
          <div className="font-display text-xl mb-2" style={{ color: "var(--ink-primary)" }}>
            拖入你想模仿的植物景觀
          </div>
          <div className="text-sm mb-4" style={{ color: "var(--ink-secondary)" }}>
            或 點此選擇圖片
          </div>
          <div className="text-xs" style={{ color: "var(--ink-tertiary)" }}>
            JPG / PNG / WebP · 最大 10 MB
          </div>
        </>
      )}
    </div>
  );
}
