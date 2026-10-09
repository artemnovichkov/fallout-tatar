import { el } from './dom';
import { bus } from '../systems/events';
import { game, save } from '../systems/state';
import { t, setLang, getLang } from '../systems/i18n';
import { item } from '../data/items';

// FO2-like bottom panel: log | HP/AC | weapon slot | AP lamps | buttons.
export function mountHud(): HTMLElement {
  const logBox = el('div', { class: 'hud-log' });
  const hp = el('div', { class: 'hud-counter' });
  const ac = el('div', { class: 'hud-counter small' });
  const weapon = el('button', { class: 'hud-weapon', title: 'weapon' });
  const ap = el('div', { class: 'hud-ap' });
  const mode = el('div', { class: 'hud-mode' });
  const combatBtns = el('div', { class: 'hud-combat' });

  const btn = (label: string, fn: () => void, title = '') => el('button', { class: 'hud-btn', onclick: fn, title }, [label]);
  const buttons = el('div', { class: 'hud-buttons' }, [
    btn('INV', () => bus.emit('openInventory'), 'I'),
    btn('CHA', () => bus.emit('openCharacter'), 'C'),
    btn('PIP', () => bus.emit('openPipbuy'), 'P'),
    btn('SAVE', () => { if (save()) bus.emit('log', t('log.saved')); }),
    btn('LANG', () => setLang(getLang() === 'ru' ? 'tt' : 'ru')),
  ]);

  const hud = el('div', { class: 'hud' }, [
    logBox,
    el('div', { class: 'hud-stats' }, [el('label', {}, ['HP']), hp, el('label', {}, ['AC']), ac]),
    el('div', { class: 'hud-center' }, [weapon, ap, combatBtns, mode]),
    buttons,
  ]);
  hud.id = 'hud';

  const refresh = () => {
    const p = game.player;
    hp.textContent = String(p.hp).padStart(3, '0');
    hp.classList.toggle('low', p.hp < p.maxHp * 0.3);
    ac.textContent = String(p.ac).padStart(2, '0');
    const w = p.weapon ? item(p.weapon) : undefined;
    const stack = p.inventory.find(s => s.id === p.weapon);
    weapon.textContent = w ? `${t(w.nameKey)}${w.magazine ? ` ${stack?.loaded ?? 0}/${w.magazine}` : ''}  [${w.apCost} AP]` : t('hud.unarmed');
    ap.innerHTML = '';
    for (let i = 0; i < p.maxAp; i++) ap.append(el('span', { class: i < p.ap ? 'lamp on' : 'lamp' }));
  };
  const addLog = (m: string) => {
    logBox.append(el('div', {}, [`• ${m}`]));
    while (logBox.childElementCount > 60) logBox.firstChild!.remove();
    logBox.scrollTop = logBox.scrollHeight;
  };
  bus.on('stateChanged', refresh);
  bus.on('log', addLog);
  bus.on('modeChanged', m => { mode.textContent = t(`mode.${m}`); });
  bus.on('langChanged', () => { refresh(); mode.textContent = t('mode.move'); });
  game.log.slice(-20).forEach(addLog);
  mode.textContent = t('mode.move');
  refresh();
  return hud;
}

// Slot where combat UI puts its buttons (END TURN / END COMBAT).
export const combatSlot = () => document.querySelector('.hud-combat') as HTMLElement;
