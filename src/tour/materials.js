// ILIKA tour: materials. Architecture and furniture use scanned surfaces; leaves are painted
// in code; the pool is a shader.
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

function paint(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  return c;
}

// Surfaces are scanned materials (colour, relief, roughness and crevice shading) packed by
// scripts/build-tour-assets.mjs into public/tour/tex. Phones load the 512 px set, desktops 1024 px.
export function makeMaterials({ aniso = 4, lite = false, onProgress = () => {} } = {}) {
  const r = rng(26);
  const M = {};
  const dir = `/tour/tex/${lite ? 512 : 1024}/`;
  let total = 0;
  let done = 0;
  let resolve;
  M.ready = new Promise((ok) => (resolve = ok));
  const manager = new THREE.LoadingManager();
  manager.onProgress = () => onProgress(++done / total);
  manager.onLoad = () => resolve();
  manager.onError = (url) => console.warn('tour texture missing', url); // the surface falls back to its flat colour
  const loader = new THREE.TextureLoader(manager);
  const cacheT = new Map();
  // one texture per (file, tile size); UVs are in metres, so repeat is 1 / metres per tile
  const tex = (name, kind, tile) => {
    const key = `${name}_${kind}@${tile}`;
    if (cacheT.has(key)) return cacheT.get(key);
    total++;
    const t = loader.load(`${dir}${name}_${kind}.webp`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (kind === 'c') t.colorSpace = THREE.SRGBColorSpace;
    t.repeat.set(1 / tile, 1 / tile);
    t.anisotropy = aniso;
    cacheT.set(key, t);
    return t;
  };
  // the sky lights every room unoccluded, so keep its mirror image faint on everything but metal and glass
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, envMapIntensity: o.metalness ? 1 : 0.5, ...o });
  const scan = (name, tile, o = {}) => {
    const arm = tex(name, 'arm', tile);
    return std({
      map: tex(name, 'c', tile),
      normalMap: tex(name, 'n', tile),
      aoMap: arm,
      aoMapIntensity: 0.9,
      roughnessMap: arm,
      roughness: 1,
      ...o,
    });
  };
  const soft = (m) => {
    m.userData.soft = true;
    return m;
  };

  // ---------- lime plaster: one scan, tinted for every colour on the house ----------
  const plaster = (tint, o = {}) => scan('plaster', 2.4, { color: tint, normalScale: new THREE.Vector2(0.8, 0.8), ...o });
  M.terra = plaster('#dc8d64');
  M.clay = plaster('#cf8560');
  M.deep = plaster('#c06d48');
  M.ivory = plaster('#f5ead6');
  M.sand = plaster('#dfcaa9');
  M.coping = plaster('#d99a72');
  M.pot = plaster('#c06f4a', { roughness: 0.85 });
  M.potPale = plaster('#dcbf9f');
  M.ceiling = plaster('#f7f0e3');
  M.art = plaster('#a85c3e', { normalScale: new THREE.Vector2(2, 2) });
  M.jaaliBrick = plaster('#c8774f', { normalScale: new THREE.Vector2(1.6, 1.6) });
  M.jaali = plaster('#c4704a');

  // ---------- stone ----------
  M.stone = scan('travertine', 1.8, { roughness: 0.75, envMapIntensity: 0.7 }); // 900 mm honed slabs
  M.bathStone = scan('travertine', 1.2, { roughness: 0.7, envMapIntensity: 0.7 }); // 600 mm
  M.deck = scan('paving', 2.25, { color: '#e9d0aa' });
  M.pool = scan('paving', 1.5, { color: '#e9d2b8' });

  // ---------- timber ----------
  M.timber = scan('oak', 1.83);
  M.timberDark = scan('walnut', 0.9);
  M.timberPale = scan('bamboo', 1.0);
  M.planks = scan('planks', 1.89);
  M.bark = scan('bark', 1.0, { normalScale: new THREE.Vector2(1.6, 1.6) });
  M.palmBark = scan('palmbark', 1.3, { normalScale: new THREE.Vector2(1.6, 1.6) });

  // ---------- cloth, cane, rugs ----------
  const linen = (tint) => soft(scan('linen', 0.32, { color: tint }));
  M.linen = linen('#f4eee2');
  M.linenWarm = linen('#dcbf9f');
  M.linenClay = linen('#b76b4c');
  M.linenOlive = linen('#8f8e60');
  M.cane = scan('cane', 0.28, { roughness: 0.85 });
  M.rug = scan('carpet', 0.8, { color: '#e6d6b9' });
  M.rugClay = scan('carpet', 0.8, { color: '#cf9c7e' });
  M.sheer = new THREE.MeshStandardMaterial({
    map: tex('linen', 'c', 0.2),
    color: '#fffaf0',
    roughness: 1,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  M.sheer.userData.noCast = M.sheer.userData.noAO = true;

  // ---------- ground ----------
  M.brick = scan('brick', 1.8);
  M.brick.color.setRGB(1.5, 1.25, 1.1); // the scan is a dark engineering brick: lift it to a sun-baked clay paver
  M.grass = scan('grass', 2.4, { envMapIntensity: 0.3 });
  M.grass.color.setRGB(0.8, 1.15, 0.5); // the scan is a dry lawn: push it toward a watered one
  M.soil = scan('mulch', 2.0, { color: '#b9a48e' });
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

  if (!total) resolve();
  M.sway = sway;
  M.setDusk = (k) => {
    M.lamp.emissiveIntensity = 0.25 + k * 2.4;
    M.led.emissiveIntensity = 0.4 + k * 3.2;
  };
  return M;
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
