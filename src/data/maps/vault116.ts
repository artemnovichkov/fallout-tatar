import type { MapDef } from '../map';

// STUB — to be replaced by the full Vault 116 location.
export const VAULT116: MapDef = {
  id: 'vault116',
  nameKey: 'map.vault116',
  floor: [
    '____________',
    '____________',
    '____________',
    '____________',
    '____________',
    '____________',
  ],
  objects: [
    '#####V######',
    '#..........#',
    '#..........#',
    '#..........#',
    '#..........#',
    '############',
  ],
  playerStart: { col: 5, row: 1 },
  spawns: { entrance: { col: 5, row: 1 } },
  exits: [{ col: 5, row: 0, to: 'kazan_ruins', spawn: 'vault', labelKey: 'exit.kazan' }],
  npcs: [],
  containers: [],
};
