import type { Actor } from '../systems/types';
import { baseSkills, maxHpFor, maxApFor, acFor } from '../systems/stats';

type Template = Omit<Actor, 'id' | 'pos' | 'facing' | 'hp' | 'maxHp' | 'ap' | 'maxAp' | 'ac' | 'skills' | 'dead'>;

const avg = { S: 5, P: 5, E: 5, C: 5, I: 5, A: 5, L: 5 };

export const NPC_TEMPLATES: Record<string, Template> = {
  trader: {
    nameKey: 'npc.trader', sprite: 'trader', special: { ...avg, C: 7 }, hostile: false,
    inventory: [{ id: 'stimpak', count: 3 }, { id: 'ammo9', count: 40 }, { id: 'ayran', count: 2 }, { id: 'sawedoff', count: 1, loaded: 0 }, { id: 'shells', count: 10 }],
    dialogue: 'trader', portrait: 'portrait_trader', ai: 'idle',
  },
  raider: {
    nameKey: 'npc.raider', sprite: 'raider', special: { ...avg, S: 6, A: 6 }, hostile: true,
    inventory: [{ id: 'knife', count: 1 }, { id: 'junk', count: 1 }], weapon: 'knife', portrait: 'portrait_raider', ai: 'aggressive',
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
