# AI 開發進化營第三場作業｜繳交資料

## 專案資訊

| 項目 | 內容 |
| --- | --- |
| GitHub 儲存庫 | https://github.com/happyloa/2026-ai-adv-homework-course03 |
| AI Agent | Codex |
| 挑戰等級 | LV3 |
| 作業系統 | Windows PowerShell |
| Node.js | 24+ |

## 環境變數名稱

`JWT_SECRET`、`BASE_URL`、`ECPAY_MERCHANT_ID`、`ECPAY_HASH_KEY`、`ECPAY_HASH_IV`、`ECPAY_ENV`，以及 E2E 可選的 `E2E_BASE_URL`。所有實際值都只存於本機 `.env` 或執行環境，未提交至 Git。

## 自動化驗證

| 項目 | 證據 |
| --- | --- |
| 配送 Unit Test | `tests/unit/shipping.test.js`、`npm run test:unit` |
| 訂單 Integration Test | `tests/integration/order-flow.test.js`、`npm run test:integration` |
| E2E Test | `tests/e2e/payment-flow.spec.js`、`npm run test:e2e` |
| OpenAPI | `openapi.json`、`npm run openapi` |
| Postman Collection | `postman/flower-shop.postman_collection.json`、`npm run postman` |
| GitHub Actions | https://github.com/happyloa/2026-ai-adv-homework-course03/actions |

## 仍須本人完成的外部項目

- [ ] 填寫第三場回饋表單，並在繳交系統附上提交成功畫面截圖。
- [ ] 將 GitHub Actions 成功畫面截圖附到繳交系統。
- [ ] 若作業要求真實綠界 ATM 畫面，使用公開 HTTPS `BASE_URL` 完成 staging 流程並附上付款成功回站截圖。
