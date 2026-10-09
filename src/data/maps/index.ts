import type { MapDef } from '../map';
import { KAZAN } from './kazan';
import { VAULT116 } from './vault116';

// Registry of all locations. NPC and container ids must be unique across maps (save state is keyed by id).
export const MAPS: Record<string, MapDef> = {
  [KAZAN.id]: KAZAN,
  [VAULT116.id]: VAULT116,
};
export const DEFAULT_MAP = KAZAN.id;
export const getMap = (id?: string): MapDef => MAPS[id ?? DEFAULT_MAP] ?? KAZAN;
/** @deprecated use getMap(game.mapId) */
export const MAP = KAZAN;
