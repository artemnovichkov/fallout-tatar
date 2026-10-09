import { AUTOLOAD_KEY } from './pipbuy';
// Combat HUD buttons (END TURN / END COMBAT / RELOAD) and game-over overlay.
import type { WorldScene } from '../scenes/WorldScene';
import { CombatController } from '../systems/combat';
import { bus } from '../systems/events';
import { t } from '../systems/i18n';
import { game, hasSave } from '../systems/state';
import { el } from './dom';
import { combatSlot } from './hud';

let current: { dispose(): void } | null = null;
export let combat: CombatController | null = null;

export function mountCombat(world: WorldScene) {
  current?.dispose();
  const ctl = new CombatController(world);
  combat = ctl;
  const offs: (() => void)[] = [];

  const render = () => {
    const slot = combatSlot();
    if (!slot) return;
    slot.innerHTML = '';
    if (!ctl.active) return;
    const mine = ctl.current?.id === 'player';
    const b = (label: string, fn: () => void, title: string) => {
      const e = el('button', { onclick: fn, title }, [label]);
      e.disabled = !mine;
      return e;
    };
    slot.append(
      b(t('combat.btnEndTurn'), () => ctl.playerEndTurn(), 'Space'),
      b(t('combat.btnEndCombat'), () => ctl.playerEndCombat(), 'Enter'),
      b(t('combat.btnReload'), () => ctl.playerReload(), 'R'),
    );
  };
  offs.push(bus.on('combatStart', render), bus.on('combatEnd', render), bus.on('turnStart', render), bus.on('langChanged', render));

  let overlay: HTMLElement | null = null;
  const gameOver = () => {
    overlay?.remove();
    const restart = (fromSave: boolean) => {
      // Full reload: WorldScene/feature mounts aren't safe to restart in place.
      try { if (fromSave) sessionStorage.setItem(AUTOLOAD_KEY, '1'); } catch { /* ignore */ }
      location.reload();
    };
    const loadBtn = el('button', { onclick: () => restart(true) }, [t('combat.goLoad')]);
    loadBtn.disabled = !hasSave();
    overlay = el('div', {
      class: 'modal-back', style: 'inset:0;z-index:50;background:rgba(40,0,0,.6)',
    }, [
      el('div', { class: 'window', style: 'max-width:480px;text-align:center' }, [
        el('h2', { style: 'color:#ff5040' }, [t('combat.goTitle')]),
        el('p', {}, [t('combat.goText')]),
        el('div', { style: 'display:flex;gap:12px;justify-content:center' }, [
          loadBtn,
          el('button', { onclick: () => restart(false) }, [t('combat.goNew')]),
        ]),
      ]),
    ]);
    document.getElementById('overlay')!.appendChild(overlay);
  };
  offs.push(bus.on('actorDied', a => { if (a.id === 'player') world.time.delayedCall(900, gameOver); }));

  const dispose = () => {
    offs.forEach(o => o());
    ctl.dispose();
    overlay?.remove();
    if (combat === ctl) combat = null;
    if (current === handle) current = null;
  };
  const handle = { dispose };
  current = handle;
  world.events.once('shutdown', dispose);
  render();
  if (game.player.dead) gameOver();
}
