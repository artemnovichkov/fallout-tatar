import type { DialogueDef } from '../../../systems/dialogue';

// Mr. Yardämche ("Helper"), the purifier-room robot. Gives v_water (chip / Science patch) and v_rats.
export const v_robot: DialogueDef = {
  id: 'v_robot',
  entry: [
    { node: 'rats_done', cond: [{ flag: 'v_rats_cleared' }, { notFlag: 'v_rats_paid' }] },
    { node: 'chip', cond: [{ item: 'water_chip' }, { notFlag: 'v_water_fixed' }] },
    { node: 'again', cond: [{ flag: 'v_robot_met' }] },
    { node: 'start' },
  ],
  nodes: {
    start: {
      effects: [{ do: 'flag', key: 'v_robot_met' }],
      options: [
        { text: 'who', next: 'who' },
        { text: 'purifier', next: 'purifier', cond: [{ notFlag: 'v_water_fixed' }] },
        { text: 'rats', next: 'rats', cond: [{ questNew: 'v_rats' }] },
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    again: {
      alt: [{ cond: [{ flag: 'v_water_fixed' }], text: 'dlg.v_robot.again_fixed' }],
      options: [
        { text: 'purifier', next: 'purifier', cond: [{ notFlag: 'v_water_fixed' }] },
        { text: 'rats', next: 'rats', cond: [{ questNew: 'v_rats' }] },
        { text: 'rats_wait', next: 'rats_wait', cond: [{ quest: 'v_rats', stage: 10 }] },
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    who: {
      options: [
        { text: 'purifier', next: 'purifier', cond: [{ notFlag: 'v_water_fixed' }] },
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    purifier: {
      alt: [{ cond: [{ flag: 'v_purifier_patched' }], text: 'dlg.v_robot.purifier_patched' }],
      effects: [{ do: 'quest', id: 'v_water', stage: 10 }],
      options: [
        { text: 'where', next: 'where' },
        { text: 'patch', next: 'patched', check: { skill: 'science', min: 40 }, fail: 'patch_fail',
          cond: [{ notFlag: 'v_patch_tried' }],
          effects: [{ do: 'flag', key: 'v_patch_tried' }, { do: 'flag', key: 'v_purifier_patched' }, { do: 'quest', id: 'v_water', stage: 20 }, { do: 'xp', n: 100 }],
          failEffects: [{ do: 'flag', key: 'v_patch_tried' }] },
        { text: 'rats', next: 'rats', cond: [{ questNew: 'v_rats' }] },
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    where: { options: [{ text: '@dlg.common.bye', next: 'end' }] },
    patched: { options: [{ text: '@dlg.common.bye', next: 'end' }] },
    patch_fail: { options: [{ text: '@dlg.common.bye', next: 'end' }] },
    chip: {
      options: [
        { text: 'install', next: 'installed' },
        { text: 'later', next: 'end' },
      ],
    },
    installed: {
      effects: [
        { do: 'take', item: 'water_chip' },
        { do: 'flag', key: 'v_water_fixed' },
        { do: 'flag', key: 'v_water_method', value: 'chip' },
        { do: 'questDone', id: 'v_water' },
        { do: 'caps', n: 150 },
        { do: 'xp', n: 400 },
      ],
      options: [{ text: '@dlg.common.bye', next: 'end' }],
    },
    rats: {
      options: [
        { text: 'rats_accept', next: 'rats_ok', effects: [{ do: 'quest', id: 'v_rats', stage: 10 }] },
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    rats_ok: { options: [{ text: '@dlg.common.bye', next: 'end' }] },
    rats_wait: { options: [{ text: '@dlg.common.bye', next: 'end' }] },
    rats_done: {
      effects: [
        { do: 'flag', key: 'v_rats_paid' },
        { do: 'give', item: 'jumpsuit' },
        { do: 'caps', n: 60 },
        { do: 'questDone', id: 'v_rats' },
        { do: 'xp', n: 150 },
      ],
      options: [{ text: '@dlg.common.bye', next: 'end' }],
    },
  },
};
