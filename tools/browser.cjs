const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');

const project = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon' };

async function openBrowser({ preview = false, out, shots = false, viewport = { width: 1280, height: 720 }, legacy } = {}) {
  const entry = preview ? 'dist/v2-preview.html' : 'dist/play.html';
  if (!fs.existsSync(path.join(project, entry))) throw new Error(`${entry} is missing; run ${preview ? 'node build-v2.mjs' : 'npm run build'} first.`);
  const { chromium } = require(require.resolve('playwright', { paths: [project, path.dirname(project)] }));
  const failures = [], consoleErrors = [], pageErrors = [];
  const output = path.resolve(out ?? path.join(os.tmpdir(), 'jingge-browser-check'));
  fs.mkdirSync(output, { recursive: true });
  const server = http.createServer((request, response) => {
    let file;
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      file = path.resolve(project, `.${pathname === '/' ? `/${entry}` : pathname}`);
    } catch { response.writeHead(400).end('Invalid URL'); return; }
    if (!file.startsWith(project + path.sep)) { response.writeHead(403).end('Forbidden'); return; }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      failures.push({ status: 404, url: `http://${request.headers.host}${request.url}`, source: 'local-server' });
      response.writeHead(404).end('Not found'); return;
    }
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(response);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const systemChrome = process.env.CHROME_PATH ?? path.join(process.env.PROGRAMFILES ?? '', 'Google/Chrome/Application/chrome.exe');
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(fs.existsSync(systemChrome) ? { executablePath: systemChrome } : {}) });
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    if (legacy) await context.addInitScript(save => {
      if (!location.protocol.startsWith('http') || sessionStorage.getItem('jg-smoke-seeded')) return;
      localStorage.clear(); localStorage.setItem('jg_hunt_save_v1', JSON.stringify(save));
      sessionStorage.setItem('jg-smoke-seeded', '1');
    }, legacy);
    const page = await context.newPage();
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push({ text: message.text(), location: message.location() }); });
    page.on('pageerror', error => pageErrors.push(error.stack ?? error.message));
    page.on('response', response => { if (response.status() >= 400) failures.push({ status: response.status(), url: response.url() }); });
    page.on('requestfailed', request => failures.push({ url: request.url(), error: request.failure()?.errorText }));
    return { page, context, browser, base, entry, output, failures, consoleErrors, pageErrors,
      async load() { await page.goto(`${base}/${entry}`, { waitUntil: 'load' }); await page.waitForFunction(() => window.__jg2d?.ready, null, { timeout: 20000 }); },
      async shot(name) { if (shots) await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true }); },
      async close() { await browser.close(); await new Promise(resolve => server.close(resolve)); },
    };
  } catch (error) {
    await browser?.close(); await new Promise(resolve => server.close(resolve)); throw error;
  }
}

module.exports = { openBrowser, project };

if (require.main === module) {
  const { runSmoke } = require('./smoke.cjs');
  runSmoke(process.argv.slice(2)).catch(error => { console.error(error.stack ?? error); process.exitCode = 1; });
}
