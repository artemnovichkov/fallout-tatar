import type { DialogueDef } from '../../systems/dialogue';

// Rank-and-file raiders: one-liners, Bädri does the talking.
export const raider: DialogueDef = {
  id: 'raider',
  entry: [
    { node: 'calm', cond: [{ flag: 'badri_pacified' }] },
    { node: 'start' },
  ],
  nodes: {
    start: { options: [{ text: 'leave', next: 'end' }, { text: 'attack', next: 'end', effects: [{ do: 'combat' }] }] },
    calm: { options: [{ text: 'leave', next: 'end' }] },
  },
};
