import type { DialogueDef } from '../../systems/dialogue';

// Minnulla, friendly ghoul, ex-announcer of "Radio Bolgar". Side quest "holotape".
export const ghoul: DialogueDef = {
  id: 'ghoul',
  entry: [
    { node: 'after', cond: [{ questDone: 'holotape' }] },
    { node: 'return', cond: [{ quest: 'holotape', item: 'holotape' }] },
    { node: 'waiting', cond: [{ quest: 'holotape' }] },
    { node: 'again', cond: [{ flag: 'ghoul_met' }] },
    { node: 'start' },
  ],
  nodes: {
    start: {
      effects: [{ do: 'flag', key: 'ghoul_met' }],
      options: [
        { text: 'ghoul', next: 'ghoul_self' },
        { text: 'help', next: 'task' },
        { text: 'found', next: 'return', cond: [{ questNew: 'holotape', item: 'holotape' }] },
        { text: 'badri', next: 'badri_info', cond: [{ quest: 'kazan', maxStage: 29 }] },
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    again: {
      options: [
        { text: 'help', next: 'task' },
        { text: 'found', next: 'return', cond: [{ questNew: 'holotape', item: 'holotape' }] },
        { text: 'badri', next: 'badri_info', cond: [{ quest: 'kazan', maxStage: 29 }] },
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    ghoul_self: {
      options: [
        { text: 'help', next: 'task' },
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    task: {
      options: [
        { text: 'accept', next: 'end', effects: [{ do: 'quest', id: 'holotape', stage: 10 }] },
        { text: 'refuse', next: 'end' },
      ],
    },
    waiting: {
      options: [
        { text: 'badri', next: 'badri_info', cond: [{ quest: 'kazan', maxStage: 29 }] },
        { text: '@dlg.common.bye', next: 'end' },
      ],
    },
    badri_info: { options: [{ text: '@dlg.common.bye', next: 'end' }] },
    return: { options: [{ text: 'give', next: 'thanks' }] },
    thanks: {
      effects: [
        { do: 'take', item: 'holotape' },
        { do: 'caps', n: 75 },
        { do: 'give', item: 'ayran', count: 2 },
        { do: 'questDone', id: 'holotape' },
        { do: 'xp', n: 200 },
      ],
      options: [{ text: '@dlg.common.bye', next: 'end' }],
    },
    after: { options: [{ text: '@dlg.common.bye', next: 'end' }] },
  },
};
