# TESTING.md — 測試規範

## 測試技術棧

- **框架**：Vitest（Node.js 測試執行器）
- **HTTP 測試**：Supertest（整合測試）
- **設定**：`vitest.config.js`

## 執行測試

```bash
npm test          # 執行所有測試
```

## 測試檔案結構

```
tests/
├── setup.js              # 測試環境初始化（使用記憶體 DB）
├── auth.test.js          # 認證 API 測試
├── products.test.js      # 商品 API 測試
├── cart.test.js          # 購物車 API 測試
├── orders.test.js        # 訂單 API 測試
├── adminProducts.test.js # 後台商品管理測試
└── adminOrders.test.js   # 後台訂單管理測試
```

## 測試環境設定

測試時使用獨立記憶體資料庫，避免影響開發資料：

```js
// tests/test-env.js
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-vitest-only';
// 使用 :memory: SQLite，每次測試完全隔離
```

## 測試撰寫規範

### 基本結構

```js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';

describe('Auth API', () => {
  describe('POST /api/auth/login', () => {
    it('應使用正確憑證登入', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@hexschool.com', password: '12345678' });
      expect(res.status).toBe(200);
      expect(res.body.error).toBeNull();
      expect(res.body.data).toHaveProperty('token');
    });

    it('密碼錯誤應回傳 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@hexschool.com', password: 'wrong' });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });
  });
});
```

### 命名規範

- `describe` 使用「模組名稱 API」格式
- `it` 使用「應...」開頭的中文描述
- 測試正向與負向情境

### 認證測試

需要登入的測試，先取得 token 再帶入：

```js
let token;

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@hexschool.com', password: '12345678' });
  token = res.body.data.token;
});

it('應取得用戶資訊', async () => {
  const res = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
});
```

## 測試覆蓋範圍

### 目前已測試

| 模組 | 測試情境 |
|------|---------|
| 認證 | 登入成功/失敗、登出、取得我的資訊 |
| 商品 | 商品列表、商品詳情 |
| 購物車 | 查看、新增、修改、刪除、清空 |
| 訂單 | 建立、查詢列表、查詢詳情 |
| 後台商品 | 列表、新增、修改、刪除 |
| 後台訂單 | 列表、更新狀態 |

### 未被自動測試（人工驗證）

- ECPay 付款流程（需連線外部服務）
- EJS 頁面渲染

## 不可做的事

- **不可**在測試中修改真實 `database.sqlite`
- **不可**在測試中引用真實 `.env` 中的 ECPay 金流帳號
- **不可**在 `it()` 中做非同步操作卻不使用 `async/await`
