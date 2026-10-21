// Builds the print brochure (brochure/brochure.html) into public/ilika-the-earth-brochure.pdf
// using the same photos, logo and icons as the website.
//
//   npm run brochure
//
// Needs Playwright with Chromium (npx playwright install chromium) — not used by the site build.

import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import QRCode from 'qrcode';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'brochure');
const OUT = path.join(SRC, '.build');
const PDF = path.join(ROOT, 'public', 'ilika-the-earth-brochure.pdf');
const IMAGES = path.join(ROOT, 'images');
const EXT = /\.(jpe?g|png|webp|avif|tiff?)$/i;

await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(path.join(OUT, 'img'), { recursive: true });

let html = await fs.readFile(path.join(SRC, 'brochure.html'), 'utf8');
const sources = Object.fromEntries((await fs.readdir(IMAGES)).filter((f) => EXT.test(f)).map((f) => [f.replace(EXT, ''), f]));

// Photos → JPEG (embedded as-is in the PDF, keeping it small); transparent art → PNG
const pics = new Map();
html = html.replace(/<img\b([^>]*?)\bdata-pic="([^"]+)"([^>]*)>/g, (m, a, name, b) => {
  if (!sources[name]) throw new Error(`Unknown image "${name}"`);
  const w = Number((m.match(/data-w="(\d+)"/) || [])[1] || 2200);
  pics.set(name, w);
  const rest = `${a} ${b}`.replace(/data-w="\d+"/, '').replace(/\/\s*$/, '');
  return `<img ${rest} src="img/${name}.__EXT__${name}__">`;
});
for (const [name, w] of pics) {
  const img = sharp(path.join(IMAGES, sources[name])).rotate();
  const { hasAlpha } = await img.metadata();
  const ext = hasAlpha ? 'png' : 'jpg';
  const resized = img.resize({ width: w, withoutEnlargement: true });
  await (hasAlpha ? resized.png({ compressionLevel: 9 }) : resized.jpeg({ quality: 84, mozjpeg: true })).toFile(
    path.join(OUT, 'img', `${name}.${ext}`),
  );
  html = html.replaceAll(`__EXT__${name}__`, ext);
}

// Inline SVGs: "ph/<icon>" from Phosphor (light), anything else from src/svg
html = await replaceAsync(html, /<i\b([^>]*)\bdata-svg="([^"]+)"([^>]*)><\/i\s*>/g, async (m, a, name, b) => {
  const file = name.startsWith('ph/')
    ? path.join(ROOT, 'node_modules/@phosphor-icons/core/assets/light', `${name.slice(3)}-light.svg`)
    : path.join(ROOT, 'src/svg', `${name}.svg`);
  const cls = (`${a} ${b}`.match(/class="([^"]+)"/) || [])[1];
  const svg = (await fs.readFile(file, 'utf8')).replace(/ data-pen(-w)?="[^"]*"/g, '');
  return cls ? svg.replace('<svg', `<svg class="${cls}"`) : svg;
});

// QR codes
html = await replaceAsync(html, /<i data-qr="([^"]+)"><\/i>/g, (m, url) =>
  QRCode.toString(url, { type: 'svg', margin: 0, color: { dark: '#f1e7d6', light: '#0000' } }),
);

// Fine film grain tile (same feel as the site's CSS grain)
const N = 512;
const noise = Buffer.alloc(N * N * 4);
for (let i = 0; i < N * N; i++) {
  const v = Math.random() < 0.5 ? 0 : 255;
  noise.set([v, v, v, Math.round(Math.random() * 26)], i * 4);
}
await sharp(noise, { raw: { width: N, height: N, channels: 4 } })
  .png()
  .toFile(path.join(OUT, 'img', 'grain.png'));

await fs.copyFile(path.join(SRC, 'brochure.css'), path.join(OUT, 'brochure.css'));
await fs.writeFile(path.join(OUT, 'index.html'), html);

// Render
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  const { execSync } = await import('node:child_process');
  ({ chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright')));
}
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`file://${path.join(OUT, 'index.html')}`, { waitUntil: 'networkidle' });
await page.evaluate(async () => {
  await document.fonts.ready;
  await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
  // page numbers, folios and the contents list
  const pages = [...document.querySelectorAll('.page')];
  pages.forEach((p, i) => {
    if (!p.hasAttribute('data-folio')) return;
    const f = document.createElement('footer');
    f.className = 'folio';
    f.innerHTML = `<span>ilika · the earth</span><span>${String(i + 1).padStart(2, '0')}</span>`;
    p.append(f);
  });
  document.querySelectorAll('[data-ref]').forEach((el) => {
    const target = document.getElementById(el.dataset.ref);
    el.textContent = String(pages.indexOf(target) + 1).padStart(2, '0');
  });
});
await page.pdf({ path: PDF, width: '297mm', height: '210mm', printBackground: true, preferCSSPageSize: true });
await browser.close();

const { size } = await fs.stat(PDF);
console.log(`brochure: ${path.relative(ROOT, PDF)} (${(size / 1048576).toFixed(1)} MB)`);

async function replaceAsync(str, re, fn) {
  const jobs = [];
  str.replace(re, (...args) => jobs.push(fn(...args)));
  const results = await Promise.all(jobs);
  return str.replace(re, () => results.shift());
}
