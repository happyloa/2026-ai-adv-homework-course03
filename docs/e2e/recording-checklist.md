# 真實綠界測試錄影清單

這份清單用於第二場作業要求的公開錄影。自動化測試是可重現的開發驗證；本清單則是要讓助教看見真實綠界測試交易與特店後台訂單。

## 已準備好的工具

- `npm run recording:start`：啟動網站與 Cloudflare Quick Tunnel，並自動更新 `.env` 的 `BASE_URL`。
- `npm run recording:check`：在背景完整驗證公開網站、真實綠界 staging、官方測試卡、3D OTP、付款 callback 與成功頁。
- `npm run recording:flow`：開啟可見 Chrome，以慢速操作完整金流並開啟綠界測試後台。
- `npm run recording:stop`：關閉本次啟動的網站與 tunnel。

`.local-tools/cloudflared.exe` 與本機 `.env` 已在本工作區準備好，兩者均被 Git 忽略。若在全新 clone 執行，需先從 [Cloudflare 官方下載頁](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/) 下載 Windows 版本到該路徑，並依 `.env.example` 建立 `.env`。

## 錄影前預檢

在專案根目錄依序執行：

```powershell
npm run recording:start
```

第一個指令會顯示 tunnel 建立進度；若 Cloudflare 回傳沒有 DNS 的暫時網址，腳本會自動重試。請勿在中途按 `Ctrl+C`，務必等到出現：

```text
Recording environment is ready.
Next step: npm run recording:check
```

再執行：

```powershell
npm run recording:check
```

看到以下三項才開始正式錄影：

1. `Public HTTPS check passed`
2. `ECPay staging payment completed`
3. `Payment success page verified`

`recording:check` 等候公開網址時會每 10 秒顯示一次進度，最長約 120 秒。它會建立一筆真實的綠界測試交易；這是預期行為，不會產生實際扣款。

## 必錄畫面順序

1. 開始螢幕錄影，確保 Codex 對話、PowerShell、Chrome 網址列都在畫面中。
2. 在 Codex 輸入：

   ```text
   使用 e2e-payment-test Skill 執行真實綠界錄影流程
   ```

3. 由 Agent 執行：

   ```powershell
   npm run recording:flow
   ```

4. 腳本會自動呈現：
   - 商品頁選取花禮並加入購物袋。
   - 註冊、結帳空欄位驗證與正確收件資料。
   - 建立待付款訂單。
   - 進入 `payment-stage.ecpay.com.tw`。
   - 填入綠界官方測試卡、取得並輸入固定測試 OTP `1234`。
   - 等待 ReturnURL callback 將訂單更新為 `paid`。
   - 回到花漾生活「付款完成」頁。
5. 腳本接著開啟 `vendor-stage.ecpay.com.tw`，並預填官方公開測試資料：
   - 帳號：`stagetest3`
   - 密碼：`test1234`
   - 統一編號：`00000000`
6. 親自輸入畫面上的 CAPTCHA 並按「登入」。
7. 登入後依序進入「一般訂單查詢 → 全方位金流訂單」，搜尋 PowerShell 當下印出的 `MerchantTradeNo`。同一編號也保存在 `.recording-runtime/last-merchant-trade-no.txt`。
8. 錄到後台的新訂單後，切回花漾生活付款成功頁，讓訂單狀態前後對照。
9. 停止螢幕錄影、關閉 Chrome，回到 PowerShell 執行：

   ```powershell
   npm run recording:stop
   ```

## 影片上傳後

- 將影片設為「公開」或「知道連結者可觀看」。
- 把公開網址填到 `docs/SUBMISSION.md`。
- 建議影片標題：`AI 開發進化營第二場｜花漾生活綠界 E2E 測試`。
- 上傳前確認影片沒有 `.env`、JWT、HashKey、HashIV、個資或正式帳號密碼。
- Cloudflare Quick Tunnel 每次啟動都會產生新網址；不需要把該暫時網址填入繳交資料。
