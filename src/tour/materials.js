// ILIKA tour: procedural materials. No image downloads: every surface is painted on a canvas
// at start-up, so the tour adds nothing to the network beyond its script.
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

const hex = (c) => '#' + new THREE.Color(c).getHexString();
const shade = (c, k) => hex(new THREE.Color(c).multiplyScalar(k));

function paint(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  return c;
}

// soft blotches that wrap at the tile edges, then a fine grain
function mottle(g, s, r, base, { blobs = 60, spread = 0.12, grain = 9, rmin = 0.05, rmax = 0.22 } = {}) {
  g.fillStyle = hex(base);
  g.fillRect(0, 0, s, s);
  for (let i = 0; i < blobs; i++) {
    const x = r() * s;
    const y = r() * s;
    const rad = (rmin + r() * (rmax - rmin)) * s;
    const k = 1 + (r() - 0.5) * 2 * spread;
    for (const ox of [-s, 0, s])
      for (const oy of [-s, 0, s]) {
        if (x + ox + rad < 0 || x + ox - rad > s || y + oy + rad < 0 || y + oy - rad > s) continue;
        const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
        const col = new THREE.Color(base).multiplyScalar(k);
        gr.addColorStop(0, `rgba(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0},0.5)`);
        gr.addColorStop(1, `rgba(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0},0)`);
        g.fillStyle = gr;
        g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
      }
  }
  if (grain) {
    const im = g.getImageData(0, 0, s, s);
    const d = im.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (r() - 0.5) * grain * 2;
      d[i] += n;
      d[i + 1] += n;
      d[i + 2] += n;
    }
    g.putImageData(im, 0, 0);
  }
}

function tex(canvas, tile, aniso) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(1 / tile, 1 / tile); // geometry UVs are in metres
  t.anisotropy = aniso;
  return t;
}

export function makeMaterials({ aniso = 4, lite = false } = {}) {
  const r = rng(26);
  const S = lite ? 256 : 512;
  const M = {};
  // the sky lights every room unoccluded, so keep its reflection faint on everything but metal and glass
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, envMapIntensity: o.metalness ? 1 : 0.55, ...o });

  const plaster = (base, tile, o) => {
    const c = paint(S, (g, s) => {
      mottle(g, s, r, base, o);
      // trowel drag: faint long strokes
      g.globalAlpha = 0.025;
      for (let i = 0; i < 40; i++) {
        g.strokeStyle = r() > 0.5 ? '#fff' : '#3b2418';
        g.lineWidth = 1 + r() * 3;
        const y = r() * s;
        g.beginPath();
        g.moveTo(-10, y);
        g.bezierCurveTo(s * 0.3, y + (r() - 0.5) * 30, s * 0.6, y + (r() - 0.5) * 30, s + 10, y + (r() - 0.5) * 14);
        g.stroke();
      }
      g.globalAlpha = 1;
    });
    const map = tex(c, tile, aniso);
    const m = std({ map, roughness: 0.94 });
    return m;
  };

  M.terra = plaster('#dca588', 3.2, { spread: 0.03, grain: 6 });
  M.clay = plaster('#d39a7c', 2.8, { spread: 0.03, grain: 6 });
  M.deep = plaster('#c67c5c', 2.4, { spread: 0.06 });
  M.ivory = plaster('#eee4d2', 3.0, { spread: 0.05, grain: 5 });
  M.sand = plaster('#d9c3a0', 3.0, { spread: 0.08 });
  M.ceiling = std({ color: '#f1e9da', roughness: 1 });

  // stone floors: 600 mm tiles, 3 x 3 to a texture
  const tiles = (base, joint, n, tile, vary = 0.06) => {
    const c = paint(S, (g, s) => {
      mottle(g, s, r, base, { blobs: 30, spread: 0.05, grain: 6 });
      const w = s / n;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          g.fillStyle = r() > 0.5 ? `rgba(255,255,255,${r() * vary})` : `rgba(60,36,24,${r() * vary})`;
          g.fillRect(i * w, j * w, w, w);
        }
      g.strokeStyle = joint;
      g.lineWidth = Math.max(1, s / 256);
      for (let i = 0; i <= n; i++) {
        g.beginPath();
        g.moveTo(i * w, 0);
        g.lineTo(i * w, s);
        g.moveTo(0, i * w);
        g.lineTo(s, i * w);
        g.stroke();
      }
    });
    return tex(c, tile, aniso);
  };
  M.stone = std({ map: tiles('#dccbb0', 'rgba(120,96,70,0.5)', 3, 1.8), roughness: 0.7 });
  M.deck = std({ map: tiles('#cdb28c', 'rgba(110,84,60,0.6)', 2, 1.6, 0.08), roughness: 0.85 });
  M.bathStone = std({ map: tiles('#c9b89c', 'rgba(110,90,70,0.5)', 4, 1.2, 0.1), roughness: 0.55 });
  M.coping = plaster('#dcab8e', 2.0, { spread: 0.045 });
  M.pool = std({ map: tiles('#d7b79a', 'rgba(150,110,90,0.5)', 8, 1.2, 0.05), roughness: 0.5 });

  // timber: long grain along U
  const timber = (base, tile, planks = 0) => {
    const c = paint(S, (g, s) => {
      g.fillStyle = hex(base);
      g.fillRect(0, 0, s, s);
      for (let i = 0; i < 260; i++) {
        const y = r() * s;
        g.strokeStyle = r() > 0.45 ? shade(base, 0.72 + r() * 0.2) : shade(base, 1.1 + r() * 0.15);
        g.globalAlpha = 0.08 + r() * 0.2;
        g.lineWidth = 0.5 + r() * 2;
        g.beginPath();
        g.moveTo(0, y);
        const w = (r() - 0.5) * 8;
        g.bezierCurveTo(s * 0.33, y + w, s * 0.66, y - w, s, y);
        g.stroke();
      }
      g.globalAlpha = 1;
      if (planks) {
        g.strokeStyle = 'rgba(40,22,12,0.6)';
        g.lineWidth = 2;
        for (let i = 0; i < planks; i++) {
          g.beginPath();
          g.moveTo(0, (i * s) / planks);
          g.lineTo(s, (i * s) / planks);
          g.stroke();
        }
      }
    });
    return tex(c, tile, aniso);
  };
  M.timber = std({ map: timber('#9a6a44', 1.4), roughness: 0.7 });
  M.timberDark = std({ map: timber('#5e3c27', 1.4), roughness: 0.65 });
  M.timberPale = std({ map: timber('#b98d62', 1.2), roughness: 0.75 });
  M.planks = std({ map: timber('#a57650', 1.2, 8), roughness: 0.8 });

  // woven surfaces
  const weave = (base, tile, n, contrast) => {
    const c = paint(256, (g, s) => {
      g.fillStyle = hex(base);
      g.fillRect(0, 0, s, s);
      const w = s / n;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          const k = (i + j) % 2 ? 1 - contrast : 1 + contrast * 0.6;
          g.fillStyle = shade(base, k + (r() - 0.5) * 0.05);
          g.fillRect(i * w + 0.5, j * w + 0.5, w - 1, w - 1);
        }
    });
    return tex(c, tile, aniso);
  };
  M.linen = std({ map: weave('#efe8d9', 0.2, 32, 0.04), roughness: 1 });
  M.linenWarm = std({ map: weave('#d9b99a', 0.2, 32, 0.05), roughness: 1 });
  M.linenClay = std({ map: weave('#b9694a', 0.2, 32, 0.06), roughness: 1 });
  M.linenOlive = std({ map: weave('#8b8a5c', 0.2, 32, 0.06), roughness: 1 });
  M.cane = std({ map: weave('#cfae7c', 0.09, 8, 0.28), roughness: 0.8 });
  M.rug = std({ map: weave('#d8c6a6', 0.5, 24, 0.1), roughness: 1 });
  M.rugClay = std({ map: weave('#c79476', 0.5, 24, 0.1), roughness: 1 });
  M.sheer = new THREE.MeshStandardMaterial({
    map: weave('#fbf6ea', 0.1, 32, 0.03),
    roughness: 1,
    transparent: true,
    opacity: 0.62,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  M.sheer.userData.noCast = true;

  // brick paving, stack bond
  M.brick = std({
    map: tex(
      paint(S, (g, s) => {
        mottle(g, s, r, '#c98463', { blobs: 20, spread: 0.05, grain: 8 });
        const bw = s / 4;
        const bh = s / 12;
        for (let j = 0; j < 12; j++)
          for (let i = -1; i < 5; i++) {
            const x = i * bw + (j % 2 ? bw / 2 : 0);
            g.fillStyle = r() > 0.5 ? `rgba(255,220,190,${r() * 0.12})` : `rgba(60,20,10,${r() * 0.16})`;
            g.fillRect(x, j * bh, bw, bh);
            g.strokeStyle = 'rgba(120,70,50,0.5)';
            g.lineWidth = 1.5;
            g.strokeRect(x, j * bh, bw, bh);
          }
      }),
      0.92,
      aniso,
    ),
    roughness: 0.9,
  });
  M.jaaliBrick = std({ color: '#c9785a', roughness: 0.92 });
  M.jaali = std({ color: '#c87656', roughness: 0.9 });

  M.grass = std({
    map: tex(
      paint(S, (g, s) => {
        mottle(g, s, r, '#7c9a48', { blobs: 160, spread: 0.07, grain: 14, rmin: 0.015, rmax: 0.08 });
      }),
      7,
      aniso,
    ),
    roughness: 1,
  });
  M.soil = std({ color: '#4a3324', roughness: 1 });
  M.mud = std({ color: '#8a5a40', roughness: 0.35 });

  M.glass = new THREE.MeshStandardMaterial({
    color: '#dfe9e2',
    roughness: 0.04,
    metalness: 0,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    envMapIntensity: 1.4,
  });
  M.glass.userData.noCast = true;
  M.brass = std({ color: '#b68d52', roughness: 0.32, metalness: 1 });
  M.ceramic = std({ color: '#f1ece1', roughness: 0.22 });
  M.pot = plaster('#c2714c', 1.2, { spread: 0.1 });
  M.potPale = plaster('#d8b796', 1.2, { spread: 0.1 });
  M.steel = std({ color: '#3a302a', roughness: 0.4, metalness: 0.7 });
  M.shadow = new THREE.MeshBasicMaterial({
    transparent: true,
    depthWrite: false,
    opacity: 0.5,
    map: (() => {
      const t = new THREE.CanvasTexture(
        paint(128, (g, s) => {
          const gr = g.createRadialGradient(s / 2, s / 2, s * 0.15, s / 2, s / 2, s / 2);
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
  M.shadow.userData.noCast = true;

  // lamps: emissive, brightened at dusk by setDusk()
  M.lamp = new THREE.MeshStandardMaterial({ color: '#f3dfb8', emissive: '#ffb86a', emissiveIntensity: 0.25, roughness: 0.8 });
  M.lamp.userData.noCast = true;
  M.led = new THREE.MeshStandardMaterial({ color: '#ffd9a0', emissive: '#ff9f45', emissiveIntensity: 0.4 });
  M.led.userData.noCast = true;
  M.art = std({ color: '#a5583a', roughness: 1 });

  // foliage, vertex-coloured, swayed in the vertex shader
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
  M.leaf = sway(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide }), 0.012);
  M.canopy = sway(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }), 0.004);
  M.bark = std({ color: '#6a5140', roughness: 1 });

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
