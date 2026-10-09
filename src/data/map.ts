// Map format: rectangular grid in odd-q offset coords (col, row). One char per hex.
// floor[row][col] -> FLOOR_LEGEND, objects[row][col] -> OBJECT_LEGEND ('.' or ' ' = none).
export const FLOOR_LEGEND: Record<string, string> = {
  '.': 'sand', ',': 'asphalt', ':': 'rubble', '"': 'grass', '~': 'water', '_': 'floor', '=': 'carpet', '-': 'metal', '+': 'grate',
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
  'W': { obj: 'wall_vault', blocks: true, los: true },
  'M': { obj: 'terminal', blocks: true, los: false },
  'P': { obj: 'purifier', blocks: true, los: true },
  'R': { obj: 'reactor', blocks: true, los: true },
  'p': { obj: 'pipes', blocks: true, los: false },
  't': { obj: 'table', blocks: true, los: false },
  's': { obj: 'shelf', blocks: true, los: false },
  'd': { obj: 'desk', blocks: true, los: false },
  'I': { obj: 'pole', blocks: true, los: false },
};

export interface MapNpc { id: string; template: string; col: number; row: number; facing?: number }
export interface MapContainer { id: string; col: number; row: number; items: { id: string; count: number }[]; lockedSkill?: number; keyId?: string }
export interface MapLabel { key: string; col: number; row: number }
export interface MapDef {
  id: string;
  nameKey: string;
  floor: string[];
  objects: string[];
  playerStart: { col: number; row: number };
  npcs: MapNpc[];
  containers: MapContainer[]; // must sit on an object hex (crate/locker/barrel)
  labels?: MapLabel[];        // Pip-Buy mini-map captions (i18n keys)
  spawns?: Record<string, { col: number; row: number }>; // arrival points for exits from other maps
  exits?: MapExit[];
}

// Transition hex. May sit on a blocking object (door: player walks adjacent) or on floor (player walks onto it).
// `requires`: game flag that must be truthy; otherwise `lockedKey` message is logged.
export interface MapExit { col: number; row: number; to: string; spawn: string; labelKey: string; requires?: string; lockedKey?: string }

export { MAPS, getMap, MAP } from './maps';
