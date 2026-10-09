import Phaser from 'phaser';
import './style.css';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { WorldScene } from './scenes/WorldScene';
import { UIScene } from './scenes/UIScene';
import { unlockOnGesture } from './systems/audio';

unlockOnGesture();

// Wait for web fonts so Phaser text (damage numbers etc.) doesn't render with a fallback font.
await Promise.race([
  Promise.all(['16px Handjet', '16px "Press Start 2P"'].map(f => document.fonts.load(f, 'Аә'))),
  new Promise(r => setTimeout(r, 2500)),
]).catch(() => {});

const phaserGame = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0d0d0b',
  pixelArt: true,
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  scene: [BootScene, MenuScene, WorldScene, UIScene],
});

// Dev-only handle for debugging / headless smoke tests.
if (import.meta.env.DEV) (window as any).__phaser = phaserGame;
