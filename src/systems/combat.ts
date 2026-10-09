import { acFor } from './stats';
// FO2-style turn-based combat. Pure rules on top (testable without Phaser), controller below.
import type { Actor, ItemDef } from './types';
import type { Hex } from './hex';
import type Phaser from 'phaser';
import type { WorldScene, InputOverride } from '../scenes/WorldScene';
import { distance, toScreen, direction, neighbors, eq } from './hex';
import { item } from '../data/items';
import { sequenceFor, critChanceFor } from './stats';
import { game, log, changed } from './state';
import { bus } from './events';
import { t } from './i18n';
import { aiTurn } from './ai';

// ---------------------------------------------------------------- rules (pure)

export const UNARMED: ItemDef = {
  id: 'unarmed', type: 'weapon', nameKey: 'hud.unarmed', descKey: '', icon: '', weight: 0, value: 0,
  damage: [1, 3], apCost: 3, range: 1, skill: 'unarmed',
};
export const RELOAD_AP = 2;
export const COMBAT_RADIUS = 15;
export const END_COMBAT_RADIUS = 10;
export const CRIT_COUNT = 6;
export const XP_FOR: Record<string, number> = { raider: 50, ghoul: 75, guard: 100, trader: 25, elder: 25 };

export type Rng = () => number;
export const randInt = (min: number, max: number, rng: Rng = Math.random) => min + Math.floor(rng() * (max - min + 1));

export const weaponOf = (a: Actor): ItemDef => (a.weapon && item(a.weapon)) || UNARMED;
export const weaponStack = (a: Actor) => (a.weapon ? a.inventory.find(s => s.id === a.weapon) : undefined);
export const isMelee = (w: ItemDef) => (w.range ?? 1) <= 1;
export const usesAmmo = (w: ItemDef) => !!w.magazine && !!w.ammo;
export const loadedAmmo = (a: Actor) => weaponStack(a)?.loaded ?? 0;
export const hasAmmoLoaded = (a: Actor) => !usesAmmo(weaponOf(a)) || loadedAmmo(a) > 0;
export const reserveAmmo = (a: Actor) => {
  const w = weaponOf(a);
  return w.ammo ? a.inventory.filter(s => s.id === w.ammo).reduce((n, s) => n + s.count, 0) : 0;
};
export const apCost = (w: ItemDef) => w.apCost ?? 3;

export const armorOf = (a: Actor) => (a.armor ? item(a.armor) : undefined);
// Derived from scratch so it works whether or not inventory.recalcArmor already folded armor into actor.ac.
export const effectiveAc = (a: Actor) => acFor(a.special) + (armorOf(a)?.ac ?? 0);
export const damageResist = (a: Actor) => armorOf(a)?.dr ?? 0;

// Melee damage bonus from Strength (FO2: max(0, S-5)); fists get +1 extra.
export function strengthBonus(a: Actor, w: ItemDef) {
  if (!isMelee(w)) return 0;
  return Math.max(0, a.special.S - 5) + (w.id === 'unarmed' ? 1 : 0);
}

export interface HitParams { skill: number; targetAc: number; dist: number; perception: number; melee: boolean; los: boolean }
// FO2-ish: skill + 30 - AC - 4 per hex beyond Perception (ranged). No LOS: impossible for ranged, -25 for melee.
export function hitChanceRaw(p: HitParams): number {
  if (!p.melee && !p.los) return 0;
  let c = p.skill + 30 - p.targetAc;
  if (!p.melee) c -= 4 * Math.max(0, p.dist - p.perception);
  if (p.melee && !p.los) c -= 25;
  return Math.max(5, Math.min(95, Math.round(c)));
}

export function hitChance(att: Actor, tgt: Actor, los = true, w: ItemDef = weaponOf(att)): number {
  return hitChanceRaw({
    skill: att.skills[w.skill ?? 'unarmed'] ?? 0, targetAc: effectiveAc(tgt), dist: distance(att.pos, tgt.pos),
    perception: att.special.P, melee: isMelee(w), los,
  });
}

export const critChance = (att: Actor) => Math.max(1, critChanceFor(att.special) + 2);

// Damage after DR%, crit doubles before armor. Minimum 1 on a hit.
export function calcDamage(base: number, crit: boolean, dr: number): number {
  const raw = crit ? base * 2 : base;
  return Math.max(1, Math.floor(raw * (1 - Math.min(90, dr) / 100)));
}

export function rollDamage(att: Actor, tgt: Actor, crit: boolean, rng: Rng = Math.random, w: ItemDef = weaponOf(att)): number {
  const [lo, hi] = w.damage ?? [1, 3];
  return calcDamage(randInt(lo, hi, rng) + strengthBonus(att, w), crit, damageResist(tgt));
}

export interface AttackRoll { hit: boolean; crit: boolean; dmg: number; chance: number }
export function rollAttack(att: Actor, tgt: Actor, los = true, rng: Rng = Math.random, w: ItemDef = weaponOf(att)): AttackRoll {
  const chance = hitChance(att, tgt, los, w);
  const hit = rng() * 100 < chance;
  if (!hit) return { hit, crit: false, dmg: 0, chance };
  const crit = rng() * 100 < critChance(att);
  return { hit, crit, dmg: rollDamage(att, tgt, crit, rng, w), chance };
}

// Highest sequence first; player wins ties; otherwise stable.
export function turnOrder(actors: Actor[]): Actor[] {
  return actors
    .map((a, i) => ({ a, i }))
    .sort((x, y) => {
      const d = sequenceFor(y.a.special) - sequenceFor(x.a.special);
      if (d) return d;
      if (x.a.id === 'player') return -1;
      if (y.a.id === 'player') return 1;
      return x.i - y.i;
    })
    .map(x => x.a);
}

// Can `att` standing at `from` attack `tgt` with weapon (ignores AP)? Returns reason if not.
export function attackBlocker(from: Hex, tgt: Hex, w: ItemDef, los: boolean): 'range' | 'los' | null {
  const d = distance(from, tgt);
  if (isMelee(w)) return d <= 1 ? null : 'range';
  if (d > (w.range ?? 1)) return 'range';
  return los ? null : 'los';
}

// Move ammo from inventory into the equipped weapon. Inventory agent may replace this.
export type ReloadResult = 'ok' | 'full' | 'noAmmo' | 'notNeeded';
export function reload(a: Actor): ReloadResult {
  const w = weaponOf(a);
  const st = weaponStack(a);
  if (!usesAmmo(w) || !st) return 'notNeeded';
  const need = w.magazine! - (st.loaded ?? 0);
  if (need <= 0) return 'full';
  let got = 0;
  for (const s of a.inventory.filter(s => s.id === w.ammo)) {
    const take = Math.min(s.count, need - got);
    s.count -= take; got += take;
    if (got >= need) break;
  }
  a.inventory = a.inventory.filter(s => !(s.id === w.ammo && s.count <= 0));
  if (!got) return 'noAmmo';
  st.loaded = (st.loaded ?? 0) + got;
  return 'ok';
}

// Shortest prefix of `path` after which `canAttackFrom` holds (0 = already can). -1 if never.
export function stepsUntil(start: Hex, path: Hex[], canAttackFrom: (h: Hex) => boolean): number {
  if (canAttackFrom(start)) return 0;
  for (let i = 0; i < path.length; i++) if (canAttackFrom(path[i])) return i + 1;
  return -1;
}

export const xpFor = (a: Actor) => XP_FOR[a.sprite] ?? 25;

// ---------------------------------------------------------------- controller

const wait = (w: WorldScene, ms: number) => new Promise<void>(res => w.time.delayedCall(ms, res));
const nm = (a: Actor) => t(a.nameKey);

export class CombatController implements InputOverride {
  active = false;
  order: Actor[] = [];
  current: Actor | null = null;
  busy = false;
  private turnIdx = 0;
  private endPlayerTurn: (() => void) | null = null;
  private pendingTarget: Actor | null = null;
  private label: Phaser.GameObjects.Text | null = null;
  private fx: Phaser.GameObjects.Graphics | null = null;
  private disposers: (() => void)[] = [];
  private gen = 0; // invalidates running loop on end/dispose

  constructor(public world: WorldScene) {
    this.disposers.push(bus.on('combatStart', () => this.start()));
    const onReq = (target: Actor) => this.onAttackRequest(target);
    world.events.on('attackRequest', onReq);
    this.disposers.push(() => world.events.off('attackRequest', onReq));
    const kb = world.input.keyboard;
    if (kb) {
      const onKey = (e: KeyboardEvent) => {
        if (!this.active || document.getElementById('modal')) return;
        if (e.code === 'Space') this.playerEndTurn();
        else if (e.key.toLowerCase() === 'r' || e.key.toLowerCase() === 'к') this.playerReload();
        else if (e.key === 'Enter') this.playerEndCombat();
      };
      kb.on('keydown', onKey);
      this.disposers.push(() => kb.off('keydown', onKey));
    }
  }

  dispose() {
    this.gen++;
    this.active = false;
    if (this.world.inputOverride === this) this.world.inputOverride = null;
    this.disposers.forEach(d => d());
    this.disposers = [];
  }

  get player() { return game.player; }
  get isPlayerTurn() { return this.active && this.current?.id === 'player' && !this.busy; }

  // ---------- lifecycle ----------
  private hostilesNear(radius: number, needLos = false) {
    const p = this.player;
    return this.world.livingActors().filter(a => a.id !== 'player' && a.hostile && distance(a.pos, p.pos) <= radius
      && (!needLos || this.world.hasLos(a.pos, p.pos)));
  }

  start() {
    if (this.active || this.player.dead) return;
    this.active = true;
    const gen = ++this.gen;
    this.order = turnOrder([this.player, ...this.hostilesNear(COMBAT_RADIUS)]);
    this.turnIdx = 0;
    this.pendingTarget = null;
    this.world.inputOverride = this;
    this.world.showPath(null);
    this.label = this.world.add.text(0, 0, '', {
      fontFamily: 'VT323, monospace', fontSize: '18px', color: '#6cff6c', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(100001).setVisible(false);
    this.fx = this.world.add.graphics().setDepth(99999);
    log(t('combat.start'));
    for (const a of this.order) a.ap = a.maxAp;
    changed();
    // Delay so a following 'attackRequest' is captured before the first turn.
    wait(this.world, 350).then(() => { if (gen === this.gen) this.loop(gen); });
  }

  end() {
    if (!this.active) return;
    this.gen++;
    this.active = false;
    this.current = null;
    this.busy = false;
    this.endPlayerTurn = null;
    if (this.world.inputOverride === this) this.world.inputOverride = null;
    this.world.showPath(null);
    this.label?.destroy(); this.label = null;
    this.fx?.destroy(); this.fx = null;
    this.player.ap = this.player.maxAp;
    for (const a of this.order) this.world.persistNpc(a);
    const ps = this.world.sprites.get('player');
    if (ps && !this.player.dead) this.world.cameras.main.startFollow(ps, true, 0.1, 0.1);
    if (!this.player.dead) log(t('combat.end'));
    bus.emit('combatEnd');
    changed();
  }

  private shouldEnd() {
    if (this.player.dead) return true;
    return !this.order.some(a => a.id !== 'player' && !a.dead && a.hostile && distance(a.pos, this.player.pos) <= COMBAT_RADIUS);
  }

  private join(a: Actor) {
    if (this.order.includes(a)) return;
    a.ap = a.maxAp;
    this.order.push(a);
  }

  private async loop(gen: number) {
    while (this.active && gen === this.gen) {
      if (this.turnIdx === 0) this.hostilesNear(COMBAT_RADIUS).forEach(a => this.join(a));
      if (this.shouldEnd()) { this.end(); return; }
      const a = this.order[this.turnIdx];
      if (a && !a.dead) {
        this.current = a;
        a.ap = a.maxAp;
        bus.emit('turnStart', a);
        changed();
        if (a.id === 'player') await this.playerTurn();
        else {
          log(t('combat.turnOf', { name: nm(a) }));
          this.panTo(a);
          await wait(this.world, 350);
          if (gen !== this.gen) return;
          await aiTurn(this, a);
          await wait(this.world, 250);
        }
        if (gen !== this.gen) return;
      }
      this.turnIdx = (this.turnIdx + 1) % Math.max(1, this.order.length);
    }
  }

  private playerTurn(): Promise<void> {
    const ps = this.world.sprites.get('player');
    if (ps) this.world.cameras.main.startFollow(ps, true, 0.1, 0.1);
    log(t('combat.yourTurn', { ap: this.player.ap }));
    return new Promise(res => {
      this.endPlayerTurn = () => { this.endPlayerTurn = null; this.hideHover(); res(); };
      const tgt = this.pendingTarget;
      this.pendingTarget = null;
      if (tgt && !tgt.dead) this.playerAttack(tgt);
    });
  }

  private panTo(a: Actor) {
    const cam = this.world.cameras.main;
    cam.stopFollow();
    const p = toScreen(a.pos);
    cam.pan(p.x, p.y, 300, 'Sine.easeInOut');
  }

  // ---------- player commands ----------
  playerEndTurn() {
    if (!this.isPlayerTurn) return;
    this.endPlayerTurn?.();
  }

  canEndCombat() { return this.hostilesNear(END_COMBAT_RADIUS, true).length === 0; }

  playerEndCombat() {
    if (!this.isPlayerTurn) return;
    if (!this.canEndCombat()) { log(t('combat.cantEnd')); return; }
    this.endPlayerTurn = null;
    this.end();
  }

  async playerReload() {
    if (!this.isPlayerTurn) return;
    this.busy = true;
    await this.doReload(this.player);
    this.busy = false;
    this.afterPlayerAction();
  }

  private onAttackRequest(target: Actor) {
    if (!this.active || target.dead || target.id === 'player') return;
    this.makeHostile(target);
    if (this.isPlayerTurn) this.playerAttack(target);
    else this.pendingTarget = target;
  }

  private makeHostile(a: Actor) {
    if (!a.hostile) { a.hostile = true; if (a.ai === 'idle' || !a.ai) a.ai = 'aggressive'; this.world.persistNpc(a); }
    this.join(a);
  }

  onHexClick(h: Hex, pointer: Phaser.Input.Pointer) {
    if (!this.isPlayerTurn || pointer.button !== 0) return;
    const w = this.world;
    const target = w.actorAt(h);
    if (w.mode === 'look') {
      if (target) log(t('look.actor', { name: nm(target), hp: `${target.hp}/${target.maxHp}` }));
      return;
    }
    if (target && target.id !== 'player') {
      if (target.hostile || w.mode === 'attack') { this.makeHostile(target); this.playerAttack(target); }
      return;
    }
    if (target) return;
    this.playerMove(h);
  }

  private async playerMove(h: Hex) {
    const path = this.world.pathFor(this.player, h);
    if (!path || !path.length) return;
    if (this.player.ap <= 0) { log(t('combat.noAp', { need: 1 })); return; }
    this.busy = true;
    this.hideHover();
    await this.walk(this.player, path.slice(0, this.player.ap));
    this.busy = false;
    this.afterPlayerAction();
  }

  async playerAttack(target: Actor) {
    if (!this.isPlayerTurn) return;
    const p = this.player, w = weaponOf(p);
    if (usesAmmo(w) && loadedAmmo(p) <= 0) { log(t('combat.noAmmo')); return; }
    const cost = apCost(w);
    this.busy = true;
    this.hideHover();
    if (isMelee(w) && distance(p.pos, target.pos) > 1) {
      const path = this.pathAdjacent(p, target);
      if (!path) { this.busy = false; log(t('combat.outOfRange')); return; }
      if (path.length + cost > p.ap) {
        // FO2: walk anyway if can't reach + hit this turn? Only walk if can reach; else report.
        this.busy = false;
        log(t('combat.noAp', { need: path.length + cost }));
        return;
      }
      await this.walk(p, path);
    }
    const los = this.world.hasLos(p.pos, target.pos);
    const block = attackBlocker(p.pos, target.pos, w, los);
    if (block) { this.busy = false; log(t(block === 'los' ? 'combat.noLos' : 'combat.outOfRange')); return; }
    if (p.ap < cost) { this.busy = false; log(t('combat.noAp', { need: cost })); return; }
    await this.attack(p, target);
    this.busy = false;
    this.afterPlayerAction();
  }

  private afterPlayerAction() {
    if (!this.active) return;
    changed();
    if (this.shouldEnd()) { this.endPlayerTurn?.(); return; }
    const p = this.player;
    // Auto end turn when nothing useful is possible.
    if (p.ap <= 0) { this.endPlayerTurn?.(); return; }
    this.onHexHover(this.world.hexUnderPointer(this.world.input.activePointer));
  }

  // ---------- shared actions (player & AI) ----------
  pathAdjacent(a: Actor, target: Actor): Hex[] | null {
    let best: Hex[] | null = null;
    for (const n of neighbors(target.pos)) {
      if (eq(n, a.pos)) return [];
      if (this.world.isBlocked(n, a.id)) continue;
      const p = this.world.pathFor(a, n);
      if (p && (!best || p.length < best.length)) best = p;
    }
    return best;
  }

  async walk(a: Actor, path: Hex[]) {
    if (!path.length || a.ap <= 0) return;
    await this.world.moveActor(a, path.slice(0, a.ap), () => { a.ap--; changed(); return a.ap > 0 && this.active; });
  }

  async doReload(a: Actor): Promise<boolean> {
    if (a.ap < RELOAD_AP) { if (a.id === 'player') log(t('combat.noAp', { need: RELOAD_AP })); return false; }
    const r = reload(a);
    const wname = t(weaponOf(a).nameKey);
    if (r === 'ok') {
      a.ap -= RELOAD_AP;
      log(t('combat.reload', { name: nm(a), weapon: wname }));
      this.world.floatText(a.pos, t('combat.reloadFloat'), '#ffd040');
      changed();
      await wait(this.world, 300);
      return true;
    }
    if (a.id === 'player') log(t(r === 'full' ? 'combat.full' : r === 'noAmmo' ? 'combat.noAmmoLeft' : 'combat.cantReload'));
    return false;
  }

  // Performs attack with currently usable weapon. Caller checks range/AP. `w` lets AI fall back to fists.
  async attack(att: Actor, tgt: Actor, w: ItemDef = weaponOf(att)) {
    const world = this.world;
    att.ap -= apCost(w);
    world.setFacing(att, direction(att.pos, tgt.pos));
    const los = world.hasLos(att.pos, tgt.pos);
    const roll = rollAttack(att, tgt, los, Math.random, w);
    if (usesAmmo(w) && w.id === att.weapon) { const st = weaponStack(att); if (st) st.loaded = Math.max(0, (st.loaded ?? 0) - 1); }
    changed();
    await world.playAnim(att, 'attack');
    if (!isMelee(w)) this.tracer(att.pos, tgt.pos, roll.hit);
    world.playAnim(att, 'idle');
    if (!roll.hit) {
      world.floatText(tgt.pos, t('combat.missFloat'), '#c0c0c0');
      log(t('combat.miss', { att: nm(att), tgt: nm(tgt) }));
    } else {
      tgt.hp -= roll.dmg;
      world.floatText(tgt.pos, roll.crit ? `${t('combat.critFloat')} -${roll.dmg}` : `-${roll.dmg}`, roll.crit ? '#ffd040' : '#ff5050');
      if (roll.crit) log(t(`combat.crit.${Math.floor(Math.random() * CRIT_COUNT)}`, { att: nm(att), tgt: nm(tgt), dmg: roll.dmg }));
      else log(t('combat.hit', { att: nm(att), tgt: nm(tgt), dmg: roll.dmg }));
      if (tgt.hp <= 0) await this.kill(tgt, att);
      else await this.flash(tgt);
    }
    if (tgt.id !== 'player' && !tgt.dead && !tgt.hostile) this.makeHostile(tgt);
    world.persistNpc(tgt);
    changed();
    await wait(world, 200);
  }

  private tracer(a: Hex, b: Hex, hit: boolean) {
    const g = this.fx; if (!g) return;
    const pa = toScreen(a), pb = toScreen(b);
    g.clear().lineStyle(2, hit ? 0xffe080 : 0xa0a0a0, 0.9).lineBetween(pa.x, pa.y - 40, pb.x, pb.y - 35);
    this.world.time.delayedCall(120, () => this.fx?.clear());
  }

  private async flash(a: Actor) {
    const s = this.world.sprites.get(a.id); if (!s) return;
    s.setTint(0xff3030);
    this.world.time.delayedCall(220, () => s.clearTint());
    await this.world.playAnim(a, 'hit');
    this.world.playAnim(a, 'idle');
  }

  private async kill(a: Actor, killer: Actor) {
    a.hp = 0;
    a.dead = true;
    a.ap = 0;
    const s = this.world.sprites.get(a.id);
    s?.setTint(0xff3030);
    this.world.time.delayedCall(200, () => s?.clearTint());
    log(t('combat.died', { name: nm(a) }));
    await this.world.playAnim(a, 'death');
    if (s) s.setDepth(toScreen(a.pos).y + 1);
    this.world.persistNpc(a);
    if (killer.id === 'player' && a.id !== 'player') {
      const xp = xpFor(a);
      game.xp += xp;
      log(t('combat.xp', { xp }));
    }
    bus.emit('actorDied', a);
    changed();
  }

  // ---------- hover preview ----------
  private hideHover() { this.world.showPath(null); this.label?.setVisible(false); }

  onHexHover(h: Hex) {
    if (!this.isPlayerTurn || !this.label) { this.hideHover(); return; }
    const w = this.world, p = this.player;
    const ptr = w.input.activePointer;
    const hh = ptr ? w.hexUnderPointer(ptr) : h;
    const target = w.actorAt(hh);
    if (target && target.id !== 'player') {
      w.showPath(null);
      const wpn = weaponOf(p);
      const los = w.hasLos(p.pos, target.pos);
      const tp = toScreen(target.pos);
      let txt: string; let ok = true;
      const block = isMelee(wpn) ? (this.pathAdjacent(p, target) ? null : 'range') : attackBlocker(p.pos, target.pos, wpn, los);
      let cost = apCost(wpn);
      if (isMelee(wpn) && !block) cost += this.pathAdjacent(p, target)!.length;
      if (block) { txt = t(block === 'los' ? 'combat.noLosShort' : 'combat.rangeShort'); ok = false; }
      else {
        txt = t('combat.hoverHit', { pct: hitChance(p, target, los, wpn), ap: cost });
        ok = cost <= p.ap && hasAmmoLoaded(p);
      }
      this.label.setText(txt).setColor(ok ? '#6cff6c' : '#ff5050').setPosition(tp.x, tp.y - 78).setVisible(true);
      return;
    }
    if (!w.inBounds(h) || w.isBlocked(h, 'player')) { this.hideHover(); return; }
    const path = w.pathFor(p, h);
    if (!path || !path.length) { this.hideHover(); return; }
    const ok = path.length <= p.ap;
    w.showPath(path, ok ? 0x6cff6c : 0xff4040);
    const ph = toScreen(h);
    this.label.setText(t('combat.hoverAp', { ap: path.length })).setColor(ok ? '#6cff6c' : '#ff5050')
      .setPosition(ph.x, ph.y - 14).setVisible(true);
  }
}
