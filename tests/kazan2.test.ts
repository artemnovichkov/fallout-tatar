import { describe, it, expect, beforeEach } from 'vitest';
import { MAPS } from '../src/data/map';
import { spawnNpc } from '../src/data/npcs';
import { DIALOGUES } from '../src/data/dialogues';
import { KAZAN2_DIALOGUES } from '../src/data/dialogues/kazan2';
import { KAZAN2_QUESTS } from '../src/data/quests_kazan2';
import { game, setGame, newGame } from '../src/systems/state';
import { DialogueSession, checkLabel } from '../src/systems/dialogue';
import { questStage, questDone, checkQuestTriggers, questText } from '../src/systems/quests';
import { hasItem, countItem, containerHolder, tryUnlock, buyFactor } from '../src/systems/inventory';
import { setLang } from '../src/systems/i18n';
import type { Actor } from '../src/systems/types';

const files = import.meta.glob<Record<string, string>>('../src/locales/*/kazan2.json', { eager: true, import: 'default' });
const RU = Object.entries(files).find(([p]) => p.includes('/ru/'))![1];
const TT = Object.entries(files).find(([p]) => p.includes('/tt/'))![1];

const tpl: Record<string, string> = {
  k_sab_org: 'k_organizer', k_sab_champ: 'k_champion', k_salima: 'k_salima', k_rinat: 'k_rinat', k_marat: 'k_engineer', k_shurale: 'k_shurale',
};
const npc = (id: string) => spawnNpc(id, tpl[id] ?? id, { q: 0, r: 0 });
const talk = (dlg: string, who: Actor = npc(dlg)) => new DialogueSession(DIALOGUES[dlg], { game, npc: who });
const pick = (s: DialogueSession, opt: string) => {
  const i = s.options().findIndex(o => o.opt.text === opt || o.opt.text === `@dlg.common.${opt}`);
  expect(i, `option ${opt} in ${s.def.id}.${s.node}: ${s.options().map(o => o.opt.text)}`).toBeGreaterThanOrEqual(0);
  s.choose(i);
};
const has = (s: DialogueSession, opt: string) => s.options().some(o => o.opt.text === opt);

beforeEach(() => { setGame(newGame()); setLang('ru'); });

describe('kazan2 content', () => {
  it('kazan2 locale files have identical keys; quest/dialogue texts in kazan2.json', () => {
    expect(Object.keys(RU).sort()).toEqual(Object.keys(TT).sort());
    for (const q of Object.values(KAZAN2_QUESTS)) {
      for (const k of [q.nameKey, `quest.${q.id}.done`, ...q.stages.map(s => `quest.${q.id}.s${s}`)]) expect(RU[k], k).toBeTruthy();
    }
    for (const d of Object.values(KAZAN2_DIALOGUES)) for (const nid of Object.keys(d.nodes)) expect(RU[`dlg.${d.id}.${nid}`], `${d.id}.${nid}`).toBeTruthy();
    for (const k of ['item.towel', 'item.valve.d', 'item.debt_note', 'item.shurale_horn.d', 'look.obj.pole']) expect(RU[k] && TT[k], k).toBeTruthy();
  });

  it('map: pole, k_ npcs and shurale stash with water_chip', () => {
    const m = MAPS.kazan_ruins;
    expect(m.objects.some(r => r.includes('I'))).toBe(true);
    for (const id of Object.keys(tpl)) expect(m.npcs.find(n => n.id === id), id).toBeDefined();
    const stash = m.containers.find(c => c.id === 'shurale_stash')!;
    expect(stash.items.some(i => i.id === 'water_chip')).toBe(true);
    expect(m.spawns?.vault).toBeDefined();
    expect(m.exits?.find(e => e.to === 'vault116')).toMatchObject({ col: 5, row: 4 });
  });
});

describe('Sabantuy', () => {
  it('egg (Agility) + pole via chak-chak = 2 wins -> towel', () => {
    game.player.inventory.push({ id: 'chakchak', count: 1 });
    const s = talk('k_sab_org');
    pick(s, 'join');
    expect(questStage('k_sabantuy')).toBe(10);
    expect(has(s, 'finish')).toBe(false);
    pick(s, 'egg'); pick(s, 'egg_run');
    expect(s.node).toBe('egg_win');
    pick(s, 'back');
    pick(s, 'pole');
    const climb = s.options().find(o => o.opt.text === 'pole_climb')!;
    expect(climb.label.startsWith('[Сила+Ловкость 13]')).toBe(true);
    pick(s, 'pole_honey');
    expect(hasItem(game.player, 'chakchak')).toBe(false);
    expect(hasItem(game.player, 'stimpak', 3)).toBe(true);
    pick(s, 'back');
    expect(s.text()).toContain('Две победы');
    const caps = game.caps;
    pick(s, 'finish');
    expect(s.node).toBe('prize');
    expect(hasItem(game.player, 'towel')).toBe(true);
    expect(game.caps).toBe(caps + 100);
    expect(questDone('k_sabantuy')).toBe(true);
    expect(questText('k_sabantuy')).toContain('батыр');
    expect(game.log.some(l => l.includes('Батыр Сабантуя'))).toBe(true);
    expect(talk('k_sab_org').node).toBe('after');
  });

  it('sack fight checks with champion; losing all three -> consolation', () => {
    game.player.special.A = 4;
    const s = talk('k_sab_org');
    pick(s, 'join'); pick(s, 'egg'); pick(s, 'egg_run');
    expect(s.node).toBe('egg_lose');
    pick(s, 'back'); pick(s, 'pole'); pick(s, 'pole_climb');
    expect(s.node).toBe('pole_lose');
    expect(talk('k_sab_champ').options().map(o => o.opt.text)).toContain('challenge');
    const c = talk('k_sab_champ');
    pick(c, 'challenge');
    pick(c, 'strength'); // S 5 < 6
    expect(c.node).toBe('lost');
    expect(game.flags.k_sab_sack).toBe('lose');
    expect(talk('k_sab_champ').node).toBe('after');
    const s2 = talk('k_sab_org');
    pick(s2, 'finish');
    expect(s2.node).toBe('consolation');
    expect(game.flags.k_sabantuy_method).toBe('lose');
    expect(questDone('k_sabantuy')).toBe(true);
  });

  it('cheating at the sack fight with Steal counts as a win', () => {
    game.quests.k_sabantuy = { id: 'k_sabantuy', stage: 10, done: false };
    game.player.skills.steal = 40;
    const c = talk('k_sab_champ');
    pick(c, 'challenge'); pick(c, 'grease');
    expect(c.node).toBe('win_grease');
    expect(game.flags.k_sab_points).toBe(1);
    expect(game.flags.k_sab_cheated).toBe(true);
  });
});

describe('Shurale', () => {
  it('riddles (3rd needs Intelligence 7) give the horn and unlock the stash', () => {
    const sh = npc('k_shurale');
    const s = talk('k_shurale', sh);
    expect(questStage('k_shurale')).toBe(10);
    pick(s, 'riddles'); pick(s, 'go'); pick(s, 'r1_volga'); pick(s, 'r2_tower');
    pick(s, 'r3_think');
    expect(s.node).toBe('riddles_won');
    expect(hasItem(game.player, 'shurale_horn')).toBe(true);
    expect(hasItem(sh, 'shurale_horn')).toBe(false);
    expect(tryUnlock('shurale_stash')).toBe('open');
    expect(hasItem(containerHolder('shurale_stash')!, 'water_chip')).toBe(true);
    checkQuestTriggers();
    expect(questStage('k_shurale')).toBe(20);
    expect(talk('k_shurale', sh).node).toBe('after');
  });

  it('wrong riddle tickles (hp >= 1) and closes riddles; Byltyr needs holotape or [Интеллект 7]', () => {
    game.player.special.I = 5;
    game.player.hp = 3;
    const s = talk('k_shurale');
    pick(s, 'riddles'); pick(s, 'go'); pick(s, 'r1_rinat');
    expect(s.node).toBe('wrong_rinat');
    expect(game.player.hp).toBe(1);
    expect(has(s, 'byltyr')).toBe(false);
    pick(s, 'byltyr_int');
    expect(s.node).toBe('byltyr_fail');
    expect(has(s, 'riddles')).toBe(false);
    const s2 = talk('k_shurale');
    expect(s2.node).toBe('again');
    expect(has(s2, 'byltyr_int')).toBe(false);
    expect(has(s2, 'fight')).toBe(true);
    pick(s2, 'fight');
    expect(s2.actions).toEqual(['combat']);
  });

  it('Tukay way after the holotape quest; Sälimä pays, horn stays as trophy', () => {
    game.quests.holotape = { id: 'holotape', stage: 20, done: true };
    const st = talk('k_salima');
    pick(st, 'what'); pick(st, 'accept');
    expect(questStage('k_shurale')).toBe(10);
    const s = talk('k_shurale');
    expect(has(s, 'byltyr_int')).toBe(false);
    pick(s, 'byltyr'); pick(s, 'log'); pick(s, 'deal');
    expect(game.flags.k_shurale_method).toBe('byltyr');
    expect(game.flags['unlocked:shurale_stash']).toBe(true);
    checkQuestTriggers();
    const caps = game.caps;
    const r = talk('k_salima');
    expect(r.node).toBe('reward');
    pick(r, 'give');
    expect(questDone('k_shurale')).toBe(true);
    expect(game.caps).toBe(caps + 120);
    expect(hasItem(game.player, 'shurale_horn')).toBe(true);
    expect(questText('k_shurale')).toContain('Былтыр');
  });

  it('killing Shurale: horn from the corpse opens the stash (key) and sets method fight', () => {
    game.npcs.k_shurale = { dead: true };
    game.player.inventory.push({ id: 'shurale_horn', count: 1 });
    expect(checkQuestTriggers()).toBe(true);
    expect(questStage('k_shurale')).toBe(20);
    expect(game.flags.k_shurale_method).toBe('fight');
    expect(tryUnlock('shurale_stash')).toBe('key');
  });

  it('stash is locked without the horn', () => {
    expect(tryUnlock('shurale_stash')).toBe('needKey');
  });
});

describe('Almetyevsk oil', () => {
  it('needs the raider camp resolved; valve = full reward; fuel unlocks trader stock', () => {
    const s = talk('k_marat');
    pick(s, 'oil'); pick(s, 'accept');
    expect(questStage('k_oil')).toBe(10);
    game.player.inventory.push({ id: 'valve', count: 1 });
    let w = talk('k_marat');
    expect(w.node).toBe('waiting');
    expect(has(w, 'valve')).toBe(false);
    game.flags.badri_pacified = true;
    w = talk('k_marat');
    expect(w.textKey()).toBe('dlg.k_marat.waiting_clear');
    const caps = game.caps;
    pick(w, 'valve');
    expect(questDone('k_oil')).toBe(true);
    expect(game.caps).toBe(caps + 150);
    expect(hasItem(game.player, 'valve')).toBe(false);
    expect(game.flags.k_fuel).toBe(true);

    const gali = npc('trader');
    const ammo = countItem(gali, 'ammo762');
    const t = new DialogueSession(DIALOGUES.trader, { game, npc: gali });
    pick(t, 'fuel');
    expect(countItem(gali, 'ammo762')).toBe(ammo + 20);
    expect(hasItem(gali, 'rifle')).toBe(true);
    expect(has(new DialogueSession(DIALOGUES.trader, { game, npc: gali }), 'fuel')).toBe(false);
  });

  it('[Наука 50] improvised fix after kazan quest done; failure blocks retry', () => {
    game.quests.k_oil = { id: 'k_oil', stage: 10, done: false };
    game.quests.kazan = { id: 'kazan', stage: 30, done: true };
    const f = talk('k_marat');
    pick(f, 'improvise'); // science 28
    expect(f.node).toBe('science_fail');
    expect(has(talk('k_marat'), 'improvise')).toBe(false);
    delete game.flags.k_oil_sci_failed;
    game.player.skills.science = 50;
    const s = talk('k_marat');
    expect(s.options().find(o => o.opt.text === 'improvise')!.label.startsWith('[Наука 50]')).toBe(true);
    pick(s, 'improvise');
    expect(s.node).toBe('fixed_science');
    expect(game.flags.k_oil_method).toBe('science');
    expect(checkLabel({ stats: ['S', 'A'], min: 13 })).toBe('[Сила+Ловкость 13]');
  });
});

describe("Gali's debt", () => {
  const gali = () => new DialogueSession(DIALOGUES.trader, { game, npc: npc('trader') });
  const getJob = () => { const t = gali(); pick(t, 'debt_job'); pick(t, 'debt_accept'); };

  it('intimidate Rinat [Сила 7] -> collect -> discount', () => {
    getJob();
    expect(hasItem(game.player, 'debt_note')).toBe(true);
    game.player.special.S = 7;
    const r = talk('k_rinat');
    expect(r.node).toBe('debt');
    pick(r, 'scare');
    expect(r.node).toBe('paid_force');
    expect(questStage('k_debt')).toBe(20);
    const caps = game.caps;
    const p1 = npc('trader');
    const before = buyFactor(game.player, p1);
    const t = gali();
    pick(t, 'debt_back');
    expect(questDone('k_debt')).toBe(true);
    expect(game.caps).toBe(caps - 70);
    expect(hasItem(game.player, 'debt_note')).toBe(false);
    expect(game.flags.gali_discount).toBe(true);
    expect(buyFactor(game.player, p1)).toBeLessThan(before);
    expect(gali().textKey()).toBe('dlg.trader.again_discount');
  });

  it('forgive after the sad story: Gali annoyed, no discount', () => {
    getJob();
    const r = talk('k_rinat');
    pick(r, 'persuade'); // speech 30 < 50
    expect(r.node).toBe('refuse');
    pick(r, 'why'); pick(r, 'forgive');
    expect(questStage('k_debt')).toBe(30);
    expect(hasItem(game.player, 'debt_note')).toBe(false);
    expect(hasItem(game.player, 'rat_meat')).toBe(true);
    const t = gali();
    pick(t, 'debt_forgive');
    expect(questDone('k_debt')).toBe(true);
    expect(game.flags.gali_annoyed).toBe(true);
    expect(game.flags.gali_discount).toBeUndefined();
    expect(gali().textKey()).toBe('dlg.trader.again_annoyed');
    expect(talk('k_rinat').textKey()).toBe('dlg.k_rinat.after_forgive');
  });

  it('pay it yourself, or Rinat killed', () => {
    getJob();
    game.caps = 150;
    const t = gali();
    pick(t, 'debt_pay');
    expect(game.caps).toBe(50);
    expect(game.flags.k_debt_method).toBe('pay');
    expect(questDone('k_debt')).toBe(true);

    setGame(newGame());
    getJob();
    const r = talk('k_rinat');
    pick(r, 'fight');
    expect(r.actions).toEqual(['combat']);
    game.npcs.k_rinat = { dead: true };
    expect(checkQuestTriggers()).toBe(true);
    expect(questStage('k_debt')).toBe(20);
    const t2 = gali();
    expect(has(t2, 'debt_back')).toBe(false);
    pick(t2, 'debt_dead');
    expect(questDone('k_debt')).toBe(true);
    expect(game.flags.gali_discount).toBeUndefined();
  });
});

describe('guard rumors', () => {
  it('guard points to the new content (also after kazan is done)', () => {
    pick(talk('guard'), 'k_rumors');
    game.quests.kazan = { id: 'kazan', stage: 30, done: true };
    const s = talk('guard');
    expect(s.node).toBe('hero');
    pick(s, 'k_rumors');
    expect(s.node).toBe('k_rumors');
  });
});
