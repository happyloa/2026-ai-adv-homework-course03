# 花漾生活｜AI 開發進化營第二場作業

本專案以第一場作業的綠界金流電商專案為起點，完成第二場作業所需的：

- Design Skill 與設計稿導向的響應式切版
- E2E Payment Test Skill 與可重現的瀏覽器自動化測試流程
- 綠界測試環境付款流程、訂單結果與後台驗證指引

## 第一場作業基底

- 起始儲存庫：[happyloa/2026-ai-adv-homework-course01](https://github.com/happyloa/2026-ai-adv-homework-course01)
- 本次作業儲存庫：[happyloa/2026-ai-adv-homework-course02](https://github.com/happyloa/2026-ai-adv-homework-course02)

## 交付物導覽

| 項目 | 位置 |
| --- | --- |
| Design Skill | `.agents/skills/flower-commerce-design/SKILL.md` |
| E2E Payment Test Skill | `.agents/skills/e2e-payment-test/SKILL.md` |
| 設計稿與設計規格 | `docs/design/` |
| E2E 測試與錄影說明 | `docs/e2e/` |
| 執行與繳交資訊 | `docs/SUBMISSION.md` |

## 本機驗證

請使用 Node.js 24 以上版本，依 `.env.example` 建立本機 `.env` 後執行：

```powershell
npm install
npm run css:build
npm test
npm run test:e2e
npm run design:capture
```

`npm run test:e2e` 會以隔離的測試資料庫啟動本機伺服器，並以 Chrome 驗證商品加入購物袋、註冊後購物袋合併、欄位驗證、建立訂單、綠界簽章回呼與付款完成頁。

## 真實綠界錄影

本工作區已準備 Cloudflare Quick Tunnel 與被 Git 忽略的 `.env`。正式錄影依序執行：

```powershell
npm run recording:start
npm run recording:check
npm run recording:flow
npm run recording:stop
```

`recording:flow` 會自動操作前台、綠界官方測試卡與 3D OTP，最後預填綠界測試後台帳密；錄影者只需輸入 CAPTCHA，並查詢終端顯示的 `MerchantTradeNo`。完整步驟請見 [`docs/e2e/recording-checklist.md`](docs/e2e/recording-checklist.md)。

執行 `recording:start` 後，請先等到終端顯示 `Recording environment is ready.` 再執行 `recording:check`；Cloudflare 暫時網址若沒有正確建立 DNS，啟動腳本會自動更換網址重試。

> 尚未完成的外部提交項目（回饋表單截圖、公開錄影網址）會在交付文件中以明確欄位保留，避免誤將示範內容當作真實提交。
