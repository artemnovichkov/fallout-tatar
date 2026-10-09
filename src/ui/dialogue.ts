// FO2-style dialogue window + world hooks for the content (forced talk, raider group hostility, quest triggers).
import type { WorldScene } from '../scenes/WorldScene';
import type { Actor } from '../systems/types';
import { el, modal, closeModal, modalOpen } from './dom';
import { bus } from '../systems/events';
import { game, log, changed } from '../systems/state';
import { t } from '../systems/i18n';
import { distance, direction } from '../systems/hex';
import { DialogueSession, checkLabel, type DialogueAction } from '../systems/dialogue';
import { checkQuestTriggers } from '../systems/quests';
import { DIALOGUES } from '../data/dialogues';
import { RAIDER_GROUP } from '../data/npcs';
import './content.css';

// Talking head as data URL from the Phaser texture manager (works for loaded and generated textures).
const portraitCache = new Map<string, string>();
export function portraitUrl(world: WorldScene, key?: string): string {
  if (!key || !world.textures.exists(key)) return '';
  if (!portraitCache.has(key)) {
    try { portraitCache.set(key, world.textures.getBase64(key)); } catch { return ''; }
  }
  return portraitCache.get(key)!;
}

function setGroupHostile(world: WorldScene) {
  for (const id of RAIDER_GROUP) {
    const a = world.actors.get(id);
    if (a && !a.dead && !a.hostile) { a.hostile = true; world.persistNpc(a); }
  }
}

function startFight(world: WorldScene, npc: Actor) {
  if (RAIDER_GROUP.includes(npc.id)) setGroupHostile(world);
  else if (!npc.hostile) { npc.hostile = true; if (npc.ai === 'idle' || npc.ai === 'coward') npc.ai = 'aggressive'; world.persistNpc(npc); }
  changed();
  bus.emit('combatStart');
}

function runActions(world: WorldScene, npc: Actor, actions: DialogueAction[]) {
  for (const a of actions) {
    if (a === 'barter') bus.emit('openBarter', { npc });
    if (a === 'combat') startFight(world, npc);
  }
}

export function openDialogue(world: WorldScene, npc: Actor) {
  const def = npc.dialogue ? DIALOGUES[npc.dialogue] : undefined;
  if (!def || npc.dead) return;
  const s = new DialogueSession(def, { game, npc });
  let feedback = '';

  const img = el('img', { class: 'dlg-img', alt: '' });
  const url = portraitUrl(world, npc.portrait);
  if (url) img.src = url;
  const name = el('div', { class: 'dlg-name' });
  const fb = el('div', { class: 'dlg-feedback' });
  const text = el('div', { class: 'dlg-text' });
  const opts = el('ol', { class: 'dlg-options' });
  const hint = el('div', { class: 'dlg-hint' });
  const win = el('div', { class: 'window dlg' }, [
    el('div', { class: 'dlg-head' }, [el('div', { class: 'dlg-portrait crt' }, [img]), name]),
    el('div', { class: 'dlg-body' }, [fb, text]),
    el('div', { class: 'ornament' }),
    opts,
    hint,
  ]);

  const render = () => {
    name.textContent = t(npc.nameKey);
    fb.textContent = feedback;
    fb.className = 'dlg-feedback' + (s.lastCheck ? (s.lastCheck.ok ? ' ok' : ' fail') : '');
    text.textContent = s.text();
    hint.textContent = t('dlg.ui.hint');
    opts.innerHTML = '';
    s.options().forEach((o, i) => {
      opts.append(el('li', {}, [el('button', { class: 'dlg-opt', onclick: () => pick(i) }, [`${i + 1}. ${o.label}`])]));
    });
  };

  const pick = (i: number) => {
    s.choose(i);
    feedback = s.lastCheck ? `${checkLabel(s.lastCheck.check)} ${t(s.lastCheck.ok ? 'dlg.check.ok' : 'dlg.check.fail')}` : '';
    world.persistNpc(npc);
    changed();
    if (s.ended) {
      close();
      runActions(world, npc, s.actions);
      return;
    }
    render();
  };

  const onKey = (e: KeyboardEvent) => {
    const n = Number(e.key);
    if (n >= 1 && n <= 9 && n <= s.options().length) { e.preventDefault(); e.stopPropagation(); pick(n - 1); }
  };
  const offLang = bus.on('langChanged', render);
  document.addEventListener('keydown', onKey, true);
  const close = modal(win, () => { document.removeEventListener('keydown', onKey, true); offLang(); });
  render();
  if (s.ended) { close(); runActions(world, npc, s.actions); }
}

// ---------------------------------------------------------------- world hooks
function forcedTalk(world: WorldScene) {
  if (game.flags.badri_met || world.inputOverride || modalOpen()) return;
  const b = world.actors.get('badri');
  const p = world.player;
  if (!b || b.dead || b.hostile || distance(b.pos, p.pos) > 6) return;
  world.setFacing(b, direction(b.pos, p.pos));
  world.setFacing(p, direction(p.pos, b.pos));
  bus.emit('talk', { npc: b });
}

let offs: (() => void)[] = [];
export function mountDialogue(world: WorldScene) {
  offs.forEach(f => f());
  offs = [];
  offs.push(bus.on('talk', ({ npc }) => openDialogue(world, npc)));
  offs.push(bus.on('stateChanged', () => {
    // Provoking one raider provokes the camp.
    if (RAIDER_GROUP.some(id => { const a = world.actors.get(id); return a && !a.dead && a.hostile; })) setGroupHostile(world);
    if (checkQuestTriggers()) changed();
    forcedTalk(world);
  }));
  offs.push(bus.on('actorDied', a => {
    if (a.id === 'badri') game.flags.badri_dead = true;
    if (RAIDER_GROUP.includes(a.id)) setGroupHostile(world);
  }));
  // Looting the raider chest under their noses: Sneak roll, failure starts a fight.
  offs.push(bus.on('openContainer', ({ id }) => {
    if (id !== 'raider_chest' || world.inputOverride || game.flags.badri_pacified) return;
    const watchers = RAIDER_GROUP.map(r => world.actors.get(r)).filter(a => a && !a.dead && !a.hostile && distance(a.pos, world.player.pos) <= 10);
    if (!watchers.length) return;
    const chance = Math.max(5, Math.min(95, game.player.skills.sneak + 30));
    if (Math.random() * 100 < chance) { log(t('world.badri.sneak')); return; }
    log(t('world.badri.caught'));
    setTimeout(() => { closeModal(); startFight(world, watchers[0]!); }, 0);
  }));
  const onReq = (target: Actor) => { if (RAIDER_GROUP.includes(target.id)) setGroupHostile(world); };
  world.events.on('attackRequest', onReq);
  offs.push(() => world.events.off('attackRequest', onReq));
}
