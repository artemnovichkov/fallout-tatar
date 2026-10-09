import type { DialogueDef } from '../../../systems/dialogue';

// Alsu, leader of the "Open Doors" rebels. Wants the overseer's keycard to open the vault to the surface.
export const v_alsu: DialogueDef = {
  id: 'v_alsu',
  entry: [
    { node: 'arrested', cond: [{ flag: 'v_alsu_arrested' }] },
    { node: 'after', cond: [{ questDone: 'v_revolt' }] },
    { node: 'after', cond: [{ flag: 'v_overseer_dead' }] },
    { node: 'coup_wait', cond: [{ flag: 'v_coup' }] },
    { node: 'card', cond: [{ quest: 'v_revolt' }, { item: 'keycard' }] },
    { node: 'again', cond: [{ flag: 'v_alsu_met' }] },
    { node: 'start' },
  ],
  nodes: {
    start: {
      effects: [{ do: 'flag', key: 'v_alsu_met' }, { do: 'quest', id: 'v_revolt', stage: 10 }],
      options: [
        { text: 'who', next: 'who' },
        { text: 'plan', next: 'plan' },
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    again: {
      options: [
        { text: 'plan', next: 'plan', cond: [{ notFlag: 'v_rebel' }] },
        { text: 'card_where', next: 'card_where', cond: [{ flag: 'v_rebel' }] },
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    who: {
      options: [
        { text: 'plan', next: 'plan' },
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    plan: {
      options: [
        { text: 'join', next: 'joined', effects: [{ do: 'flag', key: 'v_rebel' }, { do: 'quest', id: 'v_revolt', stage: 20 }] },
        { text: 'think', next: 'end' },
      ],
    },
    joined: { options: [{ text: 'card_where', next: 'card_where' }, { text: '@dlg.common.bye', next: 'end' }] },
    card_where: { options: [{ text: '@dlg.common.bye', next: 'end' }] },
    card: {
      options: [
        { text: 'give', next: 'won', cond: [{ flag: 'v_overseer_resigned' }],
          effects: [
            { do: 'take', item: 'keycard' }, { do: 'flag', key: 'v_revolt_method', value: 'resign' },
            { do: 'questDone', id: 'v_revolt' }, { do: 'caps', n: 50 }, { do: 'xp', n: 300 },
          ] },
        { text: 'give', next: 'coup', cond: [{ notFlag: 'v_overseer_resigned' }],
          effects: [{ do: 'take', item: 'keycard' }, { do: 'flag', key: 'v_coup' }, { do: 'quest', id: 'v_revolt', stage: 40 }, { do: 'xp', n: 100 }] },
        { text: 'keep', next: 'end' },
      ],
    },
    won: { options: [{ text: '@dlg.common.bye', next: 'end' }] },
    coup: { options: [{ text: '@dlg.common.bye', next: 'end' }] },
    coup_wait: { options: [{ text: '@dlg.common.bye', next: 'end' }] },
    arrested: { options: [{ text: '@dlg.common.bye', next: 'end' }] },
    after: {
      alt: [
        { cond: [{ flag: 'v_revolt_method', is: 'peace' }], text: 'dlg.v_alsu.after_peace' },
        { cond: [{ flag: 'v_revolt_method', is: 'resign' }], text: 'dlg.v_alsu.after_resign' },
      ],
      options: [{ text: '@dlg.common.bye', next: 'end' }],
    },
  },
};
