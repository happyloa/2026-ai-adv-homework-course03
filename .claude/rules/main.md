# Claude Code 額外規則

## 語言規則
- 所有 commit 訊息使用繁體中文
- API 回應 message 使用繁體中文
- 程式碼變數、函式名稱使用英文

## 程式碼規範
- 使用 CommonJS（require/module.exports），不使用 ES Module（import/export）
- better-sqlite3 使用同步 API，不使用 async/await 處理資料庫操作
- 所有使用者來源的資料都必須進行驗證

## 錯誤處理
- 所有路由使用 try/catch
- 錯誤使用統一格式：{ data: null, error: 'ERROR_CODE', message: '繁體中文說明' }
- 不可在路由外吐出未格式化的錯誤

## 測試
- 新功能需搭配測試，位於 tests/ 資料夾
- 測試使用 vitest + supertest

## 安全性
- 不可將 HashKey、HashIV、JWT_SECRET 等敏感資訊寫入程式碼
- 所有敏感設定透過環境變數管理
