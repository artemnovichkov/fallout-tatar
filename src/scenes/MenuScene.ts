import Phaser from 'phaser';
import { newGame, setGame, load, hasSave, saveInfo } from '../systems/state';
import { getMap } from '../data/map';
import { t, setLang, getLang } from '../systems/i18n';
import { el } from '../ui/dom';
import { playIntro } from '../ui/intro';
import { AUTOLOAD_KEY } from '../ui/pipbuy';

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    // Pip-Buy "Load" reloads the page with this flag set.
    try { if (sessionStorage.getItem(AUTOLOAD_KEY)) { sessionStorage.removeItem(AUTOLOAD_KEY); if (hasSave()) return this.start(true); } } catch { /* ignore */ }
    const root = document.getElementById('overlay')!;
    const render = () => {
      root.innerHTML = '';
      const info = saveInfo();
      const when = info?.savedAt ? new Date(info.savedAt).toLocaleString(getLang() === 'tt' ? 'tt-RU' : 'ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
      const menu = el('div', { class: 'menu crt' }, [
        el('h1', {}, [t('menu.title')]),
        el('div', { class: 'subtitle' }, [t('menu.subtitle')]),
        info ? el('button', { onclick: () => this.start(true) }, [
          t('menu.continue'),
          el('small', { class: 'menu-save' }, [`${t(getMap(info.mapId).nameKey)} · ${t('menu.level', { n: info.level })}${when ? ` · ${when}` : ''}`]),
        ]) : null,
        el('button', { onclick: () => (info ? confirmNew() : this.start(false)) }, [t('menu.new')]),
        el('button', { onclick: () => { setLang(getLang() === 'ru' ? 'tt' : 'ru'); render(); } }, [t('menu.lang')]),
      ]);
      root.appendChild(menu);
    };
    const confirmNew = () => {
      root.innerHTML = '';
      root.appendChild(el('div', { class: 'menu crt' }, [
        el('div', { class: 'subtitle' }, [t('menu.confirmNew')]),
        el('button', { onclick: () => this.start(false) }, [t('menu.yes')]),
        el('button', { onclick: render }, [t('menu.no')]),
      ]));
    };
    render();
  }

  private start(fromSave: boolean) {
    if (!(fromSave && load())) setGame(newGame());
    document.getElementById('overlay')!.innerHTML = '';
    if (fromSave) this.scene.start('World');
    else playIntro(() => this.scene.start('World'));
  }
}
