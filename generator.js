// generator.js — robust + with sanity logs
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

// Pipe browser console logs to your terminal so you can "see" what's happening
page.on('console', msg => console.log('PAGE:', msg.text()));

await page.goto('file://' + path.resolve('timeline.html'), { waitUntil: 'load' });

// Give the page the data + render it
await page.exposeFunction('getData', () => data);
await page.evaluate(async () => {
  const d = await window.getData();
  // Wait until the module attaches the function
  let tries = 40;
  while (!window.renderTimeline && tries-- > 0) {
    await new Promise(r => setTimeout(r, 50));
  }
  if (!window.renderTimeline) throw new Error('renderTimeline not available');
  window.renderTimeline(d);
});

// Sanity check in the page: do we have an SVG + circles + text?
const sanity = await page.evaluate(() => ({
  hasSVG: !!document.querySelector('#svgRoot'),
  circles: document.querySelectorAll('#svgRoot circle').length,
  texts: document.querySelectorAll('#svgRoot text').length
}));
console.log('SANITY:', sanity);

// Export PNG (target the svg if present)
const el = await page.$('#svgRoot');
if (el) {
  await el.screenshot({ path: path.join(OUT,'timeline.png') });
} else {
  await page.screenshot({ path: path.join(OUT,'timeline.png') });
}

// Export SVG (vector)
const svg = await page.evaluate(() => document.querySelector('#svgRoot')?.outerHTML || '');
if (svg) fs.writeFileSync(path.join(OUT,'timeline.svg'), svg, 'utf8');

await browser.close();
console.log('✅ Exported:', [
  fs.existsSync(path.join(OUT,'timeline.png')) && 'out/timeline.png',
  fs.existsSync(path.join(OUT,'timeline.svg')) && 'out/timeline.svg'
].filter(Boolean).join(' , '));
