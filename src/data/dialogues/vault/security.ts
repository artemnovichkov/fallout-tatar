import type { DialogueDef } from '../../../systems/dialogue';

// Ilnur, the overseer's security (and only) guard. Joins the overseer in a fight (VAULT_SECURITY group).
export const v_security: DialogueDef = {
  id: 'v_security',
  entry: [
    { node: 'coup', cond: [{ flag: 'v_coup' }, { quest: 'v_revolt' }] },
    { node: 'after', cond: [{ questDone: 'v_revolt' }] },
    { node: 'start' },
  ],
  nodes: {
    start: {
      options: [
        { text: 'who', next: 'who' },
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    who: { options: [{ text: '@dlg.common.bye', next: 'end' }] },
    coup: {
      options: [
        { text: 'fight', next: 'end', effects: [{ do: 'combat' }] },
        { text: 'leave', next: 'end' },
      ],
    },
    after: { options: [{ text: '@dlg.common.bye', next: 'end' }] },
  },
};
