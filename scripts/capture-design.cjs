const { spawn } = require('node:child_process');
const path = require('node:path');
const { chromium } = require('@playwright/test');
const { generateCheckMacValue } = require('../src/utils/ecpay');

const projectRoot = path.resolve(__dirname, '..');
const baseURL = 'http://127.0.0.1:4174';
const screenshots = {
  productDesktop: path.join(projectRoot, 'docs/design/implementation-product-desktop.jpg'),
  checkoutDesktop: path.join(projectRoot, 'docs/design/implementation-checkout-desktop.jpg'),
  paymentDesktop: path.join(projectRoot, 'docs/design/implementation-payment-success-desktop.jpg'),
  productMobile: path.join(projectRoot, 'docs/design/implementation-product-mobile.jpg')
};

let server;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseURL);
      if (response.ok) return;
    } catch (_) {
      // Server is still starting.
    }
    await sleep(250);
  }
  throw new Error('Design screenshot server did not become ready.');
}

async function stopServer() {
  if (!server || server.killed) return;
  const stopped = new Promise(resolve => server.once('exit', resolve));
  server.kill();
  await Promise.race([stopped, sleep(5_000)]);
}

async function capture() {
  server = spawn(process.execPath, ['server.js'], {
    cwd: projectRoot,
    windowsHide: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      PORT: '4174',
      NODE_ENV: 'test',
      JWT_SECRET: 'design-capture-secret',
      ECPAY_ENV: 'staging',
      BASE_URL: baseURL
    }
  });

  await waitForServer();

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const desktop = await browser.newContext({ viewport: { width: 1440, height: 1024 }, deviceScaleFactor: 1 });
    const page = await desktop.newPage();
    let gatewayPayload;

    await page.route('https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5', async route => {
      gatewayPayload = Object.fromEntries(new URLSearchParams(route.request().postData() || ''));
      await route.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: '<!doctype html><title>Mock ECPay</title><main>綠界測試付款頁</main>'
      });
    });

    await page.goto(baseURL);
    await page.getByTestId('featured-product-0').click();
    await page.screenshot({ path: screenshots.productDesktop, type: 'jpeg', quality: 86 });

    await page.getByTestId('product-add-to-cart').click();
    await page.getByRole('link', { name: '購物車' }).click();
    await page.getByTestId('cart-checkout').click();
    await page.getByTestId('register-tab').click();
    await page.getByTestId('register-name').fill('設計稿花友');
    await page.getByTestId('register-email').fill(`design-${Date.now()}@example.com`);
    await page.getByTestId('register-password').fill('design123');
    await page.getByTestId('register-submit').click();
    await page.getByTestId('checkout-submit').waitFor();
    await page.screenshot({ path: screenshots.checkoutDesktop, type: 'jpeg', quality: 86 });

    await page.getByTestId('recipient-name').fill('王小花');
    await page.getByTestId('recipient-email').fill('design-recipient@example.com');
    await page.getByTestId('recipient-address').fill('台北市大安區花園路 100 號');
    await page.getByTestId('checkout-submit').click();
    await page.getByTestId('ecpay-pay-button').click();
    await page.getByText('綠界測試付款頁').waitFor();
    if (!gatewayPayload?.MerchantTradeNo) {
      throw new Error('Design screenshot did not receive an ECPay form payload.');
    }

    const callbackPayload = {
      MerchantTradeNo: gatewayPayload.MerchantTradeNo,
      RtnCode: '1',
      RtnMsg: 'Succeeded',
      TradeNo: 'DESIGN-CAPTURE-PAID-001',
      TradeAmt: gatewayPayload.TotalAmount,
      PaymentDate: '2026/07/26 12:00:00',
      PaymentType: 'Credit_CreditCard'
    };
    callbackPayload.CheckMacValue = generateCheckMacValue(callbackPayload, 'pwFHCqoQZGmho4w6', 'EkRm7iFT261dpevs');

    const notifyResponse = await fetch(`${baseURL}/api/ecpay/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(callbackPayload)
    });
    if (!notifyResponse.ok) throw new Error('Design screenshot payment callback failed.');

    await page.goto(`${baseURL}/api/ecpay/result?MerchantTradeNo=${encodeURIComponent(gatewayPayload.MerchantTradeNo)}&RtnCode=1`);
    await page.getByTestId('payment-success').waitFor();
    await page.screenshot({ path: screenshots.paymentDesktop, type: 'jpeg', quality: 86 });
    await desktop.close();

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const mobilePage = await mobile.newPage();
    await mobilePage.goto(baseURL);
    await mobilePage.getByTestId('featured-product-0').click();
    await mobilePage.screenshot({ path: screenshots.productMobile, type: 'jpeg', quality: 88 });
    await mobile.close();
  } finally {
    await browser.close();
  }
}

capture()
  .then(() => {
    console.log('Created design screenshots:');
    for (const screenshot of Object.values(screenshots)) console.log(path.relative(projectRoot, screenshot));
  })
  .catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(stopServer);
