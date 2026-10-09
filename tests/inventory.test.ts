import { describe, it, expect, beforeEach } from 'vitest';
import { game, newGame, setGame } from '../src/systems/state';
import { spawnNpc } from '../src/data/npcs';
import { MAP } from '../src/data/map';
import {
  addItem, removeItem, countItem, hasItem, totalWeight, carryCapacity, equipWeapon, equipArmor, useItem, reload, unload,
  transfer, cycleWeapon, barter, buyPrice, sellPrice, npcCaps, containerHolder, tryUnlock, combatHooks, ITEM_AP_COST,
} from '../src/systems/inventory';
import { checkLevelUp, raiseSkill, lowerSkill, skillPointsPerLevel } from '../src/systems/leveling';
import { acFor, xpForLevel } from '../src/systems/stats';

beforeEach(() => { setGame(newGame()); combatHooks.inCombat = () => false; });

describe('inventory basics', () => {
  it('add/remove/count', () => {
    const p = game.player;
    addItem(p, 'junk', 3);
    expect(countItem(p, 'junk')).toBe(3);
    expect(hasItem(p, 'junk', 4)).toBe(false);
    expect(removeItem(p, 'junk', 5).removed).toBe(3);
    expect(hasItem(p, 'junk')).toBe(false);
  });
  it('weight and capacity', () => {
    const p = game.player;
    const w = totalWeight(p);
    addItem(p, 'junk', 2);
    expect(totalWeight(p)).toBe(w + 4);
    expect(carryCapacity(p)).toBe(25 + 25 * p.special.S);
  });
  it('removing last equipped weapon unequips', () => {
    const p = game.player;
    expect(p.weapon).toBe('pistol');
    const r = removeItem(p, 'pistol', 1);
    expect(r.loaded).toBe(6);
    expect(p.weapon).toBeUndefined();
  });
});

describe('equipment', () => {
  it('armor updates ac/dr', () => {
    const p = game.player;
    addItem(p, 'leather');
    expect(equipArmor(p, 'leather')).toBe(true);
    expect(p.ac).toBe(acFor(p.special) + 15);
    expect(p.dr).toBe(20);
    equipArmor(p, undefined);
    expect(p.ac).toBe(acFor(p.special));
    expect(equipArmor(p, 'tubeteika')).toBe(false); // not owned
  });
  it('equip and cycle weapons', () => {
    const p = game.player;
    expect(equipWeapon(p, 'knife')).toBe(true);
    expect(equipWeapon(p, 'stimpak')).toBe(false);
    p.weapon = undefined;
    expect(cycleWeapon(p)).toBe('knife');
    expect(cycleWeapon(p)).toBe('pistol');
    expect(cycleWeapon(p)).toBeUndefined();
  });
});

describe('consumables & ammo', () => {
  it('heals and changes rads', () => {
    const p = game.player;
    p.hp = 5;
    expect(useItem(p, 'stimpak')).toBe(true);
    expect(p.hp).toBe(20);
    expect(countItem(p, 'stimpak')).toBe(1);
    game.rads = 10;
    addItem(p, 'ayran');
    useItem(p, 'ayran');
    expect(game.rads).toBe(0);
    expect(useItem(p, 'knife')).toBe(false);
  });
  it('costs AP in combat', () => {
    const p = game.player;
    combatHooks.inCombat = () => true;
    p.ap = ITEM_AP_COST - 1;
    expect(useItem(p, 'stimpak')).toBe(false);
    p.ap = 5;
    expect(useItem(p, 'stimpak')).toBe(true);
    expect(p.ap).toBe(5 - ITEM_AP_COST);
  });
  it('reload/unload', () => {
    const p = game.player;
    const st = p.inventory.find(s => s.id === 'pistol')!;
    st.loaded = 1;
    expect(reload(p)).toBe(true);
    expect(st.loaded).toBe(6);
    expect(countItem(p, 'ammo9')).toBe(13);
    expect(reload(p)).toBe(false);
    expect(unload(p, 'pistol')).toBe(true);
    expect(countItem(p, 'ammo9')).toBe(19);
    expect(st.loaded).toBe(0);
  });
  it('transfer keeps loaded rounds with weapon', () => {
    const p = game.player;
    const box = { inventory: [] as any[] };
    expect(transfer(p, box, 'pistol', 1)).toBe(1);
    expect(box.inventory[0]).toMatchObject({ id: 'pistol', count: 1, loaded: 6 });
    expect(p.weapon).toBeUndefined();
  });
});

describe('containers', () => {
  it('initializes from map and persists in game.containers', () => {
    const id = MAP.containers[0].id;
    const h = containerHolder(id)!;
    expect(h.inventory.length).toBe(MAP.containers[0].items.length);
    h.inventory.pop();
    expect(containerHolder(id)!.inventory.length).toBe(MAP.containers[0].items.length - 1);
    expect(MAP.containers[0].items.length).toBeGreaterThan(0); // map def untouched
  });
  it('corpse uses actor inventory', () => {
    const r = spawnNpc('r1', 'raider', { q: 0, r: 0 });
    const h = containerHolder('corpse:r1', new Map([['r1', r]]));
    expect(h).toBe(r);
  });
  it('lockpick', () => {
    const c = { id: 'lockedTest', col: 0, row: 0, items: [], lockedSkill: 50 };
    MAP.containers.push(c);
    try {
      expect(tryUnlock('lockedTest', game.player, () => 0.99)).toBe('failed');
      expect(tryUnlock('lockedTest', game.player, () => 0)).toBe('picked');
      expect(tryUnlock('lockedTest', game.player, () => 0.99)).toBe('open');
    } finally { MAP.containers.pop(); }
  });
});

describe('barter', () => {
  it('prices: buy > value > sell', () => {
    const tr = spawnNpc('trader', 'trader', { q: 0, r: 0 });
    const p = game.player;
    expect(buyPrice('stimpak', p, tr)).toBeGreaterThan(75);
    expect(sellPrice('stimpak', p, tr)).toBeLessThan(75);
    p.skills.barter = 200;
    expect(sellPrice('stimpak', p, tr)).toBeLessThanOrEqual(75 * 0.9);
  });
  it('deal moves items and caps; refuses when broke', () => {
    const tr = spawnNpc('trader', 'trader', { q: 0, r: 0 });
    const p = game.player;
    game.caps = 0;
    if (!countItem(tr, 'stimpak')) addItem(tr, 'stimpak', 1);
    expect(barter(p, tr, {}, { stimpak: 1 }).result).toBe('noCaps');
    game.caps = 1000;
    const traderCaps = npcCaps(tr);
    const trEch = countItem(tr, 'echpochmak'), pStim = countItem(p, 'stimpak');
    const r = barter(p, tr, { echpochmak: 1 }, { stimpak: 1 });
    expect(r.result).toBe('ok');
    expect(r.owed).toBe(buyPrice('stimpak', p, tr) - sellPrice('echpochmak', p, tr));
    expect(game.caps).toBe(1000 - r.owed);
    expect(npcCaps(tr)).toBe(traderCaps + r.owed);
    expect(countItem(p, 'stimpak')).toBe(pStim + 1);
    expect(countItem(tr, 'echpochmak')).toBe(trEch + 1);
    expect(barter(p, tr, {}, {}).result).toBe('empty');
  });
});

describe('leveling', () => {
  it('levels up and grants skill points', () => {
    const p = game.player;
    const hp = p.maxHp;
    game.xp = xpForLevel(3);
    expect(checkLevelUp()).toBe(2);
    expect(game.level).toBe(3);
    expect(p.maxHp).toBeGreaterThan(hp);
    expect(game.skillPoints).toBe(2 * skillPointsPerLevel(p.special.I));
    const v = p.skills.lockpick;
    expect(raiseSkill('lockpick')).toBe(true);
    expect(p.skills.lockpick).toBe(v + 1);
    expect(lowerSkill('lockpick')).toBe(true);
    expect(game.skillPoints).toBe(2 * skillPointsPerLevel(p.special.I));
  });
  it('keeps armor AC on level up', () => {
    const p = game.player;
    addItem(p, 'leather'); equipArmor(p, 'leather');
    game.xp = xpForLevel(2);
    checkLevelUp();
    expect(p.ac).toBe(acFor(p.special) + 15);
  });
});
