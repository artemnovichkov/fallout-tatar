import { describe, it, expect } from 'vitest';
import {
  hitChanceRaw, hitChance, calcDamage, rollDamage, rollAttack, turnOrder, reload, attackBlocker, stepsUntil,
  weaponOf, UNARMED, critChance, xpFor, strengthBonus,
} from '../src/systems/combat';
import { fleeTarget, shouldFlee } from '../src/systems/ai';
import { makeRavil } from '../src/systems/state';
import { spawnNpc } from '../src/data/npcs';
import { item } from '../src/data/items';
import { distance } from '../src/systems/hex';

const raider = (q = 3, r = 0) => spawnNpc('r', 'raider', { q, r });
const seq = (vals: number[]) => { let i = 0; return () => vals[i++ % vals.length]; };

describe('hit chance', () => {
  const base = { skill: 50, targetAc: 5, dist: 3, perception: 6, melee: false, los: true };
  it('basic formula', () => expect(hitChanceRaw(base)).toBe(75));
  it('distance penalty beyond perception', () => expect(hitChanceRaw({ ...base, dist: 10 })).toBe(75 - 16));
  it('clamped 5..95', () => {
    expect(hitChanceRaw({ ...base, skill: 200 })).toBe(95);
    expect(hitChanceRaw({ ...base, skill: 0, targetAc: 80 })).toBe(5);
  });
  it('ranged without LOS impossible', () => expect(hitChanceRaw({ ...base, los: false })).toBe(0));
  it('melee ignores distance penalty', () => expect(hitChanceRaw({ ...base, melee: true, dist: 1 })).toBe(75));
  it('armor AC lowers chance', () => {
    const p = makeRavil(); const r = raider();
    const before = hitChance(p, r);
    r.armor = 'leather';
    expect(hitChance(p, r)).toBe(before - item('leather').ac!);
  });
});

describe('damage', () => {
  it('crit doubles, DR reduces, min 1', () => {
    expect(calcDamage(10, false, 0)).toBe(10);
    expect(calcDamage(10, true, 0)).toBe(20);
    expect(calcDamage(10, false, 20)).toBe(8);
    expect(calcDamage(1, false, 50)).toBe(1);
  });
  it('rolls within weapon range', () => {
    const p = makeRavil(); const r = raider();
    for (let i = 0; i < 50; i++) {
      const d = rollDamage(p, r, false);
      expect(d).toBeGreaterThanOrEqual(5); expect(d).toBeLessThanOrEqual(12);
    }
  });
  it('unarmed 1-3 plus strength bonus', () => {
    const r = raider(); r.weapon = undefined; // S 6
    expect(weaponOf(r)).toBe(UNARMED);
    expect(strengthBonus(r, UNARMED)).toBe(2);
    expect(rollDamage(r, makeRavil(), false, () => 0)).toBe(3);
    expect(rollDamage(r, makeRavil(), false, () => 0.999)).toBe(5);
  });
  it('rollAttack miss / hit / crit', () => {
    const p = makeRavil(); const r = raider();
    expect(rollAttack(p, r, true, seq([0.99])).hit).toBe(false);
    const hit = rollAttack(p, r, true, seq([0, 0.99, 0]));
    expect(hit.hit && !hit.crit).toBe(true);
    const crit = rollAttack(p, r, true, seq([0, 0, 0]));
    expect(crit.crit).toBe(true);
    expect(crit.dmg).toBe(10);
    expect(critChance(p)).toBe(p.special.L + 2);
  });
});

describe('turn order', () => {
  it('sorts by sequence, player wins ties', () => {
    const p = makeRavil(); // P 6 → 12
    const a = raider(); a.id = 'a'; a.special.P = 6;
    const b = raider(); b.id = 'b'; b.special.P = 8;
    const c = raider(); c.id = 'c'; c.special.P = 3;
    expect(turnOrder([a, c, p, b]).map(x => x.id)).toEqual(['b', 'player', 'a', 'c']);
  });
});

describe('ammo', () => {
  it('reload moves ammo from inventory', () => {
    const p = makeRavil();
    p.inventory.find(s => s.id === 'pistol')!.loaded = 1;
    expect(reload(p)).toBe('ok');
    expect(p.inventory.find(s => s.id === 'pistol')!.loaded).toBe(6);
    expect(p.inventory.find(s => s.id === 'ammo9')!.count).toBe(13);
    expect(reload(p)).toBe('full');
  });
  it('no ammo / partial / stack removed', () => {
    const p = makeRavil();
    const st = p.inventory.find(s => s.id === 'pistol')!; st.loaded = 0;
    p.inventory.find(s => s.id === 'ammo9')!.count = 2;
    expect(reload(p)).toBe('ok');
    expect(st.loaded).toBe(2);
    expect(p.inventory.some(s => s.id === 'ammo9')).toBe(false);
    st.loaded = 0;
    expect(reload(p)).toBe('noAmmo');
    p.weapon = 'knife';
    expect(reload(p)).toBe('notNeeded');
  });
});

describe('range & ai helpers', () => {
  it('attackBlocker', () => {
    expect(attackBlocker({ q: 0, r: 0 }, { q: 2, r: 0 }, item('knife'), true)).toBe('range');
    expect(attackBlocker({ q: 0, r: 0 }, { q: 1, r: 0 }, item('knife'), true)).toBe(null);
    expect(attackBlocker({ q: 0, r: 0 }, { q: 5, r: 0 }, item('pistol'), false)).toBe('los');
    expect(attackBlocker({ q: 0, r: 0 }, { q: 15, r: 0 }, item('pistol'), true)).toBe('range');
  });
  it('stepsUntil', () => {
    const path = [1, 2, 3, 4].map(q => ({ q, r: 0 }));
    expect(stepsUntil({ q: 0, r: 0 }, path, h => h.q >= 3)).toBe(3);
    expect(stepsUntil({ q: 0, r: 0 }, path, () => true)).toBe(0);
    expect(stepsUntil({ q: 0, r: 0 }, path, () => false)).toBe(-1);
  });
  it('flee goes away', () => {
    const goal = fleeTarget({ q: 0, r: 0 }, { q: -1, r: 0 }, 4, () => false)!;
    expect(distance(goal, { q: -1, r: 0 })).toBe(5);
  });
  it('coward flees below 30%', () => {
    const r = raider(); r.ai = 'coward'; r.hp = 2;
    expect(shouldFlee(r)).toBe(true);
    r.ai = 'aggressive';
    expect(shouldFlee(r)).toBe(false);
  });
  it('xp', () => expect(xpFor(raider())).toBe(50));
});
