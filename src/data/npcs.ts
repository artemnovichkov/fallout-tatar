import type { Actor } from '../systems/types';
import { baseSkills, maxHpFor, maxApFor, acFor } from '../systems/stats';

type Template = Omit<Actor, 'id' | 'pos' | 'facing' | 'hp' | 'maxHp' | 'ap' | 'maxAp' | 'ac' | 'skills' | 'dead'>;

const avg = { S: 5, P: 5, E: 5, C: 5, I: 5, A: 5, L: 5 };

// Raiders of Bädri's camp start neutral ("guarding"): Bädri intercepts the player and talks first.
// Provoking any member turns the whole RAIDER_GROUP hostile (see ui/dialogue.ts world hooks).
export const RAIDER_GROUP = ['badri', 'raider1', 'raider2', 'raider3'];

export const NPC_TEMPLATES: Record<string, Template> = {
  trader: {
    nameKey: 'npc.trader', sprite: 'trader', special: { ...avg, C: 7 }, hostile: false,
    inventory: [
      { id: 'stimpak', count: 3 }, { id: 'ammo9', count: 40 }, { id: 'ayran', count: 2 }, { id: 'sawedoff', count: 1, loaded: 0 },
      { id: 'shells', count: 10 }, { id: 'chakchak', count: 2 }, { id: 'echpochmak', count: 5 }, { id: 'leather', count: 1 }, { id: 'tubeteika', count: 1 },
    ],
    dialogue: 'trader', portrait: 'portrait_trader', ai: 'idle',
  },
  elder: {
    nameKey: 'npc.elder', sprite: 'elder', special: { ...avg, S: 3, E: 4, C: 8, I: 8, A: 3 }, hostile: false,
    inventory: [{ id: 'chakchak', count: 1 }], dialogue: 'elder', portrait: 'portrait_elder', ai: 'coward',
  },
  guard: {
    nameKey: 'npc.guard', sprite: 'guard', special: { ...avg, S: 6, P: 7, E: 6 }, hostile: false,
    inventory: [{ id: 'rifle', count: 1, loaded: 5 }, { id: 'ammo762', count: 10 }, { id: 'echpochmak', count: 1 }, { id: 'leather', count: 1 }],
    weapon: 'rifle', armor: 'leather', dialogue: 'guard', portrait: 'portrait_guard', ai: 'aggressive',
  },
  ghoul: {
    nameKey: 'npc.ghoul', sprite: 'ghoul', special: { ...avg, S: 4, E: 7, C: 6, I: 7 }, hostile: false,
    inventory: [{ id: 'junk', count: 2 }], dialogue: 'ghoul', portrait: 'portrait_ghoul', ai: 'coward',
  },
  raider: {
    nameKey: 'npc.raider', sprite: 'raider', special: { ...avg, S: 6, A: 6 }, hostile: false,
    inventory: [{ id: 'knife', count: 1 }, { id: 'junk', count: 1 }], weapon: 'knife', dialogue: 'raider', portrait: 'portrait_raider', ai: 'aggressive',
  },
  raider_gun: {
    nameKey: 'npc.raider', sprite: 'raider', special: { ...avg, S: 5, P: 6, A: 6 }, hostile: false,
    inventory: [{ id: 'pistol', count: 1, loaded: 6 }, { id: 'ammo9', count: 6 }, { id: 'echpochmak', count: 1 }],
    weapon: 'pistol', dialogue: 'raider', portrait: 'portrait_raider', ai: 'aggressive',
  },
  badri: {
    nameKey: 'npc.badri', sprite: 'raider', special: { ...avg, S: 7, E: 7, C: 4, I: 4, A: 6 }, hostile: false,
    inventory: [{ id: 'sawedoff', count: 1, loaded: 2 }, { id: 'shells', count: 6 }, { id: 'key_depot', count: 1 }, { id: 'stimpak', count: 1 }, { id: 'leather', count: 1 }],
    weapon: 'sawedoff', armor: 'leather', dialogue: 'badri', portrait: 'portrait_raider', ai: 'aggressive',
  },
};

export function spawnNpc(id: string, template: string, pos: { q: number; r: number }, facing = 2): Actor {
  const t = NPC_TEMPLATES[template];
  const s = t.special;
  return {
    ...structuredClone(t), id, pos, facing,
    hp: maxHpFor(s), maxHp: maxHpFor(s), ap: maxApFor(s), maxAp: maxApFor(s), ac: acFor(s),
    skills: baseSkills(s), dead: false,
  };
}
