const { test, expect } = require('@playwright/test');
const { generateCheckMacValue } = require('../../src/utils/ecpay');

function buildGatewayPage(returnStoreUrl) {
  return `<!doctype html>
    <html lang="zh-TW">
      <head><meta charset="utf-8"><title>綠界測試環境</title></head>
      <body>
        <main>
          <h1>綠界測試環境</h1>
          <button id="network-atm" type="button">網路 ATM</button>
          <section id="bank-options" hidden>
            <label><input id="land-bank" type="radio" name="bank" value="land">台灣土地銀行</label>
            <button id="go-pay" type="button" disabled>前往付款</button>
          </section>
        </main>
        <script>
          const bankOptions = document.getElementById('bank-options');
          document.getElementById('network-atm').addEventListener('click', () => {
            bankOptions.hidden = false;
          });
          document.getElementById('land-bank').addEventListener('change', () => {
            document.getElementById('go-pay').disabled = false;
          });
          document.getElementById('go-pay').addEventListener('click', () => {
            alert('即將前往台灣土地銀行測試頁面');
            document.body.innerHTML = '<main><h1>台灣土地銀行測試頁面</h1><button id="save" type="button">Save</button></main>';
            document.getElementById('save').addEventListener('click', () => {
              document.body.innerHTML = '<main><h1>綠界付款成功</h1><p>付款已完成</p><button id="return-store" type="button">返回商店</button></main>';
              document.getElementById('return-store').addEventListener('click', () => {
                window.location.assign(${JSON.stringify(returnStoreUrl)});
              });
            });
          });
        </script>
      </body>
    </html>`;
}

test('管理員完成配送結帳、網路 ATM 與付款成功回站流程', async ({ page, request, baseURL }, testInfo) => {
  let gatewayPayload;
  let returnStoreUrl;

  await page.route('https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5', async route => {
    gatewayPayload = Object.fromEntries(new URLSearchParams(route.request().postData() || ''));
    await route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: buildGatewayPage(returnStoreUrl)
    });
  });

  await page.goto('/login');
  await page.getByTestId('login-email').fill('admin@hexschool.com');
  await page.getByTestId('login-password').fill('12345678');
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(/\/$/);

  const token = await page.evaluate(() => localStorage.getItem('flower_token'));
  expect(token).toBeTruthy();

  await page.getByTestId('featured-product-0').click();
  await expect(page).toHaveURL(/\/products\//);
  await page.getByTestId('product-add-to-cart').click();
  await page.getByRole('link', { name: '購物車' }).click();
  await page.getByTestId('cart-checkout').click();
  await expect(page).toHaveURL(/\/checkout/);

  await page.getByTestId('shipping-home-delivery').check();
  await page.getByTestId('shipping-remote-area').check();
  await page.getByTestId('shipping-express').check();
  await page.getByTestId('recipient-name').fill('王小花');
  await page.getByTestId('recipient-email').fill('recipient@example.com');
  await page.getByTestId('recipient-address').fill('台北市大安區花園路 100 號');
  await page.getByTestId('checkout-submit').click();
  await expect(page).toHaveURL(/\/orders\//);

  const orderId = new URL(page.url()).pathname.split('/').pop();
  returnStoreUrl = `${baseURL}/orders/${orderId}`;
  await expect(page.getByTestId('ecpay-pay-button')).toBeVisible();
  await page.getByTestId('ecpay-pay-button').click();
  await expect(page.getByRole('heading', { name: '綠界測試環境' })).toBeVisible();

  await page.getByRole('button', { name: '網路 ATM' }).click();
  await page.getByLabel('台灣土地銀行').check();
  const dismissDialog = page.waitForEvent('dialog').then(dialog => dialog.dismiss());
  await page.getByRole('button', { name: '前往付款' }).click();
  await dismissDialog;

  await expect(page.getByRole('heading', { name: '台灣土地銀行測試頁面' })).toBeVisible();
  await page.getByRole('button', { name: 'Save' }).click();

  expect(gatewayPayload?.MerchantTradeNo).toBeTruthy();
  const callbackPayload = {
    MerchantTradeNo: gatewayPayload.MerchantTradeNo,
    RtnCode: '1',
    RtnMsg: 'Succeeded',
    TradeNo: 'E2E-ATM-PAID-001',
    TradeAmt: gatewayPayload.TotalAmount,
    PaymentDate: '2026/08/29 12:00:00',
    PaymentType: 'ATM_TAISHIN'
  };
  callbackPayload.CheckMacValue = generateCheckMacValue(
    callbackPayload,
    process.env.ECPAY_HASH_KEY || 'pwFHCqoQZGmho4w6',
    process.env.ECPAY_HASH_IV || 'EkRm7iFT261dpevs'
  );

  const notifyResponse = await request.post('/api/ecpay/notify', { data: callbackPayload });
  expect(notifyResponse.status()).toBe(200);
  expect(await notifyResponse.text()).toBe('1|OK');
  await expect(page.getByRole('heading', { name: '綠界付款成功' })).toBeVisible();

  await page.getByRole('button', { name: '返回商店' }).click();
  await expect(page).toHaveURL(new RegExp(`/orders/${orderId}$`));
  await expect(page.getByTestId('payment-success')).toBeVisible();
  await expect(page.getByText('付款完成，謝謝你的心意')).toBeVisible();
  await expect(page.getByText('已付款')).toBeVisible();

  const orderResponse = await request.get(`/api/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  expect(orderResponse.status()).toBe(200);
  expect((await orderResponse.json()).data.status).toBe('paid');

  await page.screenshot({
    path: testInfo.outputPath('payment-success-returned-to-store.png'),
    fullPage: true
  });
});
