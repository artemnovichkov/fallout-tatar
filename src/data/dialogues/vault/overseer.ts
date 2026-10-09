import type { DialogueDef } from '../../../systems/dialogue';

// Overseer Marat Ildarovich. v_revolt: expose the rebels / resign [Speech 60] / peace [Speech 50, water fixed].
export const v_overseer: DialogueDef = {
  id: 'v_overseer',
  entry: [
    { node: 'coup', cond: [{ flag: 'v_coup' }, { quest: 'v_revolt' }] },
    { node: 'after', cond: [{ questDone: 'v_revolt' }] },
    { node: 'again', cond: [{ flag: 'v_overseer_met' }] },
    { node: 'start' },
  ],
  nodes: {
    start: {
      effects: [{ do: 'flag', key: 'v_overseer_met' }],
      options: [
        { text: 'why', next: 'why' },
        { text: 'water', next: 'water', cond: [{ notFlag: 'v_water_fixed' }] },
        { text: 'rebels', next: 'rebels', cond: [{ notFlag: 'v_overseer_resigned' }] },
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    again: {
      alt: [
        { cond: [{ flag: 'v_overseer_resigned' }], text: 'dlg.v_overseer.again_resigned' },
        { cond: [{ flag: 'v_water_fixed' }], text: 'dlg.v_overseer.again_water' },
      ],
      options: [
        { text: 'water', next: 'water', cond: [{ notFlag: 'v_water_fixed' }] },
        { text: 'rebels', next: 'rebels', cond: [{ notFlag: 'v_overseer_resigned' }] },
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    why: {
      options: [
        { text: 'water', next: 'water', cond: [{ notFlag: 'v_water_fixed' }] },
        { text: 'rebels', next: 'rebels', cond: [{ notFlag: 'v_overseer_resigned' }] },
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    water: {
      effects: [{ do: 'quest', id: 'v_water', stage: 10 }],
      options: [
        { text: 'rebels', next: 'rebels', cond: [{ notFlag: 'v_overseer_resigned' }] },
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    rebels: {
      effects: [{ do: 'quest', id: 'v_revolt', stage: 10 }],
      options: [
        { text: 'name', next: 'exposed', cond: [{ flag: 'v_alsu_met' }],
          effects: [
            { do: 'flag', key: 'v_alsu_arrested' }, { do: 'flag', key: 'v_revolt_method', value: 'overseer' },
            { do: 'questDone', id: 'v_revolt' }, { do: 'caps', n: 150 }, { do: 'xp', n: 200 },
          ] },
        { text: 'help', next: 'task', cond: [{ quest: 'v_revolt', maxStage: 29 }, { notFlag: 'v_alsu_met' }],
          effects: [{ do: 'quest', id: 'v_revolt', stage: 30 }] },
        { text: 'peace', next: 'peace', check: { skill: 'speech', min: 50 }, fail: 'peace_fail',
          cond: [{ flag: 'v_water_fixed' }, { flag: 'v_alsu_met' }, { notFlag: 'v_peace_tried' }],
          effects: [
            { do: 'flag', key: 'v_peace_tried' }, { do: 'flag', key: 'v_revolt_method', value: 'peace' },
            { do: 'questDone', id: 'v_revolt' }, { do: 'caps', n: 100 }, { do: 'xp', n: 400 },
          ],
          failEffects: [{ do: 'flag', key: 'v_peace_tried' }] },
        { text: 'resign', next: 'resigned', check: { skill: 'speech', min: 60 }, fail: 'resign_fail',
          cond: [{ flag: 'v_alsu_met' }, { notFlag: 'v_resign_tried' }],
          effects: [
            { do: 'flag', key: 'v_resign_tried' }, { do: 'flag', key: 'v_overseer_resigned' },
            { do: 'give', item: 'keycard', from: 'container:v_overseer_desk' }, { do: 'xp', n: 150 },
          ],
          failEffects: [{ do: 'flag', key: 'v_resign_tried' }] },
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    task: { options: [{ text: '@dlg.common.bye', next: 'end' }] },
    exposed: { options: [{ text: '@dlg.common.bye', next: 'end' }] },
    peace: { options: [{ text: '@dlg.common.bye', next: 'end' }] },
    peace_fail: { options: [{ text: '@dlg.common.bye', next: 'end' }] },
    resigned: { options: [{ text: '@dlg.common.bye', next: 'end' }] },
    resign_fail: { options: [{ text: '@dlg.common.bye', next: 'end' }] },
    coup: {
      options: [
        { text: 'surrender', next: 'surrendered', check: { skill: 'speech', min: 70 }, fail: 'coup_fight',
          cond: [{ notFlag: 'v_surrender_tried' }],
          effects: [
            { do: 'flag', key: 'v_surrender_tried' }, { do: 'flag', key: 'v_overseer_resigned' },
            { do: 'flag', key: 'v_revolt_method', value: 'resign' }, { do: 'questDone', id: 'v_revolt' }, { do: 'xp', n: 300 },
          ],
          failEffects: [{ do: 'flag', key: 'v_surrender_tried' }] },
        { text: 'fight', next: 'end', effects: [{ do: 'combat' }] },
        { text: 'leave', next: 'end' },
      ],
    },
    coup_fight: { options: [{ text: 'fight', next: 'end', effects: [{ do: 'combat' }] }] },
    surrendered: { options: [{ text: '@dlg.common.bye', next: 'end' }] },
    after: {
      alt: [
        { cond: [{ flag: 'v_revolt_method', is: 'peace' }], text: 'dlg.v_overseer.after_peace' },
        { cond: [{ flag: 'v_revolt_method', is: 'resign' }], text: 'dlg.v_overseer.after_resign' },
      ],
      options: [{ text: '@dlg.common.bye', next: 'end' }],
    },
  },
};
