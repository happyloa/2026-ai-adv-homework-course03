---
name: e2e-payment-test
description: 以 Playwright 或可用的瀏覽器 MCP 驗證花漾生活從商品挑選到綠界付款完成的完整流程，並產出可錄影、可重現的證據。
---

# 花漾生活 E2E Payment Test Skill

當需求涉及綠界付款、訂單狀態、結帳表單或錄製作業影片時，套用此 Skill。測試重點是完整的使用者流程與付款結果安全性，不是只呼叫單一 API。

## 測試目標

驗證使用者能從商品頁完成以下流程：

`商品頁 → 加入購物袋 → 註冊／登入 → 結帳欄位驗證 → 建立訂單 → 綠界付款頁 → 綠界簽章回呼 → 付款完成頁`

同時驗證未簽章的 ClientBackURL GET 不得把訂單改成已付款。

## 使用工具

- 預設：Playwright + 本機 Chrome（設定檔：`playwright.config.cjs`）。
- 替代：已連線的 Chrome MCP 或 Browser MCP；先確認瀏覽器可用，再沿用相同步驟。
- 驗證程式：`tests/e2e/payment-flow.spec.js`。
- 單元／整合保護：`tests/ecpay.test.js`。

## 事前條件

1. Node.js 24+。
2. `npm install`。
3. 本機已安裝 Google Chrome；Playwright 設定會使用 Chrome channel，不需要額外下載瀏覽器。
4. 正式錄影時需要可公開 HTTPS 的 `BASE_URL`，讓綠界測試環境能呼叫 `/api/ecpay/notify`。
5. 不得提交正式環境 HashKey、HashIV、JWT secret、真實卡號或個人資料。

## 自動化測試指令

```powershell
npm test
npm run test:e2e
```

`npm run test:e2e` 會啟動隔離的測試伺服器，使用 Playwright 自動完成正常流程，並以攔截的綠界測試頁加上有效 CheckMacValue 回呼驗證付款完成。它不會向綠界建立真實交易。

若要讓瀏覽器顯示操作過程，供本機錄製畫面使用：

```powershell
npm run test:e2e:headed
```

## 正常流程預期結果

1. 可從商品頁進入商品詳情並加入購物袋。
2. 訪客購物袋在註冊後會合併到帳號，不會遺失花禮。
3. 空白收件表單會顯示三個欄位錯誤。
4. 填寫正確資料後，建立 `pending` 訂單並進入訂單確認頁。
5. 點擊「前往綠界安全付款」會送出含 `MerchantTradeNo` 與 `CheckMacValue` 的綠界表單。
6. 收到有效綠界回呼後，訂單狀態為 `paid`，付款完成頁顯示「付款完成，謝謝你的心意」。

## 異常與安全情境

- 未填收件人、Email、地址：留在結帳頁並顯示欄位錯誤。
- Email 格式不正確：顯示格式錯誤，不得建立訂單。
- 未簽章的 `GET /api/ecpay/result?RtnCode=1`：訂單必須仍為 `pending`。
- 付款失敗或取消：訂單頁顯示失敗／取消訊息，不得顯示付款成功。

## 錄製真正綠界測試流程

完整影片步驟在 `docs/e2e/recording-checklist.md`。本專案已提供一鍵啟停與真實 staging 流程：

```powershell
npm run recording:start
npm run recording:check
npm run recording:flow
npm run recording:stop
```

- `recording:start`：啟動本機伺服器與 Cloudflare Quick Tunnel，自動把隨機 HTTPS 網址寫入被 Git 忽略的 `.env`。
- `recording:check`：以 headless Chrome 建立真實綠界 staging 訂單，完成官方測試卡、3D OTP、ReturnURL callback 與付款成功頁驗證。
- `recording:flow`：以可見 Chrome 慢速重播相同流程，最後開啟綠界測試後台並預填官方公開測試帳密。
- `recording:stop`：只停止前述腳本所追蹤的 Node 與 cloudflared 程序。

執行 `recording:start` 後必須等到 `Recording environment is ready.` 才能執行下一個指令；腳本會自動淘汰沒有 DNS 記錄的 Quick Tunnel 網址。

綠界後台 CAPTCHA 必須由錄影者親自輸入；登入後依序進入「一般訂單查詢 → 全方位金流訂單」，用終端顯示的 `MerchantTradeNo` 查詢。

錄影必須依序呈現：

1. Agent 呼叫本 Skill。
2. 瀏覽器自動操作商品、購物袋與結帳流程。
3. 綠界測試付款頁、官方測試卡、3D OTP 與測試付款完成。
4. 回到花漾生活付款完成頁。
5. 綠界測試特店後台顯示新建立的訂單。

影片公開後，將網址填入 `docs/SUBMISSION.md` 的「E2E 測試影片」欄位。

## 建議呼叫方式

```text
使用 e2e-payment-test Skill 執行真實綠界錄影流程；
確認錄影環境已啟動後執行 npm run recording:flow，並保留付款成功頁與綠界後台訂單作為證據。
```
