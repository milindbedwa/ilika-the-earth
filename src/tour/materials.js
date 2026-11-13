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
    const map = colourCanvas(S, '#6f9040', (i, t) => {
      t[0] = 1 + (c[i] - 0.5) * 0.35;
      t[2] = 1 - (c[i] - 0.5) * 0.3;
      return 0.9 + (a[i] - 0.5) * 0.22 + (b[i] - 0.5) * 0.26;
    });
    M.grass = std({ map: tex(map, 3.2), normalMap: tex(normalCanvas(S, b, 1.4), 3.2, false), roughness: 1, envMapIntensity: 0.3 });
  }
  M.soil = std({ color: '#43352a', roughness: 1, normalMap: plasterN, normalScale: new THREE.Vector2(2, 2) });
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
  // A light breeze. Each plant leans and recovers on slow gusts that roll across the garden, and
  // every leaf trembles on its own. mode: 'up' plants rooted at y = 0, 'hang' creepers hanging
  // from y = 0, 'crown' palm fronds radiating from a centre.
  const sway = (m, { bend = 0.02, flutter = 0.01, mode = 'up' } = {}) => {
    const reach =
      mode === 'hang'
        ? 'max(-position.y, 0.0)'
        : mode === 'crown'
          ? 'length(position.xz) * 0.6 + max(position.y, 0.0)'
          : 'max(position.y, 0.0)';
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uWind = M.wind;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;').replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vec3 root = instanceMatrix[3].xyz;
          #else
            vec3 root = vec3(0.0);
          #endif
          float ph = root.x * 0.31 + root.z * 0.23;
          float gust = sin(uWind * 0.55 + ph) * 0.55 + sin(uWind * 1.27 + ph * 1.7 + 1.3) * 0.3 + sin(uWind * 2.9 + ph * 3.1) * 0.15;
          float reach = ${reach};
          float trem = sin(uWind * 4.7 + position.x * 7.0 + position.y * 5.0 + position.z * 6.0 + ph * 9.0);
          transformed.x += (gust + 0.25) * ${bend.toFixed(4)} * reach;
          transformed.z += gust * ${(bend * 0.5).toFixed(4)} * reach;
          ${mode === 'crown' ? `transformed.y += (gust * 0.6 + trem * 0.4) * ${(bend * 0.9).toFixed(4)} * length(position.xz);` : ''}
          transformed += objectNormal * trem * ${flutter.toFixed(4)} * min(reach, 1.5) * (0.4 + 0.6 * abs(gust));`,
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
  const leafPath = (g, l, w) => {
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(l * 0.3, -w, l * 0.75, -w * 0.8, l, 0);
    g.bezierCurveTo(l * 0.75, w * 0.8, l * 0.3, w, 0, 0);
  };
  const leaf = (g, x, y, ang, l, w, c0, c1, rib = 'rgba(210,225,150,0.5)', veins = 0) => {
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    g.fillStyle = green(g, 0, 0, l, 0, c0, c1);
    leafPath(g, l, w);
    g.fill();
    if (veins) {
      g.save();
      leafPath(g, l, w);
      g.clip();
      g.strokeStyle = 'rgba(205,222,150,0.32)';
      g.lineWidth = Math.max(0.6, w * 0.03);
      for (let i = 1; i < veins; i++) {
        const vx = (l * i) / veins;
        for (const sg of [-1, 1]) {
          g.beginPath();
          g.moveTo(vx, 0);
          g.quadraticCurveTo(vx + l * 0.08, sg * w * 0.5, vx + l * 0.16, sg * w);
          g.stroke();
        }
      }
      // a paler, sun-bleached margin
      g.strokeStyle = 'rgba(190,205,120,0.35)';
      g.lineWidth = w * 0.12;
      leafPath(g, l, w);
      g.stroke();
      g.restore();
    }
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
  // five-petalled blossom (frangipani / jasmine): white with a warm throat
  const blossom = (g, x, y, rad, petal = '#fbf6ea', throat = '#f2c45a') => {
    const a0 = r() * 6.28;
    for (let i = 0; i < 5; i++) {
      const a = a0 + (i * 6.283) / 5;
      g.save();
      g.translate(x, y);
      g.rotate(a);
      const gr = g.createLinearGradient(0, 0, rad, 0);
      gr.addColorStop(0, throat);
      gr.addColorStop(0.45, petal);
      gr.addColorStop(1, petal);
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(rad * 0.55, 0, rad * 0.5, rad * 0.3, 0, 0, 6.283);
      g.fill();
      g.restore();
    }
  };
  const tones = ['#2c4519', '#36551f', '#426a29', '#4f7a30', '#5f8a38', '#739a40', '#86a64a'];
  const pick = () => tones[(r() * tones.length) | 0];
  const leafMat = (canvas, wind, rough = 0.62) => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = aniso;
    const m = sway(
      new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.45, side: THREE.DoubleSide, roughness: rough, envMapIntensity: 0.45 }),
      wind,
    );
    m.userData.noAO = true;
    // shadows must follow the leaf outline, not the card
    m.userData.depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: t, alphaTest: 0.45 });
    return m;
  };
  const F = lite ? 512 : 1024;
  const spray = (flowers) =>
    paint(F, F, (g, s) => {
      // twigs first, then leaves from the back of the spray to the front
      g.strokeStyle = '#5b4a33';
      g.lineWidth = s * 0.006;
      for (let i = 0; i < 9; i++) {
        const a = r() * 6.283;
        g.beginPath();
        g.moveTo(s / 2, s / 2);
        g.quadraticCurveTo(
          s / 2 + Math.cos(a + 0.4) * s * 0.18,
          s / 2 + Math.sin(a + 0.4) * s * 0.18,
          s / 2 + Math.cos(a) * s * 0.36,
          s / 2 + Math.sin(a) * s * 0.36,
        );
        g.stroke();
      }
      for (let i = 0; i < 90; i++) {
        const a = r() * Math.PI * 2;
        const d = Math.sqrt(r()) * s * 0.34;
        leaf(
          g,
          s / 2 + Math.cos(a) * d,
          s / 2 + Math.sin(a) * d,
          a + (r() - 0.5) * 1.4,
          s * (0.085 + r() * 0.07),
          s * (0.026 + r() * 0.02),
          pick(),
          pick(),
          'rgba(210,225,150,0.45)',
          5,
        );
      }
      for (let i = 0; i < flowers; i++) {
        const a = r() * 6.283;
        const d = Math.sqrt(r()) * s * 0.36;
        blossom(g, s / 2 + Math.cos(a) * d, s / 2 + Math.sin(a) * d, s * (0.018 + r() * 0.012));
      }
    });
  // a spray of leaves on twigs, for tree canopies and shrubs
  M.leafSpray = leafMat(spray(0), { bend: 0.014, flutter: 0.03 }, 0.7);
  // the same in flower, for jasmine and frangipani
  M.bloom = leafMat(spray(34), { bend: 0.02, flutter: 0.02 }, 0.7);
  // palm frond: leaflets either side of a rib, along +x
  const frondArt = (g, w, h) => {
    g.strokeStyle = '#7b8742';
    g.lineWidth = h * 0.03;
    g.beginPath();
    g.moveTo(0, h / 2);
    g.lineTo(w, h / 2);
    g.stroke();
    const n = 86;
    for (let i = 0; i < n; i++) {
      const k = i / n;
      const x = w * (0.03 + k * 0.95);
      const l = h * 0.5 * Math.sin(Math.PI * Math.min(1, k * 1.05 + 0.1)) * (0.8 + r() * 0.3) + h * 0.05;
      for (const sgn of [-1, 1])
        leaf(g, x, h / 2, sgn * (1.05 + r() * 0.25 - k * 0.45), l, h * 0.017, pick(), pick(), 'rgba(200,215,140,0.35)');
    }
  };
  M.frond = leafMat(paint(F * 2, F / 2, frondArt), { bend: 0.035, flutter: 0.02, mode: 'crown' }, 0.55);
  // the same frond for ferns, which are rooted on the ground
  M.fernLeaf = leafMat(paint(F, F / 4, frondArt), { bend: 0.04, flutter: 0.015 }, 0.6);
  // long blade (agave, grasses): green heart, pale variegated margins, pointing along +x
  M.blade = leafMat(
    paint(F, F / 4, (g, w, h) => {
      const shape = (inset) => {
        g.beginPath();
        g.moveTo(0, h * (0.34 + inset));
        g.bezierCurveTo(w * 0.3, h * inset, w * 0.7, h * (0.2 + inset * 0.7), w * (1 - inset * 0.3), h * 0.5);
        g.bezierCurveTo(w * 0.7, h * (0.8 - inset * 0.7), w * 0.3, h * (1 - inset), 0, h * (0.66 - inset));
        g.closePath();
      };
      g.fillStyle = green(g, 0, 0, w, 0, '#8f9a48', '#d2cf74');
      shape(0);
      g.fill();
      g.fillStyle = green(g, 0, 0, w, 0, '#35521f', '#7d9a44');
      shape(0.13);
      g.fill();
      // fine lengthwise fibres
      g.save();
      shape(0);
      g.clip();
      g.strokeStyle = 'rgba(230,235,170,0.14)';
      g.lineWidth = 1;
      for (let i = 0; i < 16; i++) {
        const y = h * (0.1 + (i / 16) * 0.8);
        g.beginPath();
        g.moveTo(0, y);
        g.quadraticCurveTo(w * 0.5, h * 0.5 + (y - h * 0.5) * 0.8, w, h * 0.5);
        g.stroke();
      }
      g.fillStyle = 'rgba(20,40,10,0.22)';
      g.fillRect(0, h * 0.5, w, h * 0.5);
      g.restore();
    }),
    { bend: 0.03, flutter: 0.006 },
    0.5,
  );
  // thin grass blade for ornamental tufts
  M.reed = leafMat(
    paint(F / 2, F / 8, (g, w, h) => {
      g.fillStyle = green(g, 0, 0, w, 0, '#4a6a2a', '#b9c06a');
      g.beginPath();
      g.moveTo(0, h * 0.25);
      g.quadraticCurveTo(w * 0.6, h * 0.3, w, h * 0.5);
      g.quadraticCurveTo(w * 0.6, h * 0.7, 0, h * 0.75);
      g.fill();
      g.fillStyle = 'rgba(20,40,10,0.25)';
      g.fillRect(0, h * 0.5, w, h * 0.5);
    }),
    { bend: 0.09, flutter: 0.012 },
    0.5,
  );
  // broad tropical leaf on its stalk (banana, bird of paradise): veins off a midrib, a few wind tears
  M.broad = leafMat(
    paint(F, F / 2, (g, w, h) => {
      const x0 = w * 0.3; // the first third is bare stalk
      g.fillStyle = '#7d9247';
      g.fillRect(0, h * 0.485, x0 + 4, h * 0.03);
      leaf(g, x0, h / 2, 0, w * 0.69, h * 0.48, '#2b5a1d', '#6fa63a', 'rgba(215,230,160,0.85)');
      g.save();
      g.translate(x0, h / 2);
      leafPath(g, w * 0.69, h * 0.48);
      g.clip();
      g.strokeStyle = 'rgba(190,215,140,0.14)';
      g.lineWidth = 1.2;
      for (let i = 1; i < 44; i++) {
        const x = (w * 0.69 * i) / 44;
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x + w * 0.04, -h * 0.48);
        g.moveTo(x, 0);
        g.lineTo(x + w * 0.04, h * 0.48);
        g.stroke();
      }
      g.fillStyle = 'rgba(20,40,10,0.2)';
      g.fillRect(0, 0, w, h);
      // tears along the veins, as on any banana leaf that has seen wind
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 7; i++) {
        const x = w * 0.69 * (0.15 + r() * 0.75);
        const sg = r() > 0.5 ? 1 : -1;
        g.beginPath();
        g.moveTo(x, sg * h * 0.5);
        g.lineTo(x + w * 0.012, sg * h * 0.5);
        g.lineTo(x - w * 0.02, sg * h * (0.12 + r() * 0.2));
        g.fill();
      }
      g.restore();
    }),
    { bend: 0.035, flutter: 0.012 },
    0.42,
  );
  // heart-shaped leaf on a stalk (philodendron, elephant ear)
  M.heart = leafMat(
    paint(F / 2, F / 2, (g, w, h) => {
      g.fillStyle = '#6f8a40';
      g.fillRect(0, h * 0.49, w * 0.36, h * 0.022);
      g.save();
      g.translate(w * 0.3, h / 2);
      const hp = () => {
        g.beginPath();
        g.moveTo(w * 0.08, 0);
        g.bezierCurveTo(-w * 0.06, -h * 0.12, -w * 0.02, -h * 0.44, w * 0.26, -h * 0.4);
        g.bezierCurveTo(w * 0.5, -h * 0.34, w * 0.62, -h * 0.1, w * 0.68, 0);
        g.bezierCurveTo(w * 0.62, h * 0.1, w * 0.5, h * 0.34, w * 0.26, h * 0.4);
        g.bezierCurveTo(-w * 0.02, h * 0.44, -w * 0.06, h * 0.12, w * 0.08, 0);
      };
      g.fillStyle = green(g, 0, 0, w * 0.68, 0, '#2c4f1e', '#6c943c');
      hp();
      g.fill();
      hp();
      g.clip();
      g.strokeStyle = 'rgba(200,222,150,0.5)';
      g.lineWidth = 1.6;
      for (let i = 0; i < 7; i++) {
        const a = -1.25 + (i / 6) * 2.5;
        g.beginPath();
        g.moveTo(w * 0.08, 0);
        g.quadraticCurveTo(w * 0.3, Math.sin(a) * h * 0.2, w * 0.08 + Math.cos(a * 0.6) * w * 0.6, Math.sin(a) * h * 0.46);
        g.stroke();
      }
      g.fillStyle = 'rgba(20,40,10,0.2)';
      g.fillRect(-w, 0, w * 2, h);
      g.restore();
    }),
    { bend: 0.05, flutter: 0.02 },
    0.4,
  );
  // trailing creeper in flower: small leaves and white blossom down a stem, hanging along -y
  M.vine = leafMat(
    paint(F / 2, F, (g, w, h) => {
      for (const sx of [0.22, 0.4, 0.58, 0.78]) {
        const len = h * (0.5 + r() * 0.48);
        g.strokeStyle = '#4d5f2a';
        g.lineWidth = Math.max(1.5, w * 0.008);
        g.beginPath();
        g.moveTo(w * sx, 0);
        g.bezierCurveTo(w * (sx + 0.08), len * 0.4, w * (sx - 0.08), len * 0.7, w * sx, len);
        g.stroke();
        for (let y = 6; y < len; y += h * 0.022) {
          const x = w * sx + Math.sin((y / len) * 4) * w * 0.05;
          leaf(
            g,
            x,
            y,
            (r() > 0.5 ? 0.5 : Math.PI - 0.5) + (r() - 0.5) * 0.9,
            w * (0.09 + r() * 0.07),
            w * 0.04,
            pick(),
            pick(),
            'rgba(210,225,150,0.45)',
            4,
          );
          if (r() < 0.12) blossom(g, x + (r() - 0.5) * w * 0.1, y, w * 0.035);
        }
      }
    }),
    { bend: 0.07, flutter: 0.012, mode: 'hang' },
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

// Pool water. Nothing below the surface is drawn as geometry: the shader bends each view ray at the
// rippled surface, follows it to the tiled floor or wall, and paints what it would see there, with
// the moving net of light (caustics) the ripples throw on the floor, the colour the depth of water
// takes out, and the sky and sun mirrored on top.
export function makeWater(w, d, depth) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSun: { value: new THREE.Vector3(0, 1, 0) },
      uSunCol: { value: new THREE.Color('#ffd9a8') },
      uSky: { value: new THREE.Color('#6fa3d6') },
      uHorizon: { value: new THREE.Color('#e9dcc8') },
      uLight: { value: 1 },
      uHalf: { value: new THREE.Vector2(w / 2, d / 2) },
      uC: { value: new THREE.Vector2() },
      uDepth: { value: depth },
    },
    vertexShader: `varying vec3 vW;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      varying vec3 vW;
      uniform float uTime, uLight, uDepth; uniform vec3 uSun, uSunCol, uSky, uHorizon; uniform vec2 uHalf, uC;
      // slope of the surface: a few crossing swells and the finer chop from the inlets
      vec2 slope(vec2 p){
        float t = uTime;
        vec2 g = vec2(0.0);
        g += vec2(0.9, 0.4) * cos(dot(p, vec2(0.9, 0.4)) * 2.1 + t * 1.1) * 0.022;
        g += vec2(-0.5, 0.86) * cos(dot(p, vec2(-0.5, 0.86)) * 3.3 - t * 1.4) * 0.018;
        g += vec2(0.2, -0.98) * cos(dot(p, vec2(0.2, -0.98)) * 5.7 + t * 1.9) * 0.012;
        g += vec2(0.71, 0.71) * cos(dot(p, vec2(0.71, 0.71)) * 9.5 - t * 2.6 + sin(p.x * 1.3 + t * 0.4)) * 0.008;
        g += vec2(-0.8, -0.6) * cos(dot(p, vec2(-0.8, -0.6)) * 15.0 + t * 3.4 + sin(p.y * 2.1 - t * 0.6)) * 0.005;
        return g;
      }
      // moving net of light on the pool floor
      float caustic(vec2 p, float t){
        const float TAU = 6.28318;
        vec2 q = mod(p * TAU * 0.42, TAU) - 250.0;
        vec2 i = q;
        float c = 1.0;
        for (int n = 0; n < 4; n++) {
          float tt = t * (1.0 - 3.5 / float(n + 1));
          i = q + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
          c += 1.0 / length(vec2(q.x / (sin(i.x + tt) / 0.005), q.y / (cos(i.y + tt) / 0.005)));
        }
        c = 1.17 - pow(c / 4.0, 1.4);
        return pow(abs(c), 8.0);
      }
      // sand-coloured mosaic with paler joints
      vec3 mosaic(vec2 uv, float size){
        vec2 c = uv / size;
        vec2 f = abs(fract(c) - 0.5);
        float joint = smoothstep(0.44, 0.48, max(f.x, f.y));
        vec2 id = floor(c);
        float tone = fract(sin(dot(id, vec2(12.9898, 78.233))) * 43758.5453);
        vec3 tile = mix(vec3(0.78, 0.66, 0.52), vec3(0.90, 0.79, 0.64), tone);
        return mix(tile, vec3(0.93, 0.89, 0.82), joint);
      }
      void main(){
        vec2 sl = slope(vW.xz);
        vec3 n = normalize(vec3(-sl.x, 1.0, -sl.y));
        vec3 v = normalize(cameraPosition - vW);
        // into the water
        vec3 rd = refract(-v, n, 1.0 / 1.333);
        vec3 o = vec3(vW.x - uC.x, 0.0, vW.z - uC.y);
        float tFloor = uDepth / max(-rd.y, 0.001);
        vec2 tw = (sign(rd.xz) * uHalf - o.xz) / (rd.xz + sign(rd.xz) * 1e-5 + 1e-6);
        float tWall = min(tw.x, tw.y);
        float t = min(tFloor, tWall);
        vec3 hit = o + rd * t;
        vec3 base;
        float lit;
        if (tFloor <= tWall) {
          base = mosaic(hit.xz, 0.15);
          lit = 0.55 + 1.5 * caustic(hit.xz + sl * 6.0, uTime * 0.8);
        } else {
          vec2 wuv = tw.x < tw.y ? vec2(hit.z, hit.y) : vec2(hit.x, hit.y);
          base = mosaic(wuv, 0.15) * 0.92;
          float deep = clamp(-hit.y / uDepth, 0.0, 1.0);
          lit = 0.5 + 0.9 * caustic(wuv * vec2(1.0, 1.6) + sl * 6.0, uTime * 0.8) * (1.0 - deep * 0.6);
          // the tile band at the waterline is a shade darker
          base *= mix(0.8, 1.0, smoothstep(0.28, 0.34, -hit.y));
        }
        // water takes red out first: the longer the path, the bluer and greener what is seen through it
        vec3 absorb = exp(-t * vec3(0.52, 0.085, 0.07));
        vec3 under = base * lit * absorb * uLight + vec3(0.02, 0.16, 0.18) * (1.0 - exp(-t * 0.35)) * uLight;
        // the sky and the sun on the surface
        float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
        vec3 r = reflect(-v, n);
        vec3 sky = mix(uHorizon, uSky, clamp(r.y * 1.6, 0.0, 1.0));
        float sd = max(dot(r, normalize(uSun)), 0.0);
        sky += uSunCol * (pow(sd, 900.0) * 14.0 + pow(sd, 60.0) * 0.25);
        // a bright lip where the water climbs the wall
        vec2 e = uHalf - abs(o.xz);
        float lip = 1.0 - smoothstep(0.0, 0.035 + 0.02 * sin(uTime * 1.7 + (o.x + o.z) * 6.0), min(e.x, e.y));
        vec3 c = mix(under, sky, fres) + vec3(0.9, 0.95, 0.95) * lip * 0.35 * uLight;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}
