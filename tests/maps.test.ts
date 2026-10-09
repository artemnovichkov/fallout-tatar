import { describe, it, expect } from 'vitest';
import { MAPS, FLOOR_LEGEND, OBJECT_LEGEND, type MapDef } from '../src/data/map';
import { NPC_TEMPLATES } from '../src/data/npcs';
import { ITEMS } from '../src/data/items';
import { offsetToAxial, axialToOffset, neighbors, key, type Hex } from '../src/systems/hex';

function reachableSet(m: MapDef, from: { col: number; row: number }) {
  const rows = m.floor.length, cols = m.floor[0].length;
  const npcHexes = new Set(m.npcs.map(n => key(offsetToAxial(n.col, n.row))));
  const passable = (h: Hex) => {
    const { col, row } = axialToOffset(h);
    if (row < 0 || row >= rows || col < 0 || col >= cols) return false;
    if (FLOOR_LEGEND[m.floor[row][col]] === 'water') return false;
    if (OBJECT_LEGEND[m.objects[row][col]]?.blocks) return false;
    return !npcHexes.has(key(h));
  };
  const start = offsetToAxial(from.col, from.row);
  const seen = new Set([key(start)]);
  const q = [start];
  while (q.length) for (const n of neighbors(q.shift()!)) if (!seen.has(key(n)) && passable(n)) { seen.add(key(n)); q.push(n); }
  const near = (col: number, row: number) => seen.has(key(offsetToAxial(col, row))) || neighbors(offsetToAxial(col, row)).some(n => seen.has(key(n)));
  return { seen, near, passable };
}

it('npc and container ids are unique across maps', () => {
  const ids = Object.values(MAPS).flatMap(m => [...m.npcs.map(n => n.id), ...m.containers.map(c => c.id)]);
  expect(new Set(ids).size).toBe(ids.length);
});

for (const m of Object.values(MAPS)) {
  describe(`map ${m.id}`, () => {
    const rows = m.floor.length, cols = m.floor[0].length;
    it('consistent rows and known legend chars', () => {
      m.floor.forEach(r => { expect(r.length).toBe(cols); [...r].forEach(ch => expect(FLOOR_LEGEND[ch], `floor '${ch}'`).toBeDefined()); });
      expect(m.objects.length).toBe(rows);
      m.objects.forEach(r => { expect(r.length).toBe(cols); [...r].forEach(ch => expect(ch === '.' || !!OBJECT_LEGEND[ch], `obj '${ch}'`).toBe(true)); });
    });
    it('containers on crate/locker/barrel, npcs on free hexes, items exist', () => {
      for (const c of m.containers) expect(['crate', 'locker', 'barrel', 'shelf', 'desk'], c.id).toContain(OBJECT_LEGEND[m.objects[c.row][c.col]]?.obj);
      for (const n of m.npcs) {
        expect(NPC_TEMPLATES[n.template], n.template).toBeDefined();
        expect(m.objects[n.row][n.col], n.id).toBe('.');
      }
      for (const c of m.containers) for (const i of c.items) expect(ITEMS[i.id], i.id).toBeDefined();
    });
    it('everything reachable from playerStart and every spawn', () => {
      const starts = [m.playerStart, ...Object.values(m.spawns ?? {})];
      for (const s of starts) {
        const { near, passable } = reachableSet(m, s);
        expect(passable(offsetToAxial(s.col, s.row)), `start ${s.col},${s.row}`).toBe(true);
        for (const n of m.npcs) expect(near(n.col, n.row), `npc ${n.id}`).toBe(true);
        for (const c of m.containers) expect(near(c.col, c.row), `container ${c.id}`).toBe(true);
        for (const e of m.exits ?? []) expect(near(e.col, e.row), `exit ${e.to}`).toBe(true);
      }
    });
    it('exits point to existing maps and spawns', () => {
      for (const e of m.exits ?? []) {
        expect(MAPS[e.to], e.to).toBeDefined();
        expect(MAPS[e.to].spawns?.[e.spawn], `${e.to}.${e.spawn}`).toBeDefined();
      }
    });
  });
}
