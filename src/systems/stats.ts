import type { Actor, SkillId, SpecialStats } from './types';

export const SPECIAL_KEYS = ['S', 'P', 'E', 'C', 'I', 'A', 'L'] as const;
export const SKILL_IDS: SkillId[] = [
  'smallGuns', 'melee', 'unarmed', 'firstAid', 'lockpick', 'steal', 'speech', 'barter', 'science', 'sneak',
];

// FO2-like base skill formulas.
export function baseSkills(s: SpecialStats): Record<SkillId, number> {
  return {
    smallGuns: 5 + 4 * s.A,
    melee: 20 + 2 * (s.S + s.A),
    unarmed: 30 + 2 * (s.S + s.A),
    firstAid: 2 * (s.P + s.I),
    lockpick: 10 + s.P + s.A,
    steal: 3 * s.A,
    speech: 5 * s.C,
    barter: 4 * s.C,
    science: 4 * s.I,
    sneak: 5 + 3 * s.A,
  };
}

export const maxHpFor = (s: SpecialStats, level = 1) => 15 + s.S + 2 * s.E + (level - 1) * (3 + Math.floor(s.E / 2));
export const maxApFor = (s: SpecialStats) => 5 + Math.floor(s.A / 2);
export const acFor = (s: SpecialStats) => s.A;
export const sequenceFor = (s: SpecialStats) => 2 * s.P;
export const critChanceFor = (s: SpecialStats) => s.L;
export const carryWeightFor = (s: SpecialStats) => 25 + 25 * s.S;
export const xpForLevel = (lvl: number) => (lvl * (lvl - 1) / 2) * 1000;

export function recalcDerived(a: Actor, level = 1) {
  a.maxHp = maxHpFor(a.special, level);
  a.maxAp = maxApFor(a.special);
  a.ac = acFor(a.special);
  a.hp = Math.min(a.hp, a.maxHp);
}
