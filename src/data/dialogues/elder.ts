import type { DialogueDef } from '../../systems/dialogue';

// Fatima-apa, elder of Yana Bistä. Gives the main quest "kazan".
export const elder: DialogueDef = {
  id: 'elder',
  entry: [
    { node: 'thanks', cond: [{ questDone: 'kazan' }] },
    { node: 'return', cond: [{ quest: 'kazan', stage: 30, item: 'kazan' }] },
    { node: 'return', cond: [{ questNew: 'kazan', item: 'kazan' }] },
    { node: 'waiting', cond: [{ quest: 'kazan' }] },
    { node: 'start' },
  ],
  nodes: {
    start: {
      options: [
        { text: 'who', next: 'who' },
        { text: 'trouble', next: 'trouble' },
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    who: {
      options: [
        { text: 'trouble', next: 'trouble' },
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    trouble: {
      options: [
        { text: 'accept', next: 'accepted', effects: [{ do: 'quest', id: 'kazan', stage: 10 }] },
        { text: 'reward', next: 'reward' },
        { text: 'refuse', next: 'end' },
      ],
    },
    reward: {
      options: [
        { text: 'accept', next: 'accepted', effects: [{ do: 'quest', id: 'kazan', stage: 10 }] },
        { text: 'refuse', next: 'end' },
      ],
    },
    accepted: { options: [{ text: '@dlg.common.bye', next: 'end' }] },
    waiting: {
      options: [
        { text: 'where', next: 'accepted' },
        { text: 'badri', next: 'badri' },
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    badri: { options: [{ text: '@dlg.common.bye', next: 'end' }] },
    return: {
      options: [
        { text: 'give', next: 'done' },
        { text: 'haggle', next: 'haggle_ok', check: { skill: 'speech', min: 45 }, fail: 'haggle_fail', cond: [{ notFlag: 'elder_haggled' }],
          effects: [{ do: 'flag', key: 'elder_haggled' }, { do: 'caps', n: 50 }], failEffects: [{ do: 'flag', key: 'elder_haggled' }] },
      ],
    },
    haggle_ok: { options: [{ text: 'give', next: 'done' }] },
    haggle_fail: { options: [{ text: 'give_shame', next: 'done' }] },
    done: {
      alt: [{ cond: [{ flag: 'badri_dead' }], text: 'dlg.elder.done_dead' }],
      effects: [
        { do: 'take', item: 'kazan' },
        { do: 'caps', n: 100 },
        { do: 'give', item: 'chakchak', count: 2 },
        { do: 'questDone', id: 'kazan' },
        { do: 'xp', n: 300 },
      ],
      options: [{ text: '@dlg.common.bye', next: 'end' }],
    },
    thanks: {
      options: [
        { text: 'soup', next: 'soup', cond: [{ notFlag: 'elder_soup' }], effects: [{ do: 'flag', key: 'elder_soup' }, { do: 'heal', n: 15 }] },
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    soup: { options: [{ text: '@dlg.common.bye', next: 'end' }] },
  },
};
