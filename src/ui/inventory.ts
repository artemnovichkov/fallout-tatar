// FO2-style inventory window + shared window/item helpers for container, barter, character UIs.
import './ui.css';
import type { WorldScene } from '../scenes/WorldScene';
import type { Actor, InvStack, ItemDef } from '../systems/types';
import { el, modal } from './dom';
import { bus } from '../systems/events';
import { game, log, changed } from '../systems/state';
import { t } from '../systems/i18n';
import { item } from '../data/items';
import { iconUrl, textureUrl, setTextureManager } from './icons';
import {
  combatHooks, totalWeight, carryCapacity, equipWeapon, equipArmor, useItem, reload, unload, dropItem,
} from '../systems/inventory';
import { initLeveling } from '../systems/leveling';

// ---------- shared ----------
export const ui = { world: null as WorldScene | null };

let liveRender: (() => void) | null = null;
let busInited = false;
function initBus() {
  if (busInited) return;
  busInited = true;
  bus.on('stateChanged', () => liveRender?.());
  bus.on('langChanged', () => liveRender?.());
}

// Opens a modal window whose content is rebuilt on every state change. Keeps scroll of [data-scroll] boxes.
export function openWindow(cls: string, build: (root: HTMLElement, close: () => void) => void, onClose?: () => void) {
  initBus();
  const root = el('div', { class: `window inv-win ${cls}` });
  let close = () => {};
  const render = () => {
    const scroll = new Map<string, number>();
    root.querySelectorAll<HTMLElement>('[data-scroll]').forEach(e => scroll.set(e.dataset.scroll!, e.scrollTop));
    const top = root.scrollTop;
    root.replaceChildren();
    build(root, () => close());
    root.querySelectorAll<HTMLElement>('[data-scroll]').forEach(e => { e.scrollTop = scroll.get(e.dataset.scroll!) ?? 0; });
    root.scrollTop = top;
  };
  liveRender = render;
  render();
  close = modal(root, () => { if (liveRender === render) liveRender = null; onClose?.(); });
  return close;
}

export const header = (title: string, close: () => void) => [
  el('div', { class: 'inv-head' }, [
    el('h2', {}, [title]),
    el('button', { class: 'inv-x', onclick: close, title: 'Esc', 'aria-label': t('inv.close') }, ['×']),
  ]),
  el('div', { class: 'ornament' }),
];

export const itemName = (id: string) => { const d = item(id); return d ? t(d.nameKey) : id; };

export function iconImg(id: string, cls = 'inv-icon') {
  const d = item(id);
  const src = iconUrl(d?.icon ?? id);
  return src ? el('img', { class: cls, src, alt: '' }) : el('span', { class: `${cls} inv-icon-ph` });
}

export interface RowOpts {
  selected?: boolean;
  note?: string;           // e.g. price or "equipped"
  onclick?: () => void;
  actions?: HTMLElement[]; // buttons on the right
  draggable?: boolean;
  count?: number;          // override shown count
}
export function itemRow(s: InvStack, o: RowOpts = {}) {
  const d = item(s.id);
  const count = o.count ?? s.count;
  const row = el('div', {
    class: `inv-row${o.selected ? ' sel' : ''}${o.onclick ? ' click' : ''}`,
    onclick: o.onclick, draggable: o.draggable ? 'true' : undefined, tabindex: o.onclick ? 0 : undefined,
    onkeydown: o.onclick ? (e: KeyboardEvent) => { if (e.key === 'Enter') o.onclick!(); } : undefined,
    ondragstart: o.draggable ? (e: DragEvent) => e.dataTransfer?.setData('text/plain', s.id) : undefined,
  }, [
    iconImg(s.id),
    el('span', { class: 'inv-name' }, [itemName(s.id), count > 1 ? el('b', {}, [` ×${count}`]) : null]),
    el('span', { class: 'inv-note' }, [o.note ?? (d ? `${+(d.weight * count).toFixed(1)}` : '')]),
    o.actions?.length ? el('span', { class: 'inv-acts' }, o.actions) : null,
  ]);
  return row;
}

export const btn = (label: string, fn: () => void, opts: { disabled?: boolean; cls?: string; title?: string } = {}) =>
  el('button', {
    class: opts.cls, title: opts.title, disabled: opts.disabled,
    onclick: (e: Event) => { e.stopPropagation(); if (!opts.disabled) fn(); },
  }, [label]);

export function itemStats(d: ItemDef, s?: InvStack): string[] {
  const out: string[] = [];
  if (d.damage) out.push(t('inv.st.damage', { a: d.damage[0], b: d.damage[1] }));
  if (d.apCost) out.push(t('inv.st.ap', { n: d.apCost }));
  if (d.range) out.push(t('inv.st.range', { n: d.range }));
  if (d.ammo && d.magazine) out.push(t('inv.st.ammo', { item: itemName(d.ammo), n: s?.loaded ?? 0, max: d.magazine }));
  if (d.ac) out.push(t('inv.st.ac', { n: d.ac }));
  if (d.dr) out.push(t('inv.st.dr', { n: d.dr }));
  if (d.heal) out.push(t('inv.st.heal', { n: d.heal }));
  if (d.rads) out.push(t('inv.st.rads', { n: d.rads > 0 ? `+${d.rads}` : d.rads }));
  out.push(t('inv.st.weight', { n: d.weight }));
  if (d.value) out.push(t('inv.st.value', { n: d.value }));
  return out;
}

export function itemInfo(id: string, s?: InvStack, actions: HTMLElement[] = []) {
  const d = item(id);
  if (!d) return el('div', { class: 'inv-info' }, [id]);
  return el('div', { class: 'inv-info' }, [
    el('div', { class: 'inv-info-head' }, [iconImg(id, 'inv-icon big'), el('h3', {}, [t(d.nameKey)])]),
    el('p', { class: 'inv-desc' }, [t(d.descKey)]),
    el('ul', { class: 'inv-stats' }, itemStats(d, s).map(x => el('li', {}, [x]))),
    actions.length ? el('div', { class: 'inv-actions' }, actions) : null,
  ]);
}

export const sortedInv = (inv: InvStack[]) => {
  const order = ['weapon', 'armor', 'ammo', 'consumable', 'misc', 'quest'];
  return [...inv].sort((a, b) => order.indexOf(item(a.id)?.type ?? 'misc') - order.indexOf(item(b.id)?.type ?? 'misc'));
};

export function weightLine(a: Actor) {
  const w = totalWeight(a), cap = carryCapacity(a);
  return el('span', { class: w > cap ? 'inv-over' : '' }, [`${+w.toFixed(1)} / ${cap}`]);
}

// ---------- inventory window ----------
export function openInventory() {
  let sel: string | null = null;
  const p = game.player;
  const act = (fn: () => boolean | void) => () => { fn(); changed(); };

  openWindow('inv-main', (root, close) => {
    if (sel && !p.inventory.some(s => s.id === sel)) sel = null;
    const list = el('div', { class: 'inv-list', 'data-scroll': 'list' },
      p.inventory.length
        ? sortedInv(p.inventory).map(s => itemRow(s, {
          selected: s.id === sel, draggable: true,
          note: s.id === p.weapon ? t('inv.inHand') : s.id === p.armor ? t('inv.equipped') : undefined,
          onclick: () => { sel = s.id; liveRender?.(); },
        }))
        : [el('div', { class: 'inv-emptyrow' }, [t('inv.empty')])]);

    const slot = (kind: 'weapon' | 'armor') => {
      const id = kind === 'weapon' ? p.weapon : p.armor;
      const box = el('div', {
        class: `inv-slot${id && id === sel ? ' sel' : ''}`,
        onclick: () => { if (id) { sel = id; liveRender?.(); } },
        ondragover: (e: DragEvent) => e.preventDefault(),
        ondrop: (e: DragEvent) => {
          e.preventDefault();
          const did = e.dataTransfer?.getData('text/plain');
          if (!did) return;
          if (kind === 'weapon' ? equipWeapon(p, did) : equipArmor(p, did)) {
            log(t(kind === 'weapon' ? 'inv.log.equip' : 'inv.log.wear', { item: itemName(did) }));
            changed();
          }
        },
      }, [
        el('label', {}, [t(kind === 'weapon' ? 'inv.weapon' : 'inv.armor')]),
        id ? iconImg(id, 'inv-icon big') : el('span', { class: 'inv-icon big inv-icon-ph' }),
        el('span', {}, [id ? itemName(id) : kind === 'weapon' ? t('inv.fists') : t('inv.none')]),
      ]);
      return box;
    };
    const portrait = textureUrl(p.portrait ?? 'portrait_ravil');
    const center = el('div', { class: 'inv-center' }, [
      portrait ? el('img', { class: 'inv-portrait', src: portrait, alt: t('char.ravil') }) : el('div', { class: 'inv-portrait' }),
      el('div', { class: 'inv-pname' }, [t('char.ravil')]),
      el('div', { class: 'inv-slots' }, [slot('weapon'), slot('armor')]),
    ]);
    const statRow = (k: string, v: Node | string) => el('div', { class: 'inv-stat' }, [el('span', {}, [t(k)]), el('b', {}, [v])]);
    const stats = el('div', { class: 'inv-statbox' }, [
      statRow('inv.hp', `${p.hp}/${p.maxHp}`),
      statRow('inv.ac', String(p.ac)),
      statRow('inv.dr', `${p.dr ?? 0}%`),
      statRow('inv.weight', weightLine(p)),
      statRow('inv.caps', String(game.caps)),
      statRow('inv.rads', String(game.rads)),
      combatHooks.inCombat() ? statRow('inv.apLeft', String(p.ap)) : null,
    ].filter(Boolean) as HTMLElement[]);

    let detail: HTMLElement;
    const s = sel ? p.inventory.find(x => x.id === sel) : undefined;
    const d = sel ? item(sel) : undefined;
    if (s && d) {
      const a: HTMLElement[] = [];
      if (d.type === 'consumable') a.push(btn(t('inv.use'), act(() => useItem(p, d.id))));
      if (d.type === 'weapon') {
        if (p.weapon === d.id) a.push(btn(t('inv.unequip'), act(() => equipWeapon(p, undefined))));
        else a.push(btn(t('inv.equip'), act(() => { equipWeapon(p, d.id); log(t('inv.log.equip', { item: t(d.nameKey) })); })));
        if (d.magazine && (s.loaded ?? 0) < d.magazine) a.push(btn(t('inv.reload'), act(() => reload(p, d.id))));
        if (s.loaded) a.push(btn(t('inv.unload'), act(() => unload(p, d.id))));
      }
      if (d.type === 'armor') {
        if (p.armor === d.id) a.push(btn(t('inv.unequip'), act(() => equipArmor(p, undefined))));
        else a.push(btn(t('inv.wear'), act(() => { equipArmor(p, d.id); log(t('inv.log.wear', { item: t(d.nameKey) })); })));
      }
      if (d.type !== 'quest') {
        a.push(btn(t('inv.drop'), act(() => dropItem(p, d.id, 1)), { cls: 'warn' }));
        if (s.count > 1) a.push(btn(t('inv.dropAll'), act(() => dropItem(p, d.id, s.count)), { cls: 'warn' }));
      }
      detail = itemInfo(d.id, s, a);
    } else detail = el('div', { class: 'inv-info hint' }, [t('inv.selectHint')]);

    root.append(
      ...header(t('inv.title'), close),
      el('div', { class: 'inv-grid' }, [list, center, stats]),
      detail,
      el('div', { class: 'inv-foot' }, [btn(t('inv.close'), close)]),
    );
  });
}

let mounted = false;
export function mountInventory(world: WorldScene) {
  ui.world = world;
  setTextureManager(world.textures);
  combatHooks.inCombat = () => ui.world?.inputOverride != null;
  initLeveling();
  if (mounted) return;
  mounted = true;
  bus.on('openInventory', openInventory);
}
