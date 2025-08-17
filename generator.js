// generator.js — serves locally, injects data + brand logo, exports PNG+SVG (with template switch, schema validation & --validate-only)
import fs from 'fs';
import path from 'path';
import http from 'http';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import Ajv from 'ajv';
import { Schema } from './schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== args & env =====
const ARGS = new Set(process.argv.slice(2));
const VALIDATE_ONLY = ARGS.has('--validate-only');

const TEMPLATE = (process.env.TEMPLATE || 'timeline').trim(); // timeline | curved | zigzag
const HEADLESS = (process.env.HEADLESS ?? 'new');             // 'new' | 'true' | 'false'
const EXECUTABLE = process.env.PUPPETEER_EXECUTABLE_PATH || null;
const LOGO_PATH = process.env.LOGO_PATH || '/Users/venky/Documents/Development/DDT_EXIM_logo.jpeg';
const OUT_BASENAME = (process.env.OUT_BASENAME || 'timeline').trim();
const VIEWPORT = { width: 1280, height: 840, deviceScaleFactor: 2 };

// ===== tiny static server w/ template remap =====
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

function startServer(rootDir, templateName) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = new URL(req.url, 'http://localhost').pathname;

      // remap: /src/timeline.js -> /src/<TEMPLATE>.js (front-end imports timeline.js)
      let effectivePath = urlPath;
      if (urlPath === '/' || urlPath === '') effectivePath = '/timeline.html';
      if (urlPath === '/src/timeline.js' && templateName !== 'timeline') {
        effectivePath = `/src/${templateName}.js`;
      }

      const filePath = path.join(rootDir, decodeURIComponent(effectivePath));
      fs.readFile(filePath, (err, buf) => {
        if (err) {
          res.statusCode = 404;
          res.end(`Not found: ${effectivePath}`);
          return;
        }
        res.setHeader('Content-Type', MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
        res.end(buf);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

// ===== paths & out dir =====
const OUT = path.join(__dirname, 'out');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// data load (once)
const dataPath = path.join(__dirname, 'data.json');
let dataRaw;
try {
  dataRaw = fs.readFileSync(dataPath, 'utf8');
} catch (e) {
  console.error(`❌ Could not read data.json: ${e.message}`);
  process.exit(1);
}
let data;
try {
  data = JSON.parse(dataRaw);
} catch (e) {
  console.error(`❌ data.json is not valid JSON: ${e.message}`);
  process.exit(1);
}

// schema validate (once)
const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);
if (!validate(data)) {
  console.error('❌ data.json failed schema validation:\n', validate.errors);
  process.exit(1);
}
console.log('✔ data.json schema validation passed');

// normalize {items: [...]}
if (!Array.isArray(data?.items)) {
  console.warn('⚠ data.json missing "items" array after validation? Proceeding with empty items.');
  data = { items: [] };
}

if (VALIDATE_ONLY) {
  console.log('✅ --validate-only: schema OK. Exiting without rendering.');
  process.exit(0);
}

// ===== brand logo -> data URL =====
let logoDataURL = '';
try {
  const buf = fs.readFileSync(LOGO_PATH);
  const b64 = buf.toString('base64');
  const ext = path.extname(LOGO_PATH).toLowerCase() || '.jpeg';
  const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
  logoDataURL = `data:${mime};base64,${b64}`;
  console.log('✔ Loaded brand logo from:', LOGO_PATH);
} catch {
  console.warn('⚠ Could not read brand logo at', LOGO_PATH, '- continuing without it');
}

// ===== main =====
const { server, port } = await startServer(__dirname, TEMPLATE);
const origin = `http://127.0.0.1:${port}`;
const ts = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, ''); // YYYYMMDDTHHMMSS
const stem = `${OUT_BASENAME}.${TEMPLATE}.${ts}`;
const outPNG = path.join(OUT, `${stem}.png`);
const outSVG = path.join(OUT, `${stem}.svg`);
const latestPNG = path.join(OUT, `${OUT_BASENAME}.${TEMPLATE}.latest.png`);
const latestSVG = path.join(OUT, `${OUT_BASENAME}.${TEMPLATE}.latest.svg`);

let browser;
try {
  const launchOpts = { headless: HEADLESS, defaultViewport: VIEWPORT };
  if (EXECUTABLE) launchOpts.executablePath = EXECUTABLE;

  browser = await puppeteer.launch(launchOpts);
  const page = await browser.newPage();
  page.on('console', (msg) => console.log('PAGE:', msg.text()));
  page.on('pageerror', (err) => console.error('PAGEERROR:', err?.message || err));
  page.on('response', (resp) => { if (resp.status() >= 400) console.warn('HTTP', resp.status(), resp.url()); });

  console.log(`→ Using template: ${TEMPLATE}`);
  await page.goto(`${origin}/timeline.html`, { waitUntil: 'networkidle0', timeout: 60_000 });

  // inject data + logo and render
  await page.exposeFunction('getPayload', () => ({ data, logoDataURL }));

  const renderOk = await page.evaluate(async () => {
    const { data, logoDataURL } = await window.getPayload();

    // brand logo
    const img = document.getElementById('brandLogo');
    if (img && logoDataURL) img.src = logoDataURL;

    // wait for renderer
    let tries = 120;
    while (!window.renderTimeline && tries-- > 0) await new Promise((r) => setTimeout(r, 50));
    if (!window.renderTimeline) return { ok: false, reason: 'renderTimeline not available (did src/<template>.js load?)' };

    try { window.renderTimeline(data); return { ok: true }; }
    catch (e) { return { ok: false, reason: e?.message || String(e) }; }
  });

  if (!renderOk.ok) throw new Error(`Render failed: ${renderOk.reason}`);

  // wait for SVG root (or fall back)
  await page.waitForFunction(() => !!document.querySelector('#svgRoot') || !!document.querySelector('svg'), { timeout: 15_000 });
  const svgEl = await page.$('#svgRoot') || await page.$('svg');

  // export PNG
  if (svgEl) await svgEl.screenshot({ path: outPNG });
  else await page.screenshot({ path: outPNG, fullPage: true });

  // export SVG
  const svg = await page.evaluate(() => (document.querySelector('#svgRoot') || document.querySelector('svg'))?.outerHTML || '');
  if (svg) fs.writeFileSync(outSVG, svg, 'utf8');

  // "latest" symlinks (best-effort)
  try {
    for (const p of [latestPNG, latestSVG]) if (fs.existsSync(p)) fs.unlinkSync(p);
    if (fs.existsSync(outPNG)) fs.symlinkSync(path.basename(outPNG), latestPNG);
    if (fs.existsSync(outSVG)) fs.symlinkSync(path.basename(outSVG), latestSVG);
  } catch {}

  console.log('✅ Exported:', [
    fs.existsSync(outPNG) && path.relative(__dirname, outPNG),
    fs.existsSync(outSVG) && path.relative(__dirname, outSVG),
  ].filter(Boolean).join(' , '));
} catch (err) {
  console.error('❌ Build failed:', err?.message || err);
  try {
    const triage = path.join(OUT, `${OUT_BASENAME}.${TEMPLATE}.fail.png`);
    if (browser && (await browser.pages()).length) {
      const [p] = await browser.pages();
      await p.screenshot({ path: triage, fullPage: true });
      console.error('🖼  Wrote failure screenshot:', path.relative(__dirname, triage));
    }
  } catch {}
  process.exitCode = 1;
} finally {
  try { if (browser) await browser.close(); } catch {}
  server.close();
}
