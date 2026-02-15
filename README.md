# AI 語音記帳工具

🎤 使用語音自然語言輸入，AI 自動分類記帳。

## 功能特色

- 🎤 **語音記帳** — 說出消費，AI 自動辨識金額與分類
- ✍️ **手動記帳** — 傳統表單輸入方式
- 📊 **多維度分析** — 日/週/月/年消費圓餅圖、趨勢圖、長條圖
- 📱 **手機友善** — PWA 支援，可安裝至手機桌面
- 🔒 **隱私保障** — 所有資料儲存在瀏覽器本機

## 技術架構

- React + Vite
- TailwindCSS v4
- Recharts 圖表
- Dexie.js (IndexedDB)
- Web Speech API (語音辨識)
- Google Gemini API (AI 分類)

## 使用方式

1. 開啟網頁，點擊「設定」輸入 Gemini API Key
2. 切換到「語音」頁面，按下麥克風說出消費
3. 確認 AI 辨識結果後儲存
4. 在「分析」頁面查看消費統計

## 開發

```bash
npm install
npm run dev
```

## 部署

推送到 `main` 分支即自動部署至 GitHub Pages。
