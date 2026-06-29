/**
 * R2 visual-language evidence: screenshots of catalog / product / season in all
 * three climates (+ a reduced-motion pass), driving the installed Chrome via
 * puppeteer-core against the built SSR server (PORT 4000). Output → docs/r2-shots/.
 *
 * Run (with the SSR server already listening on :4000):
 *   node scripts/screenshots.mjs
 */
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import puppeteer from 'puppeteer-core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'docs', 'r2-shots');
mkdirSync(outDir, { recursive: true });

const CHROME =
  process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://localhost:4000';
const GARAGE = {
  makeId: 'bmw',
  modelId: 'bmw-3-series-g20',
  trimId: 'bmw-3-series-g20-320i',
  label: 'BMW 3 Series G20 320i',
};
const PRODUCT = 'aurelia-sportcontact-7-22545r18';
const CLIMATES = ['summer', 'winter', 'all-season'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shoot(page, season, path, url, reduced = false) {
  await page.emulateMediaFeatures([
    { name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' },
  ]);
  await page.evaluateOnNewDocument(
    (s, g) => {
      try {
        localStorage.setItem('auren.climate.season', JSON.stringify(s));
        localStorage.setItem('wheelz.garage.selected', JSON.stringify(g));
      } catch {
        /* ignore */
      }
    },
    season,
    GARAGE,
  );
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 45000 });
  await sleep(1200); // hydration applies the climate class + font swap settles
  await page.screenshot({ path, fullPage: false });
  console.log(`shot: ${path}`);
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--force-prefers-reduced-motion=0'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 960, deviceScaleFactor: 1 });

for (const c of CLIMATES) {
  await shoot(page, c, join(outDir, `catalog-${c}.png`), `${BASE}/catalog`);
  await shoot(page, c, join(outDir, `product-${c}.png`), `${BASE}/tire/${PRODUCT}`);
}
await shoot(page, 'winter', join(outDir, 'season-chooser.png'), `${BASE}/season`);
await shoot(page, 'summer', join(outDir, 'catalog-reduced-motion.png'), `${BASE}/catalog`, true);

await browser.close();
console.log('done → docs/r2-shots/');
