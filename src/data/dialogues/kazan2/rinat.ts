import type { DialogueDef, DOption } from '../../../systems/dialogue';

// Rinat, ex-raider ("Bädri's glowing half"), owes Gali-abyi 100 caps.
// Collect: intimidate [Сила 7] / persuade [Красноречие 50]; or hear his story and forgive; or fight.
const bye: DOption = { text: '@dlg.common.bye', next: 'end' };
const fight: DOption = { text: 'fight', next: 'end', effects: [{ do: 'combat' }] };
const collected = (method: string) => [
  { do: 'caps' as const, n: 100 },
  { do: 'flag' as const, key: 'k_debt_method', value: method },
  { do: 'quest' as const, id: 'k_debt', stage: 20 },
  { do: 'xp' as const, n: 50 },
];

export const k_rinat: DialogueDef = {
  id: 'k_rinat',
  entry: [
    { node: 'after', cond: [{ questDone: 'k_debt' }] },
    { node: 'forgiven', cond: [{ quest: 'k_debt', stage: 30 }] },
    { node: 'paid', cond: [{ quest: 'k_debt', stage: 20 }] },
    { node: 'debt', cond: [{ quest: 'k_debt', stage: 10 }] },
    { node: 'start' },
  ],
  nodes: {
    start: { options: [{ text: 'who', next: 'who' }, bye] },
    who: { options: [bye] },
    debt: {
      options: [
        { text: 'scare', next: 'paid_force', check: { stat: 'S', min: 7 }, fail: 'refuse', cond: [{ notFlag: 'k_rinat_scare_failed' }],
          effects: collected('force'), failEffects: [{ do: 'flag', key: 'k_rinat_scare_failed' }] },
        { text: 'persuade', next: 'paid_speech', check: { skill: 'speech', min: 50 }, fail: 'refuse', cond: [{ notFlag: 'k_rinat_talk_failed' }],
          effects: collected('speech'), failEffects: [{ do: 'flag', key: 'k_rinat_talk_failed' }] },
        { text: 'why', next: 'story' },
        fight,
        bye,
      ],
    },
    refuse: { options: [{ text: 'why', next: 'story' }, fight, bye] },
    story: {
      options: [
        { text: 'forgive', next: 'forgiven_now', effects: [
          { do: 'take', item: 'debt_note' },
          { do: 'flag', key: 'k_debt_method', value: 'forgive' },
          { do: 'flag', key: 'k_karma_rinat' },
          { do: 'quest', id: 'k_debt', stage: 30 },
          { do: 'give', item: 'rat_meat', from: 'npc' },
          { do: 'xp', n: 100 },
        ] },
        { text: 'still', next: 'debt' },
      ],
    },
    paid_force: { options: [bye] },
    paid_speech: { options: [bye] },
    forgiven_now: { options: [bye] },
    paid: { options: [bye] },
    forgiven: { options: [bye] },
    after: {
      alt: [{ cond: [{ flag: 'k_debt_method', is: 'forgive' }], text: 'dlg.k_rinat.after_forgive' }],
      options: [bye],
    },
  },
};
