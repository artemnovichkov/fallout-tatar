import type { DialogueDef, Effect, DOption } from '../../../systems/dialogue';

// Shurale of the dead grove (Tukay's "Шүрәле"). Solutions: riddles (3rd needs Intelligence), the Byltyr trick
// (needs the Tukay holotape quest done or [Интеллект 7]), or a fight (tough). Resolution unlocks 'shurale_stash'.
const resolve = (method: string, xp: number): Effect[] => [
  { do: 'give', item: 'shurale_horn', from: 'npc' },
  { do: 'flag', key: 'unlocked:shurale_stash' },
  { do: 'flag', key: 'k_shurale_resolved' },
  { do: 'flag', key: 'k_shurale_method', value: method },
  { do: 'xp', n: xp },
];
const wrong: Effect[] = [{ do: 'hurt', n: 6 }, { do: 'flag', key: 'k_shurale_riddle_failed' }];
const leave: DOption = { text: 'leave', next: 'end' };
const fight: DOption = { text: 'fight', next: 'end', effects: [{ do: 'combat' }] };
const byltyr: DOption[] = [
  { text: 'byltyr', next: 'byltyr', cond: [{ questDone: 'holotape' }] },
  { text: 'byltyr_int', next: 'byltyr', check: { stat: 'I', min: 7 }, fail: 'byltyr_fail',
    cond: [{ notQuestDone: 'holotape' }, { notFlag: 'k_shurale_int_failed' }], failEffects: [{ do: 'flag', key: 'k_shurale_int_failed' }] },
];
const main: DOption[] = [
  { text: 'riddles', next: 'riddle_intro', cond: [{ notFlag: 'k_shurale_riddle_failed' }] },
  ...byltyr,
  fight,
  leave,
];

export const k_shurale: DialogueDef = {
  id: 'k_shurale',
  entry: [
    { node: 'after', cond: [{ flag: 'k_shurale_resolved' }] },
    { node: 'again', cond: [{ flag: 'k_shurale_met' }] },
    { node: 'start' },
  ],
  nodes: {
    start: {
      effects: [{ do: 'flag', key: 'k_shurale_met' }, { do: 'quest', id: 'k_shurale', stage: 10 }],
      options: [{ text: 'who', next: 'who' }, ...main],
    },
    again: { options: [{ text: 'who', next: 'who' }, ...main] },
    who: { options: main },
    riddle_intro: { options: [{ text: 'go', next: 'r1' }, leave] },
    r1: {
      options: [
        { text: 'r1_reactor', next: 'wrong', effects: wrong },
        { text: 'r1_rinat', next: 'wrong_rinat', effects: wrong },
        { text: 'r1_volga', next: 'r2' },
      ],
    },
    r2: {
      options: [
        { text: 'r2_kuraist', next: 'wrong', effects: wrong },
        { text: 'r2_tower', next: 'r3' },
        { text: 'r2_pisa', next: 'wrong', effects: wrong },
      ],
    },
    r3: {
      options: [
        { text: 'r3_tomorrow', next: 'wrong', effects: wrong },
        { text: 'r3_vault', next: 'wrong', effects: wrong },
        { text: 'r3_think', next: 'riddles_won', check: { stat: 'I', min: 7 }, fail: 'wrong', effects: resolve('riddles', 250), failEffects: wrong },
      ],
    },
    wrong: { options: [...byltyr, fight, { text: 'flee', next: 'end' }] },
    wrong_rinat: { options: [...byltyr, fight, { text: 'flee', next: 'end' }] },
    riddles_won: { options: [leave] },
    byltyr: { options: [{ text: 'log', next: 'byltyr_trap' }] },
    byltyr_trap: { options: [{ text: 'deal', next: 'byltyr_deal', effects: resolve('byltyr', 300) }] },
    byltyr_deal: { options: [leave] },
    byltyr_fail: {
      options: [
        { text: 'riddles', next: 'riddle_intro', cond: [{ notFlag: 'k_shurale_riddle_failed' }] },
        fight,
        { text: 'flee', next: 'end' },
      ],
    },
    after: { options: [leave] },
  },
};
