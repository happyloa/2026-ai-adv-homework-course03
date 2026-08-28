# ARCHITECTURE.md — 專案架構文件

## 目錄結構

```
2026-ai-adv-homework-course01/
├── app.js                    # Express app 設定、中介層、路由掛載
├── server.js                 # HTTP server 入口（port 3001）
├── vitest.config.js          # Vitest 測試設定
├── public/                   # 靜態資源
│   ├── css/
│   │   ├── input.css         # Tailwind CSS 輸入
│   │   └── output.css        # 建置後的 CSS
│   └── js/                   # 前端 JS
├── src/
│   ├── database.js           # SQLite 初始化 & seed 資料，匯出 db 實例
│   ├── middleware/
│   │   ├── sessionMiddleware.js  # Session 設定
│   │   └── errorHandler.js      # 全域錯誤處理
│   ├── routes/
│   │   ├── authRoutes.js         # 認證：登入/登出/註冊/我的資訊
│   │   ├── productRoutes.js      # 商品：列表/詳情
│   │   ├── cartRoutes.js         # 購物車：查看/新增/修改/刪除
│   │   ├── orderRoutes.js        # 訂單：建立/查詢/金流
│   │   ├── adminProductRoutes.js # 後台：商品管理 CRUD
│   │   ├── adminOrderRoutes.js   # 後台：訂單管理
│   │   └── pageRoutes.js         # 頁面路由（EJS 渲染）
│   └── utils/
│       └── ecpay.js             # ECPay 工具函式（CMV 計算、表單產生）
├── views/
│   ├── layouts/
│   │   └── front.ejs            # 前台主版型
│   ├── pages/                   # 各頁面 EJS
│   └── partials/                # 共用元件
├── tests/
│   ├── setup.js                 # 測試環境初始化
│   ├── auth.test.js
│   ├── products.test.js
│   ├── cart.test.js
│   ├── orders.test.js
│   ├── adminProducts.test.js
│   └── adminOrders.test.js
├── .claude/
│   └── rules/                   # AI 開發規則與規範
├── docs/
│   ├── ARCHITECTURE.md          # 此文件
│   ├── DEVELOPMENT.md
│   ├── FEATURES.md
│   ├── TESTING.md
│   └── plans/
│       └── archive/
└── CLAUDE.md                    # AI 主記憶入口
```

## 資料流

### 一般 API 請求流程

```
使用者請求
  → Express Router (src/routes/)
  → Middleware（sessionMiddleware、body-parser）
  → 路由處理函式
    → db.prepare(...).get/.all/.run()  # 同步 SQLite 操作
    → 業務邏輯處理
  → res.json({ data, error, message })
```

### ECPay 付款流程（AIO CMV-SHA256）

```
前端點擊付款
  → POST /api/orders/:id/pay
  → 後端計算 CheckMacValue
  → 回傳自動提交的 HTML 表單
  → 瀏覽器 POST 至 ECPay 測試環境
  → 消費者完成付款（或 SimulatePaid=1 模擬）
  → ECPay POST 至 ReturnURL（/api/ecpay/notify）
  → 後端驗證 CheckMacValue + 更新訂單狀態
  → 回應 "1|OK"
```

## 資料庫 Schema

使用 SQLite，透過 Node.js 內建 `node:sqlite` 同步 API 操作。

### users 資料表

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | TEXT PK | UUID |
| email | TEXT UNIQUE | 使用者信箱 |
| password_hash | TEXT | bcrypt 雜湊密碼 |
| name | TEXT | 顯示名稱 |
| role | TEXT | 'user' 或 'admin' |
| created_at | TEXT | ISO 日期時間 |

### products 資料表

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | TEXT PK | UUID |
| name | TEXT | 商品名稱 |
| description | TEXT | 商品描述 |
| price | INTEGER | 定價（新台幣，必須 > 0） |
| stock | INTEGER | 庫存數量（必須 >= 0） |
| image_url | TEXT | 商品圖片 URL |
| created_at | TEXT | 建立時間 |
| updated_at | TEXT | 更新時間 |

### cart_items 資料表

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | TEXT PK | UUID |
| session_id | TEXT | 未登入用戶的 session |
| user_id | TEXT FK | 登入用戶 ID |
| product_id | TEXT FK | 商品 ID |
| quantity | INTEGER | 數量（必須 > 0） |

### orders 資料表

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | TEXT PK | UUID |
| order_no | TEXT UNIQUE | 訂單編號（系統產生） |
| merchant_trade_no | TEXT | ECPay 訂單編號（≤20 字元） |
| ecpay_trade_no | TEXT | 綠界端交易編號（notify 後回填） |
| user_id | TEXT FK | 下單用戶 ID |
| recipient_name | TEXT | 收件人姓名 |
| recipient_email | TEXT | 收件人信箱 |
| recipient_address | TEXT | 收件地址 |
| total_amount | INTEGER | 訂單總金額 |
| status | TEXT | 'pending' / 'paid' / 'failed' |
| created_at | TEXT | 建立時間 |

### order_items 資料表

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | TEXT PK | UUID |
| order_id | TEXT FK | 訂單 ID |
| product_id | TEXT FK | 商品 ID |
| product_name | TEXT | 快照：商品名稱 |
| product_price | INTEGER | 快照：商品單價 |
| quantity | INTEGER | 購買數量 |

## API 路由總覽

### 認證 `/api/auth`

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | /login | 登入（email/password → JWT） |
| POST | /logout | 登出 |
| POST | /register | 註冊 |
| GET | /me | 取得目前登入用戶資訊 |

### 商品 `/api/products`

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | / | 商品列表 |
| GET | /:id | 商品詳情 |

### 購物車 `/api/cart`

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | / | 查看購物車 |
| POST | / | 加入商品 |
| PUT | /:id | 修改數量 |
| DELETE | /:id | 移除商品 |
| DELETE | / | 清空購物車 |

### 訂單 `/api/orders`

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | / | 我的訂單列表 |
| GET | /:id | 訂單詳情 |
| POST | / | 建立訂單 |
| POST | /:id/pay | 取得 ECPay 付款表單 |
| POST | /ecpay/notify | ECPay ReturnURL（付款結果通知） |
| ALL | /ecpay/result | ECPay 付款結果頁（前端跳轉，接收本地回傳 Fallback） |

### 後台 `/api/admin`

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | /products | 商品列表 |
| POST | /products | 新增商品 |
| PUT | /products/:id | 修改商品 |
| DELETE | /products/:id | 刪除商品 |
| GET | /orders | 訂單列表 |
| PUT | /orders/:id | 更新訂單狀態 |
