// ILIKA tour: architecture. Walls, floors, pool court, roof terraces, jaali crown, stair, site walls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as P from './plan.js';
import { makeWater } from './materials.js';

const { U, X, Z, PLINTH, CEIL, SLAB, F1, PARAPET, UP_H, PIT } = P;

// box whose UVs are in metres, so every texture keeps its real-world scale
export function uvBox(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const s = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++)
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * s[f][0], uv.getY(k) * s[f][1]);
    }
  return g;
}

// collects geometry per material and merges it into one mesh each: few draw calls
export class Batch {
  constructor() {
    this.items = new Map();
  }
  add(mat, geo) {
    let a = this.items.get(mat);
    if (!a) this.items.set(mat, (a = []));
    a.push(geo);
    return geo;
  }
  box(mat, minX, maxX, y0, y1, minZ, maxZ) {
    const g = uvBox(maxX - minX, y1 - y0, maxZ - minZ);
    g.translate((minX + maxX) / 2, (y0 + y1) / 2, (minZ + maxZ) / 2);
    return this.add(mat, g);
  }
  // plan-rect box
  pbox(mat, r, y0, y1) {
    const q = P.rect(...r);
    return this.box(mat, q.minX, q.maxX, y0, y1, q.minZ, q.maxZ);
  }
  flush(parent, { cast = true, receive = true } = {}) {
    for (const [mat, geos] of this.items) {
      const mixed = geos.some((g) => !g.index);
      const list = mixed ? geos.map((g) => (g.index ? g.toNonIndexed() : g)) : geos;
      const g = mergeGeometries(list, false);
      list.forEach((x) => x.dispose());
      const m = new THREE.Mesh(g, mat);
      m.castShadow = cast && !mat.userData.noCast;
      m.receiveShadow = receive && !mat.userData.noCast;
      m.matrixAutoUpdate = false;
      if (mat.transparent) m.renderOrder = 2;
      parent.add(m);
    }
    this.items.clear();
  }
}

// a furniture piece: parts are placed in local space (front = +z), then turned and moved
export class Piece {
  constructor(batch, x, y, z, yaw = 0) {
    this.b = batch;
    this.m = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, y, z);
  }
  put(mat, g) {
    g.applyMatrix4(this.m);
    this.b.add(mat, g);
    return this;
  }
  box(mat, cx, y0, cz, w, h, d, ry = 0) {
    const g = uvBox(w, h, d);
    if (ry) g.rotateY(ry);
    g.translate(cx, y0 + h / 2, cz);
    return this.put(mat, g);
  }
  cyl(mat, cx, y0, cz, r, h, rTop = r, seg = 20) {
    const g = new THREE.CylinderGeometry(rTop, r, h, seg);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6.28 * r, uv.getY(i) * h);
    g.translate(cx, y0 + h / 2, cz);
    return this.put(mat, g);
  }
  ball(mat, cx, cy, cz, r, sy = 1) {
    const g = new THREE.SphereGeometry(r, 18, 12);
    g.scale(1, sy, 1);
    g.translate(cx, cy, cz);
    return this.put(mat, g);
  }
}

export function buildHouse(M, opts = {}) {
  const groups = {
    site: new THREE.Group(),
    ground: new THREE.Group(),
    slab: new THREE.Group(),
    upper: new THREE.Group(),
    crown: new THREE.Group(),
  };
  const B = { site: new Batch(), ground: new Batch(), slab: new Batch(), upper: new Batch(), crown: new Batch() };
  const col = [[], []]; // collision rectangles per level
  const ramps = [];
  const flats = [];
  const jaali = []; // brick jaali panels, instanced at the end
  const solid = (lv, r) => col[lv].push(r);
  const psolid = (lv, r) => col[lv].push(P.rect(...r));

  // ---------- walls ----------
  function wall(w, lv, batch) {
    const base = w.base ?? (lv ? F1 : PLINTH);
    const h = w.h ?? (lv ? UP_H : CEIL);
    const t = w.t * U;
    const [ma, mb] = [M[w.m[0]], M[w.m[1]]];
    const clv = w.base === 0 ? 0 : lv;
    // a run [a,b] of wall between two heights, across a given depth centred on the wall line
    const run = (a, b, y0, y1, depth, mat) => {
      if (b - a < 1e-4 || y1 - y0 < 1e-4) return;
      if (w.ax === 'x') batch.box(mat, X(b), X(a), y0, y1, Z(w.c) - depth / 2, Z(w.c) + depth / 2);
      else batch.box(mat, X(w.c) - depth / 2, X(w.c) + depth / 2, y0, y1, Z(a), Z(b));
    };
    const seg = (a, b, y0, y1) => {
      if (b - a < 1e-4 || y1 - y0 < 1e-4) return;
      if (ma === mb) return run(a, b, y0, y1, t, ma);
      if (w.ax === 'x') {
        batch.box(ma, X(b), X(a), y0, y1, Z(w.c) - t / 2, Z(w.c));
        batch.box(mb, X(b), X(a), y0, y1, Z(w.c), Z(w.c) + t / 2);
      } else {
        // lower plan y is higher world X
        batch.box(ma, X(w.c), X(w.c) + t / 2, y0, y1, Z(a), Z(b));
        batch.box(mb, X(w.c) - t / 2, X(w.c), y0, y1, Z(a), Z(b));
      }
    };
    const foot = (a, b) =>
      w.ax === 'x'
        ? { minX: X(b), maxX: X(a), minZ: Z(w.c) - t / 2, maxZ: Z(w.c) + t / 2 }
        : { minX: X(w.c) - t / 2, maxX: X(w.c) + t / 2, minZ: Z(a), maxZ: Z(b) };

    let cur = w.a;
    const ops = [...(w.op || [])].sort((p, q) => p.a - q.a);
    for (const o of ops) {
      const sill = o.sill ?? 0;
      const head = Math.min(o.head ?? 2.25, h);
      if (o.a > cur) {
        seg(cur, o.a, base, base + h);
        solid(clv, foot(cur, o.a));
      }
      seg(o.a, o.b, base, base + sill);
      seg(o.a, o.b, base + head, base + h);
      const y0 = base + sill;
      const y1 = base + head;
      const f = 0.05 / U; // frame member, in plan units
      if (o.kind === 'glass') {
        run(o.a, o.b, y0, y1, 0.016, M.glass);
        run(o.a, o.a + f, y0, y1, 0.07, M.timberDark);
        run(o.b - f, o.b, y0, y1, 0.07, M.timberDark);
        run(o.a, o.b, y1 - 0.05, y1, 0.07, M.timberDark);
        run(o.a, o.b, y0, y0 + 0.04, 0.07, M.timberDark);
        const n = Math.round(((o.b - o.a) * U) / 1.15);
        for (let i = 1; i < n; i++) {
          const c = o.a + ((o.b - o.a) * i) / n;
          run(c - f / 2, c + f / 2, y0, y1, 0.06, M.timberDark);
        }
        solid(clv, foot(o.a, o.b));
      } else if (o.kind === 'door') {
        run(o.a - f * 0.2, o.a + f * 0.8, y0, y1, t + 0.03, M.timber);
        run(o.b - f * 0.8, o.b + f * 0.2, y0, y1, t + 0.03, M.timber);
        run(o.a, o.b, y1 - 0.04, y1 + 0.02, t + 0.03, M.timber);
      } else if (o.kind === 'niche') {
        solid(clv, foot(o.a, o.b));
      } else if (o.kind === 'jaali') {
        jaali.push({ ax: w.ax, c: w.c, a: o.a, b: o.b, y0, y1 });
        solid(clv, foot(o.a, o.b));
      }
      cur = o.b;
    }
    if (w.b > cur) {
      seg(cur, w.b, base, base + h);
      solid(clv, foot(cur, w.b));
    }
  }

  // window-seat bays on the two end walls (French windows 18 and 4)
  const bayWalls = [];
  for (const [x0, x1, yIn, yOut] of [
    [433, 464, 77.2, 65.5],
    [429, 459, 332, 343.5],
  ]) {
    const lo = Math.min(yIn, yOut);
    const hi = Math.max(yIn, yOut);
    const out = yOut < yIn;
    bayWalls.push(
      {
        ax: 'y',
        c: yOut,
        a: x0 - 0.6,
        b: x1 + 0.6,
        t: 1.3,
        m: ['terra', 'terra'],
        h: 2.6,
        op: [{ a: x0 + 1, b: x1 - 1, kind: 'glass', sill: 0.45, head: 2.3 }],
      },
      {
        ax: 'x',
        c: x0,
        a: lo,
        b: hi,
        t: 1.3,
        m: ['terra', 'ivory'],
        h: 2.6,
        op: [{ a: lo + 1.5, b: hi - 1.5, kind: 'glass', sill: 0.45, head: 2.3 }],
      },
      {
        ax: 'x',
        c: x1,
        a: lo,
        b: hi,
        t: 1.3,
        m: ['ivory', 'terra'],
        h: 2.6,
        op: [{ a: lo + 1.5, b: hi - 1.5, kind: 'glass', sill: 0.45, head: 2.3 }],
      },
    );
    const r = [x0 - 0.6, lo - (out ? 0.6 : 0), x1 + 0.6, hi + (out ? 0 : 0.6)];
    B.ground.pbox(M.terra, r, -0.05, PLINTH - 0.03);
    B.ground.pbox(M.stone, r, PLINTH - 0.03, PLINTH);
    B.ground.pbox(M.terra, [r[0] - 1, r[1] - (out ? 1 : 0), r[2] + 1, r[3] + (out ? 0 : 1)], PLINTH + 2.6, PLINTH + 2.75);
    // seat and cushion
    B.ground.pbox(M.ivory, [x0 + 1, lo + 1, x1 - 1, hi - 1], PLINTH, PLINTH + 0.4);
    B.ground.pbox(M.linen, [x0 + 2, lo + 1.5, x1 - 2, hi - 1.5], PLINTH + 0.4, PLINTH + 0.5);
  }

  for (const w of [...P.WALLS, ...bayWalls]) wall(w, 0, B.ground);
  for (const w of P.WALLS_UP) wall(w, 1, B.upper);

  for (const [px, py] of P.COLUMNS) {
    const r = [px - 1.8, py - 1.8, px + 1.8, py + 1.8];
    B.ground.pbox(M.terra, r, 0, PLINTH + CEIL);
    psolid(0, r);
  }
  for (const [px, py] of [
    [362, 152.5],
    [429, 152.5],
    [362, 255],
    [429, 255],
  ])
    B.upper.pbox(M.terra, [px - 1.8, py - 1.8, px + 1.8, py + 1.8], F1, F1 + UP_H);

  // ---------- plinth and ground-floor finishes ----------
  const top = PLINTH - 0.03;
  for (const r of [
    [360.7, 77.2, 452, 332],
    [452, 77.2, 502, 164.7],
    [452, 245.5, 502, 332],
    [350.2, 134.4, 360.7, 171.3],
    [350.2, 234.8, 360.7, 275.9],
    [331, 172.6, 360.7, 233.4],
  ])
    B.ground.pbox(M.terra, r, -0.05, top);
  for (const r of [
    [362, 78.5, 484.5, 134.4],
    [362, 275.9, 484.5, 330.7],
    [362, 134.4, 429, 275.9],
    [351.5, 134.4, 362, 171.3],
    [351.5, 234.8, 362, 275.9],
  ])
    B.ground.pbox(M.stone, r, top, PLINTH);
  for (const r of [
    [363.3, 102.7, 413, 133.1],
    [363.3, 299.7, 413, 329.4],
  ])
    B.ground.pbox(M.bathStone, r, PLINTH, PLINTH + 0.006);
  for (const r of [
    [429, 134.4, 452, 151],
    [429, 258.5, 452, 275.9],
  ])
    B.ground.pbox(M.bathStone, r, top, PLINTH);
  for (const r of [
    [429, 151, 452, 258.5],
    [452, 134.4, 502, 164.7],
    [452, 245.5, 502, 275.9],
    [484.5, 77.2, 502, 134.4],
    [484.5, 275.9, 502, 332],
    [331, 172.6, 362, 233.4],
  ])
    B.ground.pbox(M.deck, r, top, PLINTH);
  flats.push({ ...P.rect(331, 172.6, 362, 233.4), h: PLINTH }, { ...P.rect(350.2, 77.2, 502, 332), h: PLINTH });

  // steps down to the lawn in front of both bedroom wings
  const led = (r, y) => B.ground.pbox(M.led, r, y - 0.03, y - 0.012);
  for (const [y0, y1] of [
    [77.2, 164.7],
    [245.5, 332],
  ]) {
    for (let i = 0; i < 3; i++) B.ground.pbox(M.deck, [502 + i * 3.9, y0, 502 + (i + 1) * 3.9, y1], -0.05, PLINTH - (i + 1) * 0.15);
    ramps.push({ ...P.rect(502, y0, 513.7, y1), axis: 'z', h0: PLINTH, h1: 0 });
  }
  // entrance steps with a warm strip under each nosing
  for (let i = 0; i < 3; i++) {
    const x1 = 331 - i * 3.4;
    B.ground.pbox(M.deck, [x1 - 3.4, 172.6, x1, 233.4], -0.05, PLINTH - (i + 1) * 0.15);
    led([x1 - 0.25, 173.5, x1 + 0.1, 232.5], PLINTH - i * 0.15);
  }
  ramps.push({ ...P.rect(320.8, 172.6, 331, 233.4), axis: 'z', h0: 0, h1: PLINTH });

  // ---------- pool and sunken sitting ----------
  const pool = [474.6, 164.7, 517.7, 245.5];
  const cw = 3.4; // coping width
  for (const r of [
    [pool[0], pool[1], pool[2], pool[1] + cw],
    [pool[0], pool[3] - cw, pool[2], pool[3]],
    [pool[0], pool[1] + cw, pool[0] + cw, pool[3] - cw],
    [pool[2] - cw, pool[1] + cw, pool[2], pool[3] - cw],
  ])
    B.ground.pbox(M.coping, r, -0.95, PLINTH);
  B.ground.pbox(M.pool, [pool[0] + cw, pool[1] + cw, pool[2] - cw, pool[3] - cw], -0.95, -0.9);
  psolid(0, [pool[0] + 0.6, pool[1] + 0.6, pool[2], pool[3] - 0.6]);
  const pr = P.rect(pool[0] + cw, pool[1] + cw, pool[2] - cw, pool[3] - cw);
  const water = makeWater(pr.maxX - pr.minX, pr.maxZ - pr.minZ);
  water.position.set((pr.minX + pr.maxX) / 2, PLINTH - 0.1, (pr.minZ + pr.maxZ) / 2);
  water.rotation.z = 0;
  groups.ground.add(water);
  // garden-side steps up to the pool edge, as in the pool render
  for (let i = 0; i < 3; i++) {
    B.ground.pbox(M.coping, [517.7 + i * 3.8, 176, 517.7 + (i + 1) * 3.8, 234], -0.05, PLINTH - (i + 1) * 0.15);
    led([517.7 + i * 3.8 - 0.1, 177, 517.7 + i * 3.8 + 0.25, 233], PLINTH - i * 0.15);
  }
  ramps.push({ ...P.rect(517.7, 176, 529.1, 234), axis: 'z', h0: PLINTH, h1: 0 });

  // sunken sitting 19: planters at both ends, seats on three sides, floor 450 mm down
  for (const r of [
    [452, 164.7, 474.6, 172],
    [452, 238, 474.6, 245.5],
  ]) {
    B.ground.pbox(M.coping, r, -0.05, PLINTH + 0.32);
    B.ground.pbox(M.soil, [r[0] + 1, r[1] + 1, r[2] - 1, r[3] - 1], PLINTH + 0.32, PLINTH + 0.34);
    psolid(0, r);
  }
  for (const r of [
    [452, 172, 460, 201],
    [452, 213, 460, 238],
    [460, 172, 474.6, 180],
    [460, 230, 474.6, 238],
  ]) {
    B.ground.pbox(M.coping, r, -0.05, PLINTH);
    psolid(0, r);
  }
  B.ground.pbox(M.coping, [460, 180, 473.4, 230], -0.05, PIT - 0.03);
  B.ground.pbox(M.deck, [460, 180, 473.4, 230], PIT - 0.03, PIT);
  B.ground.pbox(M.coping, [473.4, 180, 474.6, 230], -0.05, PLINTH);
  psolid(0, [473.2, 180, 474.6, 230]);
  B.ground.pbox(M.coping, [452, 201, 454.7, 213], -0.05, PLINTH - 0.15);
  B.ground.pbox(M.coping, [454.7, 201, 457.3, 213], -0.05, PLINTH - 0.3);
  B.ground.pbox(M.coping, [457.3, 201, 460, 213], -0.05, PIT);
  ramps.push({ ...P.rect(452, 201, 457.3, 213), axis: 'z', h0: PLINTH, h1: PIT });
  flats.unshift({ ...P.rect(457.3, 180, 473.4, 230), h: PIT });

  // planted jaali courts behind the entrance screens
  for (const r of [
    [344.8, 79.8, 360.7, 133.1],
    [344.8, 277.2, 360.7, 329.4],
    [344.8, 135.7, 350.2, 170],
    [344.8, 236, 350.2, 274.6],
  ]) {
    B.ground.pbox(M.soil, r, -0.05, 0.3);
    psolid(0, r);
  }
  // roofs over the three entrance bays
  for (const r of [
    [350.2, 133.1, 362, 172.6],
    [350.2, 233.5, 362, 277.2],
  ]) {
    B.ground.pbox(M.ceiling, r, PLINTH + CEIL, PLINTH + CEIL + 0.05);
    B.ground.pbox(M.terra, r, PLINTH + CEIL + 0.05, PLINTH + CEIL + 0.3);
  }
  // brick jaali flanks on the store walls facing the pool, as in the pool render
  jaali.push({ ax: 'x', c: 439.2, a: 154, b: 173.5, y0: PLINTH + 0.3, y1: PLINTH + 2.7, thin: true });
  jaali.push({ ax: 'x', c: 439.2, a: 237, b: 256.5, y0: PLINTH + 0.3, y1: PLINTH + 2.7, thin: true });

  // ---------- first-floor slab, terraces and parapets ----------
  const c0 = PLINTH + CEIL;
  // keep the slab edge just inside the outer wall faces
  const inset = (r) => [Math.max(r[0], 361), Math.max(r[1], 77.6), Math.min(r[2], 485.4), Math.min(r[3], 331.6)];
  for (const r of P.ROOF) B.slab.pbox(M.ceiling, inset(r), c0, c0 + 0.08);
  for (const r of [P.ROOF[0], P.ROOF[1], P.ROOF[2], [362, 135.5, 430, 152.5], [362, 255, 430, 276], P.ROOF[4], P.ROOF[5], P.ROOF[6]])
    B.slab.pbox(M.deck, inset(r), c0 + 0.08, F1);
  B.slab.pbox(M.stone, [362, 152.5, 430, 255], c0 + 0.08, F1);
  B.slab.pbox(M.bathStone, [363.3, 232.7, 414.8, 253.7], F1, F1 + 0.006);
  const pt = 2.6; // same 9 inch thickness as the walls below
  for (const [ax, c, ...v] of P.PARAPETS)
    for (let i = 0; i < v.length; i += 2) {
      const r = ax === 'x' ? [c - pt / 2, v[i], c + pt / 2, v[i + 1]] : [v[i], c - pt / 2, v[i + 1], c + pt / 2];
      B.slab.pbox(M.terra, r, c0, F1 + PARAPET);
      psolid(1, r);
    }
  // slab edge under the multi room walls
  B.slab.pbox(M.terra, [360.7, 151.2, 363.3, 256.3], c0, F1);
  B.slab.pbox(M.terra, [427.7, 175.5, 430.3, 235.5], c0, F1);
  // planted canopy over the walk between hall and pool
  B.slab.pbox(M.ceiling, [430.3, 176.2, 447, 234.8], c0 - 0.06, c0 - 0.02);
  B.slab.pbox(M.terra, [430.3, 176.2, 447, 234.8], c0 - 0.02, c0 + 0.12);
  B.slab.pbox(M.timber, [446.4, 175.5, 448.6, 235.5], c0 - 0.24, c0 + 0.02);
  B.slab.pbox(M.terra, [441, 176.2, 447, 234.8], c0 + 0.12, c0 + 0.42);
  B.slab.pbox(M.soil, [441.8, 177, 446.2, 234], c0 + 0.42, c0 + 0.44);

  // ---------- jaali crown over the multi room ----------
  const cr = [352, 141, 439, 266]; // plan footprint: overhangs the room on all four sides
  const yA = F1 + UP_H; // roof slab
  B.crown.pbox(M.ceiling, cr, yA, yA + 0.06);
  B.crown.pbox(M.deep, cr, yA + 0.06, yA + 0.2);
  const j0 = F1 + UP_H - 0.3;
  const j1 = F1 + UP_H + 1.5;
  const q = P.rect(...cr);
  const bar = 0.045;
  const cell = 0.17;
  const dth = 0.09;
  const ring = (y0, y1, mat, d = 0.14) => {
    B.crown.box(mat, q.minX, q.maxX, y0, y1, q.minZ, q.minZ + d);
    B.crown.box(mat, q.minX, q.maxX, y0, y1, q.maxZ - d, q.maxZ);
    B.crown.box(mat, q.minX, q.minX + d, y0, y1, q.minZ + d, q.maxZ - d);
    B.crown.box(mat, q.maxX - d, q.maxX, y0, y1, q.minZ + d, q.maxZ - d);
  };
  ring(j0 - 0.08, j0, M.deep);
  ring(j1, j1 + 0.1, M.deep);
  // posts every 1.2 m, then the square lattice between them
  const lattice = (a0, a1, fixed, along) => {
    const len = a1 - a0;
    const nP = Math.round(len / 1.2);
    for (let i = 0; i <= nP; i++) {
      const a = a0 + (len * i) / nP;
      if (along === 'x') B.crown.box(M.deep, a - 0.04, a + 0.04, j0, j1, fixed - 0.07, fixed + 0.07);
      else B.crown.box(M.deep, fixed - 0.07, fixed + 0.07, j0, j1, a - 0.04, a + 0.04);
    }
    const nV = Math.round(len / cell);
    for (let i = 1; i < nV; i++) {
      const a = a0 + (len * i) / nV;
      if (along === 'x') B.crown.box(M.jaali, a - bar / 2, a + bar / 2, j0, j1, fixed - dth / 2, fixed + dth / 2);
      else B.crown.box(M.jaali, fixed - dth / 2, fixed + dth / 2, j0, j1, a - bar / 2, a + bar / 2);
    }
    const nH = Math.round((j1 - j0) / cell);
    for (let i = 1; i < nH; i++) {
      const y = j0 + ((j1 - j0) * i) / nH;
      if (along === 'x') B.crown.box(M.jaali, a0, a1, y - bar / 2, y + bar / 2, fixed - dth / 2, fixed + dth / 2);
      else B.crown.box(M.jaali, fixed - dth / 2, fixed + dth / 2, y - bar / 2, y + bar / 2, a0, a1);
    }
  };
  lattice(q.minX, q.maxX, q.minZ + 0.07, 'x');
  lattice(q.minX, q.maxX, q.maxZ - 0.07, 'x');
  lattice(q.minZ, q.maxZ, q.minX + 0.07, 'z');
  lattice(q.minZ, q.maxZ, q.maxX - 0.07, 'z');

  // ---------- outside stair to the terrace (drawn on both plans, risers not dimensioned) ----------
  const nR = 22;
  const rise = F1 / nR;
  const going = (440 - 372) / (nR - 1);
  for (let i = 0; i < nR - 1; i++) {
    const x0 = 372 + i * going;
    const y = (i + 1) * rise;
    B.site.pbox(M.terra, [x0, 333.4, x0 + going, 347.5], 0, y - 0.03);
    B.site.pbox(M.deck, [x0, 333.4, x0 + going, 346.4], y - 0.03, y);
    B.site.pbox(M.terra, [x0, 346.4, x0 + going, 347.5], y - 0.03, y + 0.95);
  }
  B.site.pbox(M.terra, [440, 332, 460, 347.5], F1 - 0.2, F1 - 0.03);
  B.site.pbox(M.deck, [440, 332, 460, 346.4], F1 - 0.03, F1);
  B.site.pbox(M.terra, [440, 346.4, 461.1, 347.5], F1 - 0.03, F1 + 0.95);
  B.site.pbox(M.terra, [460, 332, 461.1, 346.4], F1 - 0.03, F1 + 0.95);
  B.site.pbox(M.terra, [458.6, 345, 461.1, 347.5], 0, F1 - 0.2);
  psolid(0, [372, 333.4, 440, 347.5]);
  psolid(0, [458.6, 345, 461.1, 347.5]);

  // ---------- entrance pergola ----------
  const pg = PLINTH + 2.75;
  for (const py of [174.2, 231.8]) {
    B.site.pbox(M.timber, [331.5, py - 1, 333.5, py + 1], PLINTH, pg);
    psolid(0, [331.3, py - 1.2, 333.7, py + 1.2]);
  }
  B.site.pbox(M.timber, [331.3, 171.5, 333.7, 234.5], pg, pg + 0.24);
  B.site.pbox(M.timber, [345, 172.6, 347, 233.4], pg, pg + 0.24);
  for (let py = 174; py < 233; py += 4.4) B.site.pbox(M.timber, [330, py - 0.35, 361, py + 0.35], pg + 0.24, pg + 0.38);

  // ---------- lawn, drive, boundary ----------
  const hole = P.rect(452, 164.7, 517.7, 245.5);
  const far = 170;
  B.site.box(M.grass, -far, far, -0.4, 0, -far, hole.minZ);
  B.site.box(M.grass, -far, far, -0.4, 0, hole.maxZ, far);
  B.site.box(M.grass, -far, hole.minX, -0.4, 0, hole.minZ, hole.maxZ);
  B.site.box(M.grass, hole.maxX, far, -0.4, 0, hole.minZ, hole.maxZ);
  const g = P.GATE;
  B.site.box(M.brick, P.PLOT.minX - 6, 3.4, 0, 0.02, g.z0, g.z1);
  B.site.box(M.brick, -3.2, 3.4, 0, 0.02, g.z1, Z(320.8));
  // stepping stones from the lawn to each wing, as in the pool render
  for (const py of [106, 303])
    for (let i = 0; i < 6; i++) B.site.box(M.sand, X(py) - 0.9, X(py) + 0.9, 0, 0.03, Z(516) + 0.35 + i * 0.95, Z(516) + 1.0 + i * 0.95);
  const pl = P.PLOT;
  const bw = 0.2;
  const bh = 1.9;
  const fence = (minX, maxX, minZ, maxZ) => {
    B.site.box(M.sand, minX, maxX, 0, bh, minZ, maxZ);
    B.site.box(M.terra, minX - 0.03, maxX + 0.03, bh, bh + 0.08, minZ - 0.03, maxZ + 0.03);
    solid(0, { minX, maxX, minZ, maxZ });
  };
  fence(pl.minX, pl.maxX, pl.minZ - bw, pl.minZ);
  fence(pl.minX, pl.maxX, pl.maxZ, pl.maxZ + bw);
  fence(pl.maxX, pl.maxX + bw, pl.minZ, pl.maxZ);
  fence(pl.minX - bw, pl.minX, pl.minZ, g.z0);
  fence(pl.minX - bw, pl.minX, g.z1, pl.maxZ);
  for (const z of [g.z0, g.z1]) B.site.box(M.terra, pl.minX - 0.4, pl.minX + 0.2, 0, 2.4, z - 0.3, z + 0.3);
  // gate leaves, open inward
  for (const [z, s] of [
    [g.z0 + 0.3, 1],
    [g.z1 - 0.3, -1],
  ])
    for (let i = 0; i < 12; i++)
      B.site.box(M.timberDark, pl.minX + 0.2 + i * 0.17, pl.minX + 0.31 + i * 0.17, 0.12, 1.75, z - 0.03 * s, z + 0.03 * s);
  solid(0, { minX: pl.minX - 8, maxX: pl.minX - 5.5, minZ: g.z0 - 2, maxZ: g.z1 + 2 }); // the lane beyond the gate is not modelled

  // ---------- garden pavilion ----------
  const pv = P.PAVILION;
  const pvB = B.site;
  pvB.box(M.sand, pv.minX, pv.maxX, -0.05, pv.h - 0.03, pv.minZ, pv.maxZ);
  pvB.box(M.deck, pv.minX, pv.maxX, pv.h - 0.03, pv.h, pv.minZ, pv.maxZ);
  const pz = (pv.minZ + pv.maxZ) / 2;
  for (let i = 0; i < 2; i++) {
    pvB.box(M.sand, pv.minX - (i + 1) * 0.36, pv.minX - i * 0.36, -0.05, pv.h - (i + 1) * 0.15, pz - 1.7, pz + 1.7);
    pvB.box(
      M.led,
      pv.minX - i * 0.36 - 0.03,
      pv.minX - i * 0.36 + 0.01,
      pv.h - i * 0.15 - 0.03,
      pv.h - i * 0.15 - 0.012,
      pz - 1.6,
      pz + 1.6,
    );
  }
  ramps.push({ minX: pv.minX - 0.75, maxX: pv.minX, minZ: pz - 1.7, maxZ: pz + 1.7, axis: 'x', h0: 0, h1: pv.h });
  flats.unshift({ minX: pv.minX, maxX: pv.maxX, minZ: pv.minZ, maxZ: pv.maxZ, h: pv.h });
  const ph = pv.h + 2.75;
  for (const cx of [pv.minX + 0.4, pv.maxX - 0.4])
    for (const cz of [pv.minZ + 0.4, pv.maxZ - 0.4]) {
      pvB.box(M.sand, cx - 0.27, cx + 0.27, pv.h, pv.h + 0.7, cz - 0.27, cz + 0.27);
      pvB.box(M.timber, cx - 0.11, cx + 0.11, pv.h + 0.7, ph, cz - 0.11, cz + 0.11);
      solid(0, { minX: cx - 0.27, maxX: cx + 0.27, minZ: cz - 0.27, maxZ: cz + 0.27 });
    }
  for (const cz of [pv.minZ + 0.4, pv.maxZ - 0.4]) pvB.box(M.timber, pv.minX, pv.maxX, ph, ph + 0.26, cz - 0.08, cz + 0.08);
  for (const cx of [pv.minX + 0.4, pv.maxX - 0.4]) pvB.box(M.timber, cx - 0.08, cx + 0.08, ph, ph + 0.26, pv.minZ, pv.maxZ);
  for (let x = pv.minX + 0.1; x < pv.maxX; x += 0.3)
    pvB.box(M.timberPale, x - 0.025, x + 0.025, ph + 0.26, ph + 0.36, pv.minZ - 0.25, pv.maxZ + 0.25);
  // the edges of the platform that have no steps are planted, so nobody walks off them
  solid(0, { minX: pv.minX - 0.5, maxX: pv.minX, minZ: pv.minZ, maxZ: pz - 1.7 });
  solid(0, { minX: pv.minX - 0.5, maxX: pv.minX, minZ: pz + 1.7, maxZ: pv.maxZ });
  solid(0, { minX: pv.minX, maxX: pv.maxX, minZ: pv.maxZ, maxZ: pv.maxZ + 0.5 });
  solid(0, { minX: pv.minX, maxX: pv.maxX, minZ: pv.minZ - 0.5, maxZ: pv.minZ });
  solid(0, { minX: pv.maxX, maxX: pv.maxX + 0.5, minZ: pv.minZ, maxZ: pv.maxZ });

  // ---------- brick jaali: one instanced mesh ----------
  const bl = 0.22;
  const bhh = 0.072;
  const pitch = 0.33;
  const mats = [];
  const mtx = new THREE.Matrix4();
  for (const j of jaali) {
    const len = (j.b - j.a) * U;
    const rows = Math.floor((j.y1 - j.y0) / bhh);
    const n = Math.floor(len / pitch);
    const pad = (len - n * pitch) / 2;
    for (let r = 0; r < rows; r++)
      for (let i = 0; i <= n; i++) {
        const s = pad + i * pitch + (r % 2 ? pitch / 2 : 0);
        if (s > len - 0.02 || s < 0.02) continue;
        const y = j.y0 + (r + 0.5) * bhh;
        if (j.ax === 'x') mtx.makeTranslation(X(j.a) - s, y, Z(j.c));
        else mtx.makeRotationY(Math.PI / 2).setPosition(X(j.c), y, Z(j.a) + s);
        mats.push(mtx.clone());
      }
  }
  const bricks = new THREE.InstancedMesh(new THREE.BoxGeometry(bl, bhh, 0.105), M.jaaliBrick, mats.length);
  mats.forEach((m, i) => bricks.setMatrixAt(i, m));
  bricks.castShadow = bricks.receiveShadow = true;
  groups.ground.add(bricks);

  const ctx = { M, B, groups, col, ramps, flats, solid, psolid, water, opts };
  return ctx;
}

export function finish(ctx) {
  for (const k of Object.keys(ctx.B)) ctx.B[k].flush(ctx.groups[k]);
}

// walking height at a point
export function heightAt(ctx, lv, x, z) {
  if (lv === 1) return F1;
  for (const r of ctx.ramps)
    if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) {
      const k = r.axis === 'x' ? (x - r.minX) / (r.maxX - r.minX) : (z - r.minZ) / (r.maxZ - r.minZ);
      return r.h0 + (r.h1 - r.h0) * k;
    }
  for (const f of ctx.flats) if (x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ) return f.h;
  return 0;
}
