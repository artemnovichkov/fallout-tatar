import type { Hex } from './hex';

export type Special = 'S' | 'P' | 'E' | 'C' | 'I' | 'A' | 'L';
export type SpecialStats = Record<Special, number>;

export type SkillId =
  | 'smallGuns' | 'melee' | 'unarmed' | 'firstAid' | 'lockpick'
  | 'steal' | 'speech' | 'barter' | 'science' | 'sneak';

export type ItemType = 'weapon' | 'armor' | 'consumable' | 'ammo' | 'misc' | 'quest';

export interface ItemDef {
  id: string;
  type: ItemType;
  nameKey: string;       // i18n key
  descKey: string;
  icon: string;          // texture key / frame name
  weight: number;
  value: number;         // in caps
  // weapon
  damage?: [number, number];
  apCost?: number;
  range?: number;        // in hexes
  skill?: SkillId;
  ammo?: string;         // ammo item id
  magazine?: number;
  // armor
  ac?: number;
  dr?: number;           // damage resistance %
  // consumable
  heal?: number;
  rads?: number;         // negative = removes radiation
}

export interface InvStack { id: string; count: number; loaded?: number }

export interface Actor {
  id: string;
  nameKey: string;
  sprite: string;        // sprite sheet key, e.g. 'ravil', 'raider'
  pos: Hex;
  facing: number;        // 0..5, see hex.DIRS
  hp: number;
  maxHp: number;
  ap: number;
  maxAp: number;
  ac: number;
  special: SpecialStats;
  skills: Record<SkillId, number>;
  inventory: InvStack[];
  weapon?: string;       // equipped weapon item id
  armor?: string;
  dr?: number;           // damage resistance % from armor (set by inventory.equipArmor)
  caps?: number;         // NPC money (traders)
  hostile: boolean;
  dead: boolean;
  dialogue?: string;     // dialogue id
  portrait?: string;     // texture key for talking head
  ai?: 'aggressive' | 'coward' | 'idle';
}

export interface QuestState { id: string; stage: number; done: boolean; failed?: boolean }

export interface GameState {
  version: 1;
  mapId?: string;        // current location (data/maps); undefined = default map
  lang: 'ru' | 'tt';
  player: Actor;
  level: number;
  xp: number;
  rads: number;
  caps: number;
  flags: Record<string, number | boolean | string>;
  quests: Record<string, QuestState>;
  npcs: Record<string, Partial<Actor>>; // persistent overrides for map actors (dead, hp, pos, inventory)
  containers: Record<string, InvStack[]>;
  log: string[];
  skillPoints?: number;  // unspent skill points (leveling)
  perks?: string[];
}
