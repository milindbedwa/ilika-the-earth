// ILIKA tour: the measured plan.
// Everything here is read off public/svg/plan-ground.svg and images/plan-first.png.
// The ground plan is drawn at 3.5 drawing units to the foot (checked against the schedule:
// hall 18'6" = 64.8 units, hall + kitchen 40'0" = 139.7 units, pool 23'0" = 80.8 units).
// Plan coordinates are written as (px, py) in those drawing units, exactly as in the SVG.
//
// World axes (metres): +X = plan "up" (bedroom 17 end), +Z = plan "right" (pool side),
// so the site plan reads the same way up as the world seen from above. The plan's
// "north face" is the entrance side, world -Z.

export const FT = 0.3048;
export const U = FT / 3.5; // metres per drawing unit
const CY = 204.6; // plan y of the hall centre line
const CX = 395; // plan x of the hall centre line

export const X = (py) => (CY - py) * U;
export const Z = (px) => (px - CX) * U;
export const W = (px, py) => [X(py), Z(px)];
export const toPlan = (x, z) => [z / U + CX, CY - x / U];
export const rect = (x1, y1, x2, y2) => ({
  minX: X(Math.max(y1, y2)),
  maxX: X(Math.min(y1, y2)),
  minZ: Z(Math.min(x1, x2)),
  maxZ: Z(Math.max(x1, x2)),
});

// heights (metres). Not on the drawings: inferred from the renders.
export const PLINTH = 0.6; // four 150 mm risers up from the lawn
export const CEIL = 3.0; // ground floor clear height
export const SLAB = 0.2;
export const F1 = PLINTH + CEIL + SLAB; // first floor level
export const PARAPET = 0.85;
export const UP_H = 2.8; // multi room clear height
export const EYE = 1.6;
export const PIT = PLINTH - 0.45; // sunken sitting floor

// site, from the master plan (7.85 px to the foot on the 1290 px crop), in metres
export const PLOT = { minX: -22.1, maxX: 23.9, minZ: -20.7, maxZ: 21.2 };
export const GATE = { x: PLOT.minX, z0: -10.7, z1: -6.0 };
export const PAVILION = { minX: 12.6, maxX: 18.3, minZ: -15.05, maxZ: -9.3, h: 0.45 };
export const TREES = [
  [-15.5, -16.3, 1.0],
  [-5.2, -17.6, 0.8],
  [6.6, -16.1, 0.95],
  [19.8, -16.9, 0.9],
  [-10.2, -12.5, 0.75],
  [20.4, -5.3, 0.95],
  [-17.4, 1.7, 0.85],
  [20.4, 7.0, 1.05],
  [-17.1, 16.7, 1.0],
  [-5.4, 15.7, 0.9],
  [9.6, 16.5, 0.8],
  [18.7, 16.7, 1.0],
];

// roof of the ground floor = the two open terraces + the multi room (plan rects)
export const ROOF = [
  [362, 77, 486, 135.5],
  [430, 135.5, 453, 151.5],
  [430, 151.5, 438.5, 175.5],
  [362, 135.5, 430, 276],
  [430, 235.5, 438.5, 258.5],
  [430, 258.5, 453, 276],
  [362, 276, 486, 332],
];

// ---- rooms: number, name and size are quoted from the schedules ----
// r: plan rect, v: viewpoint, l: look-at point (plan coords)
export const ROOMS = [
  { id: 'g1', lv: 0, n: 1, name: 'Bedroom', dim: '20′0″ × 15′0″', r: [414.5, 277, 483, 330], v: [424, 286], l: [462, 308] },
  { id: 'g2', lv: 0, n: 2, name: 'Attached toilet', dim: '8′9″ × 14′3″', r: [363, 300, 413, 330], v: [407, 309], l: [372, 322] },
  { id: 'g3', lv: 0, n: 3, name: 'Dresser', dim: '9′0″ × 5′9″', r: [383, 277, 413, 298], v: [407, 293], l: [390, 284] },
  { id: 'g4', lv: 0, n: 4, name: 'French window', dim: '8′6″ × 3′0″', r: [428, 332, 460, 344], v: [427, 322], l: [446, 338] },
  { id: 'g5', lv: 0, n: 5, name: 'Washing area', dim: '5′9″ × 5′0″', r: [363, 277, 382, 299], v: [374, 283], l: [368, 296] },
  { id: 'g6', lv: 0, n: 6, name: 'Powder room', dim: '6′0″ × 4′0″', r: [430, 259, 452, 275], v: [434, 265], l: [450, 268] },
  { id: 'g7', lv: 0, n: 7, name: 'Open kitchen', dim: '18′9″ × 11′6″', r: [363, 235.5, 428, 275], v: [420, 240], l: [390, 266] },
  { id: 'g8', lv: 0, n: 8, name: 'French window', dim: '10′9″ × 3′0″', r: [352, 237, 362, 276], v: [376, 256], l: [352, 256] },
  { id: 'g9', lv: 0, n: 9, name: 'Store', dim: '2′0″ × 6′0″', r: [430, 236, 437, 258], v: [414, 247], l: [432, 247] },
  { id: 'g10', lv: 0, n: 10, name: 'Hall', dim: '28′6″ × 18′6″', r: [363, 135.5, 428, 235.5], v: [372, 203], l: [420, 172] },
  { id: 'g11', lv: 0, n: 11, name: 'French window', dim: '3′0″ × 6′9″', r: [352, 150.5, 362, 171], v: [376, 161], l: [352, 161] },
  { id: 'g12', lv: 0, n: 12, name: 'Pooja area', dim: '3′0″ × 3′0″', r: [352, 136, 362, 149.5], v: [374, 144], l: [354, 143] },
  { id: 'g13', lv: 0, n: 13, name: 'Store', dim: '2′0″ × 6′0″', r: [430, 152, 437, 174], v: [414, 163], l: [432, 163] },
  { id: 'g14', lv: 0, n: 14, name: 'Bathroom', dim: '4′0″ × 6′0″', r: [430, 135.5, 452, 151], v: [445, 147], l: [433, 139] },
  { id: 'g15', lv: 0, n: 15, name: 'Attached toilet', dim: '9′0″ × 14′3″', r: [363, 103, 413, 133.5], v: [407, 112], l: [372, 126] },
  { id: 'g16', lv: 0, n: 16, name: 'Dresser', dim: '5′9″ × 14′3″', r: [363, 80, 413, 101], v: [407, 95], l: [380, 86] },
  { id: 'g17', lv: 0, n: 17, name: 'Bedroom', dim: '20′0″ × 15′0″', r: [414.5, 80, 483, 133.5], v: [424, 125], l: [462, 102] },
  { id: 'g18', lv: 0, n: 18, name: 'French window', dim: '3′0″ × 8′6″', r: [432, 64, 465, 77], v: [448, 124], l: [448, 70] },
  { id: 'g19', lv: 0, n: 19, name: 'Sitting area', dim: '6′6″ × 18′9″', r: [451, 165, 474.5, 245.5], v: [443, 206], l: [480, 206] },
  { id: 'g20', lv: 0, n: 20, name: 'Swimming pool', dim: '12′9″ × 23′0″', r: [474.6, 165, 517.7, 245.5], v: [494, 156], l: [498, 215] },
  { id: 'f1', lv: 1, n: 1, name: 'Open terrace', dim: '21′6″ × 36′6″', r: [362, 255.5, 486, 332], v: [426, 288], l: [480, 312] },
  { id: 'f2', lv: 1, n: 2, name: 'Storage', dim: '5′6″ × 5′6″', r: [416, 232, 428, 255], v: [422, 262], l: [422, 236] },
  { id: 'f3', lv: 1, n: 3, name: 'Bathroom', dim: '5′6″ × 12′0″', r: [363, 232.5, 415, 255], v: [403, 238], l: [372, 247] },
  { id: 'f4', lv: 1, n: 4, name: 'Multi room', dim: '22′9″ × 18′6″', r: [363, 152.5, 428, 232], v: [421, 226], l: [380, 170] },
  { id: 'f5', lv: 1, n: 5, name: 'Open terrace', dim: '21′6″ × 36′6″', r: [362, 77, 486, 152], v: [378, 141], l: [450, 96] },
  { id: 'f6', lv: 1, n: 6, name: 'Mud bath', dim: '5′0″ × 32″', r: [383, 95, 418, 117], v: [400, 128], l: [400, 104] },
  { id: 'f7', lv: 1, n: 7, name: 'Outdoor sitting', dim: '20′ × 30″ running ft', r: [440, 77, 486, 135], v: [446, 122], l: [480, 86] },
];

// outdoor places that are on the site plan but not in the room schedules
export const PLACES = [
  { id: 'porch', lv: 0, name: 'Entrance', r: [321, 172, 362, 234] },
  { id: 'court', lv: 0, name: 'Pool court', r: [430, 135, 518, 276] },
  { id: 'deck', lv: 0, name: 'Garden deck', r: [486, 77, 518, 332] },
];

export function roomAt(level, x, z) {
  const [px, py] = toPlan(x, z);
  const hit = (r) => px >= r[0] && px <= r[2] && py >= r[1] && py <= r[3];
  // small rooms first so the mud bath wins over the terrace it sits on
  const order = [...ROOMS].filter((r) => r.lv === level).sort((a, b) => area(a.r) - area(b.r));
  for (const r of order) if (hit(r.r)) return r.name;
  if (level === 1) return 'Open terrace';
  for (const p of PLACES) if (hit(p.r)) return p.name;
  if (x > PAVILION.minX && x < PAVILION.maxX && z > PAVILION.minZ && z < PAVILION.maxZ) return 'Garden pavilion';
  return 'Garden';
}
const area = (r) => (r[2] - r[0]) * (r[3] - r[1]);

// ---- walls ----
// ax 'x': runs along plan y at constant plan x = c.   ax 'y': runs along plan x at constant plan y = c.
// m: [material on the lower-coordinate face, material on the higher-coordinate face]
// op: openings along the run. kind: open | door | glass | niche (see-through, not walkable) | jaali
const T = 'terra';
const I = 'ivory';
const C = 'clay';
const EXT = 2.6; // 9 inch wall
const INT = 1.4; // 4.5 inch partition
const slide = (a, b, pane) => [
  { a, b: a + pane, kind: 'glass', head: 2.4 },
  { a: a + pane, b: b - pane, kind: 'open', head: 2.4 },
  { a: b - pane, b, kind: 'glass', head: 2.4 },
];

export const WALLS = [
  // --- bedroom 17 wing ---
  { ax: 'y', c: 78.5, a: 360.7, b: 485.8, t: EXT, m: [T, I], op: [{ a: 433, b: 464, kind: 'niche', head: 2.3 }] },
  {
    ax: 'x',
    c: 362,
    a: 79.8,
    b: 133.1,
    t: EXT,
    m: [T, I],
    op: [
      { a: 84, b: 98, kind: 'glass', sill: 1.0, head: 2.2 },
      { a: 107, b: 129, kind: 'glass', sill: 0.7, head: 2.2 },
    ],
  },
  { ax: 'x', c: 484.5, a: 79.8, b: 133.1, t: EXT, m: [I, T], op: slide(87, 126, 13) },
  { ax: 'y', c: 134.4, a: 360.7, b: 452, t: EXT, m: [I, I], op: [{ a: 416.5, b: 427, kind: 'door' }] },
  { ax: 'y', c: 134.4, a: 452, b: 485.8, t: EXT, m: [C, T] },
  {
    ax: 'x',
    c: 413.7,
    a: 79.8,
    b: 133.1,
    t: INT,
    m: [I, C],
    op: [
      { a: 91.5, b: 100.5, kind: 'door' },
      { a: 103.5, b: 112.5, kind: 'door' },
    ],
  },
  { ax: 'y', c: 102, a: 363.3, b: 413, t: INT, m: [I, I] },
  // --- bedroom 1 wing ---
  { ax: 'y', c: 330.7, a: 360.7, b: 485.8, t: EXT, m: [I, T], op: [{ a: 429, b: 459, kind: 'niche', head: 2.3 }] },
  {
    ax: 'x',
    c: 362,
    a: 277.2,
    b: 329.4,
    t: EXT,
    m: [T, I],
    op: [
      { a: 282, b: 295, kind: 'glass', sill: 1.2, head: 2.2 },
      { a: 306, b: 327, kind: 'glass', sill: 0.7, head: 2.2 },
    ],
  },
  { ax: 'x', c: 484.5, a: 277.2, b: 329.4, t: EXT, m: [I, T], op: slide(284, 323, 13) },
  {
    ax: 'y',
    c: 275.9,
    a: 360.7,
    b: 452,
    t: EXT,
    m: [I, I],
    op: [
      { a: 365, b: 375.5, kind: 'door' },
      { a: 416.5, b: 427, kind: 'door' },
    ],
  },
  { ax: 'y', c: 275.9, a: 452, b: 485.8, t: EXT, m: [T, C] },
  {
    ax: 'x',
    c: 413.7,
    a: 277.2,
    b: 329.4,
    t: INT,
    m: [I, C],
    op: [
      { a: 289, b: 298, kind: 'door' },
      { a: 300.5, b: 309.5, kind: 'door' },
    ],
  },
  { ax: 'y', c: 299, a: 363.3, b: 413, t: INT, m: [I, I] },
  { ax: 'x', c: 382.5, a: 277.2, b: 298.3, t: INT, m: [I, I] },
  // --- hall and open kitchen ---
  {
    ax: 'x',
    c: 362,
    a: 135.7,
    b: 274.6,
    t: EXT,
    m: [T, I],
    op: [
      { a: 137.5, b: 148.3, kind: 'niche', head: 2.2 },
      { a: 151.5, b: 169.8, kind: 'niche', head: 2.3 },
      ...slide(172.6, 233.4, 10.5),
      { a: 238.5, b: 273.2, kind: 'niche', head: 2.3 },
    ],
  },
  {
    ax: 'x',
    c: 429,
    a: 135.7,
    b: 274.6,
    t: EXT,
    m: [I, T],
    op: [...slide(176.6, 234.6, 10.5), { a: 261.5, b: 270.5, kind: 'door' }],
  },
  // --- pool bathroom 14, store 13, store 9, powder room 6 ---
  { ax: 'y', c: 151, a: 430.3, b: 453.3, t: 2, m: [I, T], op: [{ a: 441, b: 449.5, kind: 'door' }] },
  { ax: 'x', c: 452, a: 135.7, b: 150, t: EXT, m: [I, T], op: [{ a: 139.5, b: 147, kind: 'glass', sill: 1.5, head: 2.1 }] },
  { ax: 'x', c: 437.5, a: 152, b: 175.8, t: EXT, m: [T, T] },
  { ax: 'y', c: 174.8, a: 430.3, b: 438.8, t: 2, m: [T, T] },
  { ax: 'y', c: 258.5, a: 430.3, b: 453.3, t: 2, m: [T, I] },
  { ax: 'x', c: 452, a: 259.5, b: 274.6, t: EXT, m: [I, T], op: [{ a: 263.5, b: 271, kind: 'glass', sill: 1.5, head: 2.1 }] },
  { ax: 'x', c: 437.5, a: 234.8, b: 257.5, t: EXT, m: [T, T] },
  { ax: 'y', c: 235.8, a: 430.3, b: 438.8, t: 2, m: [T, T] },
  // --- entrance bays: pooja 12, french windows 11 and 8 ---
  { ax: 'y', c: 134.4, a: 350.2, b: 360.7, t: EXT, m: [T, I] },
  { ax: 'x', c: 351.5, a: 135.7, b: 170.6, t: EXT, m: [T, I], op: [{ a: 152, b: 169, kind: 'glass', sill: 0.45, head: 2.3 }] },
  { ax: 'y', c: 149.6, a: 352.8, b: 360.7, t: INT, m: [I, I] },
  { ax: 'x', c: 351.5, a: 236, b: 274.6, t: EXT, m: [T, I], op: [{ a: 240, b: 272, kind: 'glass', sill: 0.45, head: 2.3 }] },
  { ax: 'y', c: 275.9, a: 350.2, b: 360.7, t: EXT, m: [I, T] },
  // --- entrance screen walls with brick jaali, full height from the ground ---
  {
    ax: 'x',
    c: 343.5,
    a: 77.2,
    b: 171.3,
    t: EXT,
    m: [T, T],
    base: 0,
    h: F1 + PARAPET,
    op: [{ a: 104, b: 158, kind: 'jaali', sill: 1.0, head: 3.9 }],
  },
  {
    ax: 'x',
    c: 343.5,
    a: 234.8,
    b: 332,
    t: EXT,
    m: [T, T],
    base: 0,
    h: F1 + PARAPET,
    op: [{ a: 248, b: 302, kind: 'jaali', sill: 1.0, head: 3.9 }],
  },
  { ax: 'y', c: 171.3, a: 344.8, b: 360.7, t: EXT, m: [T, T], base: 0, h: F1 + PARAPET },
  { ax: 'y', c: 234.8, a: 344.8, b: 360.7, t: EXT, m: [T, T], base: 0, h: F1 + PARAPET },
  { ax: 'y', c: 78.5, a: 344.8, b: 360.7, t: EXT, m: [T, T], base: 0, h: F1 + PARAPET },
  { ax: 'y', c: 330.7, a: 344.8, b: 360.7, t: EXT, m: [T, T], base: 0, h: F1 + PARAPET },
];

// first floor: multi room, bathroom, storage passage
export const WALLS_UP = [
  { ax: 'y', c: 152.5, a: 360.7, b: 430.3, t: EXT, m: [T, I], op: slide(366, 425, 20) },
  {
    ax: 'x',
    c: 362,
    a: 153.8,
    b: 253.7,
    t: EXT,
    m: [T, I],
    op: [
      { a: 157, b: 228, kind: 'glass', head: 2.3 },
      { a: 238, b: 250, kind: 'glass', sill: 1.5, head: 2.1 },
    ],
  },
  { ax: 'x', c: 429, a: 153.8, b: 253.7, t: EXT, m: [I, T], op: [{ a: 157, b: 228, kind: 'glass', head: 2.3 }] },
  {
    ax: 'y',
    c: 232,
    a: 363.3,
    b: 427.7,
    t: INT,
    m: [I, I],
    op: [
      { a: 396, b: 405.5, kind: 'door' },
      { a: 417, b: 426.5, kind: 'door' },
    ],
  },
  { ax: 'y', c: 255, a: 360.7, b: 430.3, t: EXT, m: [I, T], op: [{ a: 417, b: 426.5, kind: 'door' }] },
  { ax: 'x', c: 415.5, a: 232.7, b: 253.7, t: INT, m: [I, I] },
];

// terrace parapets along the roof outline (the multi room walls close the rest)
export const PARAPETS = [
  ['y', 78.5, 360.7, 485.8],
  ['x', 484.5, 79.8, 135.7],
  ['y', 135.7, 451.7, 485.8],
  ['x', 451.7, 137, 151.5],
  ['y', 151.5, 437.2, 453],
  ['x', 437.2, 152.8, 175.5],
  ['y', 175.5, 430.3, 438.5],
  ['y', 235.5, 430.3, 438.5],
  ['x', 437.2, 235.5, 257.2],
  ['y', 258.5, 437.2, 453],
  ['x', 451.7, 258.5, 274.5],
  ['y', 275.8, 451.7, 485.8],
  ['x', 484.5, 277.1, 329.4],
  ['y', 330.7, 360.7, 440, 459, 485.8], // gap where the outside stair lands
  ['x', 362, 79.8, 151.2],
  ['x', 362, 256.3, 329.4],
];

// terracotta columns drawn on the plan at the outer corners
export const COLUMNS = [
  [362, 78.5],
  [484.5, 78.5],
  [484.5, 134.4],
  [362, 330.7],
  [484.5, 330.7],
  [484.5, 275.9],
  [452, 151],
  [452, 258.5],
  [437.5, 174.8],
  [437.5, 235.8],
  [351.5, 134.4],
  [351.5, 275.9],
];

// guided tour stops. p / l in plan coords; world: true means already metres.
export const TOUR = [
  {
    t: 'Garden arrival',
    c: 'Two bedroom wings, an open living core and a jaali crown above the pool.',
    lv: 0,
    p: [0, 19.3],
    l: [0, 4],
    world: true,
  },
  {
    t: 'Entrance',
    c: 'Brick jaali screens and a planted pergola frame the way in from the north.',
    lv: 0,
    p: [0.4, -9.6],
    l: [0, -2],
    world: true,
  },
  { t: 'Living room', c: 'The hall, 28′6″ × 18′6″, opens on both long sides to garden and water.', lv: 0, p: [372, 205], l: [420, 172] },
  {
    t: 'Dining and kitchen',
    c: 'A timber table, cane pendants and an island kitchen share the same room.',
    lv: 0,
    p: [420, 207],
    l: [388, 262],
  },
  {
    t: 'Bedroom suite',
    c: 'Each 20′0″ × 15′0″ bedroom slides open to the deck and has its own dresser and bath.',
    lv: 0,
    p: [423, 124],
    l: [462, 100],
  },
  { t: 'Bath', c: 'Stone, warm plaster and a window onto the planted jaali court.', lv: 0, p: [407, 113], l: [372, 127] },
  { t: 'Second bedroom', c: 'The same suite, mirrored at the other end of the house.', lv: 0, p: [423, 286], l: [462, 308] },
  { t: 'Poolside sitting', c: 'A sunken seat beside the 23′0″ pool, level with the water.', lv: 0, p: [442, 206], l: [490, 206] },
  {
    t: 'Garden pavilion',
    c: 'A timber pergola under creepers, across the lawn from the entrance.',
    lv: 0,
    p: [10.2, -8.2],
    l: [15.6, -12.4],
    world: true,
  },
  { t: 'Multi room', c: 'Upstairs, 22′9″ × 18′6″ of open floor for reading, gathering or yoga.', lv: 1, p: [421, 225], l: [378, 168] },
  {
    t: 'Terraces',
    c: 'Two open terraces: one with the mud bath and built-in seating, one facing the evening sun.',
    lv: 1,
    p: [378, 141],
    l: [452, 98],
  },
];

export const START = { lv: 0, p: [0, 19.3], l: [0, 4] };
