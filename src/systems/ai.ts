// Enemy combat AI. Aggressive: close in and attack while AP lasts. Coward: flee below 30% HP.
import type { Actor, ItemDef } from './types';
import type { Hex } from './hex';
import type { CombatController } from './combat';
import { distance, key, neighbors } from './hex';
import {
  weaponOf, UNARMED, usesAmmo, loadedAmmo, reserveAmmo, apCost, attackBlocker, stepsUntil, isMelee, RELOAD_AP,
} from './combat';
import { log } from './state';
import { t } from './i18n';

export const shouldFlee = (a: Actor) => a.ai === 'coward' && a.hp < a.maxHp * 0.3;

// Weapon AI will actually use now: equipped if loaded, else fists (unless it can reload).
function usableWeapon(a: Actor): { w: ItemDef; needReload: boolean } {
  const w = weaponOf(a);
  if (!usesAmmo(w) || loadedAmmo(a) > 0) return { w, needReload: false };
  if (reserveAmmo(a) > 0) return { w, needReload: true };
  return { w: UNARMED, needReload: false };
}

// BFS within `steps` for the reachable hex farthest from `from`.
export function fleeTarget(start: Hex, from: Hex, steps: number, blocked: (h: Hex) => boolean): Hex | null {
  const seen = new Set([key(start)]);
  let frontier = [start];
  let best: Hex | null = null; let bestD = distance(start, from);
  for (let i = 0; i < steps; i++) {
    const next: Hex[] = [];
    for (const h of frontier) for (const n of neighbors(h)) {
      if (seen.has(key(n)) || blocked(n)) continue;
      seen.add(key(n)); next.push(n);
      const d = distance(n, from);
      if (d > bestD) { bestD = d; best = n; }
    }
    frontier = next;
  }
  return best;
}

export async function aiTurn(c: CombatController, a: Actor) {
  const w = c.world;
  const p = c.player;
  if (shouldFlee(a)) {
    log(t('combat.flee', { name: t(a.nameKey) }));
    const goal = fleeTarget(a.pos, p.pos, a.ap, h => w.isBlocked(h, a.id));
    const path = goal && w.pathFor(a, goal);
    if (path) await c.walk(a, path);
    return;
  }
  for (let guard = 0; guard < 12 && a.ap > 0 && c.active && !a.dead && !p.dead; guard++) {
    const { w: wpn, needReload } = usableWeapon(a);
    if (needReload) {
      if (a.ap < RELOAD_AP || !(await c.doReload(a))) break;
      continue;
    }
    const cost = apCost(wpn);
    const canFrom = (h: Hex) => !attackBlocker(h, p.pos, wpn, w.hasLos(h, p.pos));
    if (canFrom(a.pos)) {
      if (a.ap < cost) break;
      await c.attack(a, p, wpn);
      continue;
    }
    // Approach: melee → path to a free neighbor of player; ranged → walk player-ward until in range+LOS.
    const path = isMelee(wpn) ? c.pathAdjacent(a, p) : w.pathFor(a, p.pos, true)?.slice(0, -1) ?? null;
    if (!path || !path.length) break;
    const need = stepsUntil(a.pos, path, canFrom);
    const steps = Math.min(need > 0 ? need : path.length, a.ap);
    const before = a.ap;
    await c.walk(a, path.slice(0, steps));
    if (a.ap === before) break; // stuck
    if (distance(a.pos, p.pos) > 1 && a.ap <= 0) break;
  }
}
