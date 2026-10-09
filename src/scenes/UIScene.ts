import Phaser from 'phaser';
import { mountHud } from '../ui/hud';
import { bus } from '../systems/events';
import { modalOpen } from '../ui/dom';

// Hosts HTML overlay UI. Feature modules register in src/ui/index.ts.
import { mountFeatures } from '../ui';

export class UIScene extends Phaser.Scene {
  constructor() { super('UI'); }
  create() {
    const overlay = document.getElementById('overlay')!;
    overlay.querySelector('#hud')?.remove();
    overlay.appendChild(mountHud());
    mountFeatures(this.scene.get('World') as any);
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (modalOpen()) return;
      const k = e.key.toLowerCase();
      if (k === 'i' || k === 'ш') bus.emit('openInventory');
      if (k === 'c' || k === 'с') bus.emit('openCharacter');
      if (k === 'p' || k === 'з') bus.emit('openPipbuy');
    });
  }
}
