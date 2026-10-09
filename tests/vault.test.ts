import { describe, it, expect, beforeEach } from 'vitest';
import { getMap } from '../src/data/map';
import { spawnNpc } from '../src/data/npcs';
import { VAULT_DIALOGUES } from '../src/data/dialogues/vault';
import { VAULT_QUESTS } from '../src/data/quests_vault';
import { VAULT_NPCS } from '../src/data/npcs_vault';
import { DIALOGUES } from '../src/data/dialogues';
import { VAULT_RATS, VAULT_SECURITY, vaultOnDeath } from '../src/data/dialogues/vault/hooks';
import { game, setGame, newGame } from '../src/systems/state';
import { DialogueSession } from '../src/systems/dialogue';
import { questStage, questDone, questText } from '../src/systems/quests';
import { hasItem, containerHolder } from '../src/systems/inventory';
import { setLang } from '../src/systems/i18n';

const files = import.meta.glob<Record<string, string>>('../src/locales/*/*.json', { eager: true, import: 'default' });
const dict = (lang: string) => Object.assign({}, ...Object.entries(files).filter(([p]) => p.includes(`/${lang}/`)).map(([, d]) => d));
const RU = dict('ru'), TT = dict('tt');
const both = (k: string) => { expect(RU[k], `ru ${k}`).toBeTruthy(); expect(TT[k], `tt ${k}`).toBeTruthy(); };

const V = getMap('vault116');
const npc = (tpl: string) => spawnNpc(tpl, tpl, { q: 0, r: 0 });
const talk = (tpl: string) => new DialogueSession(DIALOGUES[tpl], { game, npc: npc(tpl) });
const pick = (s: DialogueSession, opt: string) => {
  const i = s.options().findIndex(o => o.opt.text === opt || o.opt.text === `@dlg.common.${opt}`);
  expect(i, `option ${opt} in ${s.def.id}.${s.node}`).toBeGreaterThanOrEqual(0);
  s.choose(i);
};
const has = (s: DialogueSession, opt: string) => s.options().some(o => o.opt.text === opt);

describe('vault116 content', () => {
  it('map: exit to Kazan, valve in vault_storage, rats, labels', () => {
    expect(V.exits?.[0]).toMatchObject({ to: 'kazan_ruins', spawn: 'vault' });
    expect(V.spawns?.entrance).toBeDefined();
    expect(V.containers.find(c => c.id === 'vault_storage')!.items.some(i => i.id === 'valve')).toBe(true);
    expect(V.npcs.filter(n => n.template === 'v_rat').map(n => n.id).sort()).toEqual([...VAULT_RATS].sort());
    for (const id of VAULT_SECURITY) expect(V.npcs.some(n => n.id === id)).toBe(true);
    for (const n of V.npcs) expect(n.id.startsWith('v_'), n.id).toBe(true);
    const rat = npc('v_rat');
    expect(rat.hostile).toBe(true);
    expect(rat.maxHp).toBeLessThan(25);
  });

  it('all vault texts exist in ru+tt', () => {
    for (const d of Object.values(VAULT_DIALOGUES)) for (const [nid, n] of Object.entries(d.nodes)) {
      both(n.text ?? `dlg.${d.id}.${nid}`);
      n.alt?.forEach(a => both(a.text));
      for (const o of n.options) both(o.text.startsWith('@') ? o.text.slice(1) : `dlg.${d.id}.o.${o.text}`);
    }
    for (const q of Object.values(VAULT_QUESTS)) { both(q.nameKey); q.stages.forEach(s => both(`quest.${q.id}.s${s}`)); both(`quest.${q.id}.done`); }
    for (const m of ['overseer', 'resign', 'peace', 'rebels', 'blood']) both(`quest.v_revolt.done.${m}`);
    for (const n of Object.values(VAULT_NPCS)) both(n.nameKey);
    for (const l of V.labels ?? []) both(l.key);
    for (const i of ['wrench', 'jumpsuit', 'kystybyi', 'rat_meat', 'water_chip', 'keycard']) { both(`item.${i}`); both(`item.${i}.d`); }
    for (const o of ['wall_vault', 'terminal', 'purifier', 'reactor', 'pipes', 'table', 'shelf', 'desk']) both(`look.obj.${o}`);
    both('look.floor.metal'); both('look.floor.grate');
  });
});

describe('vault quests', () => {
  beforeEach(() => { setGame(newGame()); setLang('ru'); });

  it('water: Science patch, then chip install completes', () => {
    const s = talk('v_robot');
    pick(s, 'purifier');
    expect(questStage('v_water')).toBe(10);
    game.player.skills.science = 40;
    pick(s, 'patch');
    expect(s.node).toBe('patched');
    expect(questStage('v_water')).toBe(20);
    expect(game.flags.v_purifier_patched).toBe(true);
    game.player.inventory.push({ id: 'water_chip', count: 1 });
    const s2 = talk('v_robot');
    expect(s2.node).toBe('chip');
    const caps = game.caps;
    pick(s2, 'install');
    expect(questDone('v_water')).toBe(true);
    expect(hasItem(game.player, 'water_chip')).toBe(false);
    expect(game.caps).toBe(caps + 150);
    expect(game.flags.v_water_fixed).toBe(true);
    expect(talk('v_robot').text()).toContain('рәхәт');
  });

  it('water: failed patch can not be retried', () => {
    game.player.skills.science = 10;
    const s = talk('v_robot');
    pick(s, 'purifier'); pick(s, 'patch');
    expect(s.node).toBe('patch_fail');
    const s2 = talk('v_robot'); pick(s2, 'purifier');
    expect(has(s2, 'patch')).toBe(false);
  });

  it('rats: quest from robot, all rats dead -> stage 20, reward', () => {
    const s = talk('v_robot');
    pick(s, 'rats'); pick(s, 'rats_accept');
    expect(questStage('v_rats')).toBe(10);
    VAULT_RATS.slice(0, 3).forEach(id => { game.npcs[id] = { dead: true }; vaultOnDeath(id); });
    expect(questStage('v_rats')).toBe(10);
    game.npcs.v_rat4 = { dead: true }; vaultOnDeath('v_rat4');
    expect(questStage('v_rats')).toBe(20);
    const xp = game.xp;
    const s2 = talk('v_robot');
    expect(s2.node).toBe('rats_done');
    expect(questDone('v_rats')).toBe(true);
    expect(hasItem(game.player, 'jumpsuit')).toBe(true);
    expect(game.xp).toBe(xp + 150);
    expect(talk('v_robot').node).toBe('again');
  });

  it('revolt: side with overseer — expose Alsu', () => {
    const o = talk('v_overseer');
    pick(o, 'rebels'); pick(o, 'help');
    expect(questStage('v_revolt')).toBe(30);
    const a = talk('v_alsu');
    expect(game.flags.v_alsu_met).toBe(true);
    pick(a, 'bye');
    const o2 = talk('v_overseer');
    pick(o2, 'rebels');
    expect(has(o2, 'help')).toBe(false);
    pick(o2, 'name');
    expect(questDone('v_revolt')).toBe(true);
    expect(game.flags.v_revolt_method).toBe('overseer');
    expect(questText('v_revolt')).toContain('домашним арестом');
    expect(talk('v_alsu').node).toBe('arrested');
    game.flags.v_timur_met = true;
    expect(talk('v_timur').textKey()).toBe('dlg.v_timur.again_order');
  });

  it('revolt: rebels — stolen keycard leads to coup and fight', () => {
    const a = talk('v_alsu');
    pick(a, 'plan'); pick(a, 'join');
    expect(questStage('v_revolt')).toBe(20);
    // lockpicked the overseer's desk
    const desk = containerHolder('v_overseer_desk')!;
    expect(hasItem(desk, 'keycard')).toBe(true);
    game.player.inventory.push({ id: 'keycard', count: 1 });
    const a2 = talk('v_alsu');
    expect(a2.node).toBe('card');
    pick(a2, 'give');
    expect(a2.node).toBe('coup');
    expect(questStage('v_revolt')).toBe(40);
    expect(hasItem(game.player, 'keycard')).toBe(false);
    game.player.skills.speech = 20;
    const o = talk('v_overseer');
    expect(o.node).toBe('coup');
    pick(o, 'surrender');
    expect(o.node).toBe('coup_fight');
    pick(o, 'fight');
    expect(o.actions).toEqual(['combat']);
    expect(talk('v_security').node).toBe('coup');
    game.npcs.v_overseer = { dead: true }; vaultOnDeath('v_overseer');
    expect(questDone('v_revolt')).toBe(true);
    expect(game.flags.v_revolt_method).toBe('rebels');
    expect(talk('v_alsu').node).toBe('after');
  });

  it('revolt: overseer resigns [Speech 60], Alsu gets the card', () => {
    talk('v_alsu');
    game.player.skills.speech = 60;
    const o = talk('v_overseer');
    pick(o, 'rebels');
    expect(has(o, 'peace')).toBe(false); // water not fixed
    pick(o, 'resign');
    expect(o.node).toBe('resigned');
    expect(hasItem(game.player, 'keycard')).toBe(true);
    expect(hasItem(containerHolder('v_overseer_desk')!, 'keycard')).toBe(false);
    const a = talk('v_alsu');
    expect(a.node).toBe('card');
    pick(a, 'give');
    expect(a.node).toBe('won');
    expect(questDone('v_revolt')).toBe(true);
    expect(game.flags.v_revolt_method).toBe('resign');
    expect(talk('v_overseer').textKey()).toBe('dlg.v_overseer.after_resign');
  });

  it('revolt: peace needs fixed water + [Speech 50]', () => {
    talk('v_alsu');
    game.flags.v_water_fixed = true;
    game.player.skills.speech = 50;
    const o = talk('v_overseer');
    pick(o, 'rebels'); pick(o, 'peace');
    expect(o.node).toBe('peace');
    expect(questDone('v_revolt')).toBe(true);
    expect(game.flags.v_revolt_method).toBe('peace');
    expect(talk('v_alsu').textKey()).toBe('dlg.v_alsu.after_peace');
    expect(talk('v_overseer').textKey()).toBe('dlg.v_overseer.after_peace');
  });

  it('flavor: cook feeds once and hints at Shurale', () => {
    const c = talk('v_cook');
    pick(c, 'food');
    expect(hasItem(game.player, 'kystybyi')).toBe(true);
    pick(c, 'chip');
    expect(c.text()).toContain('Шүрәле');
    expect(has(talk('v_cook'), 'food')).toBe(false);
  });
});
