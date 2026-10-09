import type { DialogueDef } from '../../../systems/dialogue';

// Flavor dwellers: cook Gulnara (feeds kystybyi, Shurale rumor), Timur (voted Ravil out), granny Zuhra (lore).
export const v_cook: DialogueDef = {
  id: 'v_cook',
  entry: [{ node: 'again', cond: [{ flag: 'v_cook_met' }] }, { node: 'start' }],
  nodes: {
    start: {
      effects: [{ do: 'flag', key: 'v_cook_met' }],
      options: [
        { text: 'food', next: 'food', cond: [{ notFlag: 'v_cook_fed' }, { npcHas: 'kystybyi' }],
          effects: [{ do: 'flag', key: 'v_cook_fed' }, { do: 'give', item: 'kystybyi', from: 'npc' }] },
        { text: 'chip', next: 'chip', cond: [{ notFlag: 'v_water_fixed' }] },
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    again: {
      alt: [{ cond: [{ flag: 'v_water_fixed' }], text: 'dlg.v_cook.again_water' }],
      options: [
        { text: 'food', next: 'food', cond: [{ notFlag: 'v_cook_fed' }, { npcHas: 'kystybyi' }],
          effects: [{ do: 'flag', key: 'v_cook_fed' }, { do: 'give', item: 'kystybyi', from: 'npc' }] },
        { text: 'chip', next: 'chip', cond: [{ notFlag: 'v_water_fixed' }] },
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    food: { options: [{ text: 'chip', next: 'chip', cond: [{ notFlag: 'v_water_fixed' }] }, { text: '@dlg.common.bye', next: 'end' }] },
    chip: { options: [{ text: '@dlg.common.bye', next: 'end' }] },
  },
};

export const v_timur: DialogueDef = {
  id: 'v_timur',
  entry: [{ node: 'again', cond: [{ flag: 'v_timur_met' }] }, { node: 'start' }],
  nodes: {
    start: {
      effects: [{ do: 'flag', key: 'v_timur_met' }],
      options: [
        { text: 'vote', next: 'vote' },
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    vote: {
      options: [
        { text: 'debt', next: 'paid', check: { skill: 'speech', min: 35 }, fail: 'refused', cond: [{ notFlag: 'v_timur_debt' }],
          effects: [{ do: 'flag', key: 'v_timur_debt' }, { do: 'caps', n: 25 }], failEffects: [{ do: 'flag', key: 'v_timur_debt' }] },
        { text: 'forgive', next: 'forgiven', cond: [{ notFlag: 'v_timur_debt' }], effects: [{ do: 'flag', key: 'v_timur_debt' }, { do: 'xp', n: 25 }] },
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    paid: { options: [{ text: '@dlg.common.bye', next: 'end' }] },
    refused: { options: [{ text: '@dlg.common.bye', next: 'end' }] },
    forgiven: { options: [{ text: '@dlg.common.bye', next: 'end' }] },
    again: {
      alt: [{ cond: [{ flag: 'v_revolt_method', is: 'overseer' }], text: 'dlg.v_timur.again_order' }],
      options: [{ text: 'vote', next: 'vote', cond: [{ notFlag: 'v_timur_debt' }] }, { text: '@dlg.common.bye', next: 'end' }],
    },
  },
};

export const v_zuhra: DialogueDef = {
  id: 'v_zuhra',
  entry: [{ node: 'again', cond: [{ flag: 'v_zuhra_met' }] }, { node: 'start' }],
  nodes: {
    start: {
      effects: [{ do: 'flag', key: 'v_zuhra_met' }],
      options: [
        { text: 'tale', next: 'tale' },
        { text: 'overseer', next: 'overseer' },
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    again: {
      options: [
        { text: 'tale', next: 'tale' },
        { text: 'overseer', next: 'overseer' },
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    tale: { options: [{ text: 'overseer', next: 'overseer' }, { text: '@dlg.common.bye', next: 'end' }] },
    overseer: { options: [{ text: 'tale', next: 'tale' }, { text: '@dlg.common.bye', next: 'end' }] },
  },
};
