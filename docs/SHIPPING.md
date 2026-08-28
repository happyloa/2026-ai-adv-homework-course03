# 配送費用模組

配送計價集中在 `src/utils/shipping.js` 的 `calculateShippingFee()`。它不依賴 Express 或 SQLite，因此可以由 Unit Test 獨立驗證。

## 規則

| 條件 | 金額 | 說明 |
| --- | ---: | --- |
| 宅配到府基本運費 | NT$ 120 | 商品小計未滿 NT$ 1,500 時收取。 |
| 超商取貨基本運費 | NT$ 60 | 商品小計未滿 NT$ 1,500 時收取。 |
| 滿額免基本運費 | NT$ 0 | 商品小計達 NT$ 1,500（含）時生效。 |
| 偏遠地區附加費 | +NT$ 200 | 可與其他規則疊加。 |
| 當日急件附加費 | +NT$ 250 | 可與其他規則疊加。 |

計算順序為：先算商品小計是否達到免基本運費門檻，再加上偏遠地區與急件附加費。因此滿額免運時，附加費仍會收取。

## 訂單 API

`POST /api/orders` 需傳入：

```json
{
  "recipientName": "王小花",
  "recipientEmail": "wang@example.com",
  "recipientAddress": "台北市大安區花園路 100 號",
  "shippingMethod": "home_delivery",
  "isRemoteArea": false,
  "isExpress": false
}
```

- `shippingMethod` 必填，可為 `home_delivery` 或 `cvs`。
- `isRemoteArea`、`isExpress` 為選填布林值，預設 `false`。
- 成功回應會包含 `subtotal`、`shipping_fee`、`shipping_method`、`is_remote_area`、`is_express` 與 `total_amount`。

資料庫的 `orders` 會保存配送快照，確保日後調整運費規則不會改變歷史訂單。啟動時會以可重複執行的 migration 補上既有 `database.sqlite` 所缺欄位；測試環境仍使用 `:memory:` SQLite，不會修改正式資料庫。
