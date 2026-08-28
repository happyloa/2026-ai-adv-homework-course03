# AI 開發進化營第二場作業｜繳交資料

## 專案資訊

| 項目 | 內容 |
| --- | --- |
| GitHub 儲存庫 | https://github.com/happyloa/2026-ai-adv-homework-course02 |
| AI Agent | Codex CLI |
| Design Skill | `.agents/skills/flower-commerce-design/SKILL.md` |
| 設計工具 | OpenAI Image Generation（Codex imagegen） |
| 設計稿與實作截圖 | `docs/design/` |
| E2E Test Skill | `.agents/skills/e2e-payment-test/SKILL.md` |
| 瀏覽器自動化工具 | Playwright + Google Chrome |
| 作業系統 | Windows PowerShell |
| Node.js | 24+ |

## 挑戰一佐證

1. MCP 設計工具產生的設計概念稿：`docs/design/flower-life-design-concept.png`
2. 依此設計稿完成的商品、購物袋、結帳、訂單確認與付款完成頁：請見 `docs/design/README.md`。
3. 響應式設計驗證：`docs/design/implementation-product-desktop.jpg`、`implementation-checkout-desktop.jpg`、`implementation-payment-success-desktop.jpg` 與 `implementation-product-mobile.jpg`。

## 挑戰二佐證

1. 自動化測試：`tests/e2e/payment-flow.spec.js`
2. 綠界回呼安全測試：`tests/ecpay.test.js`
3. 執行指令：

   ```powershell
   npm test
   npm run test:e2e
   npm run recording:start
   npm run recording:check
   npm run recording:flow
   npm run recording:stop
   ```

4. 真實綠界 staging 驗證：官方測試卡、3D OTP、ReturnURL callback、`paid` 訂單與付款完成頁。
5. 實際錄影步驟：`docs/e2e/recording-checklist.md`
6. E2E 測試影片：[YouTube｜第二場作業挑戰二 E2E 測試 Skill 與自動化測試錄影](https://youtu.be/_cfjs2AgADc)

## 環境變數

請依 `.env.example` 建立 `.env`；不要將 `.env` 提交到 Git。

| 變數 | 用途 |
| --- | --- |
| `JWT_SECRET` | 登入 JWT 簽章金鑰，必填。 |
| `BASE_URL` | 網站公開網址；真正綠界測試與錄影時必須是可公開 HTTPS 網址。 |
| `ECPAY_MERCHANT_ID` | 綠界特店編號。 |
| `ECPAY_HASH_KEY` | 綠界 CheckMacValue 金鑰。 |
| `ECPAY_HASH_IV` | 綠界 CheckMacValue IV。 |
| `ECPAY_ENV` | `staging` 或 `production`；作業錄影請使用 `staging`。 |

## 尚需本人完成的外部提交

- [ ] 填寫第二場回饋表單，並將成功畫面截圖附在作業繳交表單。
- [ ] 按照 `docs/e2e/recording-checklist.md` 錄製真實綠界測試與後台訂單畫面（後台 CAPTCHA 需本人輸入）。
- [ ] 上傳公開影片並把連結填回本文件。
