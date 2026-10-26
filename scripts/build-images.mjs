// Turns every source photo in /images into responsive WebP variants in /public/img
// and writes a manifest the HTML plugin (vite.config.js) uses to build srcsets.
//
// To swap in a high-res photo: replace the file in /images keeping the same name
// (any of .jpg .jpeg .png .webp .avif .tif) and rebuild. Nothing else to change.

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'images');
const OUT = path.join(ROOT, 'public', 'img');
const MANIFEST = path.join(ROOT, 'src', 'image-manifest.json');
const WIDTHS = [480, 800, 1200, 1800, 2400, 3200]; // 3200 only for sources wider than that
const EXT = /\.(jpe?g|png|webp|avif|tiff?)$/i;
// Transparent art that always sits on one flat colour: laying it on that colour drops the
// alpha channel, which for detailed art (thousands of map trees) is most of the file size.
const FLATTEN = { 'location-map': '#77361f' }; // = --map-bg in src/styles.css

await fs.mkdir(OUT, { recursive: true });

const files = (await fs.readdir(SRC)).filter((f) => EXT.test(f)).sort();
const manifest = {};
const keep = new Set();

await Promise.all(
  files.map(async (file) => {
    const name = file.replace(EXT, '');
    const input = await fs.readFile(path.join(SRC, file));
    const flatten = FLATTEN[name];
    const hash = crypto
      .createHash('sha1')
      .update(input)
      .update(flatten || '')
      .digest('hex')
      .slice(0, 8);
    let img = sharp(input, { failOn: 'none' }).rotate();
    const meta = await img.metadata();
    const srcW = meta.autoOrient?.width ?? meta.width;
    const srcH = meta.autoOrient?.height ?? meta.height;
    if (flatten) img = img.flatten({ background: flatten });
    const alpha = meta.hasAlpha && !flatten;

    // standard widths below the source, plus the source itself (full resolution for
    // high-density phone and iPad screens) unless it's past the largest standard width
    const widths = WIDTHS.filter((w) => w < srcW);
    if (srcW <= WIDTHS.at(-1)) widths.push(srcW);

    const variants = [];
    for (const w of widths) {
      const out = `${name}-${hash}-${w}.webp`;
      keep.add(out);
      const dest = path.join(OUT, out);
      try {
        await fs.access(dest);
      } catch {
        await img
          .clone()
          .resize({ width: w, withoutEnlargement: true })
          .webp({ quality: alpha ? 90 : flatten ? 70 : 82, alphaQuality: 90, effort: 5, smartSubsample: true })
          .toFile(dest);
      }
      variants.push({ w, src: `/img/${out}` });
    }

    // Tiny blurred preview shown while the real image loads
    const lqip = alpha
      ? null
      : 'data:image/webp;base64,' + (await img.clone().resize(24).blur(1.2).webp({ quality: 40 }).toBuffer()).toString('base64');

    manifest[name] = { width: srcW, height: srcH, alpha, variants, lqip };
  }),
);

// Social share image
const og = 'farmhouse-front';
if (manifest[og]) {
  const src = files.find((f) => f.replace(EXT, '') === og);
  await sharp(path.join(SRC, src))
    .resize(1200, 630, { fit: 'cover' })
    .jpeg({ quality: 82 })
    .toFile(path.join(ROOT, 'public', 'og.jpg'));
}

// Remove stale variants from earlier builds
for (const f of await fs.readdir(OUT)) if (!keep.has(f)) await fs.rm(path.join(OUT, f));

await fs.writeFile(MANIFEST, JSON.stringify(manifest, null, 2));
console.log(`images: ${files.length} sources → ${keep.size} variants`);
