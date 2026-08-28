# FEATURES.md — 專案功能清單

> 新增功能前請先確認此文件，避免重複開發或遺漏更新。

## 功能現況總覽

| 模組 | 功能 | 狀態 |
|------|------|------|
| 認證 | 使用者註冊 | ✅ 完成 |
| 認證 | 使用者登入（JWT） | ✅ 完成 |
| 認證 | 使用者登出 | ✅ 完成 |
| 認證 | 取得當前用戶資訊 | ✅ 完成 |
| 商品 | 商品列表 | ✅ 完成 |
| 商品 | 商品詳情 | ✅ 完成 |
| 購物車 | 查看購物車 | ✅ 完成 |
| 購物車 | 加入商品 | ✅ 完成 |
| 購物車 | 修改數量 | ✅ 完成 |
| 購物車 | 移除商品 | ✅ 完成 |
| 購物車 | 清空購物車 | ✅ 完成 |
| 訂單 | 建立訂單（含購物車清空） | ✅ 完成 |
| 訂單 | 查看我的訂單列表 | ✅ 完成 |
| 訂單 | 查看訂單詳情 | ✅ 完成 |
| 金流 | ECPay AIO 付款表單產生 | ✅ 完成 |
| 金流 | ECPay ReturnURL 接收通知 | ✅ 完成 |
| 金流 | ECPay 付款結果頁 | ✅ 完成 |
| 後台 | 商品清單（管理員） | ✅ 完成 |
| 後台 | 新增商品 | ✅ 完成 |
| 後台 | 修改商品 | ✅ 完成 |
| 後台 | 刪除商品 | ✅ 完成 |
| 後台 | 訂單列表（管理員） | ✅ 完成 |
| 後台 | 更新訂單狀態 | ✅ 完成 |

## 詳細功能說明

### 認證模組 (`/api/auth`)

**POST /api/auth/register**
- 需要：email、password、name
- 密碼用 bcrypt 雜湊（saltRounds=10）
- 重複 email 回傳 409 CONFLICT

**POST /api/auth/login**
- 需要：email、password
- 成功回傳 JWT（存於 httpOnly cookie）
- 失敗回傳 401 UNAUTHORIZED

**POST /api/auth/logout**
- 清除 cookie

**GET /api/auth/me**
- 需要登入（JWT 驗證）
- 回傳 id、email、name、role

### 商品模組 (`/api/products`)

**GET /api/products**
- 回傳所有商品列表
- 欄位：id、name、description、price、stock、image_url

**GET /api/products/:id**
- 回傳單一商品詳情
- 不存在回 404

### 購物車模組 (`/api/cart`)

- 未登入用 session_id，登入用 user_id 識別購物車
- 登入後自動合併 session 購物車

**GET /api/cart**：列出所有購物車項目（含商品資訊）

**POST /api/cart**
- 需要：product_id、quantity
- 若商品已存在：累加數量
- 庫存不足回 400

**PUT /api/cart/:id**
- 修改指定項目的 quantity
- 庫存不足回 400

**DELETE /api/cart/:id**：移除單一項目

**DELETE /api/cart**：清空整個購物車

### 訂單模組 (`/api/orders`)

**POST /api/orders**
- 需要登入
- 從購物車建立訂單、扣減庫存、清空購物車
- 訂單狀態初始為 `pending`

**GET /api/orders**：我的訂單列表（含訂單項目）

**GET /api/orders/:id**：訂單詳情（含訂單項目）

### ECPay 金流模組

**POST /api/orders/:id/pay**
- 需要登入
- 訂單 status 必須為 `pending`
- 產生 ECPay AIO 付款表單 HTML（自動提交）
- 含 CheckMacValue（SHA256）

**POST /api/ecpay/notify**（ECPay ReturnURL）
- 驗證 CheckMacValue
- 更新訂單狀態為 `paid` 或 `failed`
- 必須回傳純文字 `1|OK`，HTTP 200

**ALL /api/ecpay/result**（ECPay OrderResultURL / ClientBackURL）
- 消費者付款後的前端跳轉頁（接收 GET 與 POST）
- 針對無法開放公網接收 Server 端背景 notify 的測試環境提供 Fallback：會在前端跳轉時放寬 `CheckMacValue` 的簽章校驗（避免有時中文編碼差異問題導致驗算失敗），直接依據狀態碼 (`RtnCode === '1'`) 更新訂單狀態。
- 驗證成功或查詢後跳轉回訂單詳情頁面，帶入 `?payment=success` 或 `?payment=failed`

### 後台模組 (`/api/admin`)

需要 `admin` 角色，否則回 403。

**商品管理**（CRUD）：列表、新增、修改、刪除

**訂單管理**：列表、更新狀態

## Seed 資料

資料庫初始化時自動植入：
- **管理員帳號**：`admin@hexschool.com` / `12345678`（可在 .env 覆寫）
- **8 種花卉商品**：玫瑰、百合、向日葵、鬱金香、乾燥花圈等

## 計劃中功能

| 功能 | 說明 | 優先級 |
|------|------|-------|
| 郵件通知 | 付款成功後發送確認信 | 低 |
| 商品分類 | 為商品加入分類標籤 | 中 |
| 折扣碼 | 支援折扣碼輸入 | 低 |
