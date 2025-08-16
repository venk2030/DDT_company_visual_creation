// generator.js — serves locally, injects data + brand logo, exports PNG+SVG
import fs from 'fs';
import path from 'path';
import http from 'http';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- tiny static server (no deps)
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

function startServer(rootDir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = new URL(req.url, 'http://localhost').pathname;
      let filePath = path.join(rootDir, decodeURIComponent(urlPath));
      if (urlPath === '/' || urlPath === '') {
        filePath = path.join(rootDir, 'timeline.html');
      }
      fs.readFile(filePath, (err, buf) => {
        if (err) { res.statusCode = 404; res.end('Not found'); return; }
        res.setHeader('Content-Type', MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
        res.end(buf);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

// ---------- paths & data
const OUT = path.join(__dirname, 'out');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8'));

// brand logo -> data URL (so we don’t worry about CORS)
const brandLogoPath = '/Users/venky/Documents/Development/DDT_EXIM_logo.jpeg';
let logoDataURL = '';
try {
  const buf = fs.readFileSync(brandLogoPath);
  const b64 = buf.toString('base64');
  logoDataURL = `data:image/jpeg;base64,${b64}`;
  console.log('✔ Loaded brand logo from:', brandLogoPath);
} catch (e) {
  console.warn('⚠ Could not read brand logo at', brandLogoPath, '- continuing without it');
}

// ---------- main
const { server, port } = await startServer(__dirname);
const origin = `http://127.0.0.1:${port}`;

const browser = await puppeteer.launch({
  headless: 'new',
  defaultViewport: { width: 1280, height: 840, deviceScaleFactor: 2 },
});
const page = await browser.newPage();
page.on('console', (msg) => console.log('PAGE:', msg.text()));

await page.goto(`${origin}/timeline.html`, { waitUntil: 'networkidle0' });

// inject data + logo and render
await page.exposeFunction('getPayload', () => ({ data, logoDataURL }));
await page.evaluate(async () => {
  const { data, logoDataURL } = await window.getPayload();

  // brand logo
  const img = document.getElementById('brandLogo');
  if (img && logoDataURL) img.src = logoDataURL;

  // timeline render
  let tries = 60;
  while (!window.renderTimeline && tries-- > 0) await new Promise(r => setTimeout(r, 50));
  if (!window.renderTimeline) throw new Error('renderTimeline not available');
  window.renderTimeline(data);
});

// sanity
const sanity = await page.evaluate(() => ({
  hasSVG: !!document.querySelector('#svgRoot'),
  circles: document.querySelectorAll('#svgRoot circle').length,
  texts: document.querySelectorAll('#svgRoot text').length,
}));
console.log('SANITY:', sanity);

// export PNG + SVG
const svgEl = await page.$('#svgRoot');
if (svgEl) {
  await svgEl.screenshot({ path: path.join(OUT, 'timeline.png') });
} else {
  await page.screenshot({ path: path.join(OUT, 'timeline.png') });
}
const svg = await page.evaluate(() => document.querySelector('#svgRoot')?.outerHTML || '');
if (svg) fs.writeFileSync(path.join(OUT, 'timeline.svg'), svg, 'utf8');

await browser.close();
server.close();

console.log('✅ Exported:', [
  fs.existsSync(path.join(OUT, 'timeline.png')) && 'out/timeline.png',
  fs.existsSync(path.join(OUT, 'timeline.svg')) && 'out/timeline.svg'
].filter(Boolean).join(' , '));
