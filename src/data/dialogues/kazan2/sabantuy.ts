import type { DialogueDef, Effect, DOption } from '../../../systems/dialogue';

// "Сабантуй на пепелище": tamada Hämit runs three contests (egg-in-spoon, sack fight vs champion Ildar, greased pole).
// Each contest is tried once: flag k_sab_<contest> = 'win' | 'lose'; wins counted in numeric flag k_sab_points.
const win = (contest: string, xp = 75): Effect[] => [
  { do: 'flag', key: `k_sab_${contest}`, value: 'win' },
  { do: 'inc', key: 'k_sab_points' },
  { do: 'xp', n: xp },
  { do: 'log', key: `log.k_sab.${contest}` },
];
const lose = (contest: string): Effect[] => [{ do: 'flag', key: `k_sab_${contest}`, value: 'lose' }];
const bye: DOption = { text: '@dlg.common.bye', next: 'end' };
const back: DOption = { text: 'back', next: 'hub' };

export const k_sab_org: DialogueDef = {
  id: 'k_sab_org',
  entry: [
    { node: 'after', cond: [{ questDone: 'k_sabantuy' }] },
    { node: 'hub', cond: [{ quest: 'k_sabantuy' }] },
    { node: 'start' },
  ],
  nodes: {
    start: {
      options: [
        { text: 'what', next: 'about' },
        { text: 'join', next: 'hub', effects: [{ do: 'quest', id: 'k_sabantuy', stage: 10 }] },
        bye,
      ],
    },
    about: {
      options: [
        { text: 'join', next: 'hub', effects: [{ do: 'quest', id: 'k_sabantuy', stage: 10 }] },
        bye,
      ],
    },
    hub: {
      alt: [{ cond: [{ counter: 'k_sab_points', atLeast: 2 }], text: 'dlg.k_sab_org.hub_lead' }],
      options: [
        { text: 'egg', next: 'egg', cond: [{ notFlag: 'k_sab_egg' }] },
        { text: 'sack', next: 'sack', cond: [{ notFlag: 'k_sab_sack' }] },
        { text: 'pole', next: 'pole', cond: [{ notFlag: 'k_sab_pole' }] },
        { text: 'finish', next: 'prize', cond: [{ counter: 'k_sab_points', atLeast: 2 }] },
        { text: 'finish', next: 'consolation',
          cond: [{ flag: 'k_sab_egg' }, { flag: 'k_sab_sack' }, { flag: 'k_sab_pole' }, { counter: 'k_sab_points', below: 2 }] },
        bye,
      ],
    },
    egg: {
      options: [
        { text: 'egg_run', next: 'egg_win', check: { stat: 'A', min: 6 }, fail: 'egg_lose', effects: win('egg'), failEffects: lose('egg') },
        back,
      ],
    },
    egg_win: { options: [back] },
    egg_lose: { options: [back] },
    sack: { options: [back] }, // the fight itself is in Ildar's dialogue
    pole: {
      options: [
        { text: 'pole_climb', next: 'pole_win', check: { stats: ['S', 'A'], min: 13 }, fail: 'pole_lose',
          effects: [...win('pole', 100), { do: 'give', item: 'stimpak' }], failEffects: [...lose('pole'), { do: 'hurt', n: 3 }] },
        { text: 'pole_honey', next: 'pole_honey', cond: [{ item: 'chakchak' }],
          effects: [{ do: 'take', item: 'chakchak' }, ...win('pole', 100), { do: 'give', item: 'stimpak' }] },
        back,
      ],
    },
    pole_win: { options: [back] },
    pole_honey: { options: [back] },
    pole_lose: { options: [back] },
    prize: {
      effects: [
        { do: 'give', item: 'towel' },
        { do: 'caps', n: 100 },
        { do: 'xp', n: 300 },
        { do: 'log', key: 'log.k_sab.batyr' },
        { do: 'flag', key: 'k_sabantuy_method', value: 'win' },
        { do: 'questDone', id: 'k_sabantuy' },
      ],
      options: [bye],
    },
    consolation: {
      effects: [
        { do: 'give', item: 'echpochmak', count: 2 },
        { do: 'xp', n: 75 },
        { do: 'flag', key: 'k_sabantuy_method', value: 'lose' },
        { do: 'questDone', id: 'k_sabantuy' },
      ],
      options: [bye],
    },
    after: {
      alt: [{ cond: [{ flag: 'k_sabantuy_method', is: 'lose' }], text: 'dlg.k_sab_org.after_lose' }],
      options: [bye],
    },
  },
};

// Ildar, sack-fight champion. Strength / Unarmed / cheating (Steal, Speech).
export const k_sab_champ: DialogueDef = {
  id: 'k_sab_champ',
  entry: [
    { node: 'after', cond: [{ flag: 'k_sab_sack' }] },
    { node: 'start' },
  ],
  nodes: {
    start: {
      options: [
        { text: 'challenge', next: 'sack', cond: [{ quest: 'k_sabantuy' }] },
        { text: 'who', next: 'who' },
        bye,
      ],
    },
    who: {
      options: [
        { text: 'challenge', next: 'sack', cond: [{ quest: 'k_sabantuy' }] },
        bye,
      ],
    },
    sack: {
      options: [
        { text: 'strength', next: 'win_strength', check: { stat: 'S', min: 6 }, fail: 'lost', effects: win('sack'), failEffects: lose('sack') },
        { text: 'unarmed', next: 'win_unarmed', check: { skill: 'unarmed', min: 60 }, fail: 'lost', effects: win('sack'), failEffects: lose('sack') },
        { text: 'grease', next: 'win_grease', check: { skill: 'steal', min: 35 }, fail: 'caught',
          effects: [...win('sack'), { do: 'flag', key: 'k_sab_cheated' }], failEffects: lose('sack') },
        { text: 'taunt', next: 'win_taunt', check: { skill: 'speech', min: 45 }, fail: 'lost', effects: win('sack'), failEffects: lose('sack') },
        { text: 'later', next: 'end' },
      ],
    },
    win_strength: { options: [bye] },
    win_unarmed: { options: [bye] },
    win_grease: { options: [bye] },
    win_taunt: { options: [bye] },
    lost: { effects: [{ do: 'hurt', n: 2 }], options: [bye] },
    caught: { options: [bye] },
    after: {
      alt: [{ cond: [{ flag: 'k_sab_sack', is: 'win' }], text: 'dlg.k_sab_champ.after_win' }],
      options: [bye],
    },
  },
};
