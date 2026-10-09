// Map format: rectangular grid in odd-q offset coords (col, row). One char per hex.
// floor[row][col] -> FLOOR_LEGEND, objects[row][col] -> OBJECT_LEGEND ('.' or ' ' = none).
export const FLOOR_LEGEND: Record<string, string> = {
  '.': 'sand', ',': 'asphalt', ':': 'rubble', '"': 'grass', '~': 'water', '_': 'floor', '=': 'carpet',
};

// blocks: impassable; los: blocks line of sight
export const OBJECT_LEGEND: Record<string, { obj: string; blocks: boolean; los: boolean }> = {
  '#': { obj: 'wall_stone', blocks: true, los: true },
  'B': { obj: 'wall_brick', blocks: true, los: true },
  'K': { obj: 'wall_kremlin', blocks: true, los: true },
  'S': { obj: 'tower_syuyumbike', blocks: true, los: true },
  'T': { obj: 'tree_dead', blocks: true, los: false },
  'o': { obj: 'barrel', blocks: true, los: false },
  'x': { obj: 'crate', blocks: true, los: false },
  'C': { obj: 'car_wreck', blocks: true, los: false },
  'V': { obj: 'vault_door', blocks: true, los: true },
  'A': { obj: 'tent', blocks: true, los: true },
  'f': { obj: 'campfire', blocks: true, los: false },
  'D': { obj: 'derrick', blocks: true, los: true },
  'l': { obj: 'lamp_post', blocks: true, los: false },
  'n': { obj: 'counter', blocks: true, los: false },
  'b': { obj: 'bed', blocks: true, los: false },
  'L': { obj: 'locker', blocks: true, los: false },
};

export interface MapNpc { id: string; template: string; col: number; row: number; facing?: number }
export interface MapContainer { id: string; col: number; row: number; items: { id: string; count: number }[]; lockedSkill?: number; keyId?: string }
export interface MapDef {
  id: string;
  nameKey: string;
  floor: string[];
  objects: string[];
  playerStart: { col: number; row: number };
  npcs: MapNpc[];
  containers: MapContainer[]; // must sit on an object hex (crate/locker/barrel)
}

export const MAP: MapDef = {
  id: 'kazan_ruins',
  nameKey: 'map.kazan_ruins',
  floor: [
    '..........,,,,,,,,..........',
    '..........,,,,,,,,..........',
    '..::......,,,,,,,,....:::...',
    '..::......,,,,,,,,..........',
    '.........._______...........',
    '.........._______...........',
    '.........._______...........',
    '..........,,,,,,,,..........',
    '"""".......,,,,,,,......~~~~',
    '"""""......,,,,,,,.....~~~~~',
    '""""".......,,,,,,....~~~~~~',
    '"""""".......,,,,,...~~~~~~~',
  ],
  objects: [
    '............................',
    '..T...........S.............',
    '............................',
    '..........BBBBBBB.....o.....',
    '..........B.....B...........',
    '..........B..n..B....C......',
    '..........B.....B...........',
    '..........BBB.BBB...........',
    '....x.......................',
    '..T.................f.......',
    '............................',
    '............................',
  ],
  playerStart: { col: 13, row: 9 },
  npcs: [
    { id: 'trader', template: 'trader', col: 13, row: 4 },
    { id: 'raider1', template: 'raider', col: 22, row: 9 },
  ],
  containers: [
    { id: 'crate1', col: 4, row: 8, items: [{ id: 'ammo9', count: 12 }, { id: 'echpochmak', count: 1 }] },
  ],
};
