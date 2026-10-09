// Flat-top hex grid, axial coords, squashed vertically for FO2-like isometric look.
export interface Hex { q: number; r: number }

export const HEX_W = 48; // full width of hex
export const HEX_H = 24; // full height of hex (squashed)
export const STEP_X = HEX_W * 0.75;

// Directions ordered clockwise starting from NE: NE, E(SE-ish), SE, SW, W, NW.
// For flat-top: 0=NE,1=SE,2=S,3=SW,4=NW,5=N. We map sprite facings to these.
export const DIRS: Hex[] = [
  { q: 1, r: -1 }, // 0 NE
  { q: 1, r: 0 },  // 1 SE
  { q: 0, r: 1 },  // 2 S
  { q: -1, r: 1 }, // 3 SW
  { q: -1, r: 0 }, // 4 NW
  { q: 0, r: -1 }, // 5 N
];

export const hex = (q: number, r: number): Hex => ({ q, r });
export const key = (h: Hex) => `${h.q},${h.r}`;
export const fromKey = (k: string): Hex => { const [q, r] = k.split(',').map(Number); return { q, r }; };
export const eq = (a: Hex, b: Hex) => a.q === b.q && a.r === b.r;
export const add = (a: Hex, b: Hex): Hex => ({ q: a.q + b.q, r: a.r + b.r });
export const neighbors = (h: Hex): Hex[] => DIRS.map(d => add(h, d));

export function distance(a: Hex, b: Hex): number {
  const dq = a.q - b.q, dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

export function round(q: number, r: number): Hex {
  const s = -q - r;
  let rq = Math.round(q), rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return { q: rq + 0, r: rr + 0 };
}

export function line(a: Hex, b: Hex): Hex[] {
  const n = distance(a, b);
  const out: Hex[] = [];
  for (let i = 0; i <= n; i++) {
    const t = n === 0 ? 0 : i / n;
    out.push(round(a.q + (b.q - a.q) * t + 1e-6, a.r + (b.r - a.r) * t + 1e-6));
  }
  return out;
}

// Center of hex in world pixels.
export function toScreen(h: Hex): { x: number; y: number } {
  return { x: h.q * STEP_X, y: (h.r + h.q / 2) * HEX_H };
}

export function fromScreen(x: number, y: number): Hex {
  const q = x / STEP_X;
  const r = y / HEX_H - q / 2;
  return round(q, r);
}

// Direction index (0..5) from a to b, by screen angle.
export function direction(a: Hex, b: Hex): number {
  const pa = toScreen(a), pb = toScreen(b);
  const ang = Math.atan2((pb.y - pa.y) * 2, pb.x - pa.x); // unsquash
  // DIRS screen angles: NE=-30°, SE=30°, S=90°, SW=150°, NW=-150°, N=-90°
  const deg = (ang * 180) / Math.PI;
  const targets = [-30, 30, 90, 150, -150, -90];
  let best = 0, bd = 999;
  targets.forEach((t, i) => {
    let d = Math.abs(deg - t); if (d > 180) d = 360 - d;
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}

// Offset (odd-q) <-> axial, used for rectangular maps.
export const offsetToAxial = (col: number, row: number): Hex => ({ q: col, r: row - (col - (col & 1)) / 2 });
export const axialToOffset = (h: Hex) => ({ col: h.q, row: h.r + (h.q - (h.q & 1)) / 2 });
