import type { QuestDef } from './quests';
import { game } from '../systems/state';
import { hasItem } from '../systems/inventory';

const stage = (id: string) => game.quests[id]?.stage ?? -1;
const done = (id: string) => !!game.quests[id]?.done;
const dead = (npcId: string) => !!game.npcs[npcId]?.dead;

// Kazan v2 side quests. Journal: quest.<id>.s<stage>, quest.<id>.done[.<method>] (method = flags[<id>_method]).
export const KAZAN2_QUESTS: Record<string, QuestDef> = {
  // Sabantuy: 10 = joined the contests; done = prize ceremony (method win / lose).
  k_sabantuy: { id: 'k_sabantuy', nameKey: 'quest.k_sabantuy', stages: [10] },
  // Shurale: 10 = heard of him, 20 = horn in hands (return to Sälimä); done = paid (method riddles / byltyr / fight).
  k_shurale: {
    id: 'k_shurale', nameKey: 'quest.k_shurale', stages: [10, 20],
    trigger: setStage => {
      if (done('k_shurale') || stage('k_shurale') >= 20 || !hasItem(game.player, 'shurale_horn')) return false;
      if (!game.flags.k_shurale_method) game.flags.k_shurale_method = dead('k_shurale') ? 'fight' : 'steal';
      setStage('k_shurale', 20);
      return true;
    },
  },
  // Almetyevsk oil: 10 = Marat asked; done = pump restarted (method valve / science).
  k_oil: { id: 'k_oil', nameKey: 'quest.k_oil', stages: [10] },
  // Gali's debt: 10 = got the note, 20 = money collected (or Rinat dead), 30 = forgiven; done (method force/speech/pay/forgive/fight).
  k_debt: {
    id: 'k_debt', nameKey: 'quest.k_debt', stages: [10, 20, 30],
    trigger: setStage => {
      if (done('k_debt') || stage('k_debt') !== 10 || !dead('k_rinat')) return false;
      game.flags.k_debt_method = 'fight';
      setStage('k_debt', 20);
      return true;
    },
  },
};
