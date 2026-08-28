# 花漾生活｜AI 開發進化營第三場作業

本專案延續第二場的花卉電商，完成配送費用、分層測試、Postman Collection 與 GitHub Actions 自動化測試流程。

## 本次完成項目（LV3）

- `src/utils/shipping.js`：可獨立測試的配送費用模組。
- 訂單流程保存商品小計、運費、配送方式、偏遠地區與急件快照，並將運費納入綠界收款總額。
- 結帳頁可選擇宅配／超商取貨與宅配附加選項；訂單詳情可查看配送明細。
- Unit Test、Integration Test、Playwright E2E Test，以及由 OpenAPI 產生的 Postman Collection。
- `.github/workflows/test.yml`：推送與 Pull Request 時自動執行 Unit 與 Integration Test。

配送規則與 API 說明請見 [docs/SHIPPING.md](docs/SHIPPING.md)。

## 安裝與執行

需求：Node.js 24 以上。

```powershell
npm install
npm run test:unit
npm run test:integration
npm run postman
```

`npm run postman` 會先更新 `openapi.json`，再產生 `postman/flower-shop.postman_collection.json`。

## E2E 測試

請先在另一個終端機啟動既有專案（預設 `http://localhost:3001`），再執行測試：

```powershell
$env:JWT_SECRET = '請使用本機安全字串'
npm run dev:server

# 另一個終端機
npm run test:e2e
```

E2E 使用題目指定的管理員帳號 `admin@hexschool.com` / `12345678`，執行商品加入購物車、配送選項、建立訂單、網路 ATM、台灣土地銀行、`Save`、回站付款成功與 `paid` 狀態驗證。測試不會自行啟動伺服器；成功截圖會放在被 Git 忽略的 `test-results/`。

由於本機 `localhost` 無法接收綠界外部的 ReturnURL，日常可重跑 E2E 以 Playwright 攔截綠界測試頁並送出有效簽章的 callback，完整驗證本站付款狀態。若要錄製真正綠界 staging ATM 流程，請先以公開 HTTPS 網址設定 `BASE_URL`。

## 環境變數

請從 `.env.example` 建立本機 `.env`，不要提交任何機密值。

| 變數 | 用途 |
| --- | --- |
| `JWT_SECRET` | JWT 簽章金鑰，啟動伺服器必填。 |
| `BASE_URL` | 綠界 callback 使用的公開網站網址；真實 staging 流程必須是可公開 HTTPS。 |
| `ECPAY_MERCHANT_ID` | 綠界特店編號。 |
| `ECPAY_HASH_KEY` / `ECPAY_HASH_IV` | 綠界簽章金鑰。 |
| `ECPAY_ENV` | `staging` 或 `production`。 |
| `E2E_BASE_URL` | 可選；覆寫 E2E 目標站，預設為 `http://localhost:3001`。 |

## 來源基底

- 第二場作業基底：[happyloa/2026-ai-adv-homework-course02](https://github.com/happyloa/2026-ai-adv-homework-course02)
- 第三場作業儲存庫：[happyloa/2026-ai-adv-homework-course03](https://github.com/happyloa/2026-ai-adv-homework-course03)
