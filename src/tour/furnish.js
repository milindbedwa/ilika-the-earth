// ILIKA tour: interiors and outdoor furniture.
// Positions follow the furniture drawn on the ground-floor plan (beds, sofa, dining table, island,
// counters, tubs, vanities). Everything about how those pieces look is a design proposal.
import * as THREE from 'three';
import * as P from './plan.js';
import { Piece } from './build.js';
import { potGeo } from './garden.js';
import { rng } from './materials.js';

const { X, Z, U, PLINTH, CEIL, F1, UP_H, PIT } = P;
// yaw so that a piece's front (+z) faces a plan direction
const PX = 0; // toward the pool
const NX = Math.PI; // toward the entrance
const NY = Math.PI / 2; // toward plan-up (bedroom 17 end)
const PY = -Math.PI / 2; // toward plan-down (bedroom 1 end)

export function furnish(ctx) {
  const { M, B, solid, psolid, plant } = ctx;
  const r = rng(11);
  const lamps = [];
  M.mirror = new THREE.MeshStandardMaterial({ color: '#e6e8e3', roughness: 0.05, metalness: 1 });
  const cush = [M.linenWarm, M.linenClay, M.linenOlive, M.linen];

  const pc = (b, px, py, y, yaw) => new Piece(b, X(py), y, Z(px), yaw);
  // collision footprint of a w x d piece at plan (px, py)
  const foot = (lv, px, py, w, d, yaw = 0) => {
    const q = Math.abs(Math.sin(yaw)) > 0.5;
    const hw = (q ? d : w) / 2;
    const hd = (q ? w : d) / 2;
    solid(lv, { minX: X(py) - hw, maxX: X(py) + hw, minZ: Z(px) - hd, maxZ: Z(px) + hd });
  };
  // soft contact shadow under a piece
  const blob = (b, px, py, y, w, d, yaw = 0) => {
    const g = new THREE.PlaneGeometry(w * 1.5, d * 1.5);
    g.rotateX(-Math.PI / 2);
    g.rotateY(yaw);
    g.translate(X(py), y + 0.014, Z(px));
    b.add(M.shadow, g);
  };
  const light = (px, py, y, power = 1, dist = 9) => lamps.push({ x: X(py), y, z: Z(px), power, dist });

  // ---------- pieces ----------
  function sofa(b, px, py, y, yaw, len = 2.3) {
    const p = pc(b, px, py, y, yaw);
    p.box(M.timber, 0, 0.04, 0, len, 0.1, 0.92);
    p.box(M.linen, 0, 0.14, 0.04, len - 0.04, 0.26, 0.84);
    p.box(M.linen, 0, 0.14, -0.36, len, 0.62, 0.2);
    p.box(M.linen, -len / 2 + 0.1, 0.14, 0, 0.2, 0.44, 0.92);
    p.box(M.linen, len / 2 - 0.1, 0.14, 0, 0.2, 0.44, 0.92);
    const n = Math.round((len - 0.4) / 0.62);
    for (let i = 0; i < n; i++) {
      const cx = -len / 2 + 0.2 + ((len - 0.4) * (i + 0.5)) / n;
      p.box(M.linen, cx, 0.4, 0.08, (len - 0.44) / n - 0.02, 0.1, 0.7);
      p.box(cush[i % 3], cx, 0.5, -0.2, 0.5, 0.42, 0.14, (r() - 0.5) * 0.2);
    }
    blob(b, px, py, y, len, 0.92, yaw);
    foot(y > 2 ? 1 : 0, px, py, len, 0.92, yaw);
  }
  function loungeChair(b, px, py, y, yaw, lv = 0) {
    const p = pc(b, px, py, y, yaw);
    for (const sx of [-0.33, 0.33]) {
      p.box(M.timber, sx, 0, 0.3, 0.05, 0.56, 0.05);
      p.box(M.timber, sx, 0, -0.32, 0.05, 0.78, 0.05);
      p.box(M.timber, sx, 0.54, 0, 0.06, 0.04, 0.72);
    }
    p.box(M.cane, 0, 0.3, 0, 0.62, 0.04, 0.62);
    p.box(M.linen, 0, 0.34, 0.02, 0.58, 0.1, 0.56);
    p.box(M.cane, 0, 0.42, -0.31, 0.62, 0.4, 0.035);
    p.box(M.linenWarm, 0, 0.44, -0.24, 0.5, 0.34, 0.1);
    blob(b, px, py, y, 0.75, 0.75, yaw);
    foot(lv, px, py, 0.74, 0.74, yaw);
  }
  function daybed(b, px, py, y, yaw, len = 1.9, lv = 0) {
    const p = pc(b, px, py, y, yaw);
    p.box(M.timber, 0, 0.16, 0, 0.72, 0.07, len);
    for (const sx of [-0.31, 0.31]) for (const sz of [-len / 2 + 0.08, len / 2 - 0.08]) p.box(M.timber, sx, 0, sz, 0.06, 0.16, 0.06);
    p.box(M.linen, 0, 0.23, 0, 0.68, 0.11, len - 0.04);
    p.box(M.linenWarm, 0, 0.34, -len / 2 + 0.24, 0.5, 0.1, 0.36);
    blob(b, px, py, y, 0.72, len, yaw);
    foot(lv, px, py, 0.72, len, yaw);
  }
  function table(b, px, py, y, yaw, w, d, h, top = M.timber, legs = M.timber, lv = 0) {
    const p = pc(b, px, py, y, yaw);
    p.box(top, 0, h - 0.05, 0, w, 0.05, d);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.box(legs, sx * (w / 2 - 0.09), 0, sz * (d / 2 - 0.09), 0.07, h - 0.05, 0.07);
    blob(b, px, py, y, w, d, yaw);
    return p;
  }
  function chair(b, px, py, y, yaw) {
    const p = pc(b, px, py, y, yaw);
    for (const sx of [-0.2, 0.2]) {
      p.box(M.timber, sx, 0, 0.2, 0.035, 0.44, 0.035);
      p.box(M.timber, sx, 0, -0.2, 0.035, 0.84, 0.035);
    }
    p.box(M.cane, 0, 0.44, 0, 0.46, 0.035, 0.46);
    p.box(M.cane, 0, 0.56, -0.2, 0.4, 0.26, 0.025);
    p.box(M.timber, 0, 0.82, -0.2, 0.44, 0.04, 0.035);
  }
  function stool(b, px, py, y, h = 0.66) {
    const p = pc(b, px, py, y, 0);
    p.cyl(M.timber, 0, h - 0.04, 0, 0.19, 0.04);
    for (const a of [0, 1, 2, 3])
      p.box(M.timber, Math.cos(a * 1.57 + 0.78) * 0.14, 0, Math.sin(a * 1.57 + 0.78) * 0.14, 0.03, h - 0.04, 0.03);
  }
  function pendant(b, px, py, yTop, drop, rad = 0.2, lit = true) {
    const p = pc(b, px, py, yTop - drop, 0);
    p.cyl(M.steel, 0, 0, 0, 0.004, drop, 0.004, 5);
    p.ball(M.cane, 0, -rad * 0.55, 0, rad, 0.78);
    if (lit) p.ball(M.lamp, 0, -rad * 0.62, 0, rad * 0.5);
  }
  function tableLamp(b, px, py, y) {
    const p = pc(b, px, py, y, 0);
    p.cyl(M.pot, 0, 0, 0, 0.07, 0.2, 0.045, 14);
    p.cyl(M.lamp, 0, 0.22, 0, 0.12, 0.17, 0.085, 16);
  }
  function bed(b, px, py, y, yaw) {
    const p = pc(b, px, py, y, yaw);
    p.box(M.timber, 0, 0.06, 0, 2.0, 0.2, 2.16);
    p.box(M.timberDark, 0, 0, 0, 1.7, 0.06, 1.8);
    p.box(M.linen, 0, 0.26, 0.02, 1.84, 0.2, 2.02);
    p.box(M.linenWarm, 0, 0.46, 0.5, 1.9, 0.045, 1.1);
    p.box(M.linenClay, 0, 0.5, 0.85, 1.92, 0.035, 0.42);
    for (const sx of [-0.46, 0.46]) {
      p.box(M.linen, sx, 0.46, -0.72, 0.74, 0.13, 0.42);
      p.box(sx < 0 ? M.linenOlive : M.linenWarm, sx * 0.9, 0.52, -0.5, 0.46, 0.3, 0.1, 0.1 * Math.sign(sx));
    }
    p.box(M.timber, 0, 0, -1.1, 2.3, 1.05, 0.06);
    p.box(M.cane, 0, 0.42, -1.065, 2.1, 0.55, 0.02);
    blob(b, px, py, y, 2.0, 2.2, yaw);
    foot(0, px, py, 2.0, 2.2, yaw);
  }
  function nightstand(b, px, py, y) {
    const p = pc(b, px, py, y, 0);
    p.box(M.timber, 0, 0.06, 0, 0.46, 0.4, 0.44);
    p.box(M.timberDark, 0, 0, 0, 0.36, 0.06, 0.34);
    tableLamp(b, px, py, y + 0.46);
    foot(0, px, py, 0.46, 0.44);
  }
  // a timber cabinet with cane door panels on the face toward +z
  function cabinet(b, px, py, y, yaw, w, d, h, doors, lv = 0) {
    const p = pc(b, px, py, y, yaw);
    p.box(M.timber, 0, 0, 0, w, h, d);
    const dw = w / doors;
    for (let i = 0; i < doors; i++) {
      const cx = -w / 2 + dw * (i + 0.5);
      p.box(M.cane, cx, 0.14, d / 2 + 0.006, dw - 0.1, h - 0.28, 0.012);
      p.box(M.brass, cx + (i % 2 ? -1 : 1) * (dw / 2 - 0.035), h * 0.45, d / 2 + 0.02, 0.012, 0.16, 0.012);
    }
    foot(lv, px, py, w, d, yaw);
  }
  function vanity(b, px, py, y, yaw, len, basins, lv = 0) {
    const p = pc(b, px, py, y, yaw);
    p.box(M.timber, 0, 0.3, 0, len, 0.46, 0.5);
    p.box(M.sand, 0, 0.76, 0, len + 0.04, 0.05, 0.54);
    for (let i = 0; i < basins; i++) {
      const cx = basins === 1 ? 0 : (i - 0.5) * (len * 0.5);
      p.cyl(M.ceramic, cx, 0.81, 0.02, 0.15, 0.12, 0.2, 20);
      p.cyl(M.brass, cx, 0.81, -0.2, 0.012, 0.26, 0.012, 8);
      p.box(M.brass, cx, 1.05, -0.14, 0.02, 0.02, 0.14);
    }
    foot(lv, px, py, len, 0.54, yaw);
  }
  // round mirrors need to stand upright: built separately, facing +z
  function mirror(b, px, py, y, yaw, rad = 0.28) {
    const p = pc(b, px, py, y, yaw);
    const g = new THREE.CylinderGeometry(rad, rad, 0.02, 30);
    g.rotateX(Math.PI / 2);
    p.put(M.brass, g);
    const g2 = new THREE.CylinderGeometry(rad - 0.02, rad - 0.02, 0.022, 30);
    g2.rotateX(Math.PI / 2);
    p.put(M.mirror, g2);
  }
  function tub(b, px, py, y, yaw, lv = 0) {
    const p = pc(b, px, py, y, yaw);
    const g = new THREE.CylinderGeometry(0.5, 0.42, 0.56, 28);
    g.scale(1.7, 1, 0.85);
    g.translate(0, 0.28, 0);
    p.put(M.ceramic, g);
    const g2 = new THREE.CylinderGeometry(0.44, 0.44, 0.02, 28);
    g2.scale(1.7, 1, 0.82);
    g2.translate(0, 0.555, 0);
    p.put(M.bathStone, g2);
    p.cyl(M.brass, 0.95, 0, 0.1, 0.015, 0.85, 0.015, 8);
    p.box(M.brass, 0.86, 0.83, 0.1, 0.2, 0.02, 0.02);
    blob(b, px, py, y, 1.7, 0.85, yaw);
    foot(lv, px, py, 1.7, 0.85, yaw);
  }
  function wc(b, px, py, y, yaw, lv = 0) {
    const p = pc(b, px, py, y, yaw);
    p.box(M.ceramic, 0, 0.08, -0.2, 0.36, 0.34, 0.16);
    const g = new THREE.CylinderGeometry(0.19, 0.15, 0.36, 20);
    g.scale(1, 1, 1.3);
    g.translate(0, 0.26, 0.08);
    p.put(M.ceramic, g);
    p.box(M.brass, 0, 0.9, -0.27, 0.2, 0.12, 0.012);
    foot(lv, px, py, 0.4, 0.62, yaw);
  }
  function shower(b, px, py, y, yaw) {
    const p = pc(b, px, py, y, yaw);
    p.cyl(M.brass, 0, 1.0, 0, 0.012, 1.15, 0.012, 8);
    p.box(M.brass, 0, 2.13, 0.16, 0.02, 0.02, 0.34);
    p.cyl(M.brass, 0, 2.08, 0.32, 0.11, 0.02, 0.11, 18);
    p.box(M.brass, 0, 1.05, 0.03, 0.14, 0.05, 0.03);
  }
  function fan(b, px, py, yTop) {
    const p = pc(b, px, py, yTop - 0.42, 0.4);
    p.cyl(M.brass, 0, 0.08, 0, 0.012, 0.34, 0.012, 8);
    p.cyl(M.brass, 0, 0, 0, 0.09, 0.09, 0.07, 16);
    for (let i = 0; i < 3; i++)
      p.box(
        M.timberDark,
        Math.cos((i * 2 * Math.PI) / 3) * 0.42,
        0.03,
        Math.sin((i * 2 * Math.PI) / 3) * 0.42,
        0.72,
        0.012,
        0.13,
        (-i * 2 * Math.PI) / 3,
      );
  }
  function pot(b, px, py, y, h, rad, mat = M.pot, plantKind = null, group = 'ground', lv = 0, ps = 1) {
    const g = potGeo(h, rad);
    g.translate(X(py), y, Z(px));
    b.add(mat, g);
    if (plantKind) plant(plantKind, group, X(py), y + h * 0.94, Z(px), ps);
    solid(lv, { minX: X(py) - rad * 0.8, maxX: X(py) + rad * 0.8, minZ: Z(px) - rad * 0.8, maxZ: Z(px) + rad * 0.8 });
  }
  // pleated sheer along plan y (ax 'x') or plan x (ax 'y')
  function curtain(b, ax, c, a, b2, y0, h) {
    const len = (b2 - a) * U;
    const g = new THREE.PlaneGeometry(len, h, Math.max(8, Math.round(len * 14)), 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 22) * 0.035);
    g.computeVertexNormals();
    if (ax === 'x') g.translate(X((a + b2) / 2), y0 + h / 2, Z(c));
    else {
      g.rotateY(Math.PI / 2);
      g.translate(X(c), y0 + h / 2, Z((a + b2) / 2));
    }
    b.add(M.sheer, g);
  }
  function rug(b, r4, y, mat = M.rug) {
    b.pbox(mat, r4, y, y + 0.012);
  }
  function bollard(px, py) {
    const p = new Piece(B.site, px, 0, py, 0);
    p.cyl(M.steel, 0, 0, 0, 0.035, 0.32, 0.035, 8);
    p.cyl(M.lamp, 0, 0.32, 0, 0.045, 0.07, 0.045, 10);
  }

  const G = B.ground;
  const y0 = PLINTH;
  const ceilY = PLINTH + CEIL;

  // ================= hall: living =================
  rug(G, [370.5, 164.7, 420, 194.6], y0);
  sofa(G, 395, 188.6, y0, NY, 2.3);
  for (const px of [378.6, 411.4]) {
    table(G, px, 189, y0, 0, 0.42, 0.42, 0.5);
    tableLamp(G, px, 189, y0 + 0.5);
    foot(0, px, 189, 0.42, 0.42);
  }
  const ct = pc(G, 394.6, 176.6, y0, NY);
  ct.box(M.sand, 0, 0.26, 0, 1.25, 0.1, 0.68);
  ct.box(M.timberDark, -0.4, 0, 0, 0.14, 0.26, 0.5);
  ct.box(M.timberDark, 0.4, 0, 0, 0.14, 0.26, 0.5);
  ct.cyl(M.pot, 0.25, 0.36, 0.05, 0.09, 0.16, 0.06, 14);
  ct.cyl(M.ceramic, -0.2, 0.36, -0.08, 0.16, 0.035, 0.1, 18);
  blob(G, 394.6, 176.6, y0, 0.68, 1.25);
  foot(0, 394.6, 176.6, 1.25, 0.68, NY);
  daybed(G, 377.6, 176.5, y0, PX + Math.PI / 2, 1.3);
  loungeChair(G, 412, 172.4, y0, NX);
  loungeChair(G, 412, 181.6, y0, NX);
  // console and art on the bedroom wall
  cabinet(G, 392, 138.4, y0, PY, 2.4, 0.42, 0.62, 4);
  const cs = pc(G, 392, 138.4, y0 + 0.62, PY);
  cs.cyl(M.potPale, -0.7, 0, 0, 0.11, 0.34, 0.07, 16);
  cs.cyl(M.pot, -0.42, 0, 0.02, 0.08, 0.2, 0.05, 16);
  cs.cyl(M.ceramic, 0.6, 0, 0, 0.2, 0.05, 0.12, 20);
  cs.box(M.timberDark, 0.1, 0.62, -0.18, 1.5, 1.0, 0.03);
  cs.box(M.art, 0.1, 0.66, -0.165, 1.42, 0.92, 0.012);
  cs.box(M.linenWarm, 0.1, 0.9, -0.158, 1.42, 0.2, 0.004);
  fan(G, 395, 178, ceilY);
  fan(G, 395, 226, ceilY);
  light(395, 180, y0 + 2.3, 1.2, 10);
  pot(G, 366.6, 228.6, y0, 0.62, 0.3, M.pot, 'banana', 'ground', 0, 0.7);
  pot(G, 424.6, 171, y0, 0.55, 0.27, M.potPale, 'fern', 'ground', 0, 0.9);
  for (const [c, a, b2] of [
    [364.2, 173, 181],
    [364.2, 225, 233],
    [426.8, 177, 185],
    [426.8, 226, 234],
  ])
    curtain(G, 'x', c, a, b2, y0 + 0.03, 2.38);
  // pantry and store fronts on the pool-side wall
  for (const [a, b2] of [
    [237.5, 257.5],
    [152.5, 173.5],
  ]) {
    G.pbox(M.timber, [426.9, a, 427.7, b2], y0, y0 + 2.3);
    for (let i = 1; i < 4; i++)
      G.pbox(M.timberDark, [426.85, a + ((b2 - a) * i) / 4 - 0.08, 426.9, a + ((b2 - a) * i) / 4 + 0.08], y0, y0 + 2.3);
    for (let i = 0; i < 4; i++)
      G.pbox(M.brass, [426.7, a + ((b2 - a) * (i + 0.5)) / 4 + 1.6, 426.9, a + ((b2 - a) * (i + 0.5)) / 4 + 1.8], y0 + 0.95, y0 + 1.2);
  }

  // ================= dining =================
  table(G, 395, 224, y0, NY, 2.2, 0.95, 0.75);
  for (const px of [388.5, 401.5]) {
    chair(G, px, 216.6, y0, PY);
    chair(G, px, 231.4, y0, NY);
  }
  chair(G, 379.2, 224, y0, PX);
  chair(G, 410.8, 224, y0, NX);
  psolid(0, [377, 214.2, 413, 233.8]);
  const dt = pc(G, 395, 224, y0 + 0.75, NY);
  dt.cyl(M.ceramic, 0, 0, 0, 0.2, 0.06, 0.13, 20);
  dt.cyl(M.pot, 0.5, 0, 0.05, 0.07, 0.22, 0.05, 14);
  for (const px of [386.5, 395, 403.5]) pendant(G, px, 224, ceilY, px === 395 ? 1.25 : 1.05, 0.2);
  light(395, 224, y0 + 1.75, 1.3, 9);

  // ================= open kitchen =================
  const isl = pc(G, 397, 252.7, y0, NY);
  isl.box(M.timber, 0, 0.08, 0, 2.3, 0.8, 0.72);
  isl.box(M.timberDark, 0, 0, 0, 2.2, 0.08, 0.6);
  isl.box(M.sand, 0, 0.88, 0.04, 2.44, 0.05, 0.9);
  blob(G, 397, 252.7, y0, 0.9, 2.4);
  for (const px of [388, 397, 406]) stool(G, px, 246.6, y0);
  psolid(0, [383, 243.8, 411, 257.2]);
  const kc = pc(G, 397.2, 271.1, y0, NY);
  const kl = 3.18;
  kc.box(M.timber, 0, 0.08, 0, kl, 0.8, 0.6);
  kc.box(M.timberDark, 0, 0, -0.03, kl, 0.08, 0.5);
  kc.box(M.sand, 0, 0.88, 0, kl + 0.02, 0.04, 0.62);
  kc.box(M.sand, 0, 0.92, -0.295, kl, 0.5, 0.02);
  kc.box(M.steel, 0, 0.921, 0.02, 0.75, 0.008, 0.48);
  kc.box(M.steel, 1.0, 0.9, 0.02, 0.5, 0.022, 0.4);
  kc.cyl(M.brass, 1.0, 0.92, -0.22, 0.012, 0.3, 0.012, 8);
  for (let i = 0; i < 5; i++) kc.box(M.timberDark, -kl / 2 + (kl * (i + 0.5)) / 5 + 0.3, 0.12, 0.301, 0.012, 0.72, 0.004);
  kc.box(M.timber, 0, 1.5, -0.13, kl, 0.7, 0.34);
  for (let i = 0; i < 5; i++) kc.box(M.cane, -kl / 2 + (kl * (i + 0.5)) / 5, 1.56, 0.045, kl / 5 - 0.08, 0.58, 0.01);
  kc.box(M.led, 0, 1.49, 0, kl - 0.1, 0.01, 0.03);
  psolid(0, [379, 267.6, 415.6, 274.6]);
  light(397, 259, y0 + 2.3, 1.0, 8);

  // ================= bedrooms =================
  for (const s of [
    { bed: [450, 103, PY], ns: [93, 93], rug: [434.8, 105.7, 464.6, 121.3], chair: [472.5, 99], cur: [88, 99, 114, 125], lamp: [450, 104] },
    {
      bed: [449, 303, NY],
      ns: [314, 314],
      rug: [433.7, 288.6, 463.5, 304.2],
      chair: [472.5, 309],
      cur: [285, 296, 311, 322],
      lamp: [449, 302],
    },
  ]) {
    rug(G, s.rug, y0, M.rugClay);
    bed(G, s.bed[0], s.bed[1], y0, s.bed[2]);
    nightstand(G, s.bed[0] - 13.3, s.ns[0], y0);
    nightstand(G, s.bed[0] + 13.3, s.ns[1], y0);
    loungeChair(G, s.chair[0], s.chair[1], y0, NX);
    curtain(G, 'x', 482.4, s.cur[0], s.cur[1], y0 + 0.03, 2.38);
    curtain(G, 'x', 482.4, s.cur[2], s.cur[3], y0 + 0.03, 2.38);
    fan(G, s.bed[0], s.lamp[1], ceilY);
    light(s.lamp[0], s.lamp[1], y0 + 1.5, 1.0, 8);
  }
  pot(G, 419.5, 84.5, y0, 0.5, 0.25, M.potPale, 'fern', 'ground', 0, 0.8);
  pot(G, 419.5, 326, y0, 0.5, 0.25, M.potPale, 'fern', 'ground', 0, 0.8);

  // ================= dressers =================
  cabinet(G, 388.2, 83.6, y0, PY, 4.2, 0.6, 2.3, 6);
  cabinet(G, 398.2, 281, y0, PY, 2.45, 0.6, 2.3, 4);
  G.pbox(M.brass, [386, 101, 396, 101.3], y0 + 0.15, y0 + 2.0);
  G.pbox(M.mirror, [386.5, 100.9, 395.5, 101.05], y0 + 0.2, y0 + 1.95);
  G.pbox(M.brass, [393, 297.95, 403, 298.3], y0 + 0.15, y0 + 2.0);
  G.pbox(M.mirror, [393.5, 297.85, 402.5, 298.0], y0 + 0.2, y0 + 1.95);
  stool(G, 392, 95, y0, 0.44);
  stool(G, 398, 292, y0, 0.44);

  // ================= attached baths =================
  for (const s of [
    { van: [388.4, 105.9], tub: [373.8, 127.6], sh: [385.2, 400.7, 120.8, 133.1], wc: [407, 129.6], lamp: [390, 116] },
    { van: [388.4, 302.9], tub: [373.8, 323.9], sh: [385.2, 400.7, 317.2, 329.4], wc: [407, 325.9], lamp: [390, 313] },
  ]) {
    vanity(G, s.van[0], s.van[1], y0, PY, 2.25, 2);
    for (const dx of [-6.5, 6.5]) mirror(G, s.van[0] + dx, s.van[1] - 3.05, y0 + 1.5, PY);
    tub(G, s.tub[0], s.tub[1], y0, NY);
    wc(G, s.wc[0], s.wc[1], y0, NY);
    const [a, b2, c, d] = s.sh;
    G.pbox(M.glass, [a - 0.1, c, a + 0.1, d], y0, y0 + 2.1);
    G.pbox(M.glass, [b2 - 0.1, c, b2 + 0.1, d], y0, y0 + 2.1);
    G.pbox(M.glass, [a, c - 0.1, a + 7, c + 0.1], y0, y0 + 2.1);
    psolid(0, [a - 0.5, c, a + 0.5, d]);
    psolid(0, [b2 - 0.5, c, b2 + 0.5, d]);
    psolid(0, [a, c - 0.5, a + 7, c + 0.5]);
    shower(G, (a + b2) / 2, d - 0.4, y0, NY);
    pendant(G, s.lamp[0], s.lamp[1], ceilY, 0.7, 0.16);
    light(s.lamp[0], s.lamp[1], y0 + 2.1, 0.8, 6);
  }
  // washing area
  const wa = pc(G, 372.6, 295.2, y0, NY);
  wa.box(M.timber, 0, 0, 0, 1.5, 0.86, 0.52);
  wa.box(M.sand, 0, 0.86, 0, 1.54, 0.04, 0.56);
  wa.box(M.ceramic, -0.38, 0.06, 0.262, 0.6, 0.76, 0.01);
  wa.cyl(M.steel, -0.38, 0.44, 0.27, 0.2, 0.012, 0.2, 24).box(M.steel, 0.38, 0.86, 0, 0.5, 0.045, 0.4);
  psolid(0, [364, 292, 381.4, 298.3]);
  // powder room and pool bathroom
  wc(G, 446.5, 267, y0, NX);
  vanity(G, 435, 271.4, y0, NY, 0.5, 1);
  mirror(G, 435, 274.3, y0 + 1.5, NY, 0.22);
  wc(G, 434.2, 141, y0, PX);
  vanity(G, 434.6, 146.8, y0, NY, 0.5, 1);
  shower(G, 447.5, 136.6, y0, PY);
  G.pbox(M.glass, [441.5, 136, 441.7, 143.5], y0, y0 + 2.1);
  psolid(0, [441.1, 136, 442.1, 143.5]);

  // ================= pooja niche and window seats =================
  const pj = pc(G, 356.8, 142.4, y0, PX);
  pj.box(M.sand, 0, 0, -0.1, 0.68, 0.5, 0.46);
  pj.box(M.timber, 0, 0.5, -0.1, 0.74, 0.04, 0.5);
  pj.cyl(M.brass, 0, 0.54, -0.12, 0.07, 0.03, 0.05, 16);
  pj.ball(M.lamp, 0, 0.6, -0.12, 0.028);
  pj.cyl(M.brass, -0.22, 0.54, -0.2, 0.035, 0.22, 0.02, 12);
  pj.cyl(M.brass, 0.22, 0.54, -0.2, 0.035, 0.22, 0.02, 12);
  pj.box(M.clay, 0, 0.9, -0.33, 0.5, 0.6, 0.02);
  for (const [a, b2] of [
    [150.6, 170],
    [236.2, 274.4],
  ]) {
    G.pbox(M.ivory, [352.8, a, 360.6, b2], y0, y0 + 0.4);
    G.pbox(M.linen, [353.4, a + 0.6, 360.2, b2 - 0.6], y0 + 0.4, y0 + 0.5);
    const p = pc(G, 356.5, a + 3, y0 + 0.5, PY);
    p.box(M.linenClay, 0, 0, 0, 0.42, 0.34, 0.12, 0.15);
    const p2 = pc(G, 356.5, b2 - 3, y0 + 0.5, NY);
    p2.box(M.linenOlive, 0, 0, 0, 0.42, 0.34, 0.12, -0.15);
  }

  // ================= pool court =================
  for (const [r4, pad] of [
    [[452.5, 172.5, 459.6, 200.6], 1],
    [[452.5, 213.4, 459.6, 237.5], 1],
    [[460.4, 172.5, 474.2, 179.6], 0],
    [[460.4, 230.4, 474.2, 237.5], 0],
  ]) {
    G.pbox(M.linen, r4, y0, y0 + 0.11);
    const n = pad ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n;
      if (pad) pc(G, r4[0] + 1.2, r4[1] + (r4[3] - r4[1]) * k, y0 + 0.11, PX).box(cush[i % 3], 0, 0, 0, 0.46, 0.36, 0.13);
      else
        pc(G, r4[0] + (r4[2] - r4[0]) * k, r4[1] < 200 ? r4[1] + 1.2 : r4[3] - 1.2, y0 + 0.11, r4[1] < 200 ? PY : NY).box(
          cush[(i + 1) % 3],
          0,
          0,
          0,
          0.46,
          0.36,
          0.13,
        );
    }
  }
  // a small table at the far end keeps the narrow floor of the seat clear
  const pt = pc(G, 467, 225.6, PIT, 0);
  pt.cyl(M.sand, 0, 0, 0, 0.2, 0.3, 0.24, 24);
  pt.cyl(M.sand, 0, 0.3, 0, 0.3, 0.05, 0.3, 28);
  pt.cyl(M.brass, 0, 0.35, 0, 0.06, 0.02, 0.06, 12);
  pt.cyl(M.lamp, 0, 0.37, 0, 0.05, 0.16, 0.05, 12);
  foot(0, 467, 225.6, 0.6, 0.6);
  light(467, 222, PIT + 0.8, 0.7, 6);
  for (const r4 of [
    [474, 157, 484, 162],
    [474, 248.3, 484, 253.3],
  ]) {
    G.pbox(M.sand, r4, y0, y0 + 0.42);
    psolid(0, r4);
  }
  // urns flanking the hall opening, and on the wing decks, as in the pool render
  pot(G, 433.6, 179.6, y0, 0.7, 0.33, M.pot, 'banana', 'ground', 0, 0.75);
  pot(G, 433.6, 231.6, y0, 0.7, 0.33, M.pot, 'banana', 'ground', 0, 0.75);
  for (const py of [81.5, 130.5, 279.5, 328.5]) pot(G, 498.5, py, y0, 0.78, 0.36, M.pot, py > 100 && py < 300 ? 'spike' : null);
  for (const py of [84.5, 127.5, 282.5, 325.5]) pot(G, 487.6, py, y0, 0.5, 0.24, M.potPale, 'fern', 'ground', 0, 0.8);
  for (const py of [92, 121, 290, 319]) loungeChair(G, 493.4, py, y0, PX);

  // ================= entrance =================
  pot(G, 334.5, 178.2, y0, 0.7, 0.33, M.pot, 'fern');
  pot(G, 334.5, 227.8, y0, 0.7, 0.33, M.pot, 'fern');
  for (const py of [116, 146, 260, 290]) pot(B.site, 339.5, py, 0, 0.62, 0.3, M.pot, 'banana', 'site', 0, 0.62);
  for (const py of [84, 325]) pot(B.site, 339, py, 0, 0.85, 0.4, M.pot, null);
  light(348, 203, y0 + 2.4, 0.9, 9);
  for (const [px, pz] of [
    [-6, 12.6],
    [6, 12.6],
    [-12.5, 13.5],
    [12.5, 13.5],
    [-4.2, -7.2],
    [4.4, -7.2],
    [11.6, -10],
    [11.6, -14.4],
    [-13, -5.4],
    [-18, 12],
    [19, 10],
  ])
    bollard(px, pz);

  // ================= garden pavilion =================
  const pv = P.PAVILION;
  const S = B.site;
  const sy = pv.h;
  const sd = 0.85;
  S.box(M.sand, pv.maxX - 0.3 - sd, pv.maxX - 0.3, sy, sy + 0.4, pv.minZ + 0.3, pv.maxZ - 0.75);
  S.box(M.sand, pv.minX + 0.75, pv.maxX - 0.3 - sd, sy, sy + 0.4, pv.minZ + 0.3, pv.minZ + 0.3 + sd);
  S.box(M.linen, pv.maxX - 0.34 - sd, pv.maxX - 0.56, sy + 0.4, sy + 0.52, pv.minZ + 0.34, pv.maxZ - 0.79);
  S.box(M.linen, pv.minX + 0.79, pv.maxX - 0.34 - sd, sy + 0.4, sy + 0.52, pv.minZ + 0.56, pv.minZ + 0.26 + sd);
  S.box(M.sand, pv.maxX - 0.56, pv.maxX - 0.3, sy + 0.4, sy + 0.8, pv.minZ + 0.3, pv.maxZ - 0.75);
  S.box(M.sand, pv.minX + 0.75, pv.maxX - 0.56, sy + 0.4, sy + 0.8, pv.minZ + 0.3, pv.minZ + 0.56);
  for (let i = 0; i < 5; i++)
    new Piece(S, pv.maxX - 0.68, sy + 0.52, pv.minZ + 1.0 + i * 0.78, -Math.PI / 2).box(
      cush[i % 4],
      0,
      0,
      0,
      0.5,
      0.4,
      0.14,
      (r() - 0.5) * 0.15,
    );
  for (let i = 0; i < 4; i++)
    new Piece(S, pv.minX + 1.3 + i * 0.8, sy + 0.52, pv.minZ + 0.68, 0).box(cush[(i + 2) % 4], 0, 0, 0, 0.5, 0.4, 0.14, (r() - 0.5) * 0.15);
  solid(0, { minX: pv.maxX - 0.3 - sd, maxX: pv.maxX - 0.3, minZ: pv.minZ + 0.3, maxZ: pv.maxZ - 0.75 });
  solid(0, { minX: pv.minX + 0.75, maxX: pv.maxX - 0.3, minZ: pv.minZ + 0.3, maxZ: pv.minZ + 0.3 + sd });
  const tc = [(pv.minX + pv.maxX) / 2 + 0.2, (pv.minZ + pv.maxZ) / 2 + 0.3];
  const tb = new Piece(S, tc[0], sy, tc[1], 0);
  tb.cyl(M.sand, 0, 0, 0, 0.62, 0.36, 0.56, 28);
  tb.cyl(M.timber, 0, 0.36, 0, 0.3, 0.025, 0.3, 24);
  tb.cyl(M.pot, 0.08, 0.385, 0, 0.07, 0.15, 0.05, 14);
  tb.cyl(M.pot, -0.1, 0.385, 0.08, 0.05, 0.1, 0.04, 14);
  solid(0, { minX: tc[0] - 0.62, maxX: tc[0] + 0.62, minZ: tc[1] - 0.62, maxZ: tc[1] + 0.62 });
  const pd = new Piece(S, tc[0] - 1.2, sy + 2.75 - 0.75, tc[1] + 0.6, 0);
  pd.cyl(M.steel, 0, 0, 0, 0.004, 0.75, 0.004, 5);
  pd.ball(M.cane, 0, -0.2, 0, 0.32, 0.8);
  pd.ball(M.lamp, 0, -0.22, 0, 0.14);
  lamps.push({ x: tc[0] - 1.2, y: sy + 1.75, z: tc[1] + 0.6, power: 1.2, dist: 10 });

  // ================= first floor =================
  const Up = B.upper;
  const f = F1;
  rug(Up, [376, 166, 416, 216], f);
  sofa(Up, 379.5, 225.8, f, NY, 2.2);
  for (const px of [389, 401]) {
    Up.pbox(px < 395 ? M.linenClay : M.linenOlive, [px - 3.7, 172, px + 3.7, 193], f + 0.012, f + 0.02);
  }
  const lt = new Piece(Up, X(203), f, Z(396), 0);
  lt.cyl(M.timber, 0, 0, 0, 0.36, 0.26, 0.4, 24);
  lt.cyl(M.timber, 0, 0.26, 0, 0.5, 0.035, 0.5, 28);
  lt.cyl(M.potPale, 0.12, 0.295, 0, 0.08, 0.2, 0.05, 14);
  foot(1, 396, 203, 1.0, 1.0);
  for (const [px, py, k] of [
    [386, 203, 0],
    [406, 203, 1],
    [396, 212.5, 2],
  ]) {
    const c = new Piece(Up, X(py), f, Z(px), 0);
    c.cyl(cush[k], 0, 0.012, 0, 0.33, 0.14, 0.33, 22);
  }
  loungeChair(Up, 420, 161.5, f, NX + 0.5, 1);
  const fl = new Piece(Up, X(157.5), f, Z(424.5), 0);
  fl.cyl(M.brass, 0, 0, 0, 0.13, 0.02, 0.13, 16);
  fl.cyl(M.brass, 0, 0.02, 0, 0.011, 1.45, 0.011, 8);
  fl.cyl(M.lamp, 0, 1.4, 0, 0.17, 0.26, 0.11, 18);
  cabinet(Up, 411.3, 229.3, f, NY, 0.82, 0.34, 0.9, 2, 1);
  for (const [c, a, b2] of [
    [364.2, 158, 168],
    [364.2, 217, 227],
    [426.8, 158, 168],
    [426.8, 217, 227],
  ])
    curtain(Up, 'x', c, a, b2, f + 0.03, 2.28);
  pendant(Up, 396, 192, f + UP_H, 0.7, 0.3);
  light(396, 192, f + 1.9, 1.3, 10);
  pot(Up, 367.5, 228, f, 0.55, 0.26, M.potPale, 'fern', 'upper', 1, 0.8);
  // bathroom 3 and the storage passage
  wc(Up, 367.5, 243, f, PX, 1);
  Up.pbox(M.glass, [385.9, 233, 386.1, 247], f, f + 2.1);
  psolid(1, [385.5, 233, 386.5, 247]);
  shower(Up, 378.5, 253.3, f, NY);
  vanity(Up, 401, 250.6, f, NY, 1.05, 1, 1);
  mirror(Up, 401, 253.5, f + 1.5, NY, 0.24);
  Up.pbox(M.timber, [425, 236, 427.6, 251], f, f + 2.2);
  for (let i = 1; i < 3; i++) Up.pbox(M.timberDark, [424.94, 236 + i * 5 - 0.08, 425, 236 + i * 5 + 0.08], f, f + 2.2);
  psolid(1, [425, 236, 427.7, 251]);

  // terraces live with the slab so the cutaway hides them together
  const Sl = B.slab;
  // mud bath 6: a plaster basin, drawn 10'0" x 6'3" on plan
  const mb = [383, 95, 418, 117];
  for (const r4 of [
    [mb[0], mb[1], mb[2], mb[1] + 2.6],
    [mb[0], mb[3] - 2.6, mb[2], mb[3]],
    [mb[0], mb[1] + 2.6, mb[0] + 2.6, mb[3] - 2.6],
    [mb[2] - 2.6, mb[1] + 2.6, mb[2], mb[3] - 2.6],
  ])
    Sl.pbox(M.coping, r4, f, f + 0.55);
  Sl.pbox(M.mud, [mb[0] + 2.6, mb[1] + 2.6, mb[2] - 2.6, mb[3] - 2.6], f, f + 0.42);
  Sl.pbox(M.coping, [mb[0] + 8, mb[3], mb[2] - 8, mb[3] + 4], f, f + 0.27);
  psolid(1, mb);
  // outdoor sitting 7: an L of built-in seat along the parapets
  for (const r4 of [
    [440, 79.8, 483.2, 88.5],
    [474.5, 88.5, 483.2, 133],
  ]) {
    Sl.pbox(M.terra, r4, f, f + 0.4);
    Sl.pbox(M.linen, [r4[0] + 0.5, r4[1] + 0.5, r4[2] - 0.5, r4[3] - 0.5], f + 0.4, f + 0.5);
    psolid(1, r4);
  }
  for (let i = 0; i < 5; i++) new Piece(Sl, X(81.6), f + 0.5, Z(446 + i * 7.4), -Math.PI / 2).box(cush[i % 4], 0, 0, 0, 0.5, 0.38, 0.13);
  for (let i = 0; i < 4; i++) new Piece(Sl, X(96 + i * 9.5), f + 0.5, Z(481.4), Math.PI).box(cush[(i + 1) % 4], 0, 0, 0, 0.5, 0.38, 0.13);
  table(Sl, 462, 100, f, 0, 0.9, 0.9, 0.36, M.sand, M.timber);
  foot(1, 462, 100, 0.9, 0.9);
  daybed(Sl, 432, 100, f, PX, 1.9, 1);
  daybed(Sl, 432, 113, f, PX, 1.9, 1);
  for (const [a, b2] of [
    [82, 132],
    [280, 328],
  ]) {
    Sl.pbox(M.terra, [363.3, a, 369.6, b2], f, f + 0.4);
    Sl.pbox(M.soil, [364, a + 0.7, 368.9, b2 - 0.7], f + 0.4, f + 0.42);
    psolid(1, [363.3, a, 369.6, b2]);
  }
  daybed(Sl, 455, 293, f, PX, 1.9, 1);
  daybed(Sl, 455, 306, f, PX, 1.9, 1);
  table(Sl, 400, 305, f, 0, 1.3, 1.3, 0.74, M.timber, M.timber);
  for (const [dx, dy, yaw] of [
    [0, -10.5, PY],
    [0, 10.5, NY],
    [-10.5, 0, PX],
    [10.5, 0, NX],
  ])
    chair(Sl, 400 + dx, 305 + dy, f, yaw);
  psolid(1, [387.5, 292.5, 412.5, 317.5]);
  for (const [px, py] of [
    [480, 280.5],
    [480, 327],
    [367, 147],
    [447, 143],
  ])
    pot(Sl, px, py, f, 0.7, 0.32, M.pot, px > 400 ? 'spike' : 'banana', 'slab', 1, 0.7);

  ctx.lamps = lamps;
}
