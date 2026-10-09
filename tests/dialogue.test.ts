import { describe, it, expect, beforeEach } from 'vitest';
import { MAP, FLOOR_LEGEND, OBJECT_LEGEND } from '../src/data/map';
import { NPC_TEMPLATES, spawnNpc } from '../src/data/npcs';
import { ITEMS } from '../src/data/items';
import { QUESTS } from '../src/data/quests';
import { DIALOGUES } from '../src/data/dialogues';
import { game, setGame, newGame } from '../src/systems/state';
import { DialogueSession, checkLabel } from '../src/systems/dialogue';
import { questStage, questDone, checkQuestTriggers, journal } from '../src/systems/quests';
import { hasItem, containerHolder } from '../src/systems/inventory';
import { OBJECTS, TILES, CHARACTERS, PORTRAITS, ICONS } from '../src/systems/assets';
import { INTRO_SLIDES } from '../src/ui/intro';
import ru from '../src/locales/ru/dialogue.json';
import tt from '../src/locales/tt/dialogue.json';
import { setLang } from '../src/systems/i18n';

describe('assets', () => {
  it('uses only contract assets', () => {
    Object.values(FLOOR_LEGEND).forEach(f => expect(TILES).toContain(f));
    Object.values(OBJECT_LEGEND).forEach(o => expect(OBJECTS).toContain(o.obj));
    Object.values(NPC_TEMPLATES).forEach(n => { expect(CHARACTERS).toContain(n.sprite); if (n.portrait) expect(PORTRAITS).toContain(n.portrait); });
    Object.values(ITEMS).forEach(i => expect(ICONS).toContain(i.icon));
  });
});

describe('dialogue', () => {
  beforeEach(() => { setGame(newGame()); setLang('ru'); });
  const npc = (id: string, tpl = id) => spawnNpc(id, tpl, { q: 0, r: 0 });
  const pick = (s: DialogueSession, opt: string) => {
    const i = s.options().findIndex(o => o.opt.text === opt || o.opt.text === `@dlg.common.${opt}`);
    expect(i, `option ${opt} in node ${s.node}`).toBeGreaterThanOrEqual(0);
    s.choose(i);
  };

  it('every dialogue node/option resolves and has ru+tt text', () => {
    for (const d of Object.values(DIALOGUES)) {
      for (const e of d.entry) expect(d.nodes[e.node], `${d.id} entry ${e.node}`).toBeDefined();
      for (const [nid, n] of Object.entries(d.nodes)) {
        const keys = [n.text ?? `dlg.${d.id}.${nid}`, ...(n.alt ?? []).map(a => a.text)];
        for (const o of n.options) {
          if (o.next !== 'end') expect(d.nodes[o.next], `${d.id}.${nid} -> ${o.next}`).toBeDefined();
          if (o.fail && o.fail !== 'end') expect(d.nodes[o.fail]).toBeDefined();
          keys.push(o.text.startsWith('@') ? o.text.slice(1) : `dlg.${d.id}.o.${o.text}`);
        }
        for (const k of keys) { expect((ru as Record<string, string>)[k], `ru ${k}`).toBeTruthy(); expect((tt as Record<string, string>)[k], `tt ${k}`).toBeTruthy(); }
      }
    }
    for (const n of Object.values(NPC_TEMPLATES)) if (n.dialogue) expect(DIALOGUES[n.dialogue]).toBeDefined();
  });

  it('elder gives quest, then waits', () => {
    const s = new DialogueSession(DIALOGUES.elder, { game, npc: npc('elder') });
    expect(s.node).toBe('start');
    pick(s, 'trouble'); pick(s, 'accept');
    expect(questStage('kazan')).toBe(10);
    expect(s.node).toBe('accepted');
    pick(s, 'bye'); expect(s.ended).toBe(true);
    expect(new DialogueSession(DIALOGUES.elder, { game, npc: npc('elder') }).node).toBe('waiting');
  });

  it('check labels and speech success: Bädri hands over the kazan', () => {
    game.quests.kazan = { id: 'kazan', stage: 10, done: false };
    const b = npc('badri');
    const s = new DialogueSession(DIALOGUES.badri, { game, npc: b });
    expect(game.flags.badri_met).toBe(true);
    pick(s, 'kazan');
    const persuade = s.options().find(o => o.opt.text === 'persuade')!;
    expect(persuade.label.startsWith('[Красноречие 30]')).toBe(true);
    expect(checkLabel({ stat: 'I', min: 7 })).toBe('[Интеллект 7]');
    pick(s, 'persuade');
    expect(s.lastCheck?.ok).toBe(true);
    expect(s.node).toBe('persuaded');
    expect(hasItem(game.player, 'kazan')).toBe(true);
    expect(hasItem(containerHolder('raider_chest')!, 'kazan')).toBe(false); // no duplicate kazan
    expect(game.flags.kazan_method).toBe('speech');
    checkQuestTriggers();
    expect(questStage('kazan')).toBe(30);
  });

  it('failed checks branch to fail node', () => {
    game.quests.kazan = { id: 'kazan', stage: 10, done: false };
    game.player.skills.speech = 10; game.player.special.I = 4; game.player.skills.steal = 0;
    const s = new DialogueSession(DIALOGUES.badri, { game, npc: npc('badri') });
    pick(s, 'kazan'); pick(s, 'persuade');
    expect(s.node).toBe('persuade_fail');
    expect(s.options().some(o => o.opt.text === 'buy')).toBe(false); // only 50 caps
    const s2 = new DialogueSession(DIALOGUES.badri, { game, npc: npc('badri') });
    pick(s2, 'kazan');
    expect(s2.options().some(o => o.opt.text === 'persuade')).toBe(false); // refused once
    pick(s2, 'steal');
    expect(s2.node).toBe('steal_fail');
    pick(s2, 'oops');
    expect(s2.ended).toBe(true);
    expect(s2.actions).toEqual(['combat']);
  });

  it('steal key from Bädri moves it from npc to player', () => {
    game.quests.kazan = { id: 'kazan', stage: 10, done: false };
    const b = npc('badri');
    const s = new DialogueSession(DIALOGUES.badri, { game, npc: b });
    pick(s, 'kazan'); pick(s, 'steal');
    expect(s.node).toBe('stolen_key');
    expect(hasItem(game.player, 'key_depot')).toBe(true);
    expect(hasItem(b, 'key_depot')).toBe(false);
  });

  it('returning kazan completes quest with rewards', () => {
    game.quests.kazan = { id: 'kazan', stage: 30, done: false };
    game.player.inventory.push({ id: 'kazan', count: 1 });
    const caps = game.caps, xp = game.xp;
    const s = new DialogueSession(DIALOGUES.elder, { game, npc: npc('elder') });
    expect(s.node).toBe('return');
    pick(s, 'give');
    expect(questDone('kazan')).toBe(true);
    expect(hasItem(game.player, 'kazan')).toBe(false);
    expect(game.caps).toBe(caps + 100);
    expect(game.xp).toBe(xp + 300);
    expect(hasItem(game.player, 'chakchak')).toBe(true);
    expect(journal()[0].done).toBe(true);
    expect(new DialogueSession(DIALOGUES.elder, { game, npc: npc('elder') }).node).toBe('thanks');
  });

  it('trader barter action and ghoul side quest', () => {
    const s = new DialogueSession(DIALOGUES.trader, { game, npc: npc('trader') });
    pick(s, 'trade');
    expect(s.ended).toBe(true);
    expect(s.actions).toEqual(['barter']);

    const g = new DialogueSession(DIALOGUES.ghoul, { game, npc: npc('ghoul') });
    pick(g, 'help'); pick(g, 'accept');
    expect(questStage('holotape')).toBe(10);
    game.player.inventory.push({ id: 'holotape', count: 1 });
    expect(checkQuestTriggers()).toBe(true);
    expect(questStage('holotape')).toBe(20);
    const g2 = new DialogueSession(DIALOGUES.ghoul, { game, npc: npc('ghoul') });
    expect(g2.node).toBe('return');
    pick(g2, 'give');
    expect(questDone('holotape')).toBe(true);
    expect(hasItem(game.player, 'ayran', 2)).toBe(true);
  });
});

describe('locales', () => {
  const files = import.meta.glob<Record<string, string>>('../src/locales/*/*.json', { eager: true, import: 'default' });
  const dict = (lang: string) => Object.assign({}, ...Object.entries(files).filter(([p]) => p.includes(`/${lang}/`)).map(([, d]) => d));
  const RU = dict('ru'), TT = dict('tt');
  const both = (k: string) => { expect(RU[k], `ru ${k}`).toBeTruthy(); expect(TT[k], `tt ${k}`).toBeTruthy(); };
  it('items, look texts, npcs, quests, intro exist in both languages', () => {
    for (const i of Object.values(ITEMS)) { both(i.nameKey); both(i.descKey); }
    for (const o of OBJECTS) both(`look.obj.${o}`);
    for (const f of TILES) both(`look.floor.${f}`);
    for (const n of Object.values(NPC_TEMPLATES)) both(n.nameKey);
    for (const q of Object.values(QUESTS)) { both(q.nameKey); q.stages.forEach(s => both(`quest.${q.id}.s${s}`)); both(`quest.${q.id}.done`); }
    INTRO_SLIDES.forEach(both);
    for (const l of MAP.labels ?? []) both(l.key);
  });
});
