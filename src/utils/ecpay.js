const crypto = require('crypto');

/**
 * ECPay 全方位金流（AIO）工具函式
 * 協議：CMV-SHA256
 * 參考：SKILL.md guides/01-payment-aio.md
 */

/**
 * ECPay 專用 URL encode
 * 規格：URL encode -> toLowerCase -> .NET 字元還原
 * 注意：不可與 AES 的 aesUrlEncode 混用
 * @param {string} str
 * @returns {string}
 */
function ecpayUrlEncode(str) {
  let encoded = encodeURIComponent(str);
  // 空格改為 +
  encoded = encoded.replace(/%20/g, '+');
  // 轉小寫
  encoded = encoded.toLowerCase();
  // .NET 字元還原（ECPay 規格）
  encoded = encoded
    .replace(/%2d/g, '-')
    .replace(/%5f/g, '_')
    .replace(/%2e/g, '.')
    .replace(/%21/g, '!')
    .replace(/%2a/g, '*')
    .replace(/%28/g, '(')
    .replace(/%29/g, ')');
  // ~ 必須編碼為 %7e（ECPay 規格）
  encoded = encoded.replace(/~/g, '%7e');
  return encoded;
}

/**
 * 計算 CheckMacValue（SHA256）
 * @param {Object} params - 所有表單參數（不含 CheckMacValue 本身）
 * @param {string} hashKey
 * @param {string} hashIV
 * @returns {string} 大寫十六進位 SHA256 雜湊值
 */
function generateCheckMacValue(params, hashKey, hashIV) {
  // 1. 排序（不分大小寫字母序）
  const sortedKeys = Object.keys(params)
    .filter(k => k !== 'CheckMacValue')
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  // 2. 組合字串：HashKey=...&key=value&...&HashIV=...
  const parts = sortedKeys.map(k => `${k}=${params[k]}`);
  const raw = `HashKey=${hashKey}&${parts.join('&')}&HashIV=${hashIV}`;

  // 3. ECPay URL encode
  const encoded = ecpayUrlEncode(raw);

  // 4. SHA256 -> 大寫
  return crypto.createHash('sha256').update(encoded).digest('hex').toUpperCase();
}

/**
 * timing-safe 比對兩個字串（防 timing attack）
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * 產生唯一的 MerchantTradeNo（≤20 字元，僅限英數字）
 * 格式：FP + 時間戳後 12 碼
 * @returns {string}
 */
function generateMerchantTradeNo() {
  // 使用時間戳（毫秒）確保唯一性
  const ts = Date.now().toString();
  return 'FP' + ts.slice(-12); // 共 14 字元，符合 ≤20 限制
}

/**
 * 取得台灣時間（UTC+8）格式化字串
 * ECPay 要求 MerchantTradeDate 使用台灣時間
 * @returns {string} yyyy/MM/dd HH:mm:ss
 */
function getTaiwanDateTime() {
  const now = new Date();
  // 轉換 UTC+8
  const twOffset = 8 * 60; // 分鐘
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const twTime = new Date(utc + twOffset * 60000);

  const yyyy = twTime.getFullYear();
  const MM = String(twTime.getMonth() + 1).padStart(2, '0');
  const dd = String(twTime.getDate()).padStart(2, '0');
  const HH = String(twTime.getHours()).padStart(2, '0');
  const mm = String(twTime.getMinutes()).padStart(2, '0');
  const ss = String(twTime.getSeconds()).padStart(2, '0');

  return `${yyyy}/${MM}/${dd} ${HH}:${mm}:${ss}`;
}

/**
 * 產生 ECPay AIO 付款表單 HTML（自動提交）
 * @param {Object} order - 訂單資料（含 items 陣列）
 * @param {string} merchantTradeNo - 綠界訂單編號
 * @returns {string} 自動提交的 HTML 表單字串
 */
function buildPaymentForm(order, merchantTradeNo) {
  const merchantId = process.env.ECPAY_MERCHANT_ID || '3002607';
  const hashKey = process.env.ECPAY_HASH_KEY || 'pwFHCqoQZGmho4w6';
  const hashIV = process.env.ECPAY_HASH_IV || 'EkRm7iFT261dpevs';
  const isStaging = (process.env.ECPAY_ENV || 'staging') !== 'production';
  const baseUrl = isStaging
    ? 'https://payment-stage.ecpay.com.tw'
    : 'https://payment.ecpay.com.tw';
  const serverBaseUrl = process.env.BASE_URL || 'http://localhost:3001';

  // 商品名稱（最長 400 字元，避免被截斷）
  const itemNames = (order.items || [])
    .map(i => `${i.product_name} x${i.quantity}`)
    .join('#')
    .slice(0, 390); // 保留安全長度

  const params = {
    MerchantID: merchantId,
    MerchantTradeNo: merchantTradeNo,       // ≤20 字元
    MerchantTradeDate: getTaiwanDateTime(), // 台灣時間
    PaymentType: 'aio',
    TotalAmount: String(order.total_amount),
    TradeDesc: '花店電商付款',              // 注意：不可含系統指令關鍵字
    ItemName: itemNames,
    ReturnURL: `${serverBaseUrl}/api/ecpay/notify`,
    OrderResultURL: `${serverBaseUrl}/api/ecpay/result`,
    ClientBackURL: `${serverBaseUrl}/api/ecpay/result`,
    ChoosePayment: 'ALL',                  // 開放全部付款方式
    EncryptType: '1'                       // SHA256
    // 注意：公開測試帳號(3002607)不支援 SimulatePaid，請使用測試信用卡 4311-9522-2222-2222
  };

  // 計算 CheckMacValue
  params.CheckMacValue = generateCheckMacValue(params, hashKey, hashIV);

  // 組裝自動提交表單
  const actionUrl = `${baseUrl}/Cashier/AioCheckOut/V5`;
  const inputs = Object.entries(params)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${escapeHtml(v)}">`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <title>跳轉至綠界付款...</title>
</head>
<body>
  <p>正在跳轉至綠界付款頁面，請稍候...</p>
  <form id="ecpayForm" method="POST" action="${escapeHtml(actionUrl)}">
    ${inputs}
  </form>
  <script>document.getElementById('ecpayForm').submit();</script>
</body>
</html>`;
}

/**
 * 簡單 HTML 跳脫（防 XSS）
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = {
  ecpayUrlEncode,
  generateCheckMacValue,
  timingSafeEqual,
  generateMerchantTradeNo,
  getTaiwanDateTime,
  buildPaymentForm
};
