// ILIKA tour: collision and route finding on the plan.
// Walls, glazing, furniture and water are rectangles on the floor; the visitor is a circle.
import * as P from './plan.js';
import { heightAt } from './build.js';

const RAD = 0.22;
const CELL = 0.15;

export class Nav {
  constructor(ctx) {
    this.ctx = ctx;
    this.col = ctx.col;
    const b = P.PLOT;
    const xs = P.ROOF.flatMap((r) => [P.X(r[1]), P.X(r[3])]);
    const zs = P.ROOF.flatMap((r) => [P.Z(r[0]), P.Z(r[2])]);
    this.bounds = [
      { minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ },
      { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) },
    ];
    this.roof = P.ROOF.map((r) => P.rect(...r));
    this.grids = [this.grid(0), this.grid(1)];
  }
  height(lv, x, z) {
    return heightAt(this.ctx, lv, x, z);
  }
  onFloor(lv, x, z, pad = 0) {
    const b = this.bounds[lv];
    if (x < b.minX + pad || x > b.maxX - pad || z < b.minZ + pad || z > b.maxZ - pad) return false;
    if (lv === 0) return true;
    // the roof is a union of rectangles: the circle is on it if its centre is, with a little give at the seams
    return this.roof.some((r) => x >= r.minX - 0.01 && x <= r.maxX + 0.01 && z >= r.minZ - 0.01 && z <= r.maxZ + 0.01);
  }
  hit(lv, x, z, rad = RAD) {
    if (!this.onFloor(lv, x, z)) return true;
    for (const c of this.col[lv]) {
      const dx = x - Math.max(c.minX, Math.min(x, c.maxX));
      const dz = z - Math.max(c.minZ, Math.min(z, c.maxZ));
      if (dx * dx + dz * dz < rad * rad) return true;
    }
    return false;
  }
  // move with sliding: push the circle out of anything it overlaps
  move(lv, p, dx, dz) {
    let x = p.x + dx;
    let z = p.z + dz;
    for (let it = 0; it < 3; it++)
      for (const c of this.col[lv]) {
        const cx = Math.max(c.minX, Math.min(x, c.maxX));
        const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
        let ox = x - cx;
        let oz = z - cz;
        const d2 = ox * ox + oz * oz;
        if (d2 >= RAD * RAD) continue;
        if (d2 > 1e-10) {
          const d = Math.sqrt(d2);
          x = cx + (ox / d) * RAD;
          z = cz + (oz / d) * RAD;
        } else {
          // centre is inside: leave by the nearest edge
          const l = x - c.minX;
          const r = c.maxX - x;
          const t = z - c.minZ;
          const b = c.maxZ - z;
          const m = Math.min(l, r, t, b);
          if (m === l) x = c.minX - RAD;
          else if (m === r) x = c.maxX + RAD;
          else if (m === t) z = c.minZ - RAD;
          else z = c.maxZ + RAD;
        }
      }
    if (this.hit(lv, x, z, RAD - 0.01)) {
      // try each axis alone before giving up
      if (!this.hit(lv, p.x + dx, p.z, RAD - 0.01)) return { x: p.x + dx, z: p.z };
      if (!this.hit(lv, p.x, p.z + dz, RAD - 0.01)) return { x: p.x, z: p.z + dz };
      return { x: p.x, z: p.z };
    }
    return { x, z };
  }

  // ---- grid for A* ----
  grid(lv) {
    const b = this.bounds[lv];
    const w = Math.ceil((b.maxX - b.minX) / CELL);
    const h = Math.ceil((b.maxZ - b.minZ) / CELL);
    const g = new Uint8Array(w * h);
    if (lv === 1) {
      g.fill(1);
      for (const r of this.roof) {
        const i0 = Math.max(0, Math.ceil((r.minX - b.minX) / CELL - 0.5));
        const i1 = Math.min(w - 1, Math.floor((r.maxX - b.minX) / CELL - 0.5));
        const j0 = Math.max(0, Math.ceil((r.minZ - b.minZ) / CELL - 0.5));
        const j1 = Math.min(h - 1, Math.floor((r.maxZ - b.minZ) / CELL - 0.5));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) g[j * w + i] = 0;
      }
    }
    const pad = RAD + 0.02;
    for (const c of this.col[lv]) {
      const i0 = Math.max(0, Math.ceil((c.minX - pad - b.minX) / CELL - 0.5));
      const i1 = Math.min(w - 1, Math.floor((c.maxX + pad - b.minX) / CELL - 0.5));
      const j0 = Math.max(0, Math.ceil((c.minZ - pad - b.minZ) / CELL - 0.5));
      const j1 = Math.min(h - 1, Math.floor((c.maxZ + pad - b.minZ) / CELL - 0.5));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) g[j * w + i] = 1;
    }
    return { g, w, h, b };
  }
  cellOf(lv, x, z) {
    const { w, h, b } = this.grids[lv];
    const i = Math.min(w - 1, Math.max(0, Math.floor((x - b.minX) / CELL)));
    const j = Math.min(h - 1, Math.max(0, Math.floor((z - b.minZ) / CELL)));
    return j * w + i;
  }
  pointOf(lv, k) {
    const { w, b } = this.grids[lv];
    return { x: b.minX + ((k % w) + 0.5) * CELL, z: b.minZ + (Math.floor(k / w) + 0.5) * CELL };
  }
  // nearest free cell to a point (spiral search), or -1
  free(lv, x, z, reach = 14) {
    const { g, w, h } = this.grids[lv];
    const k = this.cellOf(lv, x, z);
    if (!g[k]) return k;
    const ci = k % w;
    const cj = Math.floor(k / w);
    for (let rr = 1; rr <= reach; rr++) {
      let best = -1;
      let bd = 1e9;
      for (let j = cj - rr; j <= cj + rr; j++)
        for (let i = ci - rr; i <= ci + rr; i++) {
          if (i < 0 || j < 0 || i >= w || j >= h) continue;
          if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== rr) continue;
          if (g[j * w + i]) continue;
          const d = (i - ci) ** 2 + (j - cj) ** 2;
          if (d < bd) {
            bd = d;
            best = j * w + i;
          }
        }
      if (best >= 0) return best;
    }
    return -1;
  }
  clear(lv, a, b) {
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.ceil(d / (CELL * 0.5));
    const { g } = this.grids[lv];
    for (let i = 1; i < n; i++) {
      const k = i / n;
      if (g[this.cellOf(lv, a.x + (b.x - a.x) * k, a.z + (b.z - a.z) * k)]) return false;
    }
    return true;
  }
  // A* over the grid, then pull the route straight where there is a clear line
  path(lv, from, to) {
    const { g, w, h } = this.grids[lv];
    const s = this.free(lv, from.x, from.z);
    const e = this.free(lv, to.x, to.z);
    if (s < 0 || e < 0) return null;
    const n = w * h;
    const cost = new Float32Array(n).fill(Infinity);
    const prev = new Int32Array(n).fill(-1);
    const done = new Uint8Array(n);
    const ei = e % w;
    const ej = Math.floor(e / w);
    const heap = [];
    const push = (k, f) => {
      heap.push([f, k]);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p][0] <= heap[i][0]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = i * 2 + 1;
          const r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top;
    };
    cost[s] = 0;
    push(s, 0);
    let found = false;
    while (heap.length) {
      const [, k] = pop();
      if (done[k]) continue;
      done[k] = 1;
      if (k === e) {
        found = true;
        break;
      }
      const i = k % w;
      const j = Math.floor(k / w);
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = i + di;
          const nj = j + dj;
          if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
          const nk = nj * w + ni;
          if (g[nk] || done[nk]) continue;
          if (di && dj && (g[j * w + ni] || g[nj * w + i])) continue; // no cutting corners
          const c = cost[k] + (di && dj ? 1.4142 : 1);
          if (c < cost[nk]) {
            cost[nk] = c;
            prev[nk] = k;
            push(nk, c + Math.hypot(ni - ei, nj - ej));
          }
        }
    }
    if (!found) return null;
    const raw = [];
    for (let k = e; k >= 0; k = prev[k]) raw.push(this.pointOf(lv, k));
    raw.reverse();
    const out = [raw[0]];
    let i = 0;
    while (i < raw.length - 1) {
      let j = raw.length - 1;
      while (j > i + 1 && !this.clear(lv, raw[i], raw[j])) j--;
      out.push(raw[j]);
      i = j;
    }
    if (!this.hit(lv, to.x, to.z) && this.clear(lv, out[out.length - 1], to)) out.push({ x: to.x, z: to.z });
    let len = 0;
    for (let q = 1; q < out.length; q++) len += Math.hypot(out[q].x - out[q - 1].x, out[q].z - out[q - 1].z);
    out.length_m = len;
    return out;
  }
}
