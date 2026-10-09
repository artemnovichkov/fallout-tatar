import { VAULT_QUESTS } from './quests_vault';
import { KAZAN2_QUESTS } from './quests_kazan2';
// Quest definitions. Journal texts: quest.<id>.s<stage>, quest.<id>.done[.<method>].
export interface QuestDef { id: string; nameKey: string; stages: number[] }

export const QUESTS: Record<string, QuestDef> = {
  ...VAULT_QUESTS,
  ...KAZAN2_QUESTS,
  // Main: Fatima-apa's stolen GECK-Kazan. 10 = asked, 30 = kazan in hands, done = returned.
  kazan: { id: 'kazan', nameKey: 'quest.kazan', stages: [10, 30] },
  // Side: ghoul Minnulla's holotape with Tukay poems. 10 = asked, 20 = found, done = returned.
  holotape: { id: 'holotape', nameKey: 'quest.holotape', stages: [10, 20] },
};
