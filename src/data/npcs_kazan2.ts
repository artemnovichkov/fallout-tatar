import type { Template } from './npcs';

const avg = { S: 5, P: 5, E: 5, C: 5, I: 5, A: 5, L: 5 };
const settler = (nameKey: string, dialogue: string, special: Partial<typeof avg>, inventory: Template['inventory'], extra: Partial<Template> = {}): Template => ({
  nameKey, sprite: 'settler', special: { ...avg, ...special }, hostile: false, inventory,
  dialogue, portrait: 'portrait_settler', ai: 'coward', ...extra,
});

// Kazan v2 quest NPC templates (Sabantuy, Shurale, Almetyevsk oil, Gali's debt).
export const KAZAN2_NPCS: Record<string, Template> = {
  // Sabantuy organizer (tamada) next to the greased pole.
  k_organizer: settler('npc.k_sab_org', 'k_sab_org', { C: 8 }, [{ id: 'chakchak', count: 1 }, { id: 'junk', count: 1 }]),
  // Local sack-fight champion.
  k_champion: settler('npc.k_sab_champ', 'k_sab_champ', { S: 8, E: 7, I: 3 }, [{ id: 'echpochmak', count: 2 }], { ai: 'aggressive' }),
  // Bistä widow who wants the Shurale gone.
  k_salima: settler('npc.k_salima', 'k_salima', { C: 6, I: 6 }, [{ id: 'ayran', count: 1 }]),
  // Rinat, ex-raider ("the glowing half"), owes Gali.
  k_rinat: settler('npc.k_rinat', 'k_rinat', { S: 4, E: 6, C: 4 }, [{ id: 'junk', count: 3 }, { id: 'rat_meat', count: 1 }]),
  // Marat, oil engineer from Almetyevsk, watching the derrick from the Volga bank.
  k_engineer: settler('npc.k_marat', 'k_marat', { I: 8, S: 6 }, [{ id: 'wrench', count: 1 }, { id: 'junk', count: 2 }], { weapon: 'wrench', ai: 'aggressive' }),
  // Shurale: tough forest spirit of the dead grove. Carries his horn (trophy / stash key).
  k_shurale: {
    nameKey: 'npc.k_shurale', sprite: 'shurale', special: { ...avg, S: 9, P: 7, E: 9, I: 4, A: 8 }, hostile: false,
    inventory: [{ id: 'shurale_horn', count: 1 }, { id: 'knife', count: 1 }, { id: 'leather', count: 1 }, { id: 'junk', count: 2 }],
    weapon: 'knife', armor: 'leather', dialogue: 'k_shurale', portrait: 'portrait_shurale', ai: 'aggressive',
  },
};
