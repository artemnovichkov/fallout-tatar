// XP / level-up / skill points.
import type { SkillId } from './types';
import { xpForLevel, maxHpFor, recalcDerived } from './stats';
import { game, log, changed } from './state';
import { bus } from './events';
import { t } from './i18n';
import { recalcArmor } from './inventory';

export const skillPointsPerLevel = (I: number) => 5 + 2 * I;
export const nextLevelXp = (level = game.level) => xpForLevel(level + 1);

// Cost of raising a skill by 1 point (FO2: doubles above 100%).
export const skillCost = (value: number) => (value >= 100 ? 2 : 1);

// Applies all pending level-ups. Returns number of levels gained.
export function checkLevelUp(): number {
  let gained = 0;
  while (game.xp >= xpForLevel(game.level + 1)) {
    const p = game.player;
    const oldMax = p.maxHp;
    game.level++;
    gained++;
    recalcDerived(p, game.level);
    p.maxHp = maxHpFor(p.special, game.level);
    p.hp = Math.min(p.maxHp, p.hp + (p.maxHp - oldMax));
    recalcArmor(p);
    game.skillPoints = (game.skillPoints ?? 0) + skillPointsPerLevel(p.special.I);
    log(t('lvl.up', { level: game.level, hp: p.maxHp - oldMax, sp: skillPointsPerLevel(p.special.I) }));
  }
  return gained;
}

export function addXp(n: number) {
  game.xp += n;
  log(t('lvl.xp', { n }));
  changed();
}

// Spends points on a skill; returns false if not enough.
export function raiseSkill(id: SkillId): boolean {
  const p = game.player;
  const cost = skillCost(p.skills[id]);
  if ((game.skillPoints ?? 0) < cost || p.skills[id] >= 300) return false;
  game.skillPoints = (game.skillPoints ?? 0) - cost;
  p.skills[id]++;
  return true;
}
export function lowerSkill(id: SkillId): boolean {
  const p = game.player;
  if (p.skills[id] <= 0) return false;
  p.skills[id]--;
  game.skillPoints = (game.skillPoints ?? 0) + skillCost(p.skills[id]);
  return true;
}

let inited = false;
export function initLeveling() {
  if (inited) return;
  inited = true;
  bus.on('stateChanged', () => { if (checkLevelUp()) changed(); });
}
