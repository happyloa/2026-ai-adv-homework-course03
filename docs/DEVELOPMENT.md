# DEVELOPMENT.md — 開發規範

> 所有 AI Agent 開發時必須遵守本文件的規範，違反這些規則會產出不符合專案風格的程式碼。

## 技術棧規格

- **執行環境**：Node.js 24+（CommonJS，不使用 ES Module）
- **框架**：Express 4
- **資料庫**：Node.js 內建 `node:sqlite`（同步 API，不使用 async/await）
- **認證**：JSON Web Token (jsonwebtoken)
- **密碼**：bcrypt
- **ID 產生**：uuid v4
- **模板**：EJS
- **CSS**：Tailwind CSS v4 via CLI
- **測試**：Vitest + Supertest

## 命名規則

### 變數與函式

- 使用 **camelCase**：`orderNo`、`userId`、`hashKey`
- 布林值加 is/has 前綴：`isAdmin`、`hasStock`
- 路由處理函式命名：`getProducts`、`createOrder`、`updateOrderStatus`

### 資料庫欄位

- 使用 **snake_case**：`user_id`、`order_no`、`created_at`
- JS 操作時不做 camelCase 轉換（直接使用 `row.user_id`）

### 檔案命名

- 路由檔：`[entity]Routes.js`（如 `orderRoutes.js`）
- 中介層：`[name]Middleware.js` 或 `[name]Handler.js`
- 工具函式：`[name].js`（如 `ecpay.js`）
- 測試：`[entity].test.js`

## 回應格式規範

### 成功回應（HTTP 200）

```js
res.json({
  data: { /* 實際資料 */ },
  error: null,
  message: '操作成功的說明（繁體中文）'
});
```

### 錯誤回應

```js
res.status(400).json({
  data: null,
  error: 'ERROR_CODE',      // 全大寫英文，底線分隔
  message: '錯誤說明（繁體中文）'
});
```

### 常用錯誤碼

| 狀態碼 | error 代碼 | 情境 |
|--------|-----------|------|
| 400 | VALIDATION_ERROR | 輸入格式錯誤 |
| 400 | INVALID_INPUT | 欄位值無效 |
| 401 | UNAUTHORIZED | 未登入 |
| 403 | FORBIDDEN | 無權限（已登入但角色不符） |
| 404 | NOT_FOUND | 資源不存在 |
| 409 | CONFLICT | 資源衝突（重複資料） |
| 500 | INTERNAL_ERROR | 伺服器內部錯誤 |

## 資料庫操作規範

- **不使用 ORM**，直接操作 `db.prepare().run()/.get()/.all()`
- **同步 API**：`node:sqlite` 全部為同步，不需要 `async/await`
- **批次操作**：使用 `db.transaction(() => {...})` 包裝多筆寫入
- **ID**：主鍵一律使用 `uuidv4()` 產生

```js
const db = require('../database');
const { v4: uuidv4 } = require('uuid');

// 查詢
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

// 新增
db.prepare('INSERT INTO orders (id, ...) VALUES (?, ...)').run(uuidv4(), ...);

// 批次
const insertItem = db.prepare('INSERT INTO order_items ...');
const insertMany = db.transaction((items) => {
  for (const item of items) insertItem.run(...);
});
insertMany(orderItems);
```

## 認證規範

- 登入後使用 JWT 儲存於 cookie（httpOnly）
- 中介層 `sessionMiddleware` 解析 JWT，將用戶資訊掛在 `req.user`
- `req.user` 可能為 null（未登入）
- 需要登入的路由：驗證 `req.user`，否則回 401
- 需要管理員的路由：驗證 `req.user.role === 'admin'`，否則回 403

## 錯誤處理規範

- 路由函式使用 `try/catch` 包裹
- `catch (err)` 傳給 `next(err)` 由全域 errorHandler 處理
- 可預期錯誤（如 404、401）直接 `return res.status().json()`
- 不可在 errorHandler 之外吐出未格式化的錯誤

```js
router.get('/:id', (req, res, next) => {
  try {
    const item = db.prepare('SELECT ...').get(req.params.id);
    if (!item) {
      return res.status(404).json({ data: null, error: 'NOT_FOUND', message: '找不到此資源' });
    }
    res.json({ data: item, error: null, message: '查詢成功' });
  } catch (err) {
    next(err);
  }
});
```

## 中文使用規範

- **API 回應 message**：一律使用繁體中文
- **程式碼**：變數名、函式名、欄位名使用英文
- **注解**：可中英混用，說明以繁體中文為主
- **EJS 模板**：頁面文字使用繁體中文

## 環境變數規範

所有敏感設定透過 `.env` 管理，必要欄位見 `.env.example`。

- **不可**將真實憑證（JWT_SECRET、ECPAY_HASH_KEY 等）寫入版本控制
- `process.env.NODE_ENV` 用於區分測試／開發／正式環境

### 環境變數清單

| 變數名稱 | 說明 | 範例 / 預設值 |
|----------|------|---------------|
| `JWT_SECRET` | JWT 簽章密鑰，用於驗證 Token 來源 | `your_jwt_secret_key` |
| `BASE_URL` | 伺服器公開 URL，影響綠界 ReturnURL 等回呼位址 | `http://localhost:3001` |
| `ECPAY_MERCHANT_ID` | 綠界金流特店編號（測試環境需使用官方測試用參數） | `3002607` |
| `ECPAY_HASH_KEY` | 綠界金流 HashKey（測試環境需使用官方測試用參數） | `pwFHCqoQZGmho4w6` |
| `ECPAY_HASH_IV` | 綠界金流 HashIV（測試環境需使用官方測試用參數） | `EkRm7iFT261dpevs` |
| `NODE_ENV` | 決定程式運行的模式（如開關測試用 log 或是判斷環境） | `development` / `production` / `test` |

## 開發工作流程

以下是新增或修改路由的完整步驟：

1. **定義路由檔與結構**：在 `src/routes/` 目錄建立或修改對應的路由檔（如 `[entity]Routes.js`），並掛載至 `app.js`。
2. **權限中介層**：如果需要登入或特定身份，在此路由套用 `authMiddleware` 等檢查機制。
3. **實作邏輯與資料庫操作**：使用 `db.prepare()` 進行資料操作，確保輸入驗證，並以規定之格式回傳 `{ data, error, message }`。
4. **錯誤處理**：在路由函式內加上 `try/catch`，若有非預期的例外透過 `next(err)` 讓全域錯誤處理器接手；預期內的錯誤則直接以特定 status code 回傳 JSON。
5. **更新相關文件**：若為對外 API，可利用 Swagger JSDoc 在路由上方加入或更新 `@openapi` 註解。
6. **撰寫測試案例**：在 `tests/` 目錄下撰寫對應的 Supertest/Vitest 測試，涵蓋成功與不同錯誤情境。
7. **確認順利執行**：本機跑 `npm test` 確認無回歸錯誤，再送出 Commit。

## ECPay 金流規範

- **協議**：AIO 全方位金流（CMV-SHA256）
- **工具函式**：全部集中在 `src/utils/ecpay.js`
- **MerchantTradeDate**：必須使用台灣時間（UTC+8），格式 `yyyy/MM/dd HH:mm:ss`
- **MerchantTradeNo**：最長 20 字元，僅限英數字
- **ReturnURL 回應**：必須回傳純文字 `1|OK`，HTTP 200
- **CheckMacValue 驗證**：使用 timing-safe 比對（crypto.timingSafeEqual）
- **不可**在前端或版本控制中暴露 HashKey/HashIV

## Git 規範

- commit 訊息使用繁體中文
- 格式：`feat: 功能說明` / `fix: 修正說明` / `docs: 文件說明`
