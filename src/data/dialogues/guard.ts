import type { DialogueDef } from '../../systems/dialogue';

// Röstäm, guard at the gate of Yana Bistä.
export const guard: DialogueDef = {
  id: 'guard',
  entry: [
    { node: 'hero', cond: [{ questDone: 'kazan' }] },
    { node: 'start' },
  ],
  nodes: {
    start: {
      options: [
        { text: 'what', next: 'place' },
        { text: 'danger', next: 'danger' },
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    place: {
      options: [
        { text: 'danger', next: 'danger' },
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    danger: {
      options: [
        { text: 'what', next: 'place' },
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    hero: { options: [{ text: '@dlg.common.bye', next: 'end' }] },
  },
};
