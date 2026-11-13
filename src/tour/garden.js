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
    agave: { g: rosette(r, { n: 14, len: 0.8, wid: 0.17, lean0: 0.2, lean1: 1.3, rings: 2 }), m: M.blade },
    fern: { g: rosette(r, { n: 13, len: 1.1, wid: 0.3, lean0: 0.25, lean1: 1.95, seg: 6, fold: 0.2, rings: 2 }), m: M.fernLeaf },
    banana: { g: rosette(r, { n: 8, len: 2.3, wid: 0.72, lean0: 0.06, lean1: 1.25, seg: 7, fold: 0.22 }), m: M.broad },
    bird: { g: rosette(r, { n: 10, len: 1.5, wid: 0.42, lean0: 0.04, lean1: 0.6, seg: 5, fold: 0.3 }), m: M.broad },
    philo: { g: rosette(r, { n: 11, len: 0.8, wid: 0.46, lean0: 0.45, lean1: 1.5, seg: 4, fold: 0.12, rings: 2 }), m: M.heart },
    spike: { g: rosette(r, { n: lite ? 26 : 42, len: 1.0, wid: 0.04, lean0: 0.04, lean1: 1.05, seg: 4, rings: 3, fold: 0.5 }), m: M.reed },
    creeper: { g: creeper(), m: M.vine },
    palm: { g: palmCrown(r), m: M.frond },
    palmTrunk: { g: trunkGeo(1, 0.17, 0.11, 0.08), m: M.bark },
    treeA: { g: canopy(r, { clumps: 7, spread: 3.4, rad: 1.5, y0: 3.6, card: 1.75, per: lite ? 14 : 26 }), m: M.leafSpray },
    treeB: { g: canopy(r, { clumps: 5, spread: 2.8, rad: 1.35, y0: 3.3, card: 1.65, per: lite ? 14 : 26 }), m: M.leafSpray },
    treeTrunk: { g: trunkGeo(3.9, 0.2, 0.13, 0.1, 4, r), m: M.bark },
    bush: { g: canopy(r, { clumps: 5, spread: 0.8, rad: 0.42, y0: 0.3, card: 0.5, per: lite ? 10 : 18 }), m: M.leafSpray },
    jasmine: { g: canopy(r, { clumps: 5, spread: 0.9, rad: 0.45, y0: 0.32, card: 0.55, per: lite ? 10 : 18 }), m: M.bloom },
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
      let kind = mix[(r() * mix.length) | 0];
      if (kind === 'fern' && r() < 0.35) kind = 'philo';
      else if (kind === 'banana' && r() < 0.45) kind = 'bird';
      else if (kind === 'bush' && r() < 0.5) kind = 'jasmine';
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
  // --- borders along the inside of the boundary wall: a mulched bed, tall plants behind, low in front ---
  const m = 0.8;
  const bw = 1.9;
  const gz0 = P.GATE.z0 - 0.4;
  const gz1 = P.GATE.z1 + 0.4;
  const beds = [
    [pl.minX, pl.maxX, pl.maxZ - bw, pl.maxZ],
    [pl.minX, pl.maxX, pl.minZ, pl.minZ + bw],
    [pl.maxX - bw, pl.maxX, pl.minZ + bw, pl.maxZ - bw],
    [pl.minX, pl.minX + bw, gz1, pl.maxZ - bw],
    [pl.minX, pl.minX + bw, pl.minZ + bw, gz0],
  ];
  for (const [x0, x1, z0, z1] of beds) B.site.box(M.soil, x0, x1, 0, 0.025, z0, z1);
  ctx.beds = beds;
  const tall = ['fern', 'banana', 'banana', 'bush', 'spike', 'fern'];
  const low = ['agave', 'fern', 'spike', 'agave', 'bush'];
  const k = lite ? 0.7 : 1;
  bed(pl.minX + m, pl.maxZ - m, pl.maxX - m, pl.maxZ - m, 56 * k, 0, 'site', tall, 1.15, 0.5);
  bed(pl.minX + m, pl.maxZ - 1.5, pl.maxX - m, pl.maxZ - 1.5, 70 * k, 0, 'site', low, 0.8, 0.4);
  bed(pl.minX + m, pl.minZ + m, pl.maxX - m, pl.minZ + m, 56 * k, 0, 'site', tall, 1.15, 0.5);
  bed(pl.minX + m, pl.minZ + 1.5, pl.maxX - m, pl.minZ + 1.5, 70 * k, 0, 'site', low, 0.8, 0.4);
  bed(pl.maxX - m, pl.minZ + bw, pl.maxX - m, pl.maxZ - bw, 46 * k, 0, 'site', tall, 1.15, 0.5);
  bed(pl.maxX - 1.5, pl.minZ + bw, pl.maxX - 1.5, pl.maxZ - bw, 58 * k, 0, 'site', low, 0.8, 0.4);
  bed(pl.minX + m, pl.maxZ - bw, pl.minX + m, gz1 + 0.6, 32 * k, 0, 'site', tall, 1.15, 0.5);
  bed(pl.minX + 1.5, pl.maxZ - bw, pl.minX + 1.5, gz1 + 0.6, 40 * k, 0, 'site', low, 0.8, 0.4);
  bed(pl.minX + m, gz0 - 0.6, pl.minX + m, pl.minZ + bw, 9 * k, 0, 'site', tall, 1.15, 0.5);
  bed(pl.minX + 1.5, gz0 - 0.6, pl.minX + 1.5, pl.minZ + bw, 11 * k, 0, 'site', low, 0.8, 0.4);

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

// ---- the lawn: real blades, but only around the visitor ----
// A square of grass tufts follows the camera. Each tuft's position wraps inside that square, so
// walking never runs out of grass and the cost stays the same anywhere on the plot. A mask of the
// plot (white = lawn) keeps blades off paving, beds, water and floors.
export function makeGrass(ctx) {
  const { M, groups } = ctx;
  const lite = ctx.opts.lite;
  const r = rng(41);
  const tile = lite ? 11 : 16; // metres across
  const count = lite ? 24000 : 72000;

  // one tuft: a few curved blades
  const pos = [];
  const col = [];
  const base = new THREE.Color('#33501c');
  const mid = new THREE.Color('#587c2e');
  const tip = new THREE.Color('#8fab4e');
  const blades = lite ? 3 : 4;
  for (let b = 0; b < blades; b++) {
    const a = (b / blades) * Math.PI * 2 + r();
    const h = 0.04 + r() * 0.035;
    const w = 0.0045 + r() * 0.003;
    const lean = 0.01 + r() * 0.022;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const ox = dx * 0.012;
    const oz = dz * 0.012;
    const v = (k, s) => [ox + dx * lean * k * k - dz * w * s * (1 - k * 0.7), h * k, oz + dz * lean * k * k + dx * w * s * (1 - k * 0.7)];
    const quad = [v(0, -1), v(0, 1), v(0.55, 1), v(0.55, -1), v(1, 0)];
    const cs = [base, base, mid, mid, tip];
    for (const i of [0, 1, 2, 0, 2, 3, 3, 2, 4]) {
      pos.push(...quad[i]);
      col.push(cs[i].r, cs[i].g, cs[i].b);
    }
  }
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute(
    'normal',
    new THREE.Float32BufferAttribute(
      new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)),
      3,
    ),
  );
  const off = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    off[i * 4] = r() * tile;
    off[i * 4 + 1] = r() * tile;
    off[i * 4 + 2] = r() * 6.283;
    off[i * 4 + 3] = 0.7 + r() * 0.55;
  }
  geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4));
  geo.instanceCount = count;

  // lawn mask over the plot and a margin around it
  const pl = P.PLOT;
  const pad = 4;
  const x0 = pl.minX - pad;
  const z0 = pl.minZ - pad;
  const W = pl.maxX - pl.minX + pad * 2;
  const D = pl.maxZ - pl.minZ + pad * 2;
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, S, S);
  g.fillStyle = '#000';
  const cut = (minX, maxX, minZ, maxZ, grow = 0.04) =>
    g.fillRect(
      ((minX - grow - x0) / W) * S,
      ((minZ - grow - z0) / D) * S,
      ((maxX - minX + grow * 2) / W) * S,
      ((maxZ - minZ + grow * 2) / D) * S,
    );
  const pcut = (a, b, cc, d) => {
    const q = P.rect(a, b, cc, d);
    cut(q.minX, q.maxX, q.minZ, q.maxZ);
  };
  pcut(342.2, 77.2, 514, 332); // house, decks and wing steps
  pcut(452, 164.7, 517.7, 245.5); // sunken seat and pool
  pcut(517.7, 176, 529.2, 234); // pool steps
  pcut(320.8, 172.6, 343, 233.4); // entrance steps
  pcut(372, 333.4, 461.1, 347.5); // outside stair
  pcut(432.4, 64.9, 465.6, 77.2); // window bays
  pcut(428.4, 332, 459.6, 344.1);
  const gate = P.GATE;
  cut(pl.minX - 6, 3.4, gate.z0, gate.z1); // drive
  cut(-3.2, 3.4, gate.z1, Z(320.8));
  for (const py of [106, 303])
    for (let i = 0; i < 6; i++) cut(X(py) - 0.9, X(py) + 0.9, Z(516) + 0.35 + i * 0.95, Z(516) + 1.0 + i * 0.95, 0.01);
  const pv = P.PAVILION;
  cut(pv.minX - 0.75, pv.maxX, pv.minZ, pv.maxZ);
  for (const [bx0, bx1, bz0, bz1] of ctx.beds || []) cut(bx0, bx1, bz0, bz1, 0);
  // boundary wall
  cut(pl.minX - 0.2, pl.maxX + 0.2, pl.minZ - 0.2, pl.minZ, 0.02);
  cut(pl.minX - 0.2, pl.maxX + 0.2, pl.maxZ, pl.maxZ + 0.2, 0.02);
  cut(pl.maxX, pl.maxX + 0.2, pl.minZ, pl.maxZ, 0.02);
  cut(pl.minX - 0.2, pl.minX, pl.minZ, pl.maxZ, 0.02);
  const mask = new THREE.CanvasTexture(c);
  mask.flipY = false;
  mask.generateMipmaps = false;
  mask.minFilter = mask.magFilter = THREE.LinearFilter;

  const uniforms = {
    uCam: { value: new THREE.Vector2() },
    uTile: { value: tile },
    uMask: { value: mask },
    uPlot: { value: new THREE.Vector4(x0, z0, W, D) },
    uWind: M.wind,
  };
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.7, envMapIntensity: 0.3 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec4 aOff;
        uniform vec2 uCam; uniform float uTile; uniform float uWind; uniform sampler2D uMask; uniform vec4 uPlot;`,
      )
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);')
      .replace(
        '#include <color_vertex>',
        `#include <color_vertex>
        float tone = fract(sin(dot(aOff.xy, vec2(12.9898, 78.233))) * 43758.5453);
        vColor.rgb *= 0.78 + 0.44 * tone;
        vColor.r *= 0.9 + 0.35 * fract(tone * 7.3);`,
      )
      .replace(
        '#include <begin_vertex>',
        `// wrap the tuft into the square around the camera
        vec2 root = mod(aOff.xy - uCam + uTile * 0.5, uTile) - uTile * 0.5 + uCam;
        float far = distance(root, uCam);
        float lawn = step(0.5, texture2D(uMask, (root - uPlot.xy) / uPlot.zw).r);
        float grow = aOff.w * lawn * (1.0 - smoothstep(uTile * 0.3, uTile * 0.48, far));
        float cs = cos(aOff.z), sn = sin(aOff.z);
        vec3 p = vec3(position.x * cs - position.z * sn, position.y, position.x * sn + position.z * cs) * grow;
        // gusts cross the lawn as moving bands; blades bend most at the tip
        float gust = sin(uWind * 1.4 + root.x * 0.9 + root.y * 0.55) * 0.6 + sin(uWind * 3.1 - root.x * 2.3 + root.y * 1.9) * 0.25 + sin(uWind * 6.0 + aOff.z * 5.0) * 0.15;
        float k = position.y / 0.075;
        p.x += (gust + 0.3) * 0.02 * k * k * grow;
        p.z += gust * 0.012 * k * k * grow;
        vec3 transformed = vec3(root.x, 0.0, root.y) + p;`,
      );
    // both faces of a blade catch the light the same way
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <normal_fragment_begin>',
      THREE.ShaderChunk.normal_fragment_begin.replace('float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;', 'float faceDirection = 1.0;'),
    );
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  mesh.userData.noAO = true;
  groups.site.add(mesh);
  ctx.grass = { mesh, uniforms };
}
