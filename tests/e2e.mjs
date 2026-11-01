// E2E-rooktest: start de lokale server, doorloop de demo met Playwright en maak screenshots.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8765;
const BASIS = `http://localhost:${PORT}/`;
const SCHERMEN = process.env.SCRATCH || path.join(ROOT, 'e2e-screens');
const fouten = [];
let serverFout = null;

function eis(voorwaarde, melding) {
  if (!voorwaarde) throw new Error(`E2E mislukt: ${melding}`);
}

async function wachtOpServer() {
  for (let i = 0; i < 50; i++) {
    if (serverFout) throw new Error(`E2E mislukt: server niet gestart (${serverFout}; poort ${PORT} bezet?)`);
    try {
      const antw = await fetch(BASIS);
      if (antw.ok) {
        eis((await antw.text()).includes('RollNest'), `op poort ${PORT} draait een andere server`);
        return;
      }
    } catch (e) { if (String(e.message).startsWith('E2E')) throw e; }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('E2E mislukt: server start niet');
}

async function main() {
  mkdirSync(SCHERMEN, { recursive: true });
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', (e) => fouten.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const url = m.location().url || '';
      if (/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(url)) return; // lettertypen kunnen offline ontbreken
      fouten.push(`console.error: ${m.text()}`);
    });

    await page.goto(BASIS);
    await page.click('#btn-voorbeeld');
    await page.waitForFunction(() => document.getElementById('kop-kosten')?.textContent.includes('€'), null, { timeout: 10000 })
      .catch(() => { throw new Error('E2E mislukt: #kop-kosten bevat geen €'); });

    for (const tab of ['orders', 'stoffen', 'resultaat']) {
      await page.click(`[data-tab="${tab}"]`);
      await page.waitForSelector(`#tab-${tab}[aria-selected="true"], #tab-${tab}[aria-current], #tab-${tab}.actief`, { timeout: 1500 }).catch(() => {});
    }
    const subtabs = ['inkoop', 'doeken', 'normen', 'snijplannen'];
    for (const sub of subtabs) {
      await page.click(`[data-subtab="${sub}"]`);
      await page.waitForSelector(`[data-subtab="${sub}"][aria-pressed="true"]`);
      await page.screenshot({ path: path.join(SCHERMEN, `desktop-${sub}.png`), fullPage: true });
    }
    eis((await page.locator('svg rect.stuk').count()) >= 1, 'geen svg rect.stuk op snijplannen');

    await page.click('#btn-werkbon');
    await page.waitForSelector('.werkbon-titel');
    eis((await page.textContent('.werkbon-titel')).includes('Werkbon'), 'werkbon niet getoond');
    await page.screenshot({ path: path.join(SCHERMEN, 'desktop-werkbon.png'), fullPage: true });
    await page.click('#btn-werkbon');

    await page.click('[data-subtab="inkoop"]');
    await page.click('#btn-export-inkoop-csv');
    await page.waitForSelector('#export-inkoop-tekst', { state: 'visible' });
    const csv = await page.inputValue('#export-inkoop-tekst');
    eis(csv.startsWith('Stofcode;Stof;'), 'export-CSV begint niet met de inkoopkop "Stofcode;Stof;"');
    eis(csv.includes('S5A;'), 'export-CSV bevat geen rij voor S5A');

    await page.click('[data-tab="orders"]');
    await page.fill('#import-tekst', 'ordernr;stof;product;breedte;hoogte\nE2E;S5A;screen;200;150');
    await page.click('#btn-import');
    await page.waitForSelector('#tabel-open input[value="E2E"]', { timeout: 5000 })
      .catch(() => { throw new Error('E2E mislukt: geïmporteerde order E2E niet in #tabel-open'); });
    await page.screenshot({ path: path.join(SCHERMEN, 'desktop-orders.png'), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    for (const tab of ['orders', 'stoffen', 'resultaat']) {
      await page.click(`[data-tab="${tab}"]`);
      await page.waitForLoadState('networkidle').catch(() => {});
      const breed = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
      eis(breed, `horizontale scroll op mobiel (tab ${tab})`);
      await page.screenshot({ path: path.join(SCHERMEN, `mobiel-${tab}.png`), fullPage: true });
    }
    for (const sub of subtabs) {
      await page.click(`[data-subtab="${sub}"]`);
      await page.waitForSelector(`[data-subtab="${sub}"][aria-pressed="true"]`);
      const breed = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
      eis(breed, `horizontale scroll op mobiel (subtab ${sub})`);
      await page.screenshot({ path: path.join(SCHERMEN, `mobiel-${sub}.png`), fullPage: true });
    }

    eis(fouten.length === 0, `fouten in browser:\n  ${fouten.join('\n  ')}`);
  } finally {
    await browser.close();
  }
}

const server = spawn(process.execPath, [path.join(ROOT, 'scripts', 'serve.mjs')], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: 'ignore',
});
server.on('error', (e) => { serverFout = e.message; });
server.on('exit', (code) => { if (code) serverFout = `afgesloten met code ${code}`; });
try {
  await wachtOpServer();
  await main();
  console.log('E2E OK');
} catch (e) {
  console.error(e.message || e);
  process.exitCode = 1;
} finally {
  server.kill();
}
