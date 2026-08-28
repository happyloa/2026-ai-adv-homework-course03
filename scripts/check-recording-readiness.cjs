const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('@playwright/test');

const projectRoot = path.join(__dirname, '..');
const runtimeDir = path.join(projectRoot, '.recording-runtime');
const publicUrlPath = path.join(runtimeDir, 'public-url.txt');

function readPublicUrl() {
  if (!fs.existsSync(publicUrlPath)) {
    throw new Error('Public URL not found. Run npm run recording:start first.');
  }

  return fs.readFileSync(publicUrlPath, 'utf8').trim().replace(/\/$/, '');
}

function assertTrackedProcess(pidFileName, label) {
  const pidPath = path.join(runtimeDir, pidFileName);
  if (!fs.existsSync(pidPath)) {
    throw new Error(`${label} was not started. Run npm run recording:start and wait for "Recording environment is ready."`);
  }

  const pid = Number.parseInt(fs.readFileSync(pidPath, 'utf8'), 10);
  try {
    process.kill(pid, 0);
  } catch {
    throw new Error(`${label} is no longer running. Run npm run recording:start again.`);
  }
}

async function waitForPublicUrl(publicUrl, timeout = 120_000) {
  const deadline = Date.now() + timeout;
  let lastError = 'unknown error';
  let nextProgressAt = Date.now() + 10_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(publicUrl, {
        redirect: 'manual',
        signal: AbortSignal.timeout(10_000)
      });
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error.cause?.code || error.message;
    }

    if (Date.now() >= nextProgressAt) {
      const secondsLeft = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      console.log(`Public URL is still propagating (${lastError}); ${secondsLeft}s remaining...`);
      nextProgressAt = Date.now() + 10_000;
    }

    await new Promise(resolve => setTimeout(resolve, 2_000));
  }

  throw new Error(
    `Public URL was not ready after ${timeout / 1000}s (${lastError}). ` +
    'Run npm run recording:stop, then npm run recording:start to request a new tunnel.'
  );
}

async function waitForPageReady(page, expectedPage) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      await page.waitForFunction(pageName => {
        return document.documentElement.dataset.pageReady === pageName;
      }, expectedPage, { timeout: 12_000 });
      return;
    } catch (error) {
      if (attempt === 4) throw error;
      await page.reload({ waitUntil: 'domcontentloaded' });
    }
  }
}

async function waitForOrderPaid(publicUrl, orderId, token, timeout = 90_000) {
  const deadline = Date.now() + timeout;
  let lastStatus = 'unknown';

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${publicUrl}/api/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const payload = await response.json();
        lastStatus = payload.data?.status || lastStatus;
        if (lastStatus === 'paid') return;
      }
    } catch {
      // The quick tunnel can briefly retry while ECPay posts the callback.
    }

    await new Promise(resolve => setTimeout(resolve, 1_500));
  }

  throw new Error(`ECPay callback did not mark order ${orderId} as paid (last status: ${lastStatus}).`);
}

async function completeEcpayMockPayment(paymentPopup) {
  await paymentPopup.locator('#CardNo').fill('4311952222222222');
  await paymentPopup.locator('#AuthExpireDateYY').fill('30');
  await paymentPopup.locator('#AuthExpireDateMM').fill('12');
  await paymentPopup.locator('#AuthCode').fill('222');
  await paymentPopup.locator('#CardHolderInfo_Cardholder').fill('TEST USER');
  await paymentPopup.locator('#CardHolderInfo_CellPhone').fill('0912345678');
  await paymentPopup.locator('#CardHolderInfo_EMail').fill('e2e@example.com');
  await paymentPopup.locator('#CardHolderInfo_NationalityID').fill('TW');
  await paymentPopup.locator('#CardHolderInfo_Address').fill('Taipei, Taiwan');
  await paymentPopup.locator('input[type="submit"]').click();
  await paymentPopup.locator('#GetOTPPwd').click();
  await paymentPopup.locator('#OTP').waitFor({ timeout: 60_000 });
  await paymentPopup.locator('#OTP').fill('1234');
  await paymentPopup.locator('#OTPSend').click();
}

async function main() {
  assertTrackedProcess('server.pid', 'Local Node.js server');
  assertTrackedProcess('cloudflared.pid', 'Cloudflare tunnel');
  const publicUrl = readPublicUrl();
  console.log(`Checking recording environment: ${publicUrl}`);
  console.log('The first public check can take up to 120 seconds.');
  await waitForPublicUrl(publicUrl);

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const email = `readiness-${Date.now()}@example.com`;
  const browserErrors = [];

  page.on('console', message => {
    if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', error => browserErrors.push(`pageerror: ${error.message}`));
  page.on('requestfailed', request => {
    browserErrors.push(`requestfailed: ${request.method()} ${request.url()} - ${request.failure()?.errorText}`);
  });
  page.on('response', response => {
    if (response.status() >= 400) browserErrors.push(`response: ${response.status()} ${response.url()}`);
  });

  try {
    await page.goto(publicUrl, { waitUntil: 'domcontentloaded' });
    await waitForPageReady(page, 'index');
    await page.getByTestId('featured-product-0').click();
    await waitForPageReady(page, 'product-detail');
    await page.getByTestId('product-add-to-cart').click();
    await page.getByRole('link', { name: '購物車' }).click();
    await waitForPageReady(page, 'cart');
    await page.getByTestId('cart-checkout').click();
    await page.waitForURL(/\/login\?redirect=/);
    await waitForPageReady(page, 'login');
    await page.getByTestId('register-tab').click();
    await page.getByTestId('register-name').fill('E2E 就緒檢查');
    await page.getByTestId('register-email').fill(email);
    await page.getByTestId('register-password').fill('payment123');
    await page.getByTestId('register-submit').click();
    await page.waitForURL(/\/checkout/);
    await waitForPageReady(page, 'checkout');
    await page.getByTestId('recipient-name').fill('王小花');
    await page.getByTestId('recipient-email').fill('readiness@example.com');
    await page.getByTestId('recipient-address').fill('台北市大安區花園路 100 號');
    await page.getByTestId('checkout-submit').click();
    await page.waitForURL(/\/orders\//);
    await waitForPageReady(page, 'order-detail');
    const orderPageUrl = page.url();
    const orderId = new URL(orderPageUrl).pathname.split('/').filter(Boolean).at(-1);
    const token = await page.evaluate(() => localStorage.getItem('flower_token'));
    if (!orderId || !token) {
      throw new Error('Unable to capture the order ID or login token before ECPay checkout.');
    }
    await page.getByTestId('ecpay-pay-button').click();
    await page.waitForURL(/payment-stage\.ecpay\.com\.tw/, { timeout: 60_000 });
    await page.waitForLoadState('domcontentloaded');

    const bodyText = await page.locator('body').innerText();
    if (/CheckMacValue|參數錯誤|Error/i.test(bodyText)) {
      throw new Error(`ECPay staging rejected the request: ${bodyText.slice(0, 500)}`);
    }

    await page.screenshot({
      path: path.join(runtimeDir, 'ecpay-stage-check.png'),
      fullPage: true
    });

    const ecpayText = await page.locator('body').innerText();
    const merchantTradeNo = ecpayText.match(/FP[A-Za-z0-9]{8,18}/)?.[0];
    if (!merchantTradeNo) {
      throw new Error('Unable to read MerchantTradeNo from the ECPay staging page.');
    }

    fs.writeFileSync(path.join(runtimeDir, 'last-merchant-trade-no.txt'), merchantTradeNo, 'utf8');
    const popupPromise = page.waitForEvent('popup');
    await page.locator('#aCREDIT').click();
    const paymentPopup = await popupPromise;
    await paymentPopup.waitForLoadState('domcontentloaded').catch(() => {});
    await completeEcpayMockPayment(paymentPopup);

    await waitForOrderPaid(publicUrl, orderId, token);
    await paymentPopup.close().catch(() => {});
    const currentUrl = new URL(page.url());
    if (currentUrl.pathname !== new URL(orderPageUrl).pathname ||
        currentUrl.searchParams.get('payment') !== 'success') {
      await page.goto(`${orderPageUrl}?payment=success`, { waitUntil: 'domcontentloaded' });
    } else {
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    }
    await waitForPageReady(page, 'order-detail');
    await page.getByTestId('payment-success').waitFor({ timeout: 60_000 });
    await page.screenshot({
      path: path.join(runtimeDir, 'payment-success-check.png'),
      fullPage: true
    });

    console.log(`Public HTTPS check passed: ${publicUrl}`);
    console.log(`ECPay staging payment completed: ${merchantTradeNo}`);
    console.log(`Payment success page verified: ${page.url()}`);
    console.log('Readiness screenshot: .recording-runtime/ecpay-stage-check.png');
    console.log('Success screenshot: .recording-runtime/payment-success-check.png');
  } catch (error) {
    const failureScreenshot = path.join(runtimeDir, 'recording-readiness-failure.png');
    await page.screenshot({ path: failureScreenshot, fullPage: true }).catch(() => {});
    const bodyText = await page.locator('body').innerText().catch(() => 'Unable to read page body.');
    console.error(`Current URL: ${page.url()}`);
    console.error(`Page text: ${bodyText.slice(0, 1000)}`);
    if (browserErrors.length > 0) console.error(browserErrors.join('\n'));
    console.error('Failure screenshot: .recording-runtime/recording-readiness-failure.png');
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
