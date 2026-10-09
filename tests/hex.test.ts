import { describe, it, expect } from 'vitest';
import { distance, toScreen, fromScreen, line, neighbors, direction, offsetToAxial, axialToOffset, DIRS } from '../src/systems/hex';
import { findPath } from '../src/systems/pathfind';

describe('hex', () => {
  it('distance', () => {
    expect(distance({ q: 0, r: 0 }, { q: 3, r: -1 })).toBe(3);
    neighbors({ q: 2, r: 2 }).forEach(n => expect(distance(n, { q: 2, r: 2 })).toBe(1));
  });
  it('screen roundtrip', () => {
    for (let q = -5; q < 5; q++) for (let r = -5; r < 5; r++) {
      const p = toScreen({ q, r });
      expect(fromScreen(p.x + 3, p.y - 2)).toEqual({ q, r });
    }
  });
  it('line length', () => expect(line({ q: 0, r: 0 }, { q: 4, r: -2 })).toHaveLength(5));
  it('direction matches DIRS', () => DIRS.forEach((d, i) => expect(direction({ q: 0, r: 0 }, d)).toBe(i)));
  it('offset roundtrip', () => {
    for (let c = 0; c < 6; c++) for (let r = 0; r < 6; r++) expect(axialToOffset(offsetToAxial(c, r))).toEqual({ col: c, row: r });
  });
  it('path avoids wall', () => {
    const wall = new Set(['1,0', '1,-1', '1,1']);
    const p = findPath({ q: 0, r: 0 }, { q: 2, r: 0 }, h => !wall.has(`${h.q},${h.r}`))!;
    expect(p.at(-1)).toEqual({ q: 2, r: 0 });
    p.forEach(h => expect(wall.has(`${h.q},${h.r}`)).toBe(false));
  });
});
