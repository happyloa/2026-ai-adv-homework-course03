const { spawn } = require('node:child_process');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173';
const runnerArgs = ['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)];
let server;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServer(url) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (_) {
      // Server has not finished starting yet.
    }
    await sleep(250);
  }
  throw new Error(`E2E server did not become ready: ${url}`);
}

async function stopServer() {
  if (!server || server.killed) return;

  const stopped = new Promise(resolve => server.once('exit', resolve));
  server.kill();
  await Promise.race([stopped, sleep(5_000)]);
}

async function main() {
  if (!process.env.E2E_BASE_URL) {
    const url = new URL(baseURL);
    server = spawn(process.execPath, ['server.js'], {
      cwd: projectRoot,
      windowsHide: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        PORT: url.port || '4173',
        NODE_ENV: 'test',
        JWT_SECRET: 'e2e-payment-test-secret',
        ECPAY_ENV: 'staging',
        BASE_URL: baseURL
      }
    });
    await waitForServer(baseURL);
  }

  const runner = spawn(process.execPath, runnerArgs, {
    cwd: projectRoot,
    windowsHide: true,
    stdio: 'inherit',
    env: { ...process.env, E2E_BASE_URL: baseURL }
  });

  try {
    const exitCode = await new Promise((resolve, reject) => {
      runner.once('error', reject);
      runner.once('exit', code => resolve(code ?? 1));
    });
    process.exitCode = exitCode;
  } finally {
    await stopServer();
  }
}

process.on('SIGINT', async () => {
  await stopServer();
  process.exit(130);
});

process.on('exit', () => {
  if (server && !server.killed) server.kill();
});

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
