import type { WorldScene } from '../scenes/WorldScene';
import { bus } from '../systems/events';
import { game, save } from '../systems/state';
import { t } from '../systems/i18n';
import { el } from './dom';

// Autosave to localStorage: a few seconds after any state change, on map arrival, and when the tab is hidden.
// Never during combat or when dead, so "Load" after death returns to the moment before the fight.
export function mountAutosave(world: WorldScene) {
  const badge = el('div', { class: 'autosave-badge' }, [t('autosave.saved')]);
  document.getElementById('overlay')!.appendChild(badge);
  let timer = 0;
  const canSave = () => !world.inputOverride && !game.player.dead && world.scene.isActive();
  const doSave = (show = true) => {
    clearTimeout(timer);
    if (!canSave() || !save()) return;
    if (!show) return;
    badge.textContent = t('autosave.saved');
    badge.classList.remove('show'); void badge.offsetWidth; badge.classList.add('show');
  };
  const schedule = () => { clearTimeout(timer); timer = window.setTimeout(doSave, 3000); };

  bus.on('stateChanged', schedule);
  bus.on('combatEnd', schedule);
  world.events.on('create', () => doSave());
  doSave();
  document.addEventListener('visibilitychange', () => { if (document.hidden) doSave(false); });
  window.addEventListener('pagehide', () => doSave(false));
}
