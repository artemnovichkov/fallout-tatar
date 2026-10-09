import type { DialogueDef, DOption } from '../../../systems/dialogue';

// Sälimä-apa: her husband Sälim was tickled to death by the Shurale. Gives & pays for the Shurale quest.
const bye: DOption = { text: '@dlg.common.bye', next: 'end' };

export const k_salima: DialogueDef = {
  id: 'k_salima',
  entry: [
    { node: 'after', cond: [{ questDone: 'k_shurale' }] },
    { node: 'reward', cond: [{ quest: 'k_shurale', item: 'shurale_horn' }] },
    { node: 'waiting', cond: [{ quest: 'k_shurale' }] },
    { node: 'start' },
  ],
  nodes: {
    start: {
      options: [
        { text: 'what', next: 'story' },
        bye,
      ],
    },
    story: {
      options: [
        { text: 'accept', next: 'accepted', effects: [{ do: 'quest', id: 'k_shurale', stage: 10 }] },
        { text: 'refuse', next: 'end' },
      ],
    },
    accepted: { options: [bye] },
    waiting: {
      options: [
        { text: 'where', next: 'where' },
        bye,
      ],
    },
    where: { options: [bye] },
    reward: { options: [{ text: 'give', next: 'paid' }] },
    paid: {
      alt: [{ cond: [{ flag: 'k_shurale_method', is: 'fight' }], text: 'dlg.k_salima.paid_fight' }],
      effects: [
        { do: 'caps', n: 120 },
        { do: 'give', item: 'kystybyi', count: 2 },
        { do: 'xp', n: 150 },
        { do: 'questDone', id: 'k_shurale' },
      ],
      options: [bye],
    },
    after: { options: [bye] },
  },
};
