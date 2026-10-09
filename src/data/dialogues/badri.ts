import type { DialogueDef, Effect } from '../../systems/dialogue';

// Bädri, raider boss at the derrick. Kazan quest solutions: talk (Speech / Intelligence), buy, steal key, fight.
const handOver = (method: string, xp: number): Effect[] => [
  { do: 'give', item: 'kazan', from: 'container:raider_chest' },
  { do: 'flag', key: 'badri_pacified' },
  { do: 'flag', key: 'kazan_method', value: method },
  { do: 'xp', n: xp },
];

export const badri: DialogueDef = {
  id: 'badri',
  entry: [
    { node: 'after', cond: [{ flag: 'badri_pacified' }] },
    { node: 'again', cond: [{ flag: 'badri_met' }] },
    { node: 'start' },
  ],
  nodes: {
    start: {
      effects: [{ do: 'flag', key: 'badri_met' }],
      options: [
        { text: 'who', next: 'who' },
        { text: 'kazan', next: 'kazan', cond: [{ quest: 'kazan', maxStage: 29 }] },
        { text: 'leave', next: 'end' },
        { text: 'attack', next: 'end', effects: [{ do: 'combat' }] },
      ],
    },
    again: {
      options: [
        { text: 'who', next: 'who' },
        { text: 'kazan', next: 'kazan', cond: [{ quest: 'kazan', maxStage: 29 }] },
        { text: 'leave', next: 'end' },
        { text: 'attack', next: 'end', effects: [{ do: 'combat' }] },
      ],
    },
    who: {
      options: [
        { text: 'kazan', next: 'kazan', cond: [{ quest: 'kazan', maxStage: 29 }] },
        { text: 'leave', next: 'end' },
      ],
    },
    kazan: {
      options: [
        { text: 'persuade', next: 'persuaded', check: { skill: 'speech', min: 30 }, fail: 'persuade_fail',
          cond: [{ notFlag: 'badri_refused' }], effects: handOver('speech', 200), failEffects: [{ do: 'flag', key: 'badri_refused' }] },
        { text: 'science', next: 'scienced', check: { stat: 'I', min: 7 }, fail: 'persuade_fail',
          cond: [{ notFlag: 'badri_refused' }], effects: handOver('science', 200), failEffects: [{ do: 'flag', key: 'badri_refused' }] },
        { text: 'buy', next: 'bought', cond: [{ caps: 150 }], effects: [{ do: 'caps', n: -150 }, ...handOver('buy', 100)] },
        { text: 'steal', next: 'stolen_key', check: { skill: 'steal', min: 15 }, fail: 'steal_fail',
          cond: [{ npcHas: 'key_depot' }, { notFlag: 'badri_steal_tried' }],
          effects: [{ do: 'flag', key: 'badri_steal_tried' }, { do: 'give', item: 'key_depot', from: 'npc' }, { do: 'xp', n: 75 }],
          failEffects: [{ do: 'flag', key: 'badri_steal_tried' }] },
        { text: 'fight', next: 'end', effects: [{ do: 'combat' }] },
        { text: 'leave', next: 'end' },
      ],
    },
    persuaded: { options: [{ text: 'thanks', next: 'end' }] },
    scienced: { options: [{ text: 'thanks', next: 'end' }] },
    bought: { options: [{ text: 'thanks', next: 'end' }] },
    persuade_fail: {
      options: [
        { text: 'buy', next: 'bought', cond: [{ caps: 150 }], effects: [{ do: 'caps', n: -150 }, ...handOver('buy', 100)] },
        { text: 'fight', next: 'end', effects: [{ do: 'combat' }] },
        { text: 'leave', next: 'end' },
      ],
    },
    stolen_key: { options: [{ text: 'leave', next: 'end' }] },
    steal_fail: { options: [{ text: 'oops', next: 'end', effects: [{ do: 'combat' }] }] },
    after: { options: [{ text: 'leave', next: 'end' }] },
  },
};
