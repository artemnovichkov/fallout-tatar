import type { QuestDef } from './quests';

// Vault 116 quests.
// v_water: 10 = purifier dying, need a water chip (Shurale's stash in Kazan); 20 = patched with Science (buys time).
//   done = chip installed via Mr. Yardämche.
// v_revolt: 10 = heard of the conflict; 20 = joined Alsu (get keycard); 30 = overseer wants the rebel leader's name;
//   40 = coup (stolen keycard handed to Alsu, overseer must go). done methods: overseer | resign | peace | rebels | blood.
// v_rats: 10 = robot asked to clear the lower storage; 20 = all v_rat* dead (hooks.ts); done = rewarded.
export const VAULT_QUESTS: Record<string, QuestDef> = {
  v_water: { id: 'v_water', nameKey: 'quest.v_water', stages: [10, 20] },
  v_revolt: { id: 'v_revolt', nameKey: 'quest.v_revolt', stages: [10, 20, 30, 40] },
  v_rats: { id: 'v_rats', nameKey: 'quest.v_rats', stages: [10, 20] },
};
