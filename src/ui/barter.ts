// FO2-style barter: your inventory | your offer | their offer | their inventory.
import type { WorldScene } from '../scenes/WorldScene';
import type { Actor, InvStack } from '../systems/types';
import { el } from './dom';
import { bus } from '../systems/events';
import { game, log, changed } from '../systems/state';
import { t } from '../systems/i18n';
import { item } from '../data/items';
import { barter, buyPrice, sellPrice, offerValue, npcCaps, type Offer, type BarterResult } from '../systems/inventory';
import { ui, openWindow, header, itemRow, sortedInv, btn, itemInfo, weightLine } from './inventory';
import { textureUrl } from './icons';

const REFUSE: Partial<Record<BarterResult, number>> = { noCaps: 3, traderNoCaps: 2, tooHeavy: 2, quest: 1, empty: 1 };
const pick = (r: BarterResult) => t(`barter.refuse.${r}.${Math.floor(Math.random() * (REFUSE[r] ?? 1))}`);

export function openBarter(npc: Actor) {
  const p = game.player;
  let give: Offer = {};
  let take: Offer = {};
  let sel: { id: string; side: 'p' | 't' } | null = null;
  let say = t('barter.greet');
  const left = (inv: InvStack[], o: Offer) => inv.map(s => ({ ...s, count: s.count - (o[s.id] ?? 0) })).filter(s => s.count > 0);
  const offerStacks = (o: Offer, inv: InvStack[]): InvStack[] =>
    Object.entries(o).filter(([, n]) => n > 0).map(([id, count]) => ({ id, count, loaded: inv.find(s => s.id === id)?.loaded }));
  const move = (o: Offer, id: string, n: number) => { o[id] = Math.max(0, (o[id] ?? 0) + n); if (!o[id]) delete o[id]; };
  const sell = (id: string) => sellPrice(id, p, npc);
  const buy = (id: string) => buyPrice(id, p, npc);

  openWindow('inv-barter', (root, close) => {
    const rerender = () => changed();
    const list = (stacks: InvStack[], key: string, price: (id: string) => number, side: 'p' | 't', onMove: (id: string, n: number) => void, arrow: string) =>
      el('div', { class: 'inv-list', 'data-scroll': key }, stacks.length ? sortedInv(stacks).map(s => {
        const blocked = side === 'p' && item(s.id)?.type === 'quest' && key === 'pinv';
        const acts = [btn(arrow, () => onMove(s.id, 1), { disabled: blocked, title: '×1' })];
        if (s.count > 1) acts.push(btn(arrow + arrow, () => onMove(s.id, s.count), { disabled: blocked, title: `×${s.count}` }));
        return itemRow(s, {
          note: `${price(s.id) * s.count}`, actions: acts, selected: sel?.id === s.id && sel.side === side,
          onclick: () => { sel = { id: s.id, side }; rerender(); },
        });
      }) : [el('div', { class: 'inv-emptyrow' }, ['—'])]);

    const giveV = offerValue(give, sell);
    const takeV = offerValue(take, buy);
    const owed = takeV - giveV;
    const col = (title: string, body: HTMLElement, foot?: string) => el('div', { class: 'inv-col' }, [
      el('div', { class: 'inv-colhead' }, [title]), body, foot ? el('div', { class: 'inv-colfoot' }, [foot]) : null,
    ]);
    const portrait = textureUrl(npc.portrait ?? '');
    const deal = () => {
      const r = barter(p, npc, give, take);
      if (r.result === 'ok') {
        give = {}; take = {};
        say = t('barter.ok');
        log(t('barter.log', { name: t(npc.nameKey), n: r.owed }));
        ui.world?.persistNpc(npc);
      } else say = pick(r.result);
      changed();
    };

    root.append(
      ...header(t('barter.title', { name: t(npc.nameKey) }), close),
      el('div', { class: 'barter-top' }, [
        portrait ? el('img', { class: 'barter-portrait', src: portrait, alt: '' }) : null,
        el('div', { class: 'barter-say' }, [`«${say}»`]),
      ]),
      el('div', { class: 'inv-four' }, [
        col(t('barter.yours'), list(left(p.inventory, give), 'pinv', sell, 'p', (id, n) => { move(give, id, n); rerender(); }, '›'),
          `${t('inv.caps')}: ${game.caps}`),
        col(t('barter.yourOffer'), list(offerStacks(give, p.inventory), 'poff', sell, 'p', (id, n) => { move(give, id, -n); rerender(); }, '‹'),
          t('barter.total', { n: giveV })),
        col(t('barter.theirOffer'), list(offerStacks(take, npc.inventory), 'toff', buy, 't', (id, n) => { move(take, id, -n); rerender(); }, '›'),
          t('barter.total', { n: takeV })),
        col(t('barter.theirs'), list(left(npc.inventory, take), 'tinv', buy, 't', (id, n) => { move(take, id, n); rerender(); }, '‹'),
          `${t('inv.caps')}: ${npcCaps(npc)}`),
      ]),
      el('div', { class: 'barter-sum' }, [
        el('span', {}, [owed > 0 ? t('barter.owe', { n: owed }) : owed < 0 ? t('barter.get', { n: -owed }) : t('barter.even')]),
        el('span', {}, [t('inv.weight'), ': ', weightLine(p)]),
      ]),
      sel ? itemInfo(sel.id, (sel.side === 'p' ? p : npc).inventory.find(s => s.id === sel!.id)) : '',
      el('div', { class: 'inv-foot' }, [
        btn(t('barter.deal'), deal, { cls: 'primary' }),
        btn(t('barter.cancel'), close),
      ]),
    );
  });
}

let mounted = false;
export function mountBarter(_world: WorldScene) {
  if (mounted) return;
  mounted = true;
  bus.on('openBarter', ({ npc }) => openBarter(npc));
}
