import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const OUT = 'out';
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const data = JSON.parse(fs.readFileSync('data.json','utf8'));

const browser = await puppeteer.launch({
  headless: 'new',
  defaultViewport: { width:1280, height:840, deviceScaleFactor:2 }
});
const page = await browser.newPage();

await page.goto('file://' + path.resolve('timeline.html'), { waitUntil: 'load' });

// Inject data and ensure renderer exists
await page.exposeFunction('getData', () => data);
await page.evaluate(async () => {
  const d = await window.getData();
  // if the module hasn't attached yet, wait a tick
  let tries = 30;
  while (!window.renderTimeline && tries-- > 0) {
    await new Promise(r => setTimeout(r, 50));
  }
  if (!window.renderTimeline) throw new Error('renderTimeline not available');
  window.renderTimeline(d);
});

// Basic sanity: count nodes
const counts = await page.evaluate(() => ({
  svg: !!document.querySelector('#svgRoot'),
  nodes: document.querySelectorAll('#svgRoot circle').length,
  labels: document.querySelectorAll('#svgRoot text').length
}));
console.log('DOM sanity:', counts);

// Screenshot
const el = await page.$('#svgRoot');
if (el) {
  await el.screenshot({ path: path.join(OUT,'timeline.png') });
} else {
  await page.screenshot({ path: path.join(OUT,'timeline.png') });
}

// SVG dump
const svg = await page.evaluate(() => document.querySelector('#svgRoot')?.outerHTML || '');
if (svg) fs.writeFileSync(path.join(OUT,'timeline.svg'), svg, 'utf8');

await browser.close();
console.log('✅ Exported:', [
  fs.existsSync(path.join(OUT,'timeline.png')) && 'out/timeline.png',
  fs.existsSync(path.join(OUT,'timeline.svg')) && 'out/timeline.svg'
].filter(Boolean).join(' , '));
