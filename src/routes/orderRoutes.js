const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const authMiddleware = require('../middleware/authMiddleware');
const { calculateShippingFee, SHIPPING_METHODS } = require('../utils/shipping');

const router = express.Router();

router.use(authMiddleware);

function generateOrderNo() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = uuidv4().slice(0, 5).toUpperCase();
  return `ORD-${dateStr}-${random}`;
}

function serializeOrder(order, items) {
  return {
    id: order.id,
    order_no: order.order_no,
    merchant_trade_no: order.merchant_trade_no,
    ecpay_trade_no: order.ecpay_trade_no,
    recipient_name: order.recipient_name,
    recipient_email: order.recipient_email,
    recipient_address: order.recipient_address,
    subtotal: order.subtotal_amount,
    shipping_fee: order.shipping_fee,
    shipping_method: order.shipping_method,
    is_remote_area: Boolean(order.is_remote_area),
    is_express: Boolean(order.is_express),
    total_amount: order.total_amount,
    status: order.status,
    items,
    created_at: order.created_at
  };
}

/**
 * @openapi
 * /api/orders:
 *   post:
 *     summary: 從購物車建立訂單
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [recipientName, recipientEmail, recipientAddress, shippingMethod]
 *             properties:
 *               recipientName:
 *                 type: string
 *               recipientEmail:
 *                 type: string
 *                 format: email
 *               recipientAddress:
 *                 type: string
 *               shippingMethod:
 *                 type: string
 *                 enum: [home_delivery, cvs]
 *                 description: 配送方式；home_delivery 為宅配到府，cvs 為超商取貨
 *               isRemoteArea:
 *                 type: boolean
 *                 default: false
 *                 description: 是否為偏遠地區，加收 200 元
 *               isExpress:
 *                 type: boolean
 *                 default: false
 *                 description: 是否為當日急件，加收 250 元
 *     responses:
 *       201:
 *         description: 訂單建立成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     order_no:
 *                       type: string
 *                     subtotal:
 *                       type: integer
 *                       description: 商品小計，不含運費
 *                     shipping_fee:
 *                       type: integer
 *                       description: 基本運費與附加費合計
 *                     shipping_method:
 *                       type: string
 *                       enum: [home_delivery, cvs]
 *                     is_remote_area:
 *                       type: boolean
 *                     is_express:
 *                       type: boolean
 *                     total_amount:
 *                       type: integer
 *                     status:
 *                       type: string
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           product_name:
 *                             type: string
 *                           product_price:
 *                             type: integer
 *                           quantity:
 *                             type: integer
 *                     created_at:
 *                       type: string
 *                 error:
 *                   type: string
 *                   nullable: true
 *                 message:
 *                   type: string
 *       400:
 *         description: 購物車為空、庫存不足、收件資訊缺失或配送方式不正確
 */
router.post('/', (req, res) => {
  const {
    recipientName,
    recipientEmail,
    recipientAddress,
    shippingMethod,
    isRemoteArea = false,
    isExpress = false
  } = req.body;
  const userId = req.user.userId;

  if (
    typeof recipientName !== 'string' || !recipientName.trim()
    || typeof recipientEmail !== 'string' || !recipientEmail.trim()
    || typeof recipientAddress !== 'string' || !recipientAddress.trim()
  ) {
    return res.status(400).json({
      data: null,
      error: 'VALIDATION_ERROR',
      message: '收件人姓名、Email 和地址為必填欄位'
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(recipientEmail.trim())) {
    return res.status(400).json({
      data: null,
      error: 'VALIDATION_ERROR',
      message: 'Email 格式不正確'
    });
  }

  if (!Object.values(SHIPPING_METHODS).includes(shippingMethod)) {
    return res.status(400).json({
      data: null,
      error: 'VALIDATION_ERROR',
      message: '配送方式必須為宅配到府或超商取貨'
    });
  }

  if (typeof isRemoteArea !== 'boolean' || typeof isExpress !== 'boolean') {
    return res.status(400).json({
      data: null,
      error: 'VALIDATION_ERROR',
      message: '偏遠地區與當日急件欄位必須為布林值'
    });
  }

  // Get cart items with product info
  const cartItems = db.prepare(
    `SELECT ci.id, ci.product_id, ci.quantity,
            p.name as product_name, p.price as product_price, p.stock as product_stock
     FROM cart_items ci
     JOIN products p ON ci.product_id = p.id
     WHERE ci.user_id = ?`
  ).all(userId);

  if (cartItems.length === 0) {
    return res.status(400).json({
      data: null,
      error: 'CART_EMPTY',
      message: '購物車為空'
    });
  }

  // Check stock
  const insufficientItems = cartItems.filter(item => item.quantity > item.product_stock);
  if (insufficientItems.length > 0) {
    const names = insufficientItems.map(i => i.product_name).join(', ');
    return res.status(400).json({
      data: null,
      error: 'STOCK_INSUFFICIENT',
      message: `以下商品庫存不足：${names}`
    });
  }

  // Calculate subtotal first; the Shipping module owns all fee rules.
  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.product_price * item.quantity, 0
  );

  let shippingQuote;
  try {
    shippingQuote = calculateShippingFee({
      shippingMethod,
      subtotal,
      isRemoteArea,
      isExpress
    });
  } catch (error) {
    return res.status(400).json({
      data: null,
      error: 'VALIDATION_ERROR',
      message: error.message
    });
  }

  const totalAmount = subtotal + shippingQuote.shippingFee;

  const orderId = uuidv4();
  const orderNo = generateOrderNo();

  // Transaction: create order, order items, deduct stock, clear cart
  const createOrder = db.transaction(() => {
    db.prepare(
      `INSERT INTO orders (
        id, order_no, user_id, recipient_name, recipient_email, recipient_address,
        subtotal_amount, shipping_fee, shipping_method, is_remote_area, is_express, total_amount
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      orderId,
      orderNo,
      userId,
      recipientName.trim(),
      recipientEmail.trim(),
      recipientAddress.trim(),
      subtotal,
      shippingQuote.shippingFee,
      shippingMethod,
      isRemoteArea ? 1 : 0,
      isExpress ? 1 : 0,
      totalAmount
    );

    const insertItem = db.prepare(
      `INSERT INTO order_items (id, order_id, product_id, product_name, product_price, quantity)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    const updateStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');

    for (const item of cartItems) {
      insertItem.run(uuidv4(), orderId, item.product_id, item.product_name, item.product_price, item.quantity);
      updateStock.run(item.quantity, item.product_id);
    }

    db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(userId);
  });

  try {
    createOrder();
  } catch (error) {
    console.error('[Order Create Error]', error);
    return res.status(500).json({
      data: null,
      error: 'INTERNAL_ERROR',
      message: '建立訂單失敗，請稍後再試'
    });
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  const orderItems = db.prepare(
    'SELECT product_name, product_price, quantity FROM order_items WHERE order_id = ?'
  ).all(orderId);

  res.status(201).json({
    data: serializeOrder(order, orderItems),
    error: null,
    message: '訂單建立成功'
  });
});

/**
 * @openapi
 * /api/orders:
 *   get:
 *     summary: 自己的訂單列表
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     orders:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           order_no:
 *                             type: string
 *                           subtotal:
 *                             type: integer
 *                           shipping_fee:
 *                             type: integer
 *                           shipping_method:
 *                             type: string
 *                           total_amount:
 *                             type: integer
 *                           status:
 *                             type: string
 *                           created_at:
 *                             type: string
 *                 error:
 *                   type: string
 *                   nullable: true
 *                 message:
 *                   type: string
 */
router.get('/', (req, res) => {
  const orders = db.prepare(
    `SELECT id, order_no, subtotal_amount, shipping_fee, shipping_method,
            is_remote_area, is_express, total_amount, status, created_at
     FROM orders
     WHERE user_id = ?
     ORDER BY created_at DESC`
  ).all(req.user.userId).map(order => ({
    ...order,
    subtotal: order.subtotal_amount,
    is_remote_area: Boolean(order.is_remote_area),
    is_express: Boolean(order.is_express)
  }));

  res.json({
    data: { orders },
    error: null,
    message: '成功'
  });
});

/**
 * @openapi
 * /api/orders/{id}:
 *   get:
 *     summary: 訂單詳情
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     order_no:
 *                       type: string
 *                     recipient_name:
 *                       type: string
 *                     recipient_email:
 *                       type: string
 *                     recipient_address:
 *                       type: string
 *                     subtotal:
 *                       type: integer
 *                     shipping_fee:
 *                       type: integer
 *                     shipping_method:
 *                       type: string
 *                       enum: [home_delivery, cvs]
 *                     is_remote_area:
 *                       type: boolean
 *                     is_express:
 *                       type: boolean
 *                     total_amount:
 *                       type: integer
 *                     status:
 *                       type: string
 *                     created_at:
 *                       type: string
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           product_id:
 *                             type: string
 *                           product_name:
 *                             type: string
 *                           product_price:
 *                             type: integer
 *                           quantity:
 *                             type: integer
 *                 error:
 *                   type: string
 *                   nullable: true
 *                 message:
 *                   type: string
 *       404:
 *         description: 訂單不存在
 */
router.get('/:id', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.userId);

  if (!order) {
    return res.status(404).json({ data: null, error: 'NOT_FOUND', message: '訂單不存在' });
  }

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);

  res.json({
    data: serializeOrder(order, items),
    error: null,
    message: '成功'
  });
});


module.exports = router;
