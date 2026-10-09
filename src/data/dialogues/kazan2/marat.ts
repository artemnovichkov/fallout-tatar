import type { DialogueDef, DOption, Cond } from '../../../systems/dialogue';

// Marat, oil engineer from Almetyevsk, wants Bädri's derrick pump restarted (after the raider camp is dealt with).
// Valve from Vault 116 ('valve' in vault_storage) = full reward; [Наука 50] improvised fix = lower reward.
const bye: DOption = { text: '@dlg.common.bye', next: 'end' };
const campClear: Cond = { any: [{ questDone: 'kazan' }, { flag: 'badri_pacified' }, { flag: 'badri_dead' }] };

export const k_marat: DialogueDef = {
  id: 'k_marat',
  entry: [
    { node: 'after', cond: [{ questDone: 'k_oil' }] },
    { node: 'waiting', cond: [{ quest: 'k_oil' }] },
    { node: 'start' },
  ],
  nodes: {
    start: {
      options: [
        { text: 'who', next: 'who' },
        { text: 'oil', next: 'task' },
        bye,
      ],
    },
    who: { options: [{ text: 'oil', next: 'task' }, bye] },
    task: {
      options: [
        { text: 'accept', next: 'accepted', effects: [{ do: 'quest', id: 'k_oil', stage: 10 }] },
        { text: 'refuse', next: 'end' },
      ],
    },
    accepted: { options: [bye] },
    waiting: {
      alt: [{ cond: [campClear], text: 'dlg.k_marat.waiting_clear' }],
      options: [
        { text: 'valve', next: 'fixed_valve', cond: [campClear, { item: 'valve' }],
          effects: [
            { do: 'take', item: 'valve' }, { do: 'caps', n: 150 }, { do: 'xp', n: 300 },
            { do: 'flag', key: 'k_fuel' }, { do: 'flag', key: 'k_oil_method', value: 'valve' }, { do: 'questDone', id: 'k_oil' },
          ] },
        { text: 'improvise', next: 'fixed_science', cond: [campClear, { notFlag: 'k_oil_sci_failed' }],
          check: { skill: 'science', min: 50 }, fail: 'science_fail',
          effects: [
            { do: 'caps', n: 60 }, { do: 'xp', n: 200 },
            { do: 'flag', key: 'k_fuel' }, { do: 'flag', key: 'k_oil_method', value: 'science' }, { do: 'questDone', id: 'k_oil' },
          ],
          failEffects: [{ do: 'flag', key: 'k_oil_sci_failed' }] },
        { text: 'where_valve', next: 'valve_hint' },
        bye,
      ],
    },
    valve_hint: { options: [bye] },
    science_fail: { options: [bye] },
    fixed_valve: { options: [bye] },
    fixed_science: { options: [bye] },
    after: { options: [bye] },
  },
};
