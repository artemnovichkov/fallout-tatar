import type { WorldScene } from '../scenes/WorldScene';
import { mountCombat } from './combat';
import { mountInventory } from './inventory';
import { mountContainer } from './container';
import { mountBarter } from './barter';
import { mountCharacter } from './character';
import { mountDialogue } from './dialogue';
import { mountPipbuy } from './pipbuy';
import { mountSound } from './sound';
import { mountAutosave } from './autosave';

// Mounted once per page (UI scene lives across World restarts). Add new ones here.
export function mountFeatures(_world: WorldScene) {
  mountPerWorld(_world);
  mountInventory(_world);
  mountContainer(_world);
  mountBarter(_world);
  mountCharacter(_world);
  mountDialogue(_world);
  mountPipbuy(_world);
  mountSound(_world);
  mountAutosave(_world);
}

// Modules that dispose on World 'shutdown' and must be re-mounted after map travel.
export function mountPerWorld(world: WorldScene) {
  mountCombat(world);
}
