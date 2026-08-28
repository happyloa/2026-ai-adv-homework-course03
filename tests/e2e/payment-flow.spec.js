const { test, expect } = require('@playwright/test');
const { generateCheckMacValue } = require('../../src/utils/ecpay');

test('訪客購物、註冊、欄位驗證與綠界付款完成流程', async ({ page, request, baseURL }) => {
  const email = `e2e-${Date.now()}@example.com`;
  let gatewayPayload;

  await page.route('https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5', async route => {
    gatewayPayload = Object.fromEntries(new URLSearchParams(route.request().postData() || ''));
    await route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><title>E2E ECPay Gateway</title><main data-testid="e2e-ecpay-gateway">綠界測試付款頁已接收訂單</main>'
    });
  });

  await page.goto('/');
  await page.getByTestId('featured-product-0').click();
  await expect(page).toHaveURL(/\/products\//);

  await page.getByTestId('product-add-to-cart').click();
  await page.getByRole('link', { name: '購物車' }).click();
  await expect(page.getByTestId('cart-checkout')).toBeVisible();
  await page.getByTestId('cart-checkout').click();

  await expect(page).toHaveURL(/\/login\?redirect=/);
  await page.getByTestId('register-tab').click();
  await page.getByTestId('register-name').fill('E2E 花友');
  await page.getByTestId('register-email').fill(email);
  await page.getByTestId('register-password').fill('payment123');
  await page.getByTestId('register-submit').click();
  await expect(page).toHaveURL(/\/checkout/);

  await page.getByTestId('checkout-submit').click();
  await expect(page.getByText('請輸入收件人姓名')).toBeVisible();
  await expect(page.getByText('請輸入 Email')).toBeVisible();
  await expect(page.getByText('請輸入收件地址')).toBeVisible();

  await page.getByTestId('recipient-name').fill('王小花');
  await page.getByTestId('recipient-email').fill('recipient@example.com');
  await page.getByTestId('recipient-address').fill('台北市大安區花園路 100 號');
  await page.getByTestId('checkout-submit').click();
  await expect(page).toHaveURL(/\/orders\//);
  await expect(page.getByTestId('ecpay-pay-button')).toBeVisible();

  await page.getByTestId('ecpay-pay-button').click();
  await expect(page.getByTestId('e2e-ecpay-gateway')).toBeVisible();
  await expect.poll(() => gatewayPayload?.MerchantTradeNo).toBeTruthy();

  const callbackPayload = {
    MerchantTradeNo: gatewayPayload.MerchantTradeNo,
    RtnCode: '1',
    RtnMsg: 'Succeeded',
    TradeNo: 'E2E-PW-PAID-001',
    TradeAmt: gatewayPayload.TotalAmount,
    PaymentDate: '2026/07/26 12:00:00',
    PaymentType: 'Credit_CreditCard'
  };
  callbackPayload.CheckMacValue = generateCheckMacValue(callbackPayload, 'pwFHCqoQZGmho4w6', 'EkRm7iFT261dpevs');

  const notifyResponse = await request.post(`${baseURL}/api/ecpay/notify`, { data: callbackPayload });
  expect(notifyResponse.status()).toBe(200);
  expect(await notifyResponse.text()).toBe('1|OK');

  await page.goto(`${baseURL}/api/ecpay/result?MerchantTradeNo=${encodeURIComponent(gatewayPayload.MerchantTradeNo)}&RtnCode=1`);
  await expect(page.getByTestId('payment-success')).toBeVisible();
  await expect(page.getByText('付款完成，謝謝你的心意')).toBeVisible();
});
