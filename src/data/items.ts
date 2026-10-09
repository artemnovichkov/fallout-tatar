import type { ItemDef } from '../systems/types';

const list: ItemDef[] = [
  { id: 'knife', type: 'weapon', nameKey: 'item.knife', descKey: 'item.knife.d', icon: 'knife', weight: 1, value: 20, damage: [2, 6], apCost: 3, range: 1, skill: 'melee' },
  { id: 'pistol', type: 'weapon', nameKey: 'item.pistol', descKey: 'item.pistol.d', icon: 'pistol', weight: 3, value: 120, damage: [5, 12], apCost: 5, range: 12, skill: 'smallGuns', ammo: 'ammo9', magazine: 6 },
  { id: 'sawedoff', type: 'weapon', nameKey: 'item.sawedoff', descKey: 'item.sawedoff.d', icon: 'sawedoff', weight: 4, value: 200, damage: [12, 24], apCost: 5, range: 5, skill: 'smallGuns', ammo: 'shells', magazine: 2 },
  { id: 'rifle', type: 'weapon', nameKey: 'item.rifle', descKey: 'item.rifle.d', icon: 'rifle', weight: 8, value: 400, damage: [10, 20], apCost: 5, range: 20, skill: 'smallGuns', ammo: 'ammo762', magazine: 5 },
  { id: 'ammo9', type: 'ammo', nameKey: 'item.ammo9', descKey: 'item.ammo9.d', icon: 'ammo9', weight: 0, value: 2 },
  { id: 'shells', type: 'ammo', nameKey: 'item.shells', descKey: 'item.shells.d', icon: 'shells', weight: 0, value: 3 },
  { id: 'ammo762', type: 'ammo', nameKey: 'item.ammo762', descKey: 'item.ammo762.d', icon: 'ammo762', weight: 0, value: 4 },
  { id: 'leather', type: 'armor', nameKey: 'item.leather', descKey: 'item.leather.d', icon: 'leather', weight: 8, value: 250, ac: 15, dr: 20 },
  { id: 'tubeteika', type: 'armor', nameKey: 'item.tubeteika', descKey: 'item.tubeteika.d', icon: 'tubeteika', weight: 1, value: 60, ac: 5, dr: 5 },
  { id: 'stimpak', type: 'consumable', nameKey: 'item.stimpak', descKey: 'item.stimpak.d', icon: 'stimpak', weight: 0, value: 75, heal: 15 },
  { id: 'echpochmak', type: 'consumable', nameKey: 'item.echpochmak', descKey: 'item.echpochmak.d', icon: 'echpochmak', weight: 0, value: 10, heal: 8, rads: 2 },
  { id: 'ayran', type: 'consumable', nameKey: 'item.ayran', descKey: 'item.ayran.d', icon: 'ayran', weight: 1, value: 40, rads: -25 },
  { id: 'chakchak', type: 'consumable', nameKey: 'item.chakchak', descKey: 'item.chakchak.d', icon: 'chakchak', weight: 1, value: 30, heal: 20, rads: 5 },
  { id: 'junk', type: 'misc', nameKey: 'item.junk', descKey: 'item.junk.d', icon: 'junk', weight: 2, value: 5 },
  { id: 'kazan', type: 'quest', nameKey: 'item.kazan', descKey: 'item.kazan.d', icon: 'kazan', weight: 5, value: 0 },
  { id: 'key_depot', type: 'quest', nameKey: 'item.key_depot', descKey: 'item.key_depot.d', icon: 'key', weight: 0, value: 0 },
  { id: 'holotape', type: 'quest', nameKey: 'item.holotape', descKey: 'item.holotape.d', icon: 'holotape', weight: 0, value: 0 },
  // v2
  { id: 'wrench', type: 'weapon', nameKey: 'item.wrench', descKey: 'item.wrench.d', icon: 'wrench', weight: 2, value: 25, damage: [3, 8], apCost: 3, range: 1, skill: 'melee' },
  { id: 'jumpsuit', type: 'armor', nameKey: 'item.jumpsuit', descKey: 'item.jumpsuit.d', icon: 'jumpsuit', weight: 3, value: 80, ac: 5, dr: 10 },
  { id: 'kystybyi', type: 'consumable', nameKey: 'item.kystybyi', descKey: 'item.kystybyi.d', icon: 'kystybyi', weight: 0, value: 15, heal: 12 },
  { id: 'rat_meat', type: 'consumable', nameKey: 'item.rat_meat', descKey: 'item.rat_meat.d', icon: 'rat_meat', weight: 1, value: 4, heal: 5, rads: 6 },
  { id: 'towel', type: 'misc', nameKey: 'item.towel', descKey: 'item.towel.d', icon: 'towel', weight: 1, value: 60 },
  { id: 'water_chip', type: 'quest', nameKey: 'item.water_chip', descKey: 'item.water_chip.d', icon: 'water_chip', weight: 1, value: 0 },
  { id: 'valve', type: 'quest', nameKey: 'item.valve', descKey: 'item.valve.d', icon: 'valve', weight: 2, value: 0 },
  { id: 'debt_note', type: 'quest', nameKey: 'item.debt_note', descKey: 'item.debt_note.d', icon: 'note', weight: 0, value: 0 },
  { id: 'keycard', type: 'quest', nameKey: 'item.keycard', descKey: 'item.keycard.d', icon: 'keycard', weight: 0, value: 0 },
  { id: 'shurale_horn', type: 'quest', nameKey: 'item.shurale_horn', descKey: 'item.shurale_horn.d', icon: 'horn', weight: 1, value: 0 },
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(list.map(i => [i.id, i]));
export const item = (id: string) => ITEMS[id];
