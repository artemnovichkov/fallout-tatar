import type { WorldScene } from '../scenes/WorldScene';
import { mountCombat } from './combat';
import { mountInventory } from './inventory';
import { mountContainer } from './container';
import { mountBarter } from './barter';
import { mountCharacter } from './character';
import { mountDialogue } from './dialogue';
import { mountPipbuy } from './pipbuy';

// Each feature module exports mount(world). Add new ones here.
export function mountFeatures(_world: WorldScene) {
  mountCombat(_world);
  mountInventory(_world);
  mountContainer(_world);
  mountBarter(_world);
  mountCharacter(_world);
  mountDialogue(_world);
  mountPipbuy(_world);
}
