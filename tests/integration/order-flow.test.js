const { v4: uuidv4 } = require('uuid');
const request = require('supertest');
const app = require('../../app');
const db = require('../../src/database');

let userSequence = 0;
let productId;

function clearTestData() {
  db.exec(`
    DELETE FROM order_items;
    DELETE FROM cart_items;
    DELETE FROM orders;
    DELETE FROM users;
    DELETE FROM products;
  `);
}

async function createTestMember() {
  userSequence += 1;
  const response = await request(app)
    .post('/api/auth/register')
    .send({
      email: `integration-${Date.now()}-${userSequence}@example.com`,
      password: 'password123',
      name: '整合測試會員'
    });

  expect(response.status).toBe(201);
  expect(response.body.error).toBeNull();
  return response.body.data.token;
}

async function addProductToMemberCart(token, quantity = 1) {
  const productResponse = await request(app).get('/api/products');
  expect(productResponse.status).toBe(200);
  const product = productResponse.body.data.products.find(item => item.id === productId);
  expect(product).toBeTruthy();

  const cartResponse = await request(app)
    .post('/api/cart')
    .set('Authorization', `Bearer ${token}`)
    .send({ productId: product.id, quantity });

  expect(cartResponse.status).toBe(200);
  return product;
}

describe('訂單整合流程', () => {
  beforeEach(() => {
    clearTestData();
    productId = uuidv4();
    db.prepare(
      `INSERT INTO products (id, name, description, price, stock, image_url)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(productId, '整合測試花束', '僅供訂單整合測試使用', 600, 10, '/images/flower-life-bouquet.png');
  });

  afterEach(() => {
    clearTestData();
  });

  it('可從會員、商品、購物車到訂單，正確寫入配送費、總額、訂單品項並扣除庫存', async () => {
    const token = await createTestMember();
    const product = await addProductToMemberCart(token, 2);

    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        recipientName: '王小花',
        recipientEmail: 'wang@example.com',
        recipientAddress: '台北市大安區花園路 100 號',
        shippingMethod: 'home_delivery',
        isRemoteArea: true,
        isExpress: false
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      error: null,
      message: '訂單建立成功'
    });
    expect(response.body.data).toMatchObject({
      subtotal: 1200,
      shipping_fee: 320,
      shipping_method: 'home_delivery',
      is_remote_area: true,
      is_express: false,
      total_amount: 1520,
      status: 'pending'
    });
    expect(response.body.data.items).toEqual([
      expect.objectContaining({
        product_name: product.name,
        product_price: 600,
        quantity: 2
      })
    ]);

    const orderId = response.body.data.id;
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
    const productAfterOrder = db.prepare('SELECT stock FROM products WHERE id = ?').get(productId);
    const cartCount = db.prepare('SELECT COUNT(*) AS count FROM cart_items').get();

    expect(order).toMatchObject({
      id: orderId,
      subtotal_amount: 1200,
      shipping_fee: 320,
      shipping_method: 'home_delivery',
      is_remote_area: 1,
      is_express: 0,
      total_amount: 1520,
      status: 'pending'
    });
    expect(orderItems).toHaveLength(1);
    expect(orderItems[0]).toMatchObject({
      order_id: orderId,
      product_id: productId,
      product_name: product.name,
      product_price: 600,
      quantity: 2
    });
    expect(productAfterOrder.stock).toBe(8);
    expect(cartCount.count).toBe(0);
  });

  it('庫存不足時不建立不完整訂單、不錯扣庫存且保留購物車', async () => {
    const token = await createTestMember();
    await addProductToMemberCart(token, 2);
    db.prepare('UPDATE products SET stock = 1 WHERE id = ?').run(productId);

    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        recipientName: '王小花',
        recipientEmail: 'wang@example.com',
        recipientAddress: '台北市大安區花園路 100 號',
        shippingMethod: 'home_delivery'
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ data: null, error: 'STOCK_INSUFFICIENT' });
    expect(db.prepare('SELECT COUNT(*) AS count FROM orders').get().count).toBe(0);
    expect(db.prepare('SELECT COUNT(*) AS count FROM order_items').get().count).toBe(0);
    expect(db.prepare('SELECT stock FROM products WHERE id = ?').get(productId).stock).toBe(1);
    expect(db.prepare('SELECT quantity FROM cart_items').get().quantity).toBe(2);
  });

  it('交易中途失敗時會完整 rollback 訂單、庫存與購物車', async () => {
    const token = await createTestMember();
    await addProductToMemberCart(token, 1);
    const triggerName = 'integration_fail_stock_update';
    db.exec(`
      CREATE TRIGGER ${triggerName}
      BEFORE UPDATE OF stock ON products
      BEGIN
        SELECT RAISE(ABORT, 'forced stock update failure');
      END;
    `);

    try {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          recipientName: '王小花',
          recipientEmail: 'wang@example.com',
          recipientAddress: '台北市大安區花園路 100 號',
          shippingMethod: 'cvs'
        });

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({ data: null, error: 'INTERNAL_ERROR' });
    } finally {
      db.exec(`DROP TRIGGER IF EXISTS ${triggerName}`);
    }

    expect(db.prepare('SELECT COUNT(*) AS count FROM orders').get().count).toBe(0);
    expect(db.prepare('SELECT COUNT(*) AS count FROM order_items').get().count).toBe(0);
    expect(db.prepare('SELECT stock FROM products WHERE id = ?').get(productId).stock).toBe(10);
    expect(db.prepare('SELECT quantity FROM cart_items').get().quantity).toBe(1);
  });
});
