// Asset contract shared by art pipeline (tools/) and game code.
// Character sheets: public/assets/sprites/<key>.png, frame CHAR_W x CHAR_H.
// Rows = facings in FACING_ROWS order. Cols = animation frames per ANIM layout.
// Missing facings (NW, SW) are rendered by flipping NE, SE.
export const CHAR_W = 48;
export const CHAR_H = 80;
export const CHAR_ORIGIN_Y = 0.9; // feet position within frame

// Row index for each hex direction (hex.DIRS order: 0 NE,1 SE,2 S,3 SW,4 NW,5 N) and flip flag.
export const FACING_ROWS = ['S', 'SE', 'NE', 'N'] as const;
export const DIR_TO_ROW: { row: number; flip: boolean }[] = [
  { row: 2, flip: false }, // NE
  { row: 1, flip: false }, // SE
  { row: 0, flip: false }, // S
  { row: 1, flip: true },  // SW
  { row: 2, flip: true },  // NW
  { row: 3, flip: false }, // N
];

export const ANIM = {
  idle: { start: 0, count: 1, rate: 1, repeat: -1 },
  walk: { start: 1, count: 6, rate: 10, repeat: -1 },
  attack: { start: 7, count: 3, rate: 10, repeat: 0 },
  hit: { start: 10, count: 1, rate: 6, repeat: 0 },
  death: { start: 11, count: 4, rate: 8, repeat: 0 },
} as const;
export const CHAR_COLS = 15;
export type AnimName = keyof typeof ANIM;

export const CHARACTERS = ['ravil', 'raider', 'trader', 'elder', 'ghoul', 'guard'] as const;

// Floor tiles: public/assets/tiles/<key>.png, size TILE_W x TILE_H (hex-shaped, transparent corners).
export const TILE_W = 50;
export const TILE_H = 26;
export const TILES = ['sand', 'asphalt', 'rubble', 'grass', 'water', 'floor', 'carpet'] as const;

// Objects: public/assets/sprites/obj_<key>.png, any size, origin at bottom-center (0.5, 1) sitting on hex center.
export const OBJECTS = [
  'wall_stone', 'wall_brick', 'wall_kremlin', 'tower_syuyumbike', 'tree_dead', 'barrel', 'crate',
  'car_wreck', 'vault_door', 'tent', 'campfire', 'derrick', 'lamp_post', 'counter', 'bed', 'locker',
] as const;

// Portraits: public/assets/portraits/<key>.png, 160x160.
export const PORTRAITS = ['portrait_ravil', 'portrait_trader', 'portrait_elder', 'portrait_raider', 'portrait_ghoul', 'portrait_guard'] as const;

// Item icons: public/assets/ui/icons.png sprite sheet 32x32 frames, frame order = ICONS.
export const ICON_SIZE = 32;
export const ICONS = [
  'knife', 'pistol', 'sawedoff', 'ammo9', 'shells', 'stimpak', 'echpochmak', 'ayran', 'chakchak',
  'leather', 'tubeteika', 'caps', 'key', 'holotape', 'kazan', 'junk', 'rifle', 'ammo762',
] as const;
