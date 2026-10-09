// Inventory, equipment, consumables, containers, barter math. Pure-ish: mutates passed objects + `game`, logs via state.log.
import type { Actor, InvStack, ItemDef } from './types';
import { ITEMS } from '../data/items';
import { MAPS, type MapContainer } from '../data/map';
import { acFor, carryWeightFor } from './stats';
import { game, log } from './state';
import { t } from './i18n';

export interface Holder { inventory: InvStack[] }

export const ITEM_AP_COST = 2;

// Combat hook: UI sets inCombat (world.inputOverride !== null). Combat may override too.
export const combatHooks = { inCombat: (): boolean => false };

const def = (id: string): ItemDef | undefined => ITEMS[id];
const nm = (id: string) => (def(id) ? t(def(id)!.nameKey) : id);

// ---------- basic stack ops ----------
export function countItem(h: Holder, id: string): number {
  return h.inventory.reduce((n, s) => n + (s.id === id ? s.count : 0), 0);
}
export const hasItem = (h: Holder, id: string, n = 1) => countItem(h, id) >= n;

export function addItem(h: Holder, id: string, n = 1, loaded?: number): void {
  if (n <= 0) return;
  const s = h.inventory.find(x => x.id === id);
  if (s) {
    s.count += n;
    if (loaded) s.loaded = (s.loaded ?? 0) + loaded;
  } else {
    const st: InvStack = { id, count: n };
    if (loaded !== undefined || def(id)?.magazine) st.loaded = loaded ?? 0;
    h.inventory.push(st);
  }
}

// Removes up to n items; returns how many removed. Unequips actor slots if the last one is gone.
// Loaded ammo of a removed last weapon is returned in `loaded`.
export function removeItem(h: Holder, id: string, n = 1): { removed: number; loaded: number } {
  const i = h.inventory.findIndex(x => x.id === id);
  if (i < 0 || n <= 0) return { removed: 0, loaded: 0 };
  const s = h.inventory[i];
  const removed = Math.min(n, s.count);
  s.count -= removed;
  let loaded = 0;
  if (s.count <= 0) {
    loaded = s.loaded ?? 0;
    h.inventory.splice(i, 1);
    const a = h as Partial<Actor>;
    if (a.weapon === id) a.weapon = undefined;
    if (a.armor === id) { a.armor = undefined; if (a.special) recalcArmor(a as Actor); }
  }
  return { removed, loaded };
}

export function totalWeight(h: Holder): number {
  return h.inventory.reduce((w, s) => w + (def(s.id)?.weight ?? 0) * s.count, 0);
}
export const carryCapacity = (a: Actor) => carryWeightFor(a.special);

// ---------- equipment ----------
export function recalcArmor(a: Actor) {
  const ar = a.armor ? def(a.armor) : undefined;
  a.ac = acFor(a.special) + (ar?.ac ?? 0);
  a.dr = ar?.dr ?? 0;
}

export function equipWeapon(a: Actor, id: string | undefined): boolean {
  if (id === undefined) { a.weapon = undefined; return true; }
  if (def(id)?.type !== 'weapon' || !hasItem(a, id)) return false;
  a.weapon = id;
  return true;
}

export function equipArmor(a: Actor, id: string | undefined): boolean {
  if (id !== undefined && (def(id)?.type !== 'armor' || !hasItem(a, id))) return false;
  a.armor = id;
  recalcArmor(a);
  return true;
}

// Next weapon in inventory (fists included); for HUD weapon slot.
export function cycleWeapon(a: Actor): string | undefined {
  const ids: (string | undefined)[] = [undefined, ...new Set(a.inventory.filter(s => def(s.id)?.type === 'weapon').map(s => s.id))];
  const next = ids[(ids.indexOf(a.weapon) + 1) % ids.length];
  equipWeapon(a, next);
  return next;
}

// In combat item actions cost AP. Returns false (and logs) if not enough.
function payAp(a: Actor): boolean {
  if (a.id !== 'player' || !combatHooks.inCombat()) return true;
  if (a.ap < ITEM_AP_COST) { log(t('inv.log.noAp', { ap: ITEM_AP_COST })); return false; }
  a.ap -= ITEM_AP_COST;
  return true;
}

// ---------- consumables ----------
export function useItem(a: Actor, id: string): boolean {
  const d = def(id);
  if (!d || d.type !== 'consumable' || !hasItem(a, id)) return false;
  if (!payAp(a)) return false;
  removeItem(a, id, 1);
  const parts: string[] = [];
  if (d.heal) {
    const before = a.hp;
    a.hp = Math.min(a.maxHp, a.hp + d.heal);
    parts.push(t('inv.log.heal', { n: a.hp - before }));
  }
  if (d.rads && a.id === 'player') {
    const before = game.rads;
    game.rads = Math.max(0, game.rads + d.rads);
    const diff = game.rads - before;
    if (diff) parts.push(t(diff > 0 ? 'inv.log.radsUp' : 'inv.log.radsDown', { n: Math.abs(diff) }));
  }
  if (a.id === 'player') log(t('inv.log.used', { item: nm(id) }) + (parts.length ? ' ' + parts.join(', ') + '.' : ''));
  return true;
}

// ---------- ammo ----------
export function reload(a: Actor, weaponId = a.weapon): boolean {
  const d = weaponId ? def(weaponId) : undefined;
  const s = a.inventory.find(x => x.id === weaponId);
  if (!d?.magazine || !d.ammo || !s) return false;
  const need = d.magazine - (s.loaded ?? 0);
  if (need <= 0) { if (a.id === 'player') log(t('inv.log.full', { item: nm(d.id) })); return false; }
  const have = countItem(a, d.ammo);
  if (!have) { if (a.id === 'player') log(t('inv.log.noAmmo', { item: nm(d.id) })); return false; }
  if (!payAp(a)) return false;
  const n = Math.min(need, have);
  removeItem(a, d.ammo, n);
  s.loaded = (s.loaded ?? 0) + n;
  if (a.id === 'player') log(t('inv.log.reloaded', { item: nm(d.id), n: s.loaded, max: d.magazine }));
  return true;
}

export function unload(a: Actor, weaponId: string): boolean {
  const d = def(weaponId);
  const s = a.inventory.find(x => x.id === weaponId);
  if (!d?.ammo || !s?.loaded) return false;
  addItem(a, d.ammo, s.loaded);
  s.loaded = 0;
  if (a.id === 'player') log(t('inv.log.unloaded', { item: nm(d.id) }));
  return true;
}

export function dropItem(a: Actor, id: string, n = 1): boolean {
  const d = def(id);
  if (!d || d.type === 'quest') { log(t('inv.log.cantDrop')); return false; }
  const { removed, loaded } = removeItem(a, id, n);
  if (loaded && d.ammo) addItem(a, d.ammo, loaded);
  if (removed) log(t('inv.log.dropped', { item: nm(id), n: removed }));
  return removed > 0;
}

// Moves n items (with loaded ammo when the last weapon of a stack moves).
export function transfer(from: Holder, to: Holder, id: string, n = 1): number {
  const src = from.inventory.find(x => x.id === id);
  if (!src) return 0;
  n = Math.min(n, src.count);
  // Keep ammo with the weapon: whole stack moves its loaded rounds.
  const movingAll = n === src.count;
  const { removed, loaded } = removeItem(from, id, n);
  if (removed) addItem(to, id, removed, movingAll ? loaded : undefined);
  return removed;
}

// ---------- containers ----------
export const corpseId = (actorId: string) => `corpse:${actorId}`;
export const mapContainer = (id: string): MapContainer | undefined => {
  for (const m of Object.values(MAPS)) { const c = m.containers.find(c => c.id === id); if (c) return c; }
  return undefined;
};

// Resolves a container id to a Holder. Corpses use the dead actor's inventory.
export function containerHolder(id: string, actors?: Map<string, Actor>): Holder | undefined {
  if (id.startsWith('corpse:')) return actors?.get(id.slice(7));
  if (!game.containers[id]) {
    const mc = mapContainer(id);
    if (!mc) return undefined;
    game.containers[id] = mc.items.map(i => ({ ...i, ...(def(i.id)?.magazine ? { loaded: 0 } : {}) }));
  }
  return { inventory: game.containers[id] };
}

export const unlockedFlag = (id: string) => `unlocked:${id}`;
export type UnlockResult = 'open' | 'key' | 'picked' | 'failed' | 'needKey';

export function lockpickChance(skill: number, difficulty: number) {
  return Math.max(5, Math.min(95, skill - difficulty + 50));
}

// Checks lock; on success sets flag. roll() returns [0,1).
export function tryUnlock(id: string, a: Actor = game.player, roll: () => number = Math.random): UnlockResult {
  const mc = mapContainer(id);
  if (!mc || (mc.lockedSkill === undefined && !mc.keyId) || game.flags[unlockedFlag(id)]) return 'open';
  if (mc.keyId && hasItem(a, mc.keyId)) {
    game.flags[unlockedFlag(id)] = true;
    log(t('inv.log.unlockKey', { item: nm(mc.keyId) }));
    return 'key';
  }
  if (mc.lockedSkill === undefined) { log(t('inv.log.needKey')); return 'needKey'; }
  const chance = lockpickChance(a.skills.lockpick, mc.lockedSkill);
  if (roll() * 100 < chance) {
    game.flags[unlockedFlag(id)] = true;
    log(t('inv.log.picked', { chance }));
    return 'picked';
  }
  log(t('inv.log.pickFail', { chance }));
  return 'failed';
}

// ---------- barter ----------
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
// FO2-ish: trader marks up by base 25% plus skill gap; buys at ~60% adjusted by skill gap.
export function buyFactor(player: Actor, trader: Actor) {
  return clamp(1.25 + (trader.skills.barter - player.skills.barter) / 100, 1.05, 2.5);
}
export function sellFactor(player: Actor, trader: Actor) {
  return clamp(0.6 + (player.skills.barter - trader.skills.barter) / 200, 0.25, 0.9);
}
export const buyPrice = (id: string, p: Actor, tr: Actor) => Math.ceil((def(id)?.value ?? 0) * buyFactor(p, tr));
export const sellPrice = (id: string, p: Actor, tr: Actor) => Math.floor((def(id)?.value ?? 0) * sellFactor(p, tr));

export type Offer = Record<string, number>; // item id -> count
export const offerValue = (o: Offer, price: (id: string) => number) =>
  Object.entries(o).reduce((v, [id, n]) => v + price(id) * n, 0);

export function npcCaps(npc: Actor): number {
  if (npc.caps === undefined) {
    const f = game.flags[`caps:${npc.id}`];
    npc.caps = typeof f === 'number' ? f : 150 + 10 * npc.skills.barter;
  }
  return npc.caps;
}
export function setNpcCaps(npc: Actor, v: number) { npc.caps = v; game.flags[`caps:${npc.id}`] = v; }

export type BarterResult = 'ok' | 'empty' | 'noCaps' | 'traderNoCaps' | 'tooHeavy' | 'quest';

// Settles a deal. `owed` > 0: player pays caps; < 0: trader pays.
export function barter(player: Actor, trader: Actor, give: Offer, take: Offer): { result: BarterResult; owed: number } {
  const giveV = offerValue(give, id => sellPrice(id, player, trader));
  const takeV = offerValue(take, id => buyPrice(id, player, trader));
  const owed = takeV - giveV;
  if (!Object.values(give).some(n => n > 0) && !Object.values(take).some(n => n > 0)) return { result: 'empty', owed };
  if (Object.keys(give).some(id => def(id)?.type === 'quest' && give[id] > 0)) return { result: 'quest', owed };
  for (const [id, n] of Object.entries(give)) if (countItem(player, id) < n) return { result: 'empty', owed };
  for (const [id, n] of Object.entries(take)) if (countItem(trader, id) < n) return { result: 'empty', owed };
  if (owed > game.caps) return { result: 'noCaps', owed };
  if (-owed > npcCaps(trader)) return { result: 'traderNoCaps', owed };
  const wDelta = offerValue(take, id => def(id)?.weight ?? 0) - offerValue(give, id => def(id)?.weight ?? 0);
  if (wDelta > 0 && totalWeight(player) + wDelta > carryCapacity(player)) return { result: 'tooHeavy', owed };
  for (const [id, n] of Object.entries(give)) transfer(player, trader, id, n);
  for (const [id, n] of Object.entries(take)) transfer(trader, player, id, n);
  game.caps -= owed;
  setNpcCaps(trader, npcCaps(trader) + owed);
  return { result: 'ok', owed };
}
