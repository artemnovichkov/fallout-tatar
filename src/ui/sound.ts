import type { WorldScene } from '../scenes/WorldScene';
import { bus } from '../systems/events';
import { game } from '../systems/state';
import { sfx, setCombatMusic, toggleMute } from '../systems/audio';
import { t } from '../systems/i18n';

// Wires game events to procedural SFX/music. Combat/world call sfx() directly for per-action sounds.
export function mountSound(_world: WorldScene) {
  bus.on('combatStart', () => { setCombatMusic(true); });
  bus.on('combatEnd', () => setCombatMusic(false));
  bus.on('turnStart', a => { if (a.id === 'player') sfx('turn'); });
  bus.on('openPipbuy', () => sfx('pip'));
  for (const e of ['openInventory', 'openCharacter', 'talk', 'openBarter', 'openContainer'] as const) bus.on(e, () => sfx('open'));

  let caps = game.caps, level = game.level, rads = game.rads;
  bus.on('stateChanged', () => {
    if (game.caps !== caps) sfx('coins');
    if (game.level > level) sfx('levelup');
    if (game.rads > rads) sfx('geiger');
    caps = game.caps; level = game.level; rads = game.rads;
  });

  // UI clicks and modal close.
  document.addEventListener('click', e => { if ((e.target as HTMLElement).closest('button')) sfx('click', 0.7); }, true);
  const overlay = document.getElementById('overlay')!;
  new MutationObserver(muts => {
    for (const m of muts) for (const n of m.removedNodes) if ((n as HTMLElement).id === 'modal') sfx('close');
  }).observe(overlay, { childList: true });

  document.addEventListener('keydown', e => {
    if ((e.key === 'm' || e.key === 'ь') && !(e.target instanceof HTMLInputElement)) {
      bus.emit('log', t(toggleMute() ? 'audio.muted' : 'audio.unmuted'));
    }
  });
}
