import Phaser from 'phaser';
import { Hex, key, toScreen, fromScreen, offsetToAxial, axialToOffset, distance, neighbors, line, direction, eq, HEX_H } from '../systems/hex';
import { findPath } from '../systems/pathfind';
import { MAP, FLOOR_LEGEND, OBJECT_LEGEND, MapDef } from '../data/map';
import { spawnNpc } from '../data/npcs';
import { DIR_TO_ROW, CHAR_ORIGIN_Y, AnimName } from '../systems/assets';
import type { Actor } from '../systems/types';
import { game, log, changed } from '../systems/state';
import { bus } from '../systems/events';
import { t } from '../systems/i18n';
import { sfx } from '../systems/audio';

export type Mode = 'move' | 'attack' | 'use' | 'look';

// Combat (or anything else) can take over input by setting world.inputOverride.
export interface InputOverride {
  onHexClick(hex: Hex, pointer: Phaser.Input.Pointer): void;
  onHexHover?(hex: Hex): void;
}

export class WorldScene extends Phaser.Scene {
  map: MapDef = MAP;
  floor = new Map<string, string>();
  objects = new Map<string, { obj: string; blocks: boolean; los: boolean; sprite: Phaser.GameObjects.Image }>();
  actors = new Map<string, Actor>();
  sprites = new Map<string, Phaser.GameObjects.Sprite>();
  mode: Mode = 'move';
  inputOverride: InputOverride | null = null;
  busy = false; // true while player is executing an action in explore mode
  private hoverG!: Phaser.GameObjects.Graphics;
  private pathG!: Phaser.GameObjects.Graphics;
  private moveToken = 0;
  private dragStart: { x: number; y: number; sx: number; sy: number } | null = null;

  constructor() { super('World'); }

  get player() { return game.player; }

  create() {
    this.buildMap();
    this.spawnActors();
    this.hoverG = this.add.graphics().setDepth(1);
    this.pathG = this.add.graphics().setDepth(2);
    this.setupCamera();
    this.setupInput();
    this.scene.launch('UI');
    bus.on('modeChanged', m => { this.mode = m; });
    changed();
  }

  // ---------- map ----------
  inBounds(h: Hex) {
    const { col, row } = axialToOffset(h);
    return row >= 0 && row < this.map.floor.length && col >= 0 && col < this.map.floor[0].length;
  }

  private buildMap() {
    const m = this.map;
    for (let row = 0; row < m.floor.length; row++) {
      for (let col = 0; col < m.floor[row].length; col++) {
        const h = offsetToAxial(col, row);
        const tile = FLOOR_LEGEND[m.floor[row][col]] ?? 'sand';
        this.floor.set(key(h), tile);
        const p = toScreen(h);
        this.add.image(p.x, p.y, `tile_${tile}`).setDepth(0);
        const oc = m.objects[row]?.[col];
        const def = oc && OBJECT_LEGEND[oc];
        if (def) {
          const sprite = this.add.image(p.x, p.y + HEX_H / 2, `obj_${def.obj}`).setOrigin(0.5, 1).setDepth(p.y + 10);
          this.objects.set(key(h), { ...def, sprite });
        }
      }
    }
  }

  private spawnActors() {
    const st = this.map.playerStart;
    if (!game.flags['started']) {
      this.player.pos = offsetToAxial(st.col, st.row);
      game.flags['started'] = true;
    }
    this.addActor(this.player);
    for (const n of this.map.npcs) {
      const a = spawnNpc(n.id, n.template, offsetToAxial(n.col, n.row), n.facing ?? 2);
      Object.assign(a, game.npcs[n.id] ?? {});
      this.addActor(a);
    }
  }

  addActor(a: Actor) {
    this.actors.set(a.id, a);
    const p = toScreen(a.pos);
    const s = this.add.sprite(p.x, p.y, a.sprite, 0).setOrigin(0.5, CHAR_ORIGIN_Y);
    s.setDepth(p.y + 20);
    this.sprites.set(a.id, s);
    s.setInteractive({ pixelPerfect: false, useHandCursor: false });
    if (a.dead) this.playAnim(a, 'death', true); else this.playAnim(a, 'idle');
  }

  // Persist NPC changes into save state.
  persistNpc(a: Actor) {
    if (a.id === 'player') return;
    game.npcs[a.id] = { dead: a.dead, hp: a.hp, pos: a.pos, inventory: a.inventory, hostile: a.hostile, facing: a.facing, weapon: a.weapon };
  }

  // ---------- queries ----------
  actorAt(h: Hex, includeDead = false): Actor | undefined {
    for (const a of this.actors.values()) if (eq(a.pos, h) && (includeDead || !a.dead)) return a;
    return undefined;
  }
  isBlocked(h: Hex, ignoreId?: string) {
    if (!this.inBounds(h)) return true;
    if (this.floor.get(key(h)) === 'water') return true;
    if (this.objects.get(key(h))?.blocks) return true;
    const a = this.actorAt(h);
    return !!a && a.id !== ignoreId;
  }
  blocksLos(h: Hex) { return !!this.objects.get(key(h))?.los; }
  hasLos(a: Hex, b: Hex) {
    const l = line(a, b);
    return l.slice(1, -1).every(h => !this.blocksLos(h));
  }
  pathFor(actor: Actor, goal: Hex, allowGoalBlocked = false) {
    return findPath(actor.pos, goal, h => !this.isBlocked(h, actor.id), { allowGoalBlocked });
  }
  livingActors() { return [...this.actors.values()].filter(a => !a.dead); }

  // ---------- animation ----------
  setFacing(a: Actor, dir: number) {
    a.facing = dir;
    const s = this.sprites.get(a.id)!;
    s.setFlipX(DIR_TO_ROW[dir].flip);
  }

  playAnim(a: Actor, name: AnimName, skipToEnd = false): Promise<void> {
    const s = this.sprites.get(a.id)!;
    const { row, flip } = DIR_TO_ROW[a.facing];
    s.setFlipX(flip);
    const k = `${a.sprite}_${name}_${row}`;
    return new Promise(res => {
      s.play(k);
      if (skipToEnd) { s.anims.setProgress(1); s.anims.stop(); return res(); }
      if (name === 'idle' || name === 'walk') return res();
      s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => res());
    });
  }

  // Walk along path one hex at a time. onStep returning false stops movement.
  async moveActor(a: Actor, path: Hex[], onStep?: (h: Hex) => boolean): Promise<void> {
    const s = this.sprites.get(a.id)!;
    const token = a.id === 'player' ? ++this.moveToken : 0;
    for (const h of path) {
      if (a.id === 'player' && token !== this.moveToken) break;
      if (this.isBlocked(h, a.id)) break;
      this.setFacing(a, direction(a.pos, h));
      this.playAnim(a, 'walk');
      a.pos = h;
      sfx('step', a.id === 'player' ? 0.8 : 0.4);
      const p = toScreen(h);
      await new Promise<void>(res => this.tweens.add({
        targets: s, x: p.x, y: p.y, duration: 170, onUpdate: () => s.setDepth(s.y + 20), onComplete: () => res(),
      }));
      if (onStep && !onStep(h)) break;
    }
    this.playAnim(a, 'idle');
    this.persistNpc(a);
  }

  floatText(h: Hex, text: string, color = '#ffffff') {
    const p = toScreen(h);
    const tx = this.add.text(p.x, p.y - 70, text, { fontFamily: 'VT323, monospace', fontSize: '20px', color, stroke: '#000', strokeThickness: 3 })
      .setOrigin(0.5).setDepth(100000);
    this.tweens.add({ targets: tx, y: p.y - 110, alpha: 0, duration: 1200, onComplete: () => tx.destroy() });
  }

  // ---------- camera & input ----------
  private setupCamera() {
    const cam = this.cameras.main;
    const last = offsetToAxial(this.map.floor[0].length - 1, this.map.floor.length - 1);
    const br = toScreen(last);
    cam.setBounds(-200, -300, br.x + 400, br.y + 500);
    const ps = this.sprites.get('player')!;
    cam.startFollow(ps, true, 0.1, 0.1);
    cam.setBackgroundColor('#0d0d0b');
  }

  private setupInput() {
    this.input.mouse?.disableContextMenu();
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.dragStart && p.isDown && p.button === 1) {
        const cam = this.cameras.main;
        cam.stopFollow();
        cam.scrollX = this.dragStart.sx - (p.x - this.dragStart.x);
        cam.scrollY = this.dragStart.sy - (p.y - this.dragStart.y);
        return;
      }
      const h = fromScreen(p.worldX, p.worldY);
      this.drawHover(h);
      this.inputOverride?.onHexHover?.(h);
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.button === 1) { this.dragStart = { x: p.x, y: p.y, sx: this.cameras.main.scrollX, sy: this.cameras.main.scrollY }; return; }
      if (p.button === 2) { this.cycleMode(); return; }
      const h = this.hexUnderPointer(p);
      bus.emit('hexClicked', { hex: h, button: p.button });
      if (this.inputOverride) this.inputOverride.onHexClick(h, p);
      else this.exploreClick(h);
    });
    this.input.on('pointerup', () => { this.dragStart = null; });
    this.input.keyboard?.on('keydown-SPACE', () => this.cameras.main.startFollow(this.sprites.get('player')!, true, 0.1, 0.1));
  }

  // Prefer actor sprite under pointer (tall sprites cover other hexes).
  hexUnderPointer(p: Phaser.Input.Pointer): Hex {
    const hits = this.input.hitTestPointer(p) as Phaser.GameObjects.GameObject[];
    let best: Actor | undefined; let bestDepth = -Infinity;
    for (const [id, s] of this.sprites) {
      if (hits.includes(s) && id !== 'player' && s.depth > bestDepth) { best = this.actors.get(id); bestDepth = s.depth; }
    }
    return best ? best.pos : fromScreen(p.worldX, p.worldY);
  }

  cycleMode() {
    const order: Mode[] = ['move', 'attack', 'use', 'look'];
    this.mode = order[(order.indexOf(this.mode) + 1) % order.length];
    bus.emit('modeChanged', this.mode);
  }

  private drawHover(h: Hex) {
    const g = this.hoverG; g.clear();
    if (!this.inBounds(h)) return;
    const colors: Record<Mode, number> = { move: 0x6cff6c, attack: 0xff4040, use: 0xffd040, look: 0x40c0ff };
    this.strokeHex(g, h, colors[this.mode]);
  }

  strokeHex(g: Phaser.GameObjects.Graphics, h: Hex, color: number, alpha = 0.9) {
    const p = toScreen(h);
    const w = 24, hh = HEX_H / 2;
    g.lineStyle(2, color, alpha).strokePoints([
      { x: p.x - w / 2, y: p.y - hh }, { x: p.x + w / 2, y: p.y - hh }, { x: p.x + w, y: p.y },
      { x: p.x + w / 2, y: p.y + hh }, { x: p.x - w / 2, y: p.y + hh }, { x: p.x - w, y: p.y },
    ] as Phaser.Types.Math.Vector2Like[], true);
  }

  showPath(path: Hex[] | null, color = 0x6cff6c) {
    this.pathG.clear();
    path?.forEach(h => { const p = toScreen(h); this.pathG.fillStyle(color, 0.6).fillCircle(p.x, p.y, 3); });
  }

  // ---------- explore-mode actions ----------
  private async exploreClick(h: Hex) {
    if (!this.inBounds(h)) return;
    const target = this.actorAt(h);
    const deadTarget = this.actorAt(h, true);
    const obj = this.objects.get(key(h));

    if (this.mode === 'look') {
      if (target) log(t('look.actor', { name: t(target.nameKey), hp: `${target.hp}/${target.maxHp}` }));
      else if (deadTarget) log(t('look.dead', { name: t(deadTarget.nameKey) }));
      else if (obj) log(t(`look.obj.${obj.obj}`));
      else log(t(`look.floor.${this.floor.get(key(h))}`));
      return;
    }

    if (this.mode === 'attack' && target && target.id !== 'player') {
      bus.emit('combatStart');
      (this.events as Phaser.Events.EventEmitter).emit('attackRequest', target);
      return;
    }

    if (target && target.id !== 'player') {
      if (target.hostile) { bus.emit('combatStart'); return; }
      if (await this.walkAdjacent(h)) {
        this.setFacing(this.player, direction(this.player.pos, h));
        this.setFacing(target, direction(h, this.player.pos)); this.playAnim(target, 'idle');
        if (target.dialogue) bus.emit('talk', { npc: target });
      }
      return;
    }
    if (deadTarget && deadTarget.id !== 'player') {
      if (await this.walkAdjacent(h)) bus.emit('openContainer', { id: `corpse:${deadTarget.id}` });
      return;
    }
    const cont = this.map.containers.find(c => eq(offsetToAxial(c.col, c.row), h));
    if (cont) {
      if (await this.walkAdjacent(h)) bus.emit('openContainer', { id: cont.id });
      return;
    }
    if (obj?.blocks) return;
    const path = this.pathFor(this.player, h);
    if (!path) return;
    this.showPath(path);
    await this.moveActor(this.player, path, () => this.checkAggro());
    this.showPath(null);
    changed();
  }

  async walkAdjacent(h: Hex): Promise<boolean> {
    if (distance(this.player.pos, h) <= 1) return true;
    const goals = neighbors(h).filter(n => !this.isBlocked(n, 'player'));
    let best: Hex[] | null = null;
    for (const g of goals) {
      const p = this.pathFor(this.player, g);
      if (p && (!best || p.length < best.length)) best = p;
    }
    if (!best) return false;
    const token = this.moveToken + 1;
    await this.moveActor(this.player, best, () => this.checkAggro());
    return token === this.moveToken && distance(this.player.pos, h) <= 1 && !this.inputOverride;
  }

  // Hostiles that see the player within 8 hexes start combat. Returns false to stop movement.
  checkAggro(): boolean {
    if (this.inputOverride) return false;
    for (const a of this.livingActors()) {
      if (a.hostile && distance(a.pos, this.player.pos) <= 3 + a.special.P && this.hasLos(a.pos, this.player.pos)) {
        bus.emit('combatStart');
        return false;
      }
    }
    return true;
  }
}
