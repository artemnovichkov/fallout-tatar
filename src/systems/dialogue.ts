// Data-driven dialogue engine (pure logic, no DOM). Trees live in src/data/dialogues/<id>.ts.
// Text keys: node text = dlg.<dialogue>.<node> (or node.text), option text = dlg.<dialogue>.o.<text>
// ('@full.key' uses a key verbatim). next: node id or 'end'.
import type { Actor, GameState, SkillId, Special } from './types';
import { t } from './i18n';
import { log } from './state';
import { addItem, removeItem, hasItem, countItem, containerHolder } from './inventory';
import { addXp } from './leveling';
import { ITEMS } from '../data/items';
import { setStage, completeQuest, questStage, questDone } from './quests';

export interface Cond {
  flag?: string; is?: number | boolean | string; // flag truthy (or === is)
  notFlag?: string;
  item?: string; count?: number;                  // player has item (count, default 1)
  noItem?: string;
  caps?: number;                                  // player has at least N caps
  quest?: string; stage?: number;                 // quest at exact stage (and not done)
  minStage?: number; maxStage?: number;           // with quest: stage range (and not done)
  questNew?: string;                              // quest not started
  questDone?: string;
  npcHas?: string;                                // talking NPC carries item
  // kazan2 additions
  notQuestDone?: string;                          // quest not completed (new or active)
  any?: Cond[];                                   // OR: at least one sub-condition holds
  counter?: string; atLeast?: number; below?: number; // numeric flag (default 0) >= atLeast / < below
}

export interface Check { skill?: SkillId; stat?: Special; stats?: Special[]; min: number } // stats: summed SPECIAL

export type Effect =
  | { do: 'flag'; key: string; value?: number | boolean | string }
  | { do: 'give'; item: string; count?: number; from?: 'npc' | `container:${string}` }
  | { do: 'take'; item: string; count?: number }
  | { do: 'caps'; n: number }
  | { do: 'quest'; id: string; stage: number }
  | { do: 'questDone'; id: string }
  | { do: 'xp'; n: number }
  | { do: 'heal'; n: number }
  | { do: 'log'; key: string }
  | { do: 'combat' }
  | { do: 'barter' }
  // kazan2 additions
  | { do: 'inc'; key: string; n?: number }        // numeric flag += n (default 1)
  | { do: 'hurt'; n: number }                     // player loses HP, never below 1
  | { do: 'stock'; item: string; count?: number };// adds item to talking NPC's inventory (trader stock)

export interface DOption {
  text: string;
  next: string;
  cond?: Cond[];
  check?: Check;
  fail?: string;            // node on failed check (default: 'end')
  effects?: Effect[];
  failEffects?: Effect[];
}
export interface DNode {
  text?: string;
  alt?: { cond: Cond[]; text: string }[]; // first matching alt overrides text
  effects?: Effect[];                     // applied on entering the node
  options: DOption[];
}
export interface DialogueDef {
  id: string;
  entry: { node: string; cond?: Cond[] }[]; // first matching wins
  nodes: Record<string, DNode>;
}

export type DialogueAction = 'combat' | 'barter';

export interface Ctx { game: GameState; npc: Actor }

// ---------------------------------------------------------------- conditions & checks
export function checkCond(c: Cond, { game, npc }: Ctx): boolean {
  const p = game.player;
  if (c.flag !== undefined) {
    const v = game.flags[c.flag];
    if (c.is !== undefined ? v !== c.is : !v) return false;
  }
  if (c.notFlag !== undefined && game.flags[c.notFlag]) return false;
  if (c.item !== undefined && !hasItem(p, c.item, c.count ?? 1)) return false;
  if (c.noItem !== undefined && hasItem(p, c.noItem)) return false;
  if (c.caps !== undefined && game.caps < c.caps) return false;
  if (c.quest !== undefined) {
    const s = game.quests[c.quest];
    if (!s || s.done) return false;
    if (c.stage !== undefined && s.stage !== c.stage) return false;
    if (c.minStage !== undefined && s.stage < c.minStage) return false;
    if (c.maxStage !== undefined && s.stage > c.maxStage) return false;
  }
  if (c.questNew !== undefined && game.quests[c.questNew]) return false;
  if (c.questDone !== undefined && !game.quests[c.questDone]?.done) return false;
  if (c.npcHas !== undefined && !hasItem(npc, c.npcHas)) return false;
  if (c.notQuestDone !== undefined && game.quests[c.notQuestDone]?.done) return false;
  if (c.any !== undefined && !c.any.some(sub => checkCond(sub, { game, npc }))) return false;
  if (c.counter !== undefined) {
    const v = Number(game.flags[c.counter] ?? 0);
    if (c.atLeast !== undefined && v < c.atLeast) return false;
    if (c.below !== undefined && v >= c.below) return false;
  }
  return true;
}
export const allConds = (cs: Cond[] | undefined, ctx: Ctx) => !cs || cs.every(c => checkCond(c, ctx));

export function passCheck(ch: Check, game: GameState): boolean {
  const p = game.player;
  const v = ch.skill ? p.skills[ch.skill] : ch.stat ? p.special[ch.stat]
    : ch.stats ? ch.stats.reduce((n, st) => n + p.special[st], 0) : 0;
  return v >= ch.min;
}
// "[Красноречие 30]" / "[Интеллект 7]"
export const checkLabel = (ch: Check) =>
  `[${ch.stats && !ch.skill && !ch.stat ? ch.stats.map(st => t(`check.stat.${st}`)).join('+')
    : t(ch.skill ? `check.skill.${ch.skill}` : `check.stat.${ch.stat}`)} ${ch.min}]`;

// ---------------------------------------------------------------- effects
export function applyEffect(e: Effect, ctx: Ctx, actions: DialogueAction[]) {
  const { game, npc } = ctx;
  const p = game.player;
  switch (e.do) {
    case 'flag': game.flags[e.key] = e.value ?? true; break;
    case 'give': {
      let n = e.count ?? 1;
      if (e.from === 'npc') n = removeItem(npc, e.item, n).removed;
      else if (e.from?.startsWith('container:')) {
        const box = containerHolder(e.from.slice(10));
        n = box ? removeItem(box, e.item, n).removed : 0;
      }
      if (n > 0) { addItem(p, e.item, n); log(t('dlg.log.got', { item: itemName(e.item), n })); }
      break;
    }
    case 'take': {
      const n = Math.min(e.count ?? 1, countItem(p, e.item));
      if (n > 0) { removeItem(p, e.item, n); log(t('dlg.log.gave', { item: itemName(e.item), n })); }
      break;
    }
    case 'caps':
      game.caps = Math.max(0, game.caps + e.n);
      log(t(e.n >= 0 ? 'dlg.log.capsGot' : 'dlg.log.capsPaid', { n: Math.abs(e.n) }));
      break;
    case 'quest': setStage(e.id, e.stage); break;
    case 'questDone': completeQuest(e.id); break;
    case 'xp': addXp(e.n); break;
    case 'heal': p.hp = Math.min(p.maxHp, p.hp + e.n); break;
    case 'log': log(t(e.key)); break;
    case 'combat': case 'barter': actions.push(e.do); break;
    case 'inc': game.flags[e.key] = Number(game.flags[e.key] ?? 0) + (e.n ?? 1); break;
    case 'hurt': p.hp = Math.max(1, p.hp - e.n); break;
    case 'stock': addItem(npc, e.item, e.count ?? 1); break;
  }
}

const itemName = (id: string) => t(ITEMS[id]?.nameKey ?? id);

// ---------------------------------------------------------------- session
export interface ShownOption { index: number; opt: DOption; label: string }

export class DialogueSession {
  node = '';
  ended = false;
  actions: DialogueAction[] = [];
  lastCheck: { ok: boolean; check: Check } | null = null;

  constructor(public def: DialogueDef, public ctx: Ctx) {
    const start = def.entry.find(e => allConds(e.cond, ctx))?.node ?? Object.keys(def.nodes)[0];
    this.enter(start);
  }

  get current(): DNode { return this.def.nodes[this.node]; }

  textKey(): string {
    const n = this.current;
    const alt = n.alt?.find(a => allConds(a.cond, this.ctx));
    return alt?.text ?? n.text ?? `dlg.${this.def.id}.${this.node}`;
  }
  vars(): Record<string, string | number> {
    return { name: t(this.ctx.game.player.nameKey), caps: this.ctx.game.caps };
  }
  text(): string { return t(this.textKey(), this.vars()); }

  optionKey(o: DOption) { return o.text.startsWith('@') ? o.text.slice(1) : `dlg.${this.def.id}.o.${o.text}`; }

  options(): ShownOption[] {
    if (this.ended) return [];
    return this.current.options
      .filter(o => allConds(o.cond, this.ctx))
      .map((opt, index) => ({
        index, opt,
        label: (opt.check ? checkLabel(opt.check) + ' ' : '') + t(this.optionKey(opt), this.vars()),
      }));
  }

  // i = index in options() (0-based).
  choose(i: number) {
    const o = this.options()[i]?.opt;
    if (!o) return;
    let next = o.next;
    let effects = o.effects;
    this.lastCheck = null;
    if (o.check) {
      const ok = passCheck(o.check, this.ctx.game);
      this.lastCheck = { ok, check: o.check };
      if (!ok) { next = o.fail ?? 'end'; effects = o.failEffects; }
    }
    effects?.forEach(e => applyEffect(e, this.ctx, this.actions));
    this.enter(next);
  }

  private enter(id: string) {
    if (id === 'end' || !this.def.nodes[id]) { this.ended = true; return; }
    this.node = id;
    this.current.effects?.forEach(e => applyEffect(e, this.ctx, this.actions));
  }
}

export { questStage, questDone };
