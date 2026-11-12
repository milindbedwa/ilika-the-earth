// ILIKA tour: planting. A handful of plant shapes, repeated as instances.
import * as THREE from 'three';
import * as P from './plan.js';
import { rng } from './materials.js';

const { X, Z, PLINTH, CEIL, F1, PARAPET, UP_H } = P;

// ---- geometry helpers: non-indexed triangles with vertex colours ----
class Tri {
  constructor() {
    this.p = [];
    this.c = [];
  }
  tri(a, b, c, ca, cb = ca, cc = ca) {
    this.p.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    this.c.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeVertexNormals();
    return g;
  }
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const col = (h) => new THREE.Color(h);

// a rosette of arching blades: agave, bromeliad, fern or banana depending on the numbers
function rosette(r, { n, len, wid, lean0, lean1, base, tip, seg = 4, jitter = 0.25 }) {
  const t = new Tri();
  const cb = col(base);
  const ct = col(tip);
  for (let i = 0; i < n; i++) {
    const az = (i / n) * Math.PI * 2 + r() * 0.5;
    const L = len * (0.7 + r() * 0.5);
    const l0 = lean0 + (r() - 0.5) * jitter;
    const l1 = lean1 + (r() - 0.5) * jitter;
    const dir = V(Math.cos(az), 0, Math.sin(az));
    const side = V(-Math.sin(az), 0, Math.cos(az));
    let prev = null;
    let pos = V(0, 0, 0);
    for (let s = 0; s <= seg; s++) {
      const k = s / seg;
      const w = wid * (1 - Math.pow(k, 1.6)) * (0.35 + 0.65 * Math.sin(Math.min(1, k * 3 + 0.25) * Math.PI * 0.5));
      const a = pos.clone().addScaledVector(side, w / 2);
      const b = pos.clone().addScaledVector(side, -w / 2);
      const c = cb.clone().lerp(ct, k * (0.6 + r() * 0.4));
      if (prev) {
        t.tri(prev.a, prev.b, a, prev.c, prev.c, c);
        t.tri(prev.b, b, a, prev.c, c, c);
      }
      prev = { a, b, c };
      const lean = l0 + (l1 - l0) * k;
      pos = pos
        .clone()
        .addScaledVector(dir, (Math.sin(lean) * L) / seg)
        .add(V(0, (Math.cos(lean) * L) / seg, 0));
    }
  }
  return t.build();
}

function palmCrown(r) {
  const t = new Tri();
  const fronds = 11;
  for (let f = 0; f < fronds; f++) {
    const az = (f / fronds) * Math.PI * 2 + r() * 0.4;
    const dir = V(Math.cos(az), 0, Math.sin(az));
    const side = V(-Math.sin(az), 0, Math.cos(az));
    const L = 3.0 + r() * 1.0;
    const l0 = 0.25 + r() * 0.5;
    const l1 = 1.7 + r() * 0.6;
    const n = 13;
    let pos = V(0, 0, 0);
    const c = col('#4f6b2c').lerp(col('#7c8f3e'), r());
    for (let s = 0; s < n; s++) {
      const k = s / n;
      const lean = l0 + (l1 - l0) * k;
      const tan = V(dir.x * Math.sin(lean), Math.cos(lean), dir.z * Math.sin(lean));
      const ll = 0.95 * Math.sin(Math.PI * Math.min(1, k * 1.15 + 0.12)) + 0.15;
      for (const sgn of [-1, 1]) {
        const tipP = pos
          .clone()
          .addScaledVector(side, sgn * ll)
          .addScaledVector(tan, 0.3)
          .add(V(0, -0.38 * ll, 0));
        const cc = c.clone().multiplyScalar(0.8 + r() * 0.35);
        t.tri(pos.clone().addScaledVector(tan, -0.1), pos.clone().addScaledVector(tan, 0.12), tipP, cc);
      }
      pos = pos.clone().addScaledVector(tan, L / n);
    }
  }
  return t.build();
}

// lumpy canopy: a few squashed, jittered icospheres
function canopy(r, blobs, spread, size, y0, dark, light) {
  const t = new Tri();
  const cd = col(dark);
  const cl = col(light);
  for (let b = 0; b < blobs; b++) {
    const g = new THREE.IcosahedronGeometry(1, 1);
    const p = g.attributes.position;
    const rad = size * (0.6 + r() * 0.6);
    const off = V((r() - 0.5) * spread, y0 + r() * spread * 0.45, (r() - 0.5) * spread);
    const tone = 0.8 + r() * 0.35;
    const vs = [];
    for (let i = 0; i < p.count; i++) {
      const v = V(p.getX(i), p.getY(i), p.getZ(i));
      const h = Math.sin(v.x * 12.9 + v.y * 78.2 + v.z * 37.7) * 43758.5;
      const j = 0.82 + (h - Math.floor(h)) * 0.36;
      vs.push(
        v
          .multiplyScalar(rad * j)
          .multiply(V(1, 0.72, 1))
          .add(off),
      );
    }
    for (let i = 0; i < vs.length; i += 3) {
      const k = THREE.MathUtils.clamp((vs[i].y - off.y) / rad / 0.72 / 2 + 0.5, 0, 1);
      t.tri(vs[i], vs[i + 1], vs[i + 2], cd.clone().lerp(cl, k).multiplyScalar(tone));
    }
    g.dispose();
  }
  return t.build();
}

function creeper(r) {
  const t = new Tri();
  for (let s = 0; s < 3; s++) {
    let x = (r() - 0.5) * 0.3;
    let z = (r() - 0.5) * 0.12;
    const len = 0.3 + r() * 0.5;
    const stem = col('#3d5a24');
    t.tri(V(x - 0.004, 0, z), V(x + 0.004, 0, z), V(x, -len, z), stem);
    for (let y = 0; y > -len; y -= 0.045) {
      const a = r() * Math.PI * 2;
      const sz = 0.035 + r() * 0.035;
      const c = col('#476628').lerp(col('#86a04a'), r());
      const o = V(x + (r() - 0.5) * 0.02, y, z);
      const u = V(Math.cos(a) * sz, -sz * 0.6, Math.sin(a) * sz);
      const w = V(-Math.sin(a) * sz * 0.6, -sz * 0.2, Math.cos(a) * sz * 0.6);
      t.tri(o, o.clone().add(u).add(w), o.clone().add(u).sub(w), c);
    }
  }
  return t.build();
}

function trunkGeo(h, r0, r1, bend) {
  const g = new THREE.CylinderGeometry(r1, r0, h, 7, 6);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = p.getY(i) / h + 0.5;
    p.setX(i, p.getX(i) + bend * k * k);
  }
  g.translate(0, h / 2, 0);
  g.computeVertexNormals();
  return g;
}

// urn profile for LatheGeometry
export function potGeo(h, rad, neck = 0.62) {
  const pts = [];
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const r =
      rad *
      (0.45 + 0.55 * Math.sin(Math.min(1, k * 1.25 + 0.1) * Math.PI)) *
      (k > 0.8 ? neck + (1 - neck) * (1 - (k - 0.8) / 0.2) + (k > 0.94 ? 0.12 : 0) : 1);
    pts.push(new THREE.Vector2(Math.max(0.02, r), k * h));
  }
  const g = new THREE.LatheGeometry(pts, 18);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * rad * 5, uv.getY(i) * h);
  return g;
}

export function plantGarden(ctx) {
  const { M, groups, solid } = ctx;
  const r = rng(7);
  const lite = ctx.opts.lite;
  const kinds = {
    agave: { g: rosette(r, { n: 16, len: 0.75, wid: 0.13, lean0: 0.25, lean1: 1.35, base: '#4c6a2a', tip: '#c3c25a' }), m: M.leaf },
    fern: { g: rosette(r, { n: 13, len: 1.15, wid: 0.2, lean0: 0.15, lean1: 1.9, base: '#3f5f27', tip: '#7f9c45', seg: 5 }), m: M.leaf },
    banana: { g: rosette(r, { n: 7, len: 2.0, wid: 0.5, lean0: 0.1, lean1: 1.2, base: '#456a2a', tip: '#8fae4e', seg: 5 }), m: M.leaf },
    spike: { g: rosette(r, { n: 22, len: 0.9, wid: 0.06, lean0: 0.05, lean1: 0.7, base: '#3f5a26', tip: '#8b9a4c', seg: 3 }), m: M.leaf },
    creeper: { g: creeper(r), m: M.leaf },
    palm: { g: palmCrown(r), m: M.leaf },
    palmTrunk: { g: trunkGeo(1, 0.16, 0.11, 0.08), m: M.bark, noSway: true },
    treeA: { g: canopy(r, 7, 3.2, 1.9, 3.7, '#3a5524', '#7c9443'), m: M.canopy },
    treeB: { g: canopy(r, 6, 2.6, 1.6, 3.3, '#44602a', '#93a24e'), m: M.canopy },
    treeTrunk: { g: trunkGeo(3.9, 0.22, 0.14, 0), m: M.bark },
    bush: { g: canopy(r, 4, 0.9, 0.5, 0.35, '#3d5a26', '#7f9844'), m: M.canopy },
  };
  const lists = new Map();
  const dummy = new THREE.Object3D();
  const add = (kind, group, x, y, z, s = 1, sy = s, rot = r() * 6.28) => {
    const key = kind + '|' + group;
    if (!lists.has(key)) lists.set(key, []);
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, rot, 0);
    dummy.scale.set(s, sy, s);
    dummy.updateMatrix();
    lists.get(key).push(dummy.matrix.clone());
  };
  const palm = (x, z, h, group = 'site') => {
    const rot = r() * 6.28;
    add('palmTrunk', group, x, 0, z, 1, h, rot);
    const bx = Math.cos(rot) * 0.08;
    const bz = -Math.sin(rot) * 0.08;
    add('palm', group, x + bx, h, z + bz, 0.85 + r() * 0.3);
  };
  const tree = (x, z, s) => {
    const rot = r() * 6.28;
    add('treeTrunk', 'site', x, 0, z, s, s, rot);
    add(r() > 0.5 ? 'treeA' : 'treeB', 'site', x, 0, z, s, s * (0.9 + r() * 0.2), rot);
  };
  // a planted strip: mixed low plants along a line
  const bed = (x0, z0, x1, z1, n, y = 0, group = 'site', mix = ['agave', 'agave', 'fern', 'spike'], sc = 1, wob = 0.25) => {
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n;
      const kind = mix[(r() * mix.length) | 0];
      add(kind, group, x0 + (x1 - x0) * k + (r() - 0.5) * wob, y, z0 + (z1 - z0) * k + (r() - 0.5) * wob, sc * (0.75 + r() * 0.5));
    }
  };

  // --- trees on the master plan, each with a ring of low planting ---
  for (const [x, z, s] of P.TREES) {
    tree(x, z, s);
    solid(0, { minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3 });
    for (let i = 0; i < 5; i++) {
      const a = r() * 6.28;
      add(
        r() > 0.5 ? 'fern' : 'agave',
        'site',
        x + Math.cos(a) * (0.7 + r() * 0.7),
        0,
        z + Math.sin(a) * (0.7 + r() * 0.7),
        0.7 + r() * 0.5,
      );
    }
  }
  // --- beyond the boundary: palms and a tree line, the backdrop of every render ---
  const pl = P.PLOT;
  const nOut = lite ? 26 : 44;
  for (let i = 0; i < nOut; i++) {
    const side = i % 4;
    const k = r();
    const d = 2 + r() * 14;
    const x = side === 0 ? pl.minX - d : side === 1 ? pl.maxX + d : pl.minX - 8 + k * (pl.maxX - pl.minX + 16);
    const z = side === 2 ? pl.minZ - d : side === 3 ? pl.maxZ + d : pl.minZ - 8 + k * (pl.maxZ - pl.minZ + 16);
    if (side === 0 && z > P.GATE.z0 - 3 && z < P.GATE.z1 + 3) continue;
    if (i % 3) palm(x, z, 5.5 + r() * 4.5);
    else tree(x, z, 1.0 + r() * 0.45);
  }
  // a far ring so the horizon is trees, not bare ground
  for (let i = 0; i < (lite ? 36 : 64); i++) {
    const a = (i / (lite ? 36 : 64)) * 6.283 + r() * 0.1;
    const d = 44 + r() * 34;
    if (i % 4 === 0) palm(Math.cos(a) * d, Math.sin(a) * d, 7 + r() * 4);
    else tree(Math.cos(a) * d, Math.sin(a) * d, 1.5 + r() * 0.9);
  }
  // palms inside the plot, at the corners of the lawn
  for (const [x, z] of [
    [-19.5, 18.3],
    [-14, 19.4],
    [21, 18.6],
    [14.5, 19.6],
    [-20, -3.5],
    [21.6, 0.5],
    [8.5, -18.6],
    [-20, -18],
  ]) {
    palm(x, z, 5 + r() * 3);
    solid(0, { minX: x - 0.25, maxX: x + 0.25, minZ: z - 0.25, maxZ: z + 0.25 });
  }
  // --- borders along the inside of the boundary wall ---
  const m = 0.9;
  bed(pl.minX + m, pl.maxZ - m, pl.maxX - m, pl.maxZ - m, 46, 0, 'site', ['agave', 'fern', 'fern', 'banana', 'spike', 'bush'], 1.1, 0.8);
  bed(pl.minX + m, pl.minZ + m, pl.maxX - m, pl.minZ + m, 46, 0, 'site', ['agave', 'fern', 'fern', 'banana', 'spike', 'bush'], 1.1, 0.8);
  bed(pl.maxX - m, pl.minZ + m, pl.maxX - m, pl.maxZ - m, 40, 0, 'site', ['agave', 'fern', 'banana', 'spike', 'bush'], 1.1, 0.8);
  bed(pl.minX + m, pl.maxZ - m, pl.minX + m, P.GATE.z1 + 1, 26, 0, 'site', ['agave', 'fern', 'banana', 'spike', 'bush'], 1.1, 0.8);
  bed(pl.minX + m, P.GATE.z0 - 1, pl.minX + m, pl.minZ + m, 9, 0, 'site', ['agave', 'fern', 'banana', 'bush'], 1.1, 0.8);

  // --- pool front: beds either side of the garden steps and along the wing steps ---
  const zl = Z(517.7) + 0.55;
  bed(X(176) + 0.5, zl, X(165) + 0.4, zl + 0.3, 5, 0, 'site', ['agave', 'agave', 'spike']);
  bed(X(245) - 0.4, zl, X(234) - 0.5, zl + 0.3, 5, 0, 'site', ['agave', 'agave', 'spike']);
  bed(X(176) + 0.4, zl + 1.2, X(168), zl + 1.6, 4, 0, 'site', ['agave', 'fern']);
  bed(X(242), zl + 1.6, X(234) - 0.4, zl + 1.2, 4, 0, 'site', ['agave', 'fern']);
  for (const py of [80, 132, 278, 329]) bed(X(py), Z(515), X(py), Z(515) + 4.6, 6, 0, 'site', ['agave', 'agave', 'fern', 'spike'], 1, 0.5);
  // the two ends of the house
  bed(X(62), Z(366), X(62), Z(428), 8, 0, 'site', ['fern', 'banana', 'agave', 'bush'], 1.1, 0.6);
  bed(X(62), Z(468), X(62), Z(500), 5, 0, 'site', ['fern', 'banana', 'agave'], 1.1, 0.6);
  bed(X(350.5), Z(463), X(350.5), Z(500), 5, 0, 'site', ['fern', 'banana', 'agave'], 1.1, 0.6);
  // entrance: beds in front of both jaali screens
  bed(X(80), Z(341), X(168), Z(341), 14, 0, 'site', ['agave', 'fern', 'spike', 'agave', 'bush'], 1.05, 0.5);
  bed(X(238), Z(341), X(330), Z(341), 14, 0, 'site', ['agave', 'fern', 'spike', 'agave', 'bush'], 1.05, 0.5);
  // planted jaali courts, seen from the baths
  for (const [a, b] of [
    [82, 131],
    [279, 327],
  ]) {
    bed(X(a), Z(349), X(b), Z(349), 7, 0.3, 'ground', ['fern', 'banana', 'fern'], 1.0, 0.3);
    bed(X(a), Z(356), X(b), Z(356), 8, 0.3, 'ground', ['fern', 'agave', 'spike'], 0.9, 0.3);
  }
  bed(X(138), Z(347.5), X(168), Z(347.5), 6, 0.3, 'ground', ['fern', 'agave'], 0.8, 0.15);
  bed(X(238), Z(347.5), X(272), Z(347.5), 7, 0.3, 'ground', ['fern', 'agave'], 0.8, 0.15);
  // sunken sitting planters and the canopy planter
  for (const py of [168.3, 241.7]) bed(X(py), Z(455), X(py), Z(472), 6, PLINTH + 0.33, 'ground', ['agave', 'fern', 'spike'], 0.8, 0.12);
  bed(X(178), Z(444), X(233), Z(444), 16, PLINTH + CEIL + 0.43, 'slab', ['agave', 'agave', 'fern'], 0.75, 0.1);
  for (let py = 178; py < 234; py += 2.3)
    add('creeper', 'slab', X(py), PLINTH + CEIL - 0.2, Z(448.2) + 0.06, 0.9 + r() * 0.5, 0.7 + r() * 1.1);
  // entrance pergola: creepers and a planted top
  for (let py = 174; py < 234; py += 2.1) add('creeper', 'site', X(py), PLINTH + 2.78, Z(331.2), 0.9 + r() * 0.5, 0.6 + r() * 0.9);
  bed(X(175), Z(338), X(232), Z(338), 14, PLINTH + 3.12, 'site', ['fern', 'agave'], 0.7, 0.4);
  // garden pavilion: creepers over the pergola and beds around the platform
  const pv = P.PAVILION;
  const ph = pv.h + 2.75;
  for (let x = pv.minX; x <= pv.maxX; x += 0.42) {
    add('creeper', 'site', x, ph + 0.02, pv.maxZ + 0.2, 1 + r() * 0.5, 0.6 + r() * 1.2);
    add('creeper', 'site', x, ph + 0.02, pv.minZ - 0.2, 1 + r() * 0.5, 0.6 + r() * 1.0);
  }
  for (let z = pv.minZ; z <= pv.maxZ; z += 0.42) {
    add('creeper', 'site', pv.minX - 0.05, ph + 0.02, z, 1 + r() * 0.5, 0.5 + r() * 0.9, Math.PI / 2);
    add('creeper', 'site', pv.maxX + 0.05, ph + 0.02, z, 1 + r() * 0.5, 0.6 + r() * 1.2, Math.PI / 2);
  }
  for (let i = 0; i < 46; i++)
    add(
      'bush',
      'site',
      pv.minX + r() * (pv.maxX - pv.minX),
      ph + 0.34,
      pv.minZ + r() * (pv.maxZ - pv.minZ),
      0.55 + r() * 0.5,
      0.25 + r() * 0.2,
    );
  const pz = (pv.minZ + pv.maxZ) / 2;
  bed(pv.minX - 0.3, pv.minZ, pv.minX - 0.3, pz - 1.8, 4, 0, 'site', ['fern', 'agave', 'spike']);
  bed(pv.minX - 0.3, pz + 1.8, pv.minX - 0.3, pv.maxZ, 4, 0, 'site', ['fern', 'agave', 'spike']);
  bed(pv.minX, pv.maxZ + 0.35, pv.maxX, pv.maxZ + 0.35, 10, 0, 'site', ['fern', 'agave', 'banana', 'spike']);
  bed(pv.minX, pv.minZ - 0.35, pv.maxX, pv.minZ - 0.35, 10, 0, 'site', ['fern', 'banana', 'bush']);
  bed(pv.maxX + 0.35, pv.minZ, pv.maxX + 0.35, pv.maxZ, 10, 0, 'site', ['fern', 'banana', 'bush']);
  // terrace planters (first floor)
  for (const [a, b, px] of [
    [84, 130, 366.5],
    [282, 326, 366.5],
  ])
    bed(X(a), Z(px), X(b), Z(px), 10, F1 + 0.42, 'slab', ['agave', 'fern', 'spike'], 0.8, 0.1);

  ctx.plant = add;
  ctx.plantFlush = () => {
    for (const [key, mats] of lists) {
      const [kind, group] = key.split('|');
      const k = kinds[kind];
      const mesh = new THREE.InstancedMesh(k.g, k.m, mats.length);
      mats.forEach((mm, i) => mesh.setMatrixAt(i, mm));
      mesh.castShadow = kind !== 'creeper';
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      groups[group].add(mesh);
    }
  };
}
