// Vault 116 world hooks (called from ui/dialogue.ts). Kept out of dialogues/vault/index.ts to avoid import cycles.
import { game } from '../../../systems/state';
import { setStage, completeQuest, questActive } from '../../../systems/quests';
import { addXp } from '../../../systems/leveling';

// Provoking one of them provokes both.
export const VAULT_SECURITY = ['v_overseer', 'v_security'];
export const VAULT_RATS = ['v_rat1', 'v_rat2', 'v_rat3', 'v_rat4'];

export function vaultOnDeath(id: string) {
  if (VAULT_RATS.includes(id) && VAULT_RATS.every(r => game.npcs[r]?.dead)) {
    game.flags.v_rats_cleared = true;
    if (questActive('v_rats')) setStage('v_rats', 20);
  }
  if (id === 'v_overseer') {
    game.flags.v_overseer_dead = true;
    if (questActive('v_revolt')) {
      game.flags.v_revolt_method = game.flags.v_coup ? 'rebels' : 'blood';
      completeQuest('v_revolt');
      addXp(game.flags.v_coup ? 250 : 50);
    }
  }
}
