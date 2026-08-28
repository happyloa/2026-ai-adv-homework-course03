const { spawn } = require('node:child_process');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3001';
const runnerArgs = ['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)];

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

async function main() {
  await waitForServer(baseURL);

  const runner = spawn(process.execPath, runnerArgs, {
    cwd: projectRoot,
    windowsHide: true,
    stdio: 'inherit',
    env: { ...process.env, E2E_BASE_URL: baseURL }
  });

  const exitCode = await new Promise((resolve, reject) => {
    runner.once('error', reject);
    runner.once('exit', code => resolve(code ?? 1));
  });
  process.exitCode = exitCode;
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
