// Fetches the scanned materials, skies and models the 3D tour uses and packs them for the web.
//
//   node scripts/build-tour-assets.mjs            everything
//   node scripts/build-tour-assets.mjs tex sky    only those parts (tex, sky, models)
//
// Sources: Poly Haven (polyhaven.com) and ambientCG (ambientcg.com). Both publish under CC0, so
// nothing here needs a credit line or a licence fee. Downloads are cached in .cache/tour-assets;
// the packed results are committed under public/tour so the site builds without network access.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const cache = path.join(root, '.cache', 'tour-assets');
const out = path.join(root, 'public', 'tour');
const UA = 'ilika-tour-build';
const want = process.argv.slice(2);
const on = (k) => !want.length || want.includes(k);
fs.mkdirSync(cache, { recursive: true });

const curl = (url, file) => {
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return file;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  execFileSync('curl', ['-sS', '-L', '--fail', '-m', '600', '-A', UA, '-o', file, url], { stdio: 'inherit' });
  return file;
};
const json = (url, file) => JSON.parse(fs.readFileSync(curl(url, file), 'utf8'));
const kb = (f) => (fs.statSync(f).size / 1024).toFixed(0) + ' kB';

// ---------------------------------------------------------------- materials
// tile: metres one repeat of the texture covers. tint: stored as a neutral light-grey variation
// map, so the tour can colour it (one plaster scan serves every plaster colour).
// grid: cut the scan into n x n slabs with joints, for stone that comes as one continuous sheet.
const TEX = [
  { name: 'plaster', from: 'acg', id: 'Plaster001', tint: 0.9 },
  { name: 'travertine', from: 'acg', id: 'Travertine009', grid: 2 },
  { name: 'paving', from: 'acg', id: 'Tiles141' },
  { name: 'cane', from: 'acg', id: 'Wicker008A' },
  { name: 'grass', from: 'acg', id: 'Grass004' },
  { name: 'carpet', from: 'acg', id: 'Carpet016', tint: 0.88 },
  { name: 'linen', from: 'ph', id: 'rough_linen', tint: 0.9 },
  { name: 'oak', from: 'ph', id: 'oak_veneer_01' },
  { name: 'walnut', from: 'ph', id: 'fine_grained_wood' },
  { name: 'bamboo', from: 'ph', id: 'bamboo_veneer' },
  { name: 'planks', from: 'ph', id: 'hinoki_planks' },
  { name: 'brick', from: 'ph', id: 'red_brick_pavers' },
  { name: 'mulch', from: 'ph', id: 'yellow_flower_mulch' },
  { name: 'bark', from: 'ph', id: 'bark_brown_02' },
  { name: 'palmbark', from: 'ph', id: 'palm_tree_bark' },
];

function sources(t) {
  if (t.from === 'ph') {
    const f = json(`https://api.polyhaven.com/files/${t.id}`, path.join(cache, 'ph', t.id, 'files.json'));
    const get = (k) => curl(f[k]['1k'].jpg.url, path.join(cache, 'ph', t.id, `${k}.jpg`));
    return { color: get('Diffuse'), normal: get('nor_gl'), ao: get('AO'), rough: get('Rough') };
  }
  const dir = path.join(cache, 'acg', t.id);
  const pre = path.join(dir, `${t.id}_1K-JPG_`);
  if (!fs.existsSync(pre + 'Color.jpg')) {
    const zip = curl(`https://ambientcg.com/get?file=${t.id}_1K-JPG.zip`, path.join(cache, 'acg', `${t.id}.zip`));
    fs.mkdirSync(dir, { recursive: true });
    execFileSync('unzip', ['-q', '-o', zip, '-d', dir]);
  }
  const opt = (k) => (fs.existsSync(pre + k) ? pre + k : null);
  return { color: pre + 'Color.jpg', normal: pre + 'NormalGL.jpg', ao: opt('AmbientOcclusion.jpg'), rough: opt('Roughness.jpg') };
}

// n x n slabs: each slab shows a different piece of the scan, with a dark joint between them
async function slabs(file, n, size, { joint = [70, 58, 46], flat = false, value = null } = {}) {
  const cell = size / n;
  const src = sharp(file).resize(size, size);
  const meta = await src.clone().raw().toBuffer({ resolveWithObject: true });
  const ch = meta.info.channels;
  const parts = [];
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      // offset, and mirror alternate slabs, so neighbours never continue each other's veining
      const k = j * n + i;
      let piece = sharp(meta.data, { raw: { width: size, height: size, channels: ch } }).extract({
        left: (((i * 2 + 1) * cell * 0.37) % (size - cell)) | 0,
        top: (((j * 2 + 1) * cell * 0.61) % (size - cell)) | 0,
        width: cell,
        height: cell,
      });
      if (!flat && k % 2) piece = piece.flop();
      if (!flat && k % 3 === 1) piece = piece.flip();
      parts.push({ input: await piece.png().toBuffer(), left: i * cell, top: j * cell });
    }
  const w = Math.max(2, Math.round(size / 340));
  const c = value ?? joint;
  let lines = '';
  for (let i = 0; i <= n; i++) {
    const p = Math.min(size - w / 2, Math.max(w / 2, i * cell));
    lines += `<rect x="${p - w / 2}" y="0" width="${w}" height="${size}"/><rect x="0" y="${p - w / 2}" width="${size}" height="${w}"/>`;
  }
  const svg = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><g fill="rgb(${c.join(',')})">${lines}</g></svg>`,
  );
  return sharp({ create: { width: size, height: size, channels: 3, background: '#000' } })
    .composite([...parts, { input: svg }])
    .png()
    .toBuffer();
}

async function buildTextures() {
  for (const size of [1024, 512]) {
    const dir = path.join(out, 'tex', String(size));
    fs.mkdirSync(dir, { recursive: true });
    for (const t of TEX) {
      const s = sources(t);
      // colour
      let col = t.grid ? sharp(await slabs(s.color, t.grid, size)) : sharp(s.color).resize(size, size);
      if (t.tint) {
        const g = col.clone().greyscale();
        const { channels } = await g.clone().stats();
        col = g.linear(Math.min(2.2, (t.tint * 255) / channels[0].mean), 0).toColourspace('srgb');
      }
      await col.webp({ quality: 84 }).toFile(path.join(dir, `${t.name}_c.webp`));
      // normal
      const nor = t.grid ? sharp(await slabs(s.normal, t.grid, size, { value: [128, 128, 255] })) : sharp(s.normal).resize(size, size);
      await nor.webp({ quality: 80 }).toFile(path.join(dir, `${t.name}_n.webp`));
      // occlusion in red, roughness in green: one file, the way three.js reads them
      const grey = async (f, fallback, jointValue) => {
        if (!f)
          return sharp({ create: { width: size, height: size, channels: 3, background: { r: fallback, g: fallback, b: fallback } } })
            .greyscale()
            .raw()
            .toBuffer();
        const img = t.grid
          ? sharp(await slabs(f, t.grid, size, { value: [jointValue, jointValue, jointValue] }))
          : sharp(f).resize(size, size);
        return img.greyscale().raw().toBuffer();
      };
      const ao = await grey(s.ao, 255, 90);
      const ro = await grey(s.rough, 200, 235);
      const px = Buffer.alloc(size * size * 3);
      for (let i = 0; i < size * size; i++) {
        px[i * 3] = ao[i];
        px[i * 3 + 1] = ro[i];
      }
      await sharp(px, { raw: { width: size, height: size, channels: 3 } })
        .webp({ quality: 72 })
        .toFile(path.join(dir, `${t.name}_arm.webp`));
    }
    const total = fs.readdirSync(dir).reduce((a, f) => a + fs.statSync(path.join(dir, f)).size, 0);
    console.log(`textures ${size}px: ${fs.readdirSync(dir).length} files, ${(total / 1e6).toFixed(2)} MB`);
  }
}

// ---------------------------------------------------------------- skies
// Radiance .hdr reader (run-length and flat)
function readHDR(file) {
  const b = fs.readFileSync(file);
  let p = 0;
  let line = '';
  for (;;) {
    const e = b.indexOf(10, p);
    line = b.toString('latin1', p, e);
    p = e + 1;
    if (/^-Y \d+ \+X \d+/.test(line)) break;
  }
  const m = line.match(/-Y (\d+) \+X (\d+)/);
  const h = +m[1];
  const w = +m[2];
  const data = new Float32Array(w * h * 3);
  const scan = new Uint8Array(w * 4);
  for (let y = 0; y < h; y++) {
    if (b[p] === 2 && b[p + 1] === 2 && ((b[p + 2] << 8) | b[p + 3]) === w) {
      p += 4;
      for (let c = 0; c < 4; c++) {
        let x = 0;
        while (x < w) {
          let n = b[p++];
          if (n > 128) {
            n -= 128;
            const v = b[p++];
            while (n--) scan[x++ * 4 + c] = v;
          } else while (n--) scan[x++ * 4 + c] = b[p++];
        }
      }
    } else for (let i = 0; i < w * 4; i++) scan[i] = b[p++];
    for (let x = 0; x < w; x++) {
      const e = scan[x * 4 + 3];
      const f = e ? Math.pow(2, e - 136) : 0;
      const o = (y * w + x) * 3;
      data[o] = scan[x * 4] * f;
      data[o + 1] = scan[x * 4 + 1] * f;
      data[o + 2] = scan[x * 4 + 2] * f;
    }
  }
  return { w, h, data };
}
function writeHDR(file, w, h, data) {
  const head = Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${h} +X ${w}\n`, 'latin1');
  const px = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 3];
    const g = data[i * 3 + 1];
    const b = data[i * 3 + 2];
    const v = Math.max(r, g, b);
    if (v < 1e-32) continue;
    let e = Math.ceil(Math.log2(v));
    let s = 256 / Math.pow(2, e);
    if (v * s >= 256) {
      e++;
      s /= 2;
    }
    px[i * 4] = r * s;
    px[i * 4 + 1] = g * s;
    px[i * 4 + 2] = b * s;
    px[i * 4 + 3] = e + 128;
  }
  if (px[0] === 2 && px[1] === 2) px[0] = 3; // never look like a run-length scanline
  fs.writeFileSync(file, Buffer.concat([head, px]));
}

const SKIES = [
  // wb: white balance, as a camera set for warm evening light would record it
  { name: 'day', id: 'qwantani_late_afternoon_puresky', gain: 0.6, wb: [1.14, 1.0, 0.8], ground: [0.62, 0.5, 0.36] },
  { name: 'dusk', id: 'belfast_sunset_puresky', gain: 0.32, wb: [1.08, 1.0, 0.92], ground: [0.3, 0.22, 0.17] },
];
// rows of the panorama kept for the visible sky: zenith down to this many degrees below the horizon
const SKY_BELOW = 6;

async function buildSkies() {
  const dir = path.join(out, 'sky');
  fs.mkdirSync(dir, { recursive: true });
  const info = {};
  for (const s of SKIES) {
    const base = `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr`;
    // lighting: a small panorama is all image-based lighting needs
    const small = readHDR(curl(`${base}/1k/${s.id}_1k.hdr`, path.join(cache, 'hdri', `${s.id}_1k.hdr`)));
    const lum = (d, i) => d[i * 3] * 0.2126 + d[i * 3 + 1] * 0.7152 + d[i * 3 + 2] * 0.0722;
    let peak = 0;
    for (let i = 0; i < small.w * small.h; i++) peak = Math.max(peak, lum(small.data, i));
    let sx = 0;
    let sy = 0;
    let sw = 0;
    for (let i = 0; i < small.w * small.h; i++) {
      const l = lum(small.data, i);
      if (l > peak * 0.5) {
        sx += (i % small.w) * l;
        sy += Math.floor(i / small.w) * l;
        sw += l;
      }
    }
    const W = 512;
    const H = 256;
    const f = small.w / W;
    const env = new Float32Array(W * H * 3);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        for (let c = 0; c < 3; c++) {
          let a = 0;
          // the sun itself is lit by a lamp in the scene: cap it here so it is not counted twice
          for (let j = 0; j < f; j++)
            for (let i = 0; i < f; i++) a += Math.min(small.data[((y * f + j) * small.w + x * f + i) * 3 + c], 40);
          env[(y * W + x) * 3 + c] = (a / (f * f)) * s.wb[c];
        }
    // Below the horizon the photo shows empty ground. Replace it with what is really there: sunlit
    // lawn and paving, which is the warm light that bounces up onto ceilings and soffits.
    for (let y = H / 2; y < H; y++) {
      const k = Math.min(1, (y - H / 2) / (H * 0.06));
      for (let x = 0; x < W; x++)
        for (let c = 0; c < 3; c++) {
          const o = (y * W + x) * 3 + c;
          env[o] = env[o] * (1 - k) + s.ground[c] * k;
        }
    }
    writeHDR(path.join(dir, `${s.name}.hdr`), W, H, env);
    // the sky you look at: sharper, top part only, stored display-encoded at a known gain
    const big = readHDR(curl(`${base}/4k/${s.id}_4k.hdr`, path.join(cache, 'hdri', `${s.id}_4k.hdr`)));
    const rows = Math.round((big.h * (90 + SKY_BELOW)) / 180);
    const px = Buffer.alloc(big.w * rows * 3);
    // the visible sky takes half the correction, so it stays blue
    for (let i = 0; i < big.w * rows * 3; i++)
      px[i] = Math.min(255, Math.round(Math.pow(Math.min(1, big.data[i] * s.gain * Math.sqrt(s.wb[i % 3])), 1 / 2.2) * 255));
    await sharp(px, { raw: { width: big.w, height: rows, channels: 3 } })
      .webp({ quality: 88 })
      .toFile(path.join(dir, `${s.name}.webp`));
    info[s.name] = {
      sunU: +(sx / sw / small.w).toFixed(4), // where the sun sits across the panorama (0..1)
      sunElevation: +((0.5 - sy / sw / small.h) * 180).toFixed(1),
      gain: s.gain,
      below: SKY_BELOW,
    };
    console.log(`sky ${s.name}: env ${kb(path.join(dir, s.name + '.hdr'))}, view ${kb(path.join(dir, s.name + '.webp'))}`, info[s.name]);
  }
  fs.writeFileSync(path.join(dir, 'sky.json'), JSON.stringify(info, null, 2) + '\n');
}

if (on('tex')) await buildTextures();
if (on('sky')) await buildSkies();
if (on('models')) {
  const { buildModels } = await import('./tour-models.mjs');
  await buildModels({ cache, out, curl, json });
}
