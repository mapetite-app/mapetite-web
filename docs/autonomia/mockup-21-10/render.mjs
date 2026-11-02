// Rigenera i PNG dei mockup (390x844, densità 2x).
// Uso: PW_MODULE=$(npm root -g)/playwright node docs/autonomia/mockup-21-10/render.mjs home-A scheda-B ...
// Output in docs/autonomia/mockup-21-10/png/
import { createRequire } from 'module';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const D = dirname(fileURLToPath(import.meta.url));
mkdirSync(`${D}/png`, { recursive: true });
const b = await chromium.launch({ args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
for (const n of process.argv.slice(2)) {
  await p.goto(`file://${D}/${n}.html`);
  await p.waitForSelector('body[data-ready="1"]', { timeout: 5000 });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(150);
  await p.screenshot({ path: `${D}/png/${n}.png` });
  console.log('ok', n);
}
await b.close();
