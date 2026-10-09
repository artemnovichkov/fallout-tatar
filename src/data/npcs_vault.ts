import type { Template } from './npcs';

// Vault 116 NPC templates (ids prefixed v_). Story hooks: src/data/dialogues/vault/hooks.ts.
const avg = { S: 5, P: 5, E: 5, C: 5, I: 5, A: 5, L: 5 };

export const VAULT_NPCS: Record<string, Template> = {
  v_overseer: {
    nameKey: 'npc.v_overseer', sprite: 'overseer', special: { ...avg, S: 4, P: 6, C: 7, I: 7 }, hostile: false,
    inventory: [{ id: 'pistol', count: 1, loaded: 6 }, { id: 'ammo9', count: 12 }, { id: 'stimpak', count: 1 }, { id: 'jumpsuit', count: 1 }],
    weapon: 'pistol', armor: 'jumpsuit', dialogue: 'v_overseer', portrait: 'portrait_overseer', ai: 'aggressive',
  },
  v_security: {
    nameKey: 'npc.v_security', sprite: 'dweller', special: { ...avg, S: 6, P: 6, E: 6 }, hostile: false,
    inventory: [{ id: 'pistol', count: 1, loaded: 6 }, { id: 'ammo9', count: 8 }, { id: 'wrench', count: 1 }, { id: 'jumpsuit', count: 1 }],
    weapon: 'pistol', armor: 'jumpsuit', dialogue: 'v_security', portrait: 'portrait_dweller', ai: 'aggressive',
  },
  v_alsu: {
    nameKey: 'npc.v_alsu', sprite: 'dweller', special: { ...avg, C: 8, I: 7, A: 6 }, hostile: false,
    inventory: [{ id: 'kystybyi', count: 1 }], dialogue: 'v_alsu', portrait: 'portrait_dweller', ai: 'coward',
  },
  v_cook: {
    nameKey: 'npc.v_cook', sprite: 'dweller', special: { ...avg, C: 7 }, hostile: false,
    inventory: [{ id: 'kystybyi', count: 3 }], dialogue: 'v_cook', portrait: 'portrait_dweller', ai: 'coward',
  },
  v_timur: {
    nameKey: 'npc.v_timur', sprite: 'dweller', special: { ...avg, S: 6, I: 4 }, hostile: false,
    inventory: [{ id: 'junk', count: 1 }], dialogue: 'v_timur', portrait: 'portrait_dweller', ai: 'coward',
  },
  v_zuhra: {
    nameKey: 'npc.v_zuhra', sprite: 'dweller', special: { ...avg, S: 2, E: 3, C: 8, I: 8, A: 2 }, hostile: false,
    inventory: [{ id: 'kystybyi', count: 1 }], dialogue: 'v_zuhra', portrait: 'portrait_dweller', ai: 'coward',
  },
  v_robot: {
    nameKey: 'npc.v_robot', sprite: 'robot', special: { ...avg, S: 7, E: 8, C: 6, I: 9 }, hostile: false,
    inventory: [{ id: 'junk', count: 2 }], dialogue: 'v_robot', portrait: 'portrait_robot', ai: 'idle',
  },
  // Giant rat: weak, bites with "unarmed" (no weapon), 19 HP.
  v_rat: {
    nameKey: 'npc.v_rat', sprite: 'rat', special: { S: 2, P: 5, E: 1, C: 1, I: 1, A: 6, L: 3 }, hostile: true,
    inventory: [{ id: 'rat_meat', count: 1 }], ai: 'aggressive',
  },
};
