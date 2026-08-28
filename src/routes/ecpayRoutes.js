const express = require('express');
const db = require('../database');
const authMiddleware = require('../middleware/authMiddleware');
const {
  generateCheckMacValue,
  timingSafeEqual,
  generateMerchantTradeNo,
  buildPaymentForm
} = require('../utils/ecpay');

const router = express.Router();

/**
 * POST /api/ecpay/pay/:orderId
 * 產生 ECPay AIO 付款表單 HTML，前端收到後自動跳轉至綠界付款頁
 * 需要登入
 */
router.post('/pay/:orderId', authMiddleware, (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.userId;

    // 查詢訂單（確保屬於當前用戶）
    const order = db.prepare(
      'SELECT * FROM orders WHERE id = ? AND user_id = ?'
    ).get(orderId, userId);

    if (!order) {
      return res.status(404).json({
        data: null,
        error: 'NOT_FOUND',
        message: '訂單不存在'
      });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({
        data: null,
        error: 'INVALID_STATUS',
        message: '訂單狀態不是 pending，無法進行付款'
      });
    }

    // 查詢訂單項目
    const items = db.prepare(
      'SELECT product_name, product_price, quantity FROM order_items WHERE order_id = ?'
    ).all(orderId);

    // 產生唯一 MerchantTradeNo（若已存在則重用）
    let merchantTradeNo = order.merchant_trade_no;
    if (!merchantTradeNo) {
      merchantTradeNo = generateMerchantTradeNo();
      // 儲存至訂單
      db.prepare(
        'UPDATE orders SET merchant_trade_no = ? WHERE id = ?'
      ).run(merchantTradeNo, orderId);
    }

    // 產生付款表單 HTML
    const formHtml = buildPaymentForm({ ...order, items }, merchantTradeNo);

    // 回傳 HTML（瀏覽器直接接收並自動提交）
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(formHtml);
  } catch (err) {
    console.error('[ECPay Pay Error]', err);
    res.status(500).json({
      data: null,
      error: 'INTERNAL_ERROR',
      message: '產生付款表單失敗'
    });
  }
});

/**
 * POST /api/ecpay/notify
 * ECPay ReturnURL — 綠界付款後 Server-to-Server 通知
 * ⚠️ 不需要 JWT 認證（綠界伺服器呼叫）
 * ⚠️ 必須在 10 秒內回應純文字 "1|OK"，HTTP 200
 */
router.post('/notify', (req, res) => {
  try {
    const payload = req.body;
    const hashKey = process.env.ECPAY_HASH_KEY || 'pwFHCqoQZGmho4w6';
    const hashIV = process.env.ECPAY_HASH_IV || 'EkRm7iFT261dpevs';

    // 驗證 CheckMacValue（timing-safe）
    const receivedCmv = payload.CheckMacValue;
    const computedCmv = generateCheckMacValue(payload, hashKey, hashIV);

    if (!timingSafeEqual(receivedCmv || '', computedCmv)) {
      console.warn('[ECPay Notify] CheckMacValue 驗證失敗', {
        received: receivedCmv,
        computed: computedCmv
      });
      // 即使驗證失敗也要回傳 1|OK，避免被 ECPay 判斷為服務異常（但不更新訂單狀態）
      return res.status(200).send('1|OK');
    }

    // RtnCode 為字串 '1'（AIO CMV-SHA256 協議）
    const isSuccess = String(payload.RtnCode) === '1';
    const merchantTradeNo = payload.MerchantTradeNo;
    const ecpayTradeNo = payload.TradeNo || '';

    // 查詢對應訂單
    const order = db.prepare(
      'SELECT * FROM orders WHERE merchant_trade_no = ?'
    ).get(merchantTradeNo);

    if (order) {
      // 冪等處理：只在 pending 狀態時更新
      if (order.status === 'pending') {
        db.prepare(
          'UPDATE orders SET status = ?, ecpay_trade_no = ? WHERE id = ?'
        ).run(isSuccess ? 'paid' : 'failed', ecpayTradeNo, order.id);
        console.log(`[ECPay Notify] 訂單 ${merchantTradeNo} 已更新為 ${isSuccess ? 'paid' : 'failed'}`);
      } else {
        console.log(`[ECPay Notify] 訂單 ${merchantTradeNo} 已處理（狀態：${order.status}），略過重複通知`);
      }
    } else {
      console.warn(`[ECPay Notify] 找不到訂單 MerchantTradeNo=${merchantTradeNo}`);
    }

    // 必須回傳純文字 "1|OK"，HTTP 200
    res.status(200).send('1|OK');
  } catch (err) {
    console.error('[ECPay Notify Error]', err);
    // 即使出錯也要嘗試回傳 1|OK
    res.status(200).send('1|OK');
  }
});

/**
 * ALL /api/ecpay/result
 * ECPay OrderResultURL (POST) / ClientBackURL (GET) — 消費者付款後前端跳轉頁
 * 接收 ECPay 帶回的付款結果
 */
router.all('/result', (req, res) => {
  const payload = req.method === 'POST' ? req.body : req.query;
  const { MerchantTradeNo, RtnCode, RtnMsg, TradeNo, CheckMacValue } = payload;

  // 查詢訂單取得最新狀態
  let order = null;
  if (MerchantTradeNo) {
    order = db.prepare(
      'SELECT id, order_no, status, total_amount FROM orders WHERE merchant_trade_no = ?'
    ).get(MerchantTradeNo);
  }

  // 僅接受帶有有效 CheckMacValue 的 OrderResultURL POST 更新付款狀態。
  // ClientBackURL 的 GET 可被任意人造訪，不能只憑 RtnCode 更新訂單。
  if (order && order.status === 'pending') {
    let isValid = false;
    
    // 若有提供簽章，仍嘗試驗證
    if (req.method === 'POST' && CheckMacValue) {
      const hashKey = process.env.ECPAY_HASH_KEY || 'pwFHCqoQZGmho4w6';
      const hashIV = process.env.ECPAY_HASH_IV || 'EkRm7iFT261dpevs';
      isValid = timingSafeEqual(CheckMacValue, generateCheckMacValue(payload, hashKey, hashIV));
    }

    if (isValid) {
      const isSuccess = String(RtnCode) === '1';
      db.prepare(
        'UPDATE orders SET status = ?, ecpay_trade_no = ? WHERE id = ?'
      ).run(isSuccess ? 'paid' : 'failed', TradeNo || '', order.id);
      
      order.status = isSuccess ? 'paid' : 'failed';
      console.log(`[ECPay Result] fallback 更新訂單 ${MerchantTradeNo} 狀態為 ${order.status}`);
    } else if (req.method === 'POST' && CheckMacValue) {
      console.warn(`[ECPay Result] CheckMacValue 驗證失敗`);
    }
  }

  const isSuccess = String(RtnCode) === '1' || (order && order.status === 'paid');

  // 依據是否有訂單編號導向對應頁面
  if (order && order.id) {
    const paymentStatus = isSuccess ? 'success' : 'failed';
    return res.redirect(`/orders/${order.id}?payment=${paymentStatus}`);
  }

  // 若找不到訂單 id，退回訂單列表頁
  return res.redirect('/orders');
});

module.exports = router;
