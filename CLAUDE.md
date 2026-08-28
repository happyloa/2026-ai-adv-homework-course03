# CLAUDE.md — 花店電商後端 (AI 主記憶入口)

## 專案簡介

花店電商後端，提供商品瀏覽、購物車、訂單管理與 ECPay 綠界金流功能。

- **語言**：Node.js (CommonJS)
- **框架**：Express 4
- **資料庫**：Node.js 內建 SQLite（`node:sqlite` 同步 API）
- **模板引擎**：EJS
- **CSS**：Tailwind CSS v4（透過 CLI build）
- **測試**：Vitest + Supertest

## 核心指令

```bash
npm run dev:server   # 啟動開發伺服器（port 3001）
npm test             # 執行所有測試
npm run css:build    # 建置 Tailwind CSS
```

## 目錄結構（速覽）

```
├── .claude/            # AI 助手相關設定
│   └── rules/          # AI 開發規則與規範 (例如 main.md)
├── app.js              # Express app 設定
├── server.js           # HTTP server 入口
├── src/
│   ├── database.js     # SQLite 初始化 & seed 資料
│   ├── middleware/     # sessionMiddleware, errorHandler
│   └── routes/         # 各 API 路由
├── views/              # EJS 模板
├── public/             # 靜態資源
├── tests/              # Vitest 測試
└── CLAUDE.md           # AI 主記憶與專案入口 (本文件)
```

## 延伸文件（docs/）

| 文件 | 說明 |
|------|------|
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | 完整目錄結構、資料流、DB Schema |
| [DEVELOPMENT.md](./docs/DEVELOPMENT.md) | 命名規則、錯誤格式、開發規範 |
| [FEATURES.md](./docs/FEATURES.md) | 功能清單與現況 |
| [TESTING.md](./docs/TESTING.md) | 測試規範與範例 |
| [plans/](./docs/plans/) | 開發計畫（進行中）|
| [plans/archive/](./docs/plans/archive/) | 已完成計畫歸檔 |

## 環境變數（必填）

見 `.env.example`，關鍵變數：
- `JWT_SECRET` — JWT 簽章密鑰
- `BASE_URL` — 伺服器公開 URL（影響 ECPay ReturnURL）
- `ECPAY_MERCHANT_ID` / `ECPAY_HASH_KEY` / `ECPAY_HASH_IV` — 綠界金流憑證

## 重要規範

- **資料庫操作**：直接使用 `db.prepare(...).run()` / `.get()` / `.all()`，不使用 ORM
- **錯誤回應格式**：`{ data: null, error: 'ERROR_CODE', message: '說明' }`
- **成功回應格式**：`{ data: {...}, error: null, message: '說明' }`
- **中文**：回應 message 使用繁體中文，程式碼變數使用英文
- 詳細規範見 [DEVELOPMENT.md](./docs/DEVELOPMENT.md)
