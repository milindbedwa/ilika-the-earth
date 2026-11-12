// ILIKA tour: planting. A handful of plant shapes, repeated as instances.
import * as THREE from 'three';
import * as P from './plan.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from './materials.js';

const { X, Z, PLINTH, CEIL, F1, PARAPET, UP_H } = P;

// ---- geometry helpers: quads and strips with normals and UVs, for alpha-cut leaf textures ----
class Leaves {
  constructor() {
    this.p = [];
    this.n = [];
    this.u = [];
  }
  // quad a-b-c-d (counter-clockwise), uv corners matching
  quad(a, b, c, d, uv, nrm) {
    const order = [a, b, c, a, c, d];
    const uo = [uv[0], uv[1], uv[2], uv[0], uv[2], uv[3]];
    const face = nrm ? null : new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a)).normalize();
    for (let i = 0; i < 6; i++) {
      const v = order[i];
      this.p.push(v.x, v.y, v.z);
      // leaves are lit from above whichever way the card faces: lean every normal upward
      const n = nrm ? nrm(v) : face.clone().multiplyScalar(face.y < 0 ? -1 : 1);
      n.y += 0.55;
      n.normalize();
      this.n.push(n.x, n.y, n.z);
      this.u.push(uo[i][0], uo[i][1]);
    }
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    return g;
  }
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// an arching leaf: a strip along a curve, folded along its rib. The texture runs base (u=0) to tip (u=1).
function strip(L, r, { az, len, wid, lean0, lean1, seg = 5, fold = 0.35, base = V(0, 0, 0), u0 = 0 }) {
  const dir = V(Math.cos(az), 0, Math.sin(az));
  const side = V(-Math.sin(az), 0, Math.cos(az));
  let pos = base.clone();
  let prev = null;
  for (let s = 0; s <= seg; s++) {
    const k = s / seg;
    const lean = lean0 + (lean1 - lean0) * k;
    const tan = V(dir.x * Math.sin(lean), Math.cos(lean), dir.z * Math.sin(lean));
    const up = V().crossVectors(side, tan).normalize(); // leaf's own "up"
    const drop = up.clone().multiplyScalar(-Math.sin(fold) * wid * 0.5);
    const out = side.clone().multiplyScalar(Math.cos(fold) * wid * 0.5);
    const cur = { c: pos.clone(), l: pos.clone().add(out).add(drop), r: pos.clone().sub(out).add(drop), u: u0 + (1 - u0) * k };
    if (prev) {
      L.quad(prev.c, prev.l, cur.l, cur.c, [
        [prev.u, 0.5],
        [prev.u, 1],
        [cur.u, 1],
        [cur.u, 0.5],
      ]);
      L.quad(prev.r, prev.c, cur.c, cur.r, [
        [prev.u, 0],
        [prev.u, 0.5],
        [cur.u, 0.5],
        [cur.u, 0],
      ]);
    }
    prev = cur;
    pos = pos.clone().addScaledVector(tan, len / seg);
  }
}

function rosette(r, { n, len, wid, lean0, lean1, seg = 4, fold = 0.35, jitter = 0.25, rings = 1 }) {
  const L = new Leaves();
  for (let ring = 0; ring < rings; ring++)
    for (let i = 0; i < n; i++) {
      const k = 1 - ring * 0.3;
      strip(L, r, {
        az: (i / n) * Math.PI * 2 + r() * 0.6 + ring,
        len: len * k * (0.75 + r() * 0.45),
        wid: wid * (0.8 + r() * 0.4),
        lean0: (lean0 + (r() - 0.5) * jitter) * k,
        lean1: (lean1 + (r() - 0.5) * jitter) * k,
        seg,
        fold,
      });
    }
  return L.build();
}

function palmCrown(r) {
  const L = new Leaves();
  const fronds = 15;
  for (let f = 0; f < fronds; f++) {
    const young = f % 3 === 0; // a few upright fronds in the middle
    strip(L, r, {
      az: (f / fronds) * Math.PI * 2 + r() * 0.4,
      len: 3.1 + r() * 0.9,
      wid: 1.25,
      lean0: young ? 0.1 + r() * 0.2 : 0.5 + r() * 0.4,
      lean1: young ? 1.2 + r() * 0.3 : 1.9 + r() * 0.5,
      seg: 7,
      fold: 0.5,
    });
  }
  return L.build();
}

// a leafy mass: cards scattered through a few clumps, shaded as one rounded volume
function canopy(r, { clumps, spread, rad, y0, card, per }) {
  const L = new Leaves();
  const centre = V(0, y0 + spread * 0.25, 0);
  for (let c = 0; c < clumps; c++) {
    const cc = V((r() - 0.5) * spread, y0 + r() * spread * 0.5, (r() - 0.5) * spread);
    const cr = rad * (0.7 + r() * 0.5);
    for (let i = 0; i < per; i++) {
      // a point on the clump's shell, where leaves actually are
      const a = r() * Math.PI * 2;
      const e = Math.acos(1 - r() * 1.6) - 0.3;
      const d = cr * (0.75 + r() * 0.3);
      const o = V(Math.sin(e) * Math.cos(a) * d, Math.cos(e) * d * 0.75, Math.sin(e) * Math.sin(a) * d).add(cc);
      const s = card * (0.7 + r() * 0.6) * 0.5;
      const ax = V(r() - 0.5, (r() - 0.5) * 0.6, r() - 0.5).normalize();
      const ay = V(r() - 0.5, r() * 0.9 + 0.2, r() - 0.5)
        .cross(ax)
        .cross(ax)
        .normalize()
        .multiplyScalar(-1);
      const p = (sx, sy) =>
        o
          .clone()
          .addScaledVector(ax, sx * s)
          .addScaledVector(ay, sy * s);
      const nrm = (v) => v.clone().sub(centre).normalize();
      L.quad(
        p(-1, -1),
        p(1, -1),
        p(1, 1),
        p(-1, 1),
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ],
        nrm,
      );
    }
  }
  return L.build();
}

// two crossed hanging cards
function creeper() {
  const L = new Leaves();
  for (const a of [0, 1.3]) {
    const ax = V(Math.cos(a) * 0.28, 0, Math.sin(a) * 0.28);
    L.quad(V(0, -0.6, 0).sub(ax), V(0, -0.6, 0).add(ax), V(0, 0, 0).add(ax), V(0, 0, 0).sub(ax), [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]);
  }
  return L.build();
}

// trunk with a slight sweep, and optional boughs
function trunkGeo(h, r0, r1, bend, boughs = 0, r = null) {
  const parts = [];
  const g = new THREE.CylinderGeometry(r1, r0, h, 10, 8);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = p.getY(i) / h + 0.5;
    p.setX(i, p.getX(i) + bend * k * k);
    // flare at the foot
    if (k < 0.12) {
      const f = 1 + (0.12 - k) * 3;
      p.setX(i, p.getX(i) * f);
      p.setZ(i, p.getZ(i) * f);
    }
  }
  g.translate(0, h / 2, 0);
  parts.push(g);
  for (let b = 0; b < boughs; b++) {
    const len = h * (0.35 + r() * 0.2);
    const bg = new THREE.CylinderGeometry(r1 * 0.35, r1 * 0.8, len, 7, 1);
    bg.translate(0, len / 2, 0);
    bg.rotateZ(0.5 + r() * 0.5);
    bg.rotateY((b / boughs) * Math.PI * 2 + r());
    bg.translate(0, h * (0.72 + r() * 0.2), 0);
    parts.push(bg);
  }
  const m = parts.length > 1 ? mergeGeometries(parts) : g;
  const uv = m.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i) * h * 0.5, uv.getX(i) * r0 * 6);
  m.computeVertexNormals();
  return m;
}

// urn profile for LatheGeometry
export function potGeo(h, rad, neck = 0.62) {
  const pts = [];
  const n = 22;
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const r =
      rad *
      (0.45 + 0.55 * Math.sin(Math.min(1, k * 1.25 + 0.1) * Math.PI)) *
      (k > 0.8 ? neck + (1 - neck) * (1 - (k - 0.8) / 0.2) + (k > 0.94 ? 0.12 : 0) : 1);
    pts.push(new THREE.Vector2(Math.max(0.02, r), k * h));
  }
  const g = new THREE.LatheGeometry(pts, 32);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * rad * 5, uv.getY(i) * h);
  return g;
}

export function plantGarden(ctx) {
  const { M, groups, solid, B } = ctx;
  const r = rng(7);
  const lite = ctx.opts.lite;
  const kinds = {
    agave: { g: rosette(r, { n: 12, len: 0.8, wid: 0.16, lean0: 0.2, lean1: 1.3, rings: 2 }), m: M.blade },
    fern: { g: rosette(r, { n: 11, len: 1.15, wid: 0.34, lean0: 0.2, lean1: 1.95, seg: 6, fold: 0.2 }), m: M.frond },
    banana: { g: rosette(r, { n: 7, len: 1.9, wid: 0.62, lean0: 0.08, lean1: 1.25, seg: 6, fold: 0.25 }), m: M.broad },
    spike: { g: rosette(r, { n: 20, len: 0.95, wid: 0.07, lean0: 0.05, lean1: 0.75, seg: 3, rings: 2 }), m: M.blade },
    creeper: { g: creeper(), m: M.vine },
    palm: { g: palmCrown(r), m: M.frond },
    palmTrunk: { g: trunkGeo(1, 0.17, 0.11, 0.08), m: M.bark },
    treeA: { g: canopy(r, { clumps: 7, spread: 3.4, rad: 1.5, y0: 3.6, card: 1.75, per: lite ? 14 : 26 }), m: M.leafSpray },
    treeB: { g: canopy(r, { clumps: 5, spread: 2.8, rad: 1.35, y0: 3.3, card: 1.65, per: lite ? 14 : 26 }), m: M.leafSpray },
    treeTrunk: { g: trunkGeo(3.9, 0.2, 0.13, 0.1, 4, r), m: M.bark },
    bush: { g: canopy(r, { clumps: 4, spread: 0.8, rad: 0.42, y0: 0.3, card: 0.5, per: lite ? 10 : 16 }), m: M.leafSpray },
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
    const sh = new THREE.PlaneGeometry(7 * s, 7 * s);
    sh.rotateX(-Math.PI / 2);
    sh.translate(x, 0.02, z);
    B.site.add(M.shadow, sh);
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
    else tree(Math.cos(a) * d, Math.sin(a) * d, 1.25 + r() * 0.5);
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
      const tint = new THREE.Color();
      const leafy = !!k.m.userData.depth;
      mats.forEach((mm, i) => {
        mesh.setMatrixAt(i, mm);
        // no two plants quite the same green
        if (leafy) mesh.setColorAt(i, tint.setRGB(0.86 + r() * 0.3, 0.9 + r() * 0.2, 0.8 + r() * 0.3));
      });
      if (leafy) mesh.customDepthMaterial = k.m.userData.depth;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      if (k.m.userData.noAO) mesh.userData.noAO = true;
      groups[group].add(mesh);
    }
  };
}
