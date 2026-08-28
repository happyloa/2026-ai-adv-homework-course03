# ECPay 綠界金流整合計畫（歸檔）

> 狀態：✅ 已完成並歸檔  
> 完成日：2026-04-08

## 目標

為花店電商後端新增 ECPay 全方位金流（AIO）付款功能。

## 技術選型

- **協議**：AIO 全方位金流（CMV-SHA256）
- **環境**：測試環境 `payment-stage.ecpay.com.tw`
- **測試帳號**：MerchantID=3002607 / HashKey=pwFHCqoQZGmho4w6 / HashIV=EkRm7iFT261dpevs
- **模擬付款**：測試環境自動啟用 `SimulatePaid=1`

## 實作內容

### 新增檔案

| 檔案 | 說明 |
|------|------|
| `src/utils/ecpay.js` | ECPay 工具函式庫（CheckMacValue、表單產生、URL encode） |
| `src/routes/ecpayRoutes.js` | ECPay API 路由（付款表單、notify、result） |

### 異動檔案

| 檔案 | 說明 |
|------|------|
| `app.js` | 掛載 `/api/ecpay` 路由 |
| `src/database.js` | orders 資料表新增 `merchant_trade_no`、`ecpay_trade_no` 欄位 |

## API 說明

### POST /api/ecpay/pay/:orderId
- 需要登入（JWT Bearer token）
- 訂單狀態必須為 `pending`
- 產生自動提交的 HTML 表單，瀏覽器收到後自動跳轉至綠界付款頁
- 同時將 `merchant_trade_no` 儲存至訂單

### POST /api/ecpay/notify
- ECPay ReturnURL（S2S 通知，不需要 JWT）
- 驗證 CheckMacValue（timing-safe 比對）
- 冪等處理（只在 `pending` 狀態時更新）
- 正確回應純文字 `1|OK`，HTTP 200

### GET /api/ecpay/result
- ECPay OrderResultURL / ClientBackURL（前端跳轉）
- 顯示付款結果（成功/失敗）

## 驗證步驟

1. 確認 `.env` 含 ECPAY_MERCHANT_ID、ECPAY_HASH_KEY、ECPAY_HASH_IV
2. 啟動伺服器：`npm run dev:server`
3. 登入取得 JWT token
4. 建立訂單（POST /api/orders）
5. 呼叫 POST /api/ecpay/pay/:orderId
6. 瀏覽器自動跳轉至綠界測試付款頁
7. 使用測試信用卡 4311-9522-2222-2222 完成付款
8. 至綠界[測試商店後台](https://vendor-stage.ecpay.com.tw)確認訂單

## 注意事項

- 本地端 ReturnURL 無法接收綠界回調，需透過 ngrok 或直接從綠界後台確認付款
- 測試環境自動啟用 `SimulatePaid=1`，切换正式環境時需移除
- CheckMacValue 使用 timing-safe 比對（crypto.timingSafeEqual）
- MerchantTradeNo ≤ 20 字元，僅限英數字格式：`FP` + 12 位時間戳
