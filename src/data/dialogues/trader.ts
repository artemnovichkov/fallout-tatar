import type { DialogueDef, DOption, Effect } from '../../systems/dialogue';

// kazan2 hooks: Gali's debt quest (k_debt) + fuel stock after Marat's pump (k_oil).
const tradeBye: DOption[] = [{ text: 'trade', next: 'end', effects: [{ do: 'barter' }] }, { text: '@dlg.common.bye', next: 'end' }];
const discount: Effect[] = [{ do: 'flag', key: 'gali_discount' }, { do: 'flag', key: 'discount:trader', value: 0.15 }];
const kazan2: DOption[] = [
  { text: 'debt_job', next: 'debt_job', cond: [{ questNew: 'k_debt' }] },
  { text: 'debt_back', next: 'debt_paid',
    cond: [{ quest: 'k_debt', stage: 20 }, { caps: 100 }, { any: [{ flag: 'k_debt_method', is: 'force' }, { flag: 'k_debt_method', is: 'speech' }] }] },
  { text: 'debt_dead', next: 'debt_dead', cond: [{ quest: 'k_debt', stage: 20 }, { flag: 'k_debt_method', is: 'fight' }] },
  { text: 'debt_pay', next: 'debt_selfpaid', cond: [{ quest: 'k_debt', stage: 10 }, { caps: 100 }] },
  { text: 'debt_forgive', next: 'debt_forgiven', cond: [{ quest: 'k_debt', stage: 30 }] },
  { text: 'fuel', next: 'fuel', cond: [{ flag: 'k_fuel' }, { notFlag: 'k_fuel_stock' }] },
];

// Gali-abyi, shopkeeper of Yana Bistä.
export const trader: DialogueDef = {
  id: 'trader',
  entry: [
    { node: 'again', cond: [{ flag: 'trader_met' }] },
    { node: 'start' },
  ],
  nodes: {
    start: {
      effects: [{ do: 'flag', key: 'trader_met' }],
      options: [
        { text: 'trade', next: 'end', effects: [{ do: 'barter' }] },
        { text: 'news', next: 'news' },
        { text: 'raiders', next: 'raiders', cond: [{ quest: 'kazan', maxStage: 29 }] },
        { text: 'holo', next: 'holo', cond: [{ quest: 'holotape', stage: 10 }] },
        ...kazan2,
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    again: {
      alt: [
        { cond: [{ flag: 'gali_annoyed' }], text: 'dlg.trader.again_annoyed' },
        { cond: [{ flag: 'gali_discount' }], text: 'dlg.trader.again_discount' },
      ],
      options: [
        { text: 'trade', next: 'end', effects: [{ do: 'barter' }] },
        { text: 'news', next: 'news' },
        { text: 'raiders', next: 'raiders', cond: [{ quest: 'kazan', maxStage: 29 }] },
        { text: 'holo', next: 'holo', cond: [{ quest: 'holotape', stage: 10 }] },
        ...kazan2,
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    news: {
      options: [
        { text: 'trade', next: 'end', effects: [{ do: 'barter' }] },
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    raiders: {
      effects: [{ do: 'flag', key: 'knows_key' }],
      options: [
        { text: 'trade', next: 'end', effects: [{ do: 'barter' }] },
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    holo: {
      options: [
        { text: 'trade', next: 'end', effects: [{ do: 'barter' }] },
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    // ---- kazan2: Gali's debt
    debt_job: {
      options: [
        { text: 'debt_accept', next: 'debt_accepted', effects: [{ do: 'quest', id: 'k_debt', stage: 10 }, { do: 'give', item: 'debt_note' }] },
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    debt_accepted: { options: tradeBye },
    debt_paid: {
      effects: [
        { do: 'caps', n: -100 }, { do: 'take', item: 'debt_note' }, { do: 'caps', n: 30 }, { do: 'xp', n: 150 },
        ...discount, { do: 'questDone', id: 'k_debt' },
      ],
      options: tradeBye,
    },
    debt_selfpaid: {
      effects: [
        { do: 'caps', n: -100 }, { do: 'take', item: 'debt_note' }, { do: 'xp', n: 75 },
        { do: 'flag', key: 'k_debt_method', value: 'pay' }, ...discount, { do: 'questDone', id: 'k_debt' },
      ],
      options: tradeBye,
    },
    debt_forgiven: {
      effects: [{ do: 'flag', key: 'gali_annoyed' }, { do: 'xp', n: 50 }, { do: 'questDone', id: 'k_debt' }],
      options: tradeBye,
    },
    debt_dead: {
      effects: [{ do: 'take', item: 'debt_note' }, { do: 'xp', n: 50 }, { do: 'questDone', id: 'k_debt' }],
      options: tradeBye,
    },
    // ---- kazan2: fuel from Marat's derrick brings caravans -> new stock line
    fuel: {
      effects: [
        { do: 'flag', key: 'k_fuel_stock' },
        { do: 'stock', item: 'ammo762', count: 20 }, { do: 'stock', item: 'stimpak', count: 2 },
        { do: 'stock', item: 'rifle', count: 1 }, { do: 'stock', item: 'kystybyi', count: 3 },
      ],
      options: tradeBye,
    },
  },
};
