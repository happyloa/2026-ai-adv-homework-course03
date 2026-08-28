const { app, request, registerUser } = require('./setup');
const { generateCheckMacValue } = require('../src/utils/ecpay');

describe('ECPay payment callback security', () => {
  let userToken;
  let orderId;
  let merchantTradeNo;

  beforeAll(async () => {
    const user = await registerUser({
      email: `ecpay-${Date.now()}@example.com`,
      name: '綠界測試用戶'
    });
    userToken = user.token;

    const productRes = await request(app).get('/api/products');
    const productId = productRes.body.data.products[0].id;

    await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ productId, quantity: 1 });

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        recipientName: '綠界收件人',
        recipientEmail: 'ecpay-recipient@example.com',
        recipientAddress: '台北市綠界路 1 號'
      });
    orderId = orderRes.body.data.id;

    const payRes = await request(app)
      .post(`/api/ecpay/pay/${orderId}`)
      .set('Authorization', `Bearer ${userToken}`);
    merchantTradeNo = payRes.text.match(/name="MerchantTradeNo" value="([^"]+)"/)[1];
  });

  it('should not mark an order paid from an unsigned ClientBackURL GET', async () => {
    const resultRes = await request(app)
      .get('/api/ecpay/result')
      .query({ MerchantTradeNo: merchantTradeNo, RtnCode: '1', TradeNo: 'forged-trade' });

    expect(resultRes.status).toBe(302);

    const orderRes = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(orderRes.body.data.status).toBe('pending');
  });

  it('should mark an order paid after a signed ECPay notify callback', async () => {
    const payload = {
      MerchantTradeNo: merchantTradeNo,
      RtnCode: '1',
      RtnMsg: 'Succeeded',
      TradeNo: 'E2E-SIGNED-TRADE-001',
      TradeAmt: '1680',
      PaymentDate: '2026/07/26 12:00:00',
      PaymentType: 'Credit_CreditCard'
    };
    payload.CheckMacValue = generateCheckMacValue(payload, 'pwFHCqoQZGmho4w6', 'EkRm7iFT261dpevs');

    const notifyRes = await request(app)
      .post('/api/ecpay/notify')
      .send(payload);
    expect(notifyRes.status).toBe(200);
    expect(notifyRes.text).toBe('1|OK');

    const orderRes = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(orderRes.body.data.status).toBe('paid');
    expect(orderRes.body.data.ecpay_trade_no).toBe('E2E-SIGNED-TRADE-001');
  });
});
