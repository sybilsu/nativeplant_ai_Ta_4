# 植徑 v.2 (nativeplant_ai_Ta_4)

圖像形態匹配 → 台灣原生植物推薦,iOS 毛玻璃介面。

## Quickstart

```bash
# 1. 安裝依賴
npm install
npm install -g netlify-cli   # 第一次才需要

# 2. 設定 API 金鑰
cp .env.example .env         # 編輯填入 ANTHROPIC_API_KEY

# 3. 本機開發 (Vite + Functions 一起跑)
netlify dev                  # 開 http://localhost:8888

# 4. 建置
npm run build
```

## 結構

| 路徑 | 內容 |
|---|---|
| `src/` | React 前端 (App + 7 components + services) |
| `netlify/functions/` | Serverless API (identify, report, db-version, agent stubs, cron) |
| `data/` | `plants_enriched.json` — DB,Phase A 一次性產出 |
| `scripts/` | `enrich_csv.mjs` (CLI 補欄位), `run_step1.mjs` (CLI 實驗) |
| `taiwan native/` | 原始 CSV + 植物照片 (25 種) |
| `experiment/` | 5 次原型實驗結果 |
| `spec.md` `design.md` `sop.md` `deployment.md` | 設計文件 |

## 部署 (Netlify)

詳見 `deployment.md`。GitHub repo: https://github.com/sybilsu/nativeplant_ai_Ta_4

```bash
# 推送 → Netlify auto-deploy
git add . && git commit -m "..." && git push
```

Netlify env vars 必設:
- `ANTHROPIC_API_KEY`
- `SONNET_MODEL=claude-sonnet-4-6`
- `HAIKU_MODEL=claude-haiku-4-5-20251001`
- (Phase 7 才需要) `OPENCLAW_SHARED_SECRET`

## 設計原則

- 純 API key 計費,無訂閱依賴
- 不收集個資、不放 telemetry
- API key 永遠在 Netlify 後端,client 看不到
- Step 1 評分 = 純程式 (Rule 5);只有 Vision 用 LLM
