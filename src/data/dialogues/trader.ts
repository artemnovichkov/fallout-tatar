import type { DialogueDef } from '../../systems/dialogue';

// Gali-abyi, shopkeeper of Yana Bistä.
export const trader: DialogueDef = {
  id: 'trader',
  entry: [
    { node: 'again', cond: [{ flag: 'trader_met' }] },
    { node: 'start' },
  ],
  nodes: {
    start: {
      effects: [{ do: 'flag', key: 'trader_met' }],
      options: [
        { text: 'trade', next: 'end', effects: [{ do: 'barter' }] },
        { text: 'news', next: 'news' },
        { text: 'raiders', next: 'raiders', cond: [{ quest: 'kazan', maxStage: 29 }] },
        { text: 'holo', next: 'holo', cond: [{ quest: 'holotape', stage: 10 }] },
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    again: {
      options: [
        { text: 'trade', next: 'end', effects: [{ do: 'barter' }] },
        { text: 'news', next: 'news' },
        { text: 'raiders', next: 'raiders', cond: [{ quest: 'kazan', maxStage: 29 }] },
        { text: 'holo', next: 'holo', cond: [{ quest: 'holotape', stage: 10 }] },
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    news: {
      options: [
        { text: 'trade', next: 'end', effects: [{ do: 'barter' }] },
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    raiders: {
      effects: [{ do: 'flag', key: 'knows_key' }],
      options: [
        { text: 'trade', next: 'end', effects: [{ do: 'barter' }] },
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    holo: {
      options: [
        { text: 'trade', next: 'end', effects: [{ do: 'barter' }] },
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
  },
};
