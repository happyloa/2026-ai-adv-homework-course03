# 測試說明

## 測試分層

| 層級 | 指令 | 主要位置 | 驗證內容 |
| --- | --- | --- | --- |
| Unit | `npm run test:unit` | `tests/unit/shipping.test.js` | 純配送費用規則與邊界值。 |
| Integration | `npm run test:integration` | `tests/*.test.js`、`tests/integration/` | API、SQLite 寫入、庫存與購物車交易。 |
| E2E | `npm run test:e2e` | `tests/e2e/payment-flow.spec.js` | 已啟動站點的前端操作、付款回站與 `paid` 狀態。 |
| Postman | `npm run postman` | `postman/flower-shop.postman_collection.json` | OpenAPI 與可匯入的 API Collection。 |

`npm test` 會依序執行 Unit 與 Integration Test。

## Integration Test 的資料隔離

`tests/test-env.js` 在載入 app 前設定 `NODE_ENV=test`，因此 `src/database.js` 會使用 SQLite `:memory:`，不會讀寫專案根目錄的 `database.sqlite`。

`tests/integration/order-flow.test.js` 每個案例都會清理自己的測試資料，再依序驗證：建立會員、取得商品、加入購物車、帶配送資訊建立訂單、資料庫訂單／品項寫入、運費與總額、庫存扣除與購物車清空；也會驗證庫存不足與交易中斷時完整 rollback。

## E2E 的本機條件

E2E 不會啟動伺服器。請先讓專案在 `http://localhost:3001` 運行，或以 `E2E_BASE_URL` 指向另一個既有站點。成功後的付款完成截圖會由 Playwright 寫到被 Git 忽略的 `test-results/`。

真實綠界 staging callback 需要可公開的 HTTPS `BASE_URL`；這類外部環境步驟不會加入 CI。
