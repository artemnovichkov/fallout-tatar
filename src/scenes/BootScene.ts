import Phaser from 'phaser';
import {
  CHARACTERS, CHAR_W, CHAR_H, CHAR_COLS, FACING_ROWS, ANIM, TILES, TILE_W, TILE_H, OBJECTS, PORTRAITS, ICONS, ICON_SIZE,
} from '../systems/assets';

// Loads all assets from the contract; anything missing gets a generated placeholder so the game always runs.
export class BootScene extends Phaser.Scene {
  private missing = new Set<string>();
  constructor() { super('Boot'); }

  preload() {
    const base = 'assets/';
    this.load.on('loaderror', (f: Phaser.Loader.File) => this.missing.add(f.key));
    for (const c of CHARACTERS) this.load.spritesheet(c, `${base}sprites/${c}.png`, { frameWidth: CHAR_W, frameHeight: CHAR_H });
    for (const t of TILES) this.load.image(`tile_${t}`, `${base}tiles/${t}.png`);
    for (const o of OBJECTS) this.load.image(`obj_${o}`, `${base}sprites/obj_${o}.png`);
    for (const p of PORTRAITS) this.load.image(p, `${base}portraits/${p}.png`);
    this.load.spritesheet('icons', `${base}ui/icons.png`, { frameWidth: ICON_SIZE, frameHeight: ICON_SIZE });

    const bar = this.add.rectangle(400, 300, 4, 12, 0x6cff6c).setOrigin(0, 0.5);
    this.load.on('progress', (p: number) => { bar.width = 300 * p; bar.x = this.scale.width / 2 - 150; bar.y = this.scale.height / 2; });
  }

  create() {
    for (const k of this.missing) this.textures.exists(k) && this.textures.remove(k);
    for (const c of CHARACTERS) if (this.missing.has(c)) this.placeholderChar(c);
    for (const t of TILES) if (this.missing.has(`tile_${t}`)) this.placeholderTile(t);
    for (const o of OBJECTS) if (this.missing.has(`obj_${o}`)) this.placeholderObj(o);
    for (const p of PORTRAITS) if (this.missing.has(p)) this.placeholderPortrait(p);
    if (this.missing.has('icons')) this.placeholderIcons();

    for (const c of CHARACTERS) {
      for (let row = 0; row < FACING_ROWS.length; row++) {
        for (const [name, a] of Object.entries(ANIM)) {
          const frames = this.anims.generateFrameNumbers(c, { start: row * CHAR_COLS + a.start, end: row * CHAR_COLS + a.start + a.count - 1 });
          this.anims.create({ key: `${c}_${name}_${row}`, frames, frameRate: a.rate, repeat: a.repeat });
        }
      }
    }
    this.scene.start('Menu');
  }

  private colorFor(key: string) {
    let h = 0; for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return Phaser.Display.Color.HSVToRGB((h % 360) / 360, 0.5, 0.8).color;
  }

  private placeholderChar(key: string) {
    const g = this.make.graphics({}, false);
    const col = key === 'ravil' ? 0x7a7f88 : this.colorFor(key);
    for (let row = 0; row < FACING_ROWS.length; row++) {
      for (let f = 0; f < CHAR_COLS; f++) {
        const x = f * CHAR_W, y = row * CHAR_H;
        const dead = f >= ANIM.death.start;
        const bob = f >= ANIM.walk.start && f < ANIM.walk.start + ANIM.walk.count ? (f % 2) * 2 : 0;
        if (dead) { g.fillStyle(col).fillRect(x + 6, y + CHAR_H - 18, 36, 10); continue; }
        g.fillStyle(0x000000, 0.3).fillEllipse(x + 24, y + 72, 28, 8);
        g.fillStyle(0x3a3a40).fillRect(x + 16, y + 46 - bob, 7, 26).fillRect(x + 25, y + 46 + bob, 7, 26);
        g.fillStyle(col).fillRect(x + 13, y + 24, 22, 26);
        g.fillStyle(0xe0b896).fillCircle(x + 24, y + 16, 9);
        g.fillStyle(0x2b1d14).fillRect(x + 15, y + 6, 18, 6);
        if (key === 'ravil' && row !== 3) g.lineStyle(2, 0x5a3a1a).strokeCircle(x + 20, y + 17, 3).strokeCircle(x + 28, y + 17, 3);
        // facing marker
        g.fillStyle(0xffffff).fillRect(x + 22 + [0, 6, 6, 0][row], y + 30, 4, 4);
      }
    }
    g.generateTexture(key, CHAR_W * CHAR_COLS, CHAR_H * FACING_ROWS.length);
    g.destroy();
    const tex = this.textures.get(key);
    let i = 0;
    for (let row = 0; row < FACING_ROWS.length; row++)
      for (let f = 0; f < CHAR_COLS; f++) tex.add(i++, 0, f * CHAR_W, row * CHAR_H, CHAR_W, CHAR_H);
  }

  private hexPoints(w: number, h: number) {
    return [
      new Phaser.Math.Vector2(w * 0.25, 0), new Phaser.Math.Vector2(w * 0.75, 0), new Phaser.Math.Vector2(w, h / 2),
      new Phaser.Math.Vector2(w * 0.75, h), new Phaser.Math.Vector2(w * 0.25, h), new Phaser.Math.Vector2(0, h / 2),
    ];
  }

  private placeholderTile(t: string) {
    const colors: Record<string, number> = { sand: 0x9c8a5a, asphalt: 0x4a4a48, rubble: 0x6e6252, grass: 0x5d6b3a, water: 0x2f5a6a, floor: 0x5a5148, carpet: 0x7a2e2a };
    const g = this.make.graphics({}, false);
    g.fillStyle(colors[t] ?? 0x777777).fillPoints(this.hexPoints(TILE_W, TILE_H), true);
    g.lineStyle(1, 0x000000, 0.15).strokePoints(this.hexPoints(TILE_W, TILE_H), true);
    g.generateTexture(`tile_${t}`, TILE_W, TILE_H);
    g.destroy();
  }

  private placeholderObj(o: string) {
    const g = this.make.graphics({}, false);
    const tall = /wall|tower|derrick|vault|lamp/.test(o);
    const w = 44, h = o === 'tower_syuyumbike' ? 160 : o === 'derrick' ? 120 : tall ? 56 : 28;
    g.fillStyle(this.colorFor(o)).fillRect(4, 0, w - 8, h - 6);
    g.fillStyle(0x000000, 0.25).fillRect(4, h - 12, w - 8, 6);
    g.generateTexture(`obj_${o}`, w, h);
    g.destroy();
  }

  private placeholderPortrait(p: string) {
    const g = this.make.graphics({}, false);
    g.fillStyle(0x0b1a0b).fillRect(0, 0, 160, 160);
    g.fillStyle(0x6cff6c, 0.8).fillCircle(80, 70, 38).fillRect(30, 110, 100, 50);
    g.generateTexture(p, 160, 160);
    g.destroy();
  }

  private placeholderIcons() {
    const g = this.make.graphics({}, false);
    ICONS.forEach((k, i) => { g.fillStyle(this.colorFor(k)).fillRoundedRect(i * ICON_SIZE + 4, 4, ICON_SIZE - 8, ICON_SIZE - 8, 4); });
    g.generateTexture('icons', ICONS.length * ICON_SIZE, ICON_SIZE);
    g.destroy();
    const tex = this.textures.get('icons');
    ICONS.forEach((_, i) => tex.add(i, 0, i * ICON_SIZE, 0, ICON_SIZE, ICON_SIZE));
  }
}
