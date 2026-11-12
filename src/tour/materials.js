// ILIKA tour: procedural materials. No image downloads: every surface is generated at start-up
// as a colour map plus a normal map (surface relief), so plaster, stone, timber and cloth catch
// the light the way the real materials do.
import * as THREE from 'three';

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- scalar fields: seamless value-noise, summed over octaves, in [0, 1] ----
function fbm(size, r, octaves, px, py = px, gain = 0.5) {
  const out = new Float32Array(size * size);
  let amp = 1;
  let sum = 0;
  for (let o = 0; o < octaves; o++) {
    const cx = px << o;
    const cy = py << o;
    const lat = new Float32Array(cx * cy);
    for (let i = 0; i < lat.length; i++) lat[i] = r();
    for (let y = 0; y < size; y++) {
      const fy = (y / size) * cy;
      const y0 = Math.floor(fy);
      const ty = fy - y0;
      const sy = ty * ty * (3 - 2 * ty);
      const ya = (y0 % cy) * cx;
      const yb = ((y0 + 1) % cy) * cx;
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * cx;
        const x0 = Math.floor(fx);
        const tx = fx - x0;
        const sx = tx * tx * (3 - 2 * tx);
        const xa = x0 % cx;
        const xb = (x0 + 1) % cx;
        const a = lat[ya + xa] + (lat[ya + xb] - lat[ya + xa]) * sx;
        const b = lat[yb + xa] + (lat[yb + xb] - lat[yb + xa]) * sx;
        out[y * size + x] += (a + (b - a) * sy) * amp;
      }
    }
    sum += amp;
    amp *= gain;
  }
  for (let i = 0; i < out.length; i++) out[i] /= sum;
  return out;
}

const hexToLin = (h) => new THREE.Color(h);
const srgb = (c) => {
  const o = new THREE.Color().copy(c).convertLinearToSRGB();
  return [o.r * 255, o.g * 255, o.b * 255];
};

// colour canvas from a per-pixel function returning a brightness multiplier (and optional tint)
function colourCanvas(size, base, fn) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const im = g.createImageData(size, size);
  const d = im.data;
  const col = new THREE.Color(base); // sRGB hex read as-is: work in display space for predictable tones
  const R = col.r * 255;
  const G = col.g * 255;
  const B = col.b * 255;
  const t = [1, 1, 1];
  for (let i = 0, p = 0; i < size * size; i++, p += 4) {
    const k = fn(i, t);
    d[p] = R * k * t[0];
    d[p + 1] = G * k * t[1];
    d[p + 2] = B * k * t[2];
    d[p + 3] = 255;
    t[0] = t[1] = t[2] = 1;
  }
  g.putImageData(im, 0, 0);
  return c;
}

// tangent-space normal map from a height field (wraps at the edges)
function normalCanvas(size, h, strength) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const im = g.createImageData(size, size);
  const d = im.data;
  const s = strength * size * 0.01;
  for (let y = 0; y < size; y++) {
    const yu = ((y + size - 1) % size) * size;
    const yd = ((y + 1) % size) * size;
    for (let x = 0; x < size; x++) {
      const xl = (x + size - 1) % size;
      const xr = (x + 1) % size;
      const dx = (h[y * size + xr] - h[y * size + xl]) * s;
      const dy = (h[yu + x] - h[yd + x]) * s; // canvas rows run down, v runs up
      const il = 1 / Math.hypot(dx, dy, 1);
      const p = (y * size + x) * 4;
      d[p] = (-dx * il * 0.5 + 0.5) * 255;
      d[p + 1] = (-dy * il * 0.5 + 0.5) * 255;
      d[p + 2] = (il * 0.5 + 0.5) * 255;
      d[p + 3] = 255;
    }
  }
  g.putImageData(im, 0, 0);
  return c;
}

function paint(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  return c;
}

export function makeMaterials({ aniso = 4, lite = false } = {}) {
  const r = rng(26);
  const S = lite ? 512 : 1024;
  const M = {};
  const tex = (canvas, tile, colour = true) => {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (colour) t.colorSpace = THREE.SRGBColorSpace;
    t.repeat.set(1 / tile, 1 / tile); // geometry UVs are in metres
    t.anisotropy = aniso;
    return t;
  };
  // the sky lights every room unoccluded, so keep its mirror image faint on everything but metal and glass
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, envMapIntensity: o.metalness ? 1 : 0.5, ...o });

  // ---------- lime plaster: one relief shared by every colour ----------
  const pFine = fbm(S, r, 5, 24, 24, 0.6); // grain
  const pSoft = fbm(S, r, 3, 3); // slow undulation of a hand-trowelled wall
  const pMid = fbm(S, r, 3, 9);
  const pH = new Float32Array(S * S);
  for (let i = 0; i < pH.length; i++) pH[i] = pSoft[i] * 0.55 + pMid[i] * 0.25 + pFine[i] * 0.2;
  const plasterN = tex(normalCanvas(S, pH, 2.2), 2.6, false);
  const plaster = (base, tile, tone = 0.1, rough = 0.93) => {
    const map = tex(
      colourCanvas(S, base, (i) => 1 + (pSoft[i] - 0.5) * tone + (pMid[i] - 0.5) * tone * 0.6 + (pFine[i] - 0.5) * 0.07),
      tile,
    );
    const n = plasterN.clone();
    n.repeat.set(1 / tile, 1 / tile);
    n.needsUpdate = true;
    return std({ map, normalMap: n, normalScale: new THREE.Vector2(0.55, 0.55), roughness: rough });
  };
  M.terra = plaster('#e3a57e', 2.6, 0.12);
  M.clay = plaster('#d99a74', 2.6, 0.1);
  M.deep = plaster('#cb835c', 2.2, 0.12);
  M.ivory = plaster('#efe5d3', 2.8, 0.06);
  M.sand = plaster('#dcc7a6', 2.6, 0.1);
  M.coping = plaster('#dfab86', 2.0, 0.1, 0.85);
  M.pot = plaster('#bf6f4b', 1.0, 0.22, 0.8);
  M.potPale = plaster('#d9bb9a', 1.0, 0.18, 0.85);
  M.ceiling = plaster('#f3ebdc', 3.0, 0.03, 1);

  // ---------- stone: tiles with recessed joints, each tile its own tone, soft veining ----------
  const stone = (base, n, tile, { rough = 0.55, vein = 0.03, joint = 0.006, relief = 1.2, vary = 0.07 } = {}) => {
    const cloud = fbm(S, r, 4, 4);
    const fine = fbm(S, r, 4, 32, 32, 0.6);
    const tone = new Float32Array(n * n);
    for (let i = 0; i < tone.length; i++) tone[i] = 1 + (r() - 0.5) * vary * 2;
    const h = new Float32Array(S * S);
    const jw = Math.max(1.5, (joint * S) / tile / 2); // joint half-width in pixels
    const w = S / n;
    const edge = (i) => {
      const x = i % S;
      const y = (i / S) | 0;
      const dx = Math.min(x % w, w - (x % w));
      const dy = Math.min(y % w, w - (y % w));
      return Math.min(dx, dy);
    };
    const map = colourCanvas(S, base, (i, t) => {
      const x = i % S;
      const y = (i / S) | 0;
      const e = edge(i);
      const j = e < jw ? 0 : Math.min(1, (e - jw) / 2.5); // 0 in the joint, 1 on the face
      const veins = Math.pow(Math.abs(Math.sin((cloud[i] * 5 + fine[i] * 0.25) * Math.PI)), 24) * vein;
      h[i] = j * 0.8 + fine[i] * 0.2 * j;
      t[2] = 1 - (cloud[i] - 0.5) * 0.06;
      return (tone[((y / w) | 0) * n + ((x / w) | 0)] + (cloud[i] - 0.5) * 0.1 + (fine[i] - 0.5) * 0.06 - veins) * (0.72 + 0.28 * j);
    });
    return std({ map: tex(map, tile), normalMap: tex(normalCanvas(S, h, relief), tile, false), roughness: rough });
  };
  M.stone = stone('#dccdb3', 3, 1.8, { rough: 0.5 });
  M.deck = stone('#cdb794', 2, 1.6, { rough: 0.86, vein: 0.03, relief: 1.8, vary: 0.05 });
  M.bathStone = stone('#cbbaa0', 4, 1.2, { rough: 0.48, vein: 0.05 });
  M.pool = stone('#d9c0a6', 8, 1.2, { rough: 0.4, vein: 0, vary: 0.09, joint: 0.004 });

  // ---------- timber: grain is noise stretched along the board ----------
  const timber = (base, tile, { planks = 0, rough = 0.62, contrast = 0.13 } = {}) => {
    const grain = fbm(S, r, 5, 2, 48, 0.62);
    const wide = fbm(S, r, 3, 1, 6);
    const h = new Float32Array(S * S);
    const pw = planks ? S / planks : 0;
    const shift = Array.from({ length: planks || 1 }, () => 1 + (r() - 0.5) * 0.16);
    const map = colourCanvas(S, base, (i, t) => {
      const y = (i / S) | 0;
      const ring = Math.sin((wide[i] * 14 + grain[i] * 2) * Math.PI) * 0.5 + 0.5;
      let k = 1 + (grain[i] - 0.5) * contrast + (ring - 0.5) * contrast * 0.35;
      let gap = 1;
      if (planks) {
        const e = Math.min(y % pw, pw - (y % pw));
        gap = e < 1.5 ? 0 : 1;
        k *= shift[(y / pw) | 0] * (0.55 + 0.45 * gap);
      }
      h[i] = (grain[i] * 0.6 + ring * 0.4) * gap;
      t[0] = 1 + (ring - 0.5) * 0.05;
      return k;
    });
    return std({ map: tex(map, tile), normalMap: tex(normalCanvas(S, h, 1.1), tile, false), roughness: rough });
  };
  M.timber = timber('#ba8e60', 1.3);
  M.timberDark = timber('#86623f', 1.3, { rough: 0.55 });
  M.timberPale = timber('#cfa97c', 1.2);
  M.planks = timber('#bd9468', 1.2, { planks: 8, rough: 0.8 });
  M.bark = timber('#6b5444', 0.9, { rough: 1, contrast: 0.7 });
  M.bark.normalScale.set(2.5, 2.5);

  // ---------- cloth and cane: an over-under weave ----------
  const weave = (base, tile, n, { contrast = 0.1, relief = 1.6, rough = 1, open = 0 } = {}) => {
    const W = 512;
    const slub = fbm(W, r, 3, 4, 64);
    const h = new Float32Array(W * W);
    const cw = W / n;
    const map = colourCanvas(W, base, (i) => {
      const x = i % W;
      const y = (i / W) | 0;
      const u = (x % cw) / cw;
      const v = (y % cw) / cw;
      const over = (((x / cw) | 0) + ((y / cw) | 0)) % 2;
      const a = Math.sin(u * Math.PI);
      const b = Math.sin(v * Math.PI);
      const hh = over ? a * (0.6 + 0.4 * b) : b * (0.6 + 0.4 * a);
      h[i] = hh;
      const hole = open && a < open && b < open ? 0.45 : 1;
      return (1 - contrast + contrast * 1.6 * hh + (slub[i] - 0.5) * 0.08) * hole;
    });
    return std({ map: tex(map, tile), normalMap: tex(normalCanvas(W, h, relief), tile, false), roughness: rough });
  };
  const soft = (m) => {
    m.userData.soft = true;
    return m;
  };
  M.linen = soft(weave('#efe8da', 0.16, 64));
  M.linenWarm = soft(weave('#d8b999', 0.16, 64));
  M.linenClay = soft(weave('#b56a4c', 0.16, 64));
  M.linenOlive = soft(weave('#8c8b5e', 0.16, 64));
  M.cane = weave('#cfae7c', 0.1, 10, { contrast: 0.3, relief: 3, rough: 0.7, open: 0.22 });
  M.rug = weave('#d9c8a9', 0.3, 40, { contrast: 0.22, relief: 2.4 });
  M.rugClay = weave('#c59274', 0.3, 40, { contrast: 0.22, relief: 2.4 });
  const sheerT = weave('#fbf6ea', 0.08, 48, { contrast: 0.12 });
  M.sheer = new THREE.MeshStandardMaterial({
    map: sheerT.map,
    roughness: 1,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  M.sheer.userData.noCast = M.sheer.userData.noAO = true;

  // ---------- brick paving ----------
  {
    const fine = fbm(S, r, 4, 24, 24, 0.6);
    const cloud = fbm(S, r, 3, 4);
    const cols = 4;
    const rows = 12;
    const bw = S / cols;
    const bh = S / rows;
    const tone = Array.from({ length: (cols + 1) * rows }, () => 1 + (r() - 0.5) * 0.22);
    const h = new Float32Array(S * S);
    const map = colourCanvas(S, '#c48364', (i, t) => {
      const x = i % S;
      const y = (i / S) | 0;
      const row = (y / bh) | 0;
      const xs = (x + (row % 2 ? bw / 2 : 0)) % S;
      const e = Math.min(xs % bw, bw - (xs % bw), y % bh, bh - (y % bh));
      const j = e < 2 ? 0 : Math.min(1, (e - 2) / 2);
      h[i] = j * 0.75 + fine[i] * 0.25;
      t[1] = 1 - (cloud[i] - 0.5) * 0.08;
      return (tone[row * (cols + 1) + ((xs / bw) | 0)] + (fine[i] - 0.5) * 0.14) * (0.62 + 0.38 * j);
    });
    M.brick = std({ map: tex(map, 0.92), normalMap: tex(normalCanvas(S, h, 2.2), 0.92, false), roughness: 0.92 });
  }
  M.jaaliBrick = std({ color: '#cf8660', roughness: 0.92, normalMap: plasterN, normalScale: new THREE.Vector2(0.8, 0.8) });
  M.jaali = std({ color: '#cd8058', roughness: 0.9 });

  // ---------- lawn ----------
  {
    const a = fbm(S, r, 4, 6);
    const b = fbm(S, r, 5, 64, 64, 0.7);
    const c = fbm(S, r, 3, 20);
    const map = colourCanvas(S, '#7f9c4e', (i, t) => {
      t[0] = 1 + (c[i] - 0.5) * 0.35;
      t[2] = 1 - (c[i] - 0.5) * 0.3;
      return 0.9 + (a[i] - 0.5) * 0.22 + (b[i] - 0.5) * 0.26;
    });
    M.grass = std({ map: tex(map, 3.2), normalMap: tex(normalCanvas(S, b, 1.4), 3.2, false), roughness: 1, envMapIntensity: 0.3 });
  }
  M.soil = std({ color: '#4a3324', roughness: 1, normalMap: plasterN, normalScale: new THREE.Vector2(2, 2) });
  M.mud = std({ color: '#8a5a40', roughness: 0.3 });

  M.glass = new THREE.MeshPhysicalMaterial({
    color: '#e6efe9',
    roughness: 0.03,
    metalness: 0,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    envMapIntensity: 1.6,
    specularIntensity: 1,
  });
  M.glass.userData.noCast = M.glass.userData.noAO = true;
  M.brass = std({ color: '#b98f55', roughness: 0.3, metalness: 1 });
  M.ceramic = std({ color: '#f2ede2', roughness: 0.18, envMapIntensity: 0.8 });
  M.steel = std({ color: '#3a302a', roughness: 0.4, metalness: 0.7 });
  M.shadow = new THREE.MeshBasicMaterial({
    transparent: true,
    depthWrite: false,
    opacity: 0.42,
    map: (() => {
      const t = new THREE.CanvasTexture(
        paint(128, 128, (g, s) => {
          const gr = g.createRadialGradient(s / 2, s / 2, s * 0.12, s / 2, s / 2, s / 2);
          gr.addColorStop(0, 'rgba(40,22,14,0.85)');
          gr.addColorStop(1, 'rgba(40,22,14,0)');
          g.fillStyle = gr;
          g.fillRect(0, 0, s, s);
        }),
      );
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })(),
  });
  M.shadow.userData.noCast = M.shadow.userData.noAO = true;

  // lamps: emissive, brightened at dusk by setDusk()
  M.lamp = new THREE.MeshStandardMaterial({ color: '#f3dfb8', emissive: '#ffb86a', emissiveIntensity: 0.25, roughness: 0.8 });
  M.lamp.userData.noCast = true;
  M.led = new THREE.MeshStandardMaterial({ color: '#ffd9a0', emissive: '#ff9f45', emissiveIntensity: 0.4 });
  M.led.userData.noCast = true;
  M.art = plaster('#a85c3e', 1.2, 0.3, 1);

  // ---------- foliage: painted leaves on alpha-cut cards, swayed in the vertex shader ----------
  M.wind = { value: 0 };
  const sway = (m, amp) => {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uWind = M.wind;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;').replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vec3 wp = (instanceMatrix * vec4(position, 1.0)).xyz;
          #else
            vec3 wp = position;
          #endif
          float sw = sin(uWind * 1.1 + wp.x * 0.7 + wp.z * 0.5) + 0.5 * sin(uWind * 2.3 + wp.z * 1.3);
          transformed.x += sw * ${amp.toFixed(4)} * max(position.y, 0.0);
          transformed.z += sw * ${(amp * 0.6).toFixed(4)} * max(position.y, 0.0);`,
      );
    };
    return m;
  };
  const green = (g, x0, y0, x1, y1, a, b) => {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, a);
    gr.addColorStop(1, b);
    return gr;
  };
  // one leaf, pointing along +x from (x, y), length l, width w
  const leaf = (g, x, y, ang, l, w, c0, c1, rib = 'rgba(210,225,150,0.5)') => {
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    g.fillStyle = green(g, 0, 0, l, 0, c0, c1);
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(l * 0.3, -w, l * 0.75, -w * 0.8, l, 0);
    g.bezierCurveTo(l * 0.75, w * 0.8, l * 0.3, w, 0, 0);
    g.fill();
    g.strokeStyle = rib;
    g.lineWidth = Math.max(1, w * 0.07);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(l * 0.96, 0);
    g.stroke();
    // shade the lower half so the leaf reads as folded
    g.fillStyle = 'rgba(20,40,10,0.22)';
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(l * 0.3, w, l * 0.75, w * 0.8, l, 0);
    g.closePath();
    g.fill();
    g.restore();
  };
  const tones = ['#2f4a1c', '#3d5f24', '#4d7430', '#5e8638', '#74993f', '#8aa94c'];
  const pick = () => tones[(r() * tones.length) | 0];
  const leafMat = (canvas, amp, rough = 0.62) => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = aniso;
    const m = sway(
      new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.45, side: THREE.DoubleSide, roughness: rough, envMapIntensity: 0.45 }),
      amp,
    );
    m.userData.noAO = true;
    // shadows must follow the leaf outline, not the card
    m.userData.depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: t, alphaTest: 0.45 });
    return m;
  };
  const F = lite ? 256 : 512;
  // a spray of broad leaves, for tree canopies and shrubs
  M.leafSpray = leafMat(
    paint(F, F, (g, s) => {
      for (let i = 0; i < 46; i++) {
        const a = r() * Math.PI * 2;
        const d = r() * s * 0.3;
        leaf(
          g,
          s / 2 + Math.cos(a) * d,
          s / 2 + Math.sin(a) * d,
          a + (r() - 0.5) * 1.2,
          s * (0.13 + r() * 0.1),
          s * (0.035 + r() * 0.025),
          pick(),
          pick(),
        );
      }
    }),
    0.004,
    0.7,
  );
  // palm frond: leaflets either side of a rib, along +x
  M.frond = leafMat(
    paint(F * 2, F / 2, (g, w, h) => {
      g.strokeStyle = '#6f7d3c';
      g.lineWidth = h * 0.035;
      g.beginPath();
      g.moveTo(0, h / 2);
      g.lineTo(w, h / 2);
      g.stroke();
      const n = 54;
      for (let i = 0; i < n; i++) {
        const k = i / n;
        const x = w * (0.03 + k * 0.95);
        const l = h * 0.5 * Math.sin(Math.PI * Math.min(1, k * 1.05 + 0.1)) * (0.8 + r() * 0.3) + h * 0.05;
        for (const sgn of [-1, 1]) leaf(g, x, h / 2, sgn * (1.05 + r() * 0.25 - k * 0.45), l, h * 0.022, pick(), pick(), 'rgba(0,0,0,0)');
      }
    }),
    0.01,
    0.55,
  );
  // long blade (agave, grasses): pointing along +x
  M.blade = leafMat(
    paint(F, F / 4, (g, w, h) => {
      g.fillStyle = green(g, 0, 0, w, 0, '#3d5a26', '#a9b75a');
      g.beginPath();
      g.moveTo(0, h * 0.34);
      g.bezierCurveTo(w * 0.3, 0, w * 0.7, h * 0.2, w, h * 0.5);
      g.bezierCurveTo(w * 0.7, h * 0.8, w * 0.3, h, 0, h * 0.66);
      g.fill();
      g.fillStyle = 'rgba(225,225,150,0.35)';
      g.fillRect(0, h * 0.47, w * 0.95, h * 0.06);
      g.fillStyle = 'rgba(20,40,10,0.2)';
      g.beginPath();
      g.moveTo(0, h * 0.5);
      g.lineTo(w, h * 0.5);
      g.bezierCurveTo(w * 0.7, h * 0.8, w * 0.3, h, 0, h * 0.66);
      g.fill();
    }),
    0.012,
    0.5,
  );
  // broad tropical leaf (banana, bird of paradise): veins off a midrib
  M.broad = leafMat(
    paint(F, F / 2, (g, w, h) => {
      leaf(g, w * 0.04, h / 2, 0, w * 0.94, h * 0.5, '#365a22', '#7fa245', 'rgba(215,230,160,0.8)');
      g.strokeStyle = 'rgba(20,45,12,0.28)';
      g.lineWidth = 1.2;
      for (let i = 1; i < 30; i++) {
        const x = w * (0.06 + (i / 30) * 0.86);
        g.beginPath();
        g.moveTo(x, h / 2);
        g.lineTo(x + w * 0.05, h * 0.06);
        g.moveTo(x, h / 2);
        g.lineTo(x + w * 0.05, h * 0.94);
        g.stroke();
      }
      g.globalCompositeOperation = 'destination-in';
      leaf(g, w * 0.04, h / 2, 0, w * 0.94, h * 0.5, '#000', '#000', '#000');
    }),
    0.012,
    0.45,
  );
  // trailing creeper: small leaves down a stem, hanging along -y
  M.vine = leafMat(
    paint(F / 2, F, (g, w, h) => {
      for (const sx of [0.3, 0.55, 0.75]) {
        const len = h * (0.55 + r() * 0.42);
        g.strokeStyle = '#4d5f2a';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(w * sx, 0);
        g.bezierCurveTo(w * (sx + 0.08), len * 0.4, w * (sx - 0.08), len * 0.7, w * sx, len);
        g.stroke();
        for (let y = 6; y < len; y += h * 0.035) {
          const x = w * sx + Math.sin((y / len) * 4) * w * 0.05;
          leaf(g, x, y, (r() > 0.5 ? 0.5 : Math.PI - 0.5) + (r() - 0.5) * 0.8, w * (0.1 + r() * 0.07), w * 0.045, pick(), pick());
        }
      }
    }),
    0.02,
  );

  M.setDusk = (k) => {
    M.lamp.emissiveIntensity = 0.25 + k * 2.4;
    M.led.emissiveIntensity = 0.4 + k * 3.2;
  };
  return M;
}

// ---- sky dome and water ----
export function makeSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color() },
      uMid: { value: new THREE.Color() },
      uLow: { value: new THREE.Color() },
      uSun: { value: new THREE.Vector3(0, 1, 0) },
      uSunCol: { value: new THREE.Color() },
    },
    vertexShader:
      'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      varying vec3 vDir; uniform vec3 uTop, uMid, uLow, uSun, uSunCol;
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.2, 1.0);
        vec3 c = mix(uLow, uMid, smoothstep(-0.02, 0.22, h));
        c = mix(c, uTop, smoothstep(0.15, 0.85, h));
        float s = max(dot(d, normalize(uSun)), 0.0);
        c += uSunCol * (pow(s, 6.0) * 0.35 + pow(s, 90.0) * 0.9 + pow(s, 1400.0) * 6.0);
        // thin high cloud
        float cl = sin(d.x * 9.0 + d.z * 4.0) * sin(d.z * 13.0 - d.x * 3.0) * 0.5 + 0.5;
        c = mix(c, c + vec3(0.10, 0.08, 0.06), smoothstep(0.62, 0.95, cl) * smoothstep(0.1, 0.5, h) * 0.6);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), mat);
  mesh.frustumCulled = false;
  return mesh;
}

export function makeWater(w, d) {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
      uSun: { value: new THREE.Vector3(0, 1, 0) },
      uSunCol: { value: new THREE.Color('#ffd9a8') },
      uSky: { value: new THREE.Color('#9dc0d8') },
      uDeep: { value: new THREE.Color('#2f8f93') },
      uShallow: { value: new THREE.Color('#7fd0c8') },
      uHalf: { value: new THREE.Vector2(w / 2, d / 2) },
    },
    vertexShader: `varying vec3 vW; varying vec2 vP;
      void main(){ vP = position.xy; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      varying vec3 vW; varying vec2 vP;
      uniform float uTime; uniform vec3 uSun, uSunCol, uSky, uDeep, uShallow; uniform vec2 uHalf;
      float wave(vec2 p){
        return sin(p.x * 3.1 + uTime * 0.9) * 0.5 + sin(p.y * 4.3 - uTime * 0.7) * 0.4
             + sin((p.x + p.y) * 6.7 + uTime * 1.3) * 0.22 + sin((p.x - p.y) * 11.0 - uTime * 1.6) * 0.1;
      }
      void main(){
        vec2 p = vW.xz; float e = 0.04;
        vec3 n = normalize(vec3(wave(p - vec2(e, 0.0)) - wave(p + vec2(e, 0.0)), 5.5, wave(p - vec2(0.0, e)) - wave(p + vec2(0.0, e))));
        vec3 v = normalize(cameraPosition - vW);
        float fres = pow(1.0 - max(dot(n, v), 0.0), 4.0);
        // lighter near the walls, deeper in the middle
        vec2 q = abs(vP) / uHalf; float edge = smoothstep(0.55, 1.0, max(q.x, q.y));
        vec3 body = mix(uDeep, uShallow, edge * 0.7 + 0.15 + n.x * 0.5);
        vec3 r = reflect(-v, n);
        vec3 refl = uSky + uSunCol * pow(max(dot(r, normalize(uSun)), 0.0), 220.0) * 2.2;
        vec3 c = mix(body, refl, 0.08 + fres * 0.55);
        gl_FragColor = vec4(c, 0.86 + fres * 0.14);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}
