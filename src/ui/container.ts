import { sfx } from '../systems/audio';
// Loot window: player inventory <-> container / corpse.
import type { WorldScene } from '../scenes/WorldScene';
import type { Actor } from '../systems/types';
import { el } from './dom';
import { bus } from '../systems/events';
import { game, log, changed } from '../systems/state';
import { t } from '../systems/i18n';
import { item } from '../data/items';
import { containerHolder, tryUnlock, transfer, totalWeight, carryCapacity, type Holder } from '../systems/inventory';
import { ui, openWindow, header, itemRow, sortedInv, btn, itemName, weightLine } from './inventory';

function persist(id: string) {
  if (!id.startsWith('corpse:')) return;
  const a = ui.world?.actors.get(id.slice(7));
  if (a) ui.world?.persistNpc(a);
}

export function openContainer(id: string) {
  const p = game.player;
  const lock = tryUnlock(id);
  if (lock === 'failed' || lock === 'needKey') { sfx('fail'); changed(); return; }
  if (lock === 'picked' || lock === 'key') sfx('unlock');
  const box = containerHolder(id, ui.world?.actors);
  if (!box) return;
  const corpse = id.startsWith('corpse:') ? (box as Actor) : null;
  const title = corpse ? t('cont.corpse', { name: t(corpse.nameKey) }) : t('cont.title');

  const take = (sid: string, n: number) => {
    const w = (item(sid)?.weight ?? 0) * n;
    if (w > 0 && totalWeight(p) + w > carryCapacity(p)) { log(t('cont.tooHeavy')); return; }
    const moved = transfer(box, p, sid, n);
    if (moved) log(t('cont.took', { item: itemName(sid), n: moved }));
    persist(id); changed();
  };
  const put = (sid: string, n: number) => { transfer(p, box, sid, n); persist(id); changed(); };
  const takeAll = () => {
    for (const s of [...box.inventory]) take(s.id, s.count);
  };

  const column = (h: Holder, label: string, dir: 'take' | 'put', extra?: Node) => el('div', { class: 'inv-col' }, [
    el('div', { class: 'inv-colhead' }, [el('span', {}, [label]), extra ?? null]),
    el('div', { class: 'inv-list', 'data-scroll': dir }, h.inventory.length
      ? sortedInv(h.inventory).map(s => {
        const fn = dir === 'take' ? take : put;
        const quest = dir === 'put' && item(s.id)?.type === 'quest';
        const acts = [btn(dir === 'take' ? t('cont.take') : t('cont.put'), () => fn(s.id, s.count), { disabled: quest })];
        if (s.count > 1) acts.unshift(btn('1', () => fn(s.id, 1), { disabled: quest, title: '×1' }));
        return itemRow(s, { actions: acts });
      })
      : [el('div', { class: 'inv-emptyrow' }, [t('cont.empty')])]),
  ]);

  openWindow('inv-cont', (root, close) => {
    root.append(
      ...header(title, close),
      el('div', { class: 'inv-two' }, [
        column(p, t('char.ravil'), 'put', weightLine(p)),
        column(box, title, 'take'),
      ]),
      el('div', { class: 'inv-foot' }, [
        btn(t('cont.takeAll'), takeAll, { disabled: !box.inventory.length }),
        btn(t('inv.close'), close),
      ]),
    );
  });
}

let mounted = false;
export function mountContainer(_world: WorldScene) {
  if (mounted) return;
  mounted = true;
  bus.on('openContainer', ({ id }) => openContainer(id));
}
