import Phaser from 'phaser';
import { newGame, setGame, load, hasSave } from '../systems/state';
import { t, setLang, getLang } from '../systems/i18n';
import { el } from '../ui/dom';

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    const root = document.getElementById('overlay')!;
    const render = () => {
      root.innerHTML = '';
      const menu = el('div', { class: 'menu crt' }, [
        el('h1', {}, [t('menu.title')]),
        el('div', { class: 'subtitle' }, [t('menu.subtitle')]),
        el('button', { onclick: () => this.start(false) }, [t('menu.new')]),
        hasSave() ? el('button', { onclick: () => this.start(true) }, [t('menu.continue')]) : null,
        el('button', { onclick: () => { setLang(getLang() === 'ru' ? 'tt' : 'ru'); render(); } }, [t('menu.lang')]),
      ]);
      root.appendChild(menu);
    };
    render();
  }

  private start(fromSave: boolean) {
    if (!(fromSave && load())) setGame(newGame());
    document.getElementById('overlay')!.innerHTML = '';
    this.scene.start('World');
  }
}
