import { getAudioSettings, setAudio, sfx } from '../systems/audio';
// Pip-Buy 2000: green CRT wrist terminal. Tabs: Status, Quests, Map, Settings.
import type { WorldScene } from '../scenes/WorldScene';
import { el, modal } from './dom';
import { bus } from '../systems/events';
import { game, save, hasSave } from '../systems/state';
import { t, setLang, getLang } from '../systems/i18n';
import { SPECIAL_KEYS } from '../systems/stats';
import { nextLevelXp } from '../systems/leveling';
import { journal } from '../systems/quests';
import { toScreen, offsetToAxial } from '../systems/hex';
import { MAP, FLOOR_LEGEND, OBJECT_LEGEND } from '../data/map';
import { portraitUrl } from './dialogue';
import './content.css';

type Tab = 'status' | 'quests' | 'map' | 'settings';
export const AUTOLOAD_KEY = 'fallout-tatar-autoload';

const FLOOR_COL: Record<string, string> = {
  sand: '#1f3d1a', asphalt: '#162d16', rubble: '#1b361a', grass: '#2a5222', water: '#08201a', floor: '#2d5226', carpet: '#3b6a2c',
};

function drawMap(world: WorldScene, cv: HTMLCanvasElement, blink: boolean) {
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  const rows = MAP.floor.length, cols = MAP.floor[0].length;
  const br = toScreen(offsetToAxial(cols - 1, rows - 1));
  const pad = 12;
  const sx = (cv.width - pad * 2) / (br.x + 36), sy = (cv.height - pad * 2) / (br.y + 24);
  const pt = (col: number, row: number) => { const p = toScreen(offsetToAxial(col, row)); return { x: pad + (p.x + 18) * sx, y: pad + (p.y + 12) * sy }; };
  const cw = 36 * sx + 1, ch = 24 * sy + 1;
  ctx.fillStyle = '#041004';
  ctx.fillRect(0, 0, cv.width, cv.height);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const p = pt(c, r);
    ctx.fillStyle = FLOOR_COL[FLOOR_LEGEND[MAP.floor[r][c]]] ?? '#1f3d1a';
    ctx.fillRect(p.x - cw / 2, p.y - ch / 2, cw, ch);
    const o = OBJECT_LEGEND[MAP.objects[r]?.[c]];
    if (o) {
      ctx.fillStyle = o.los ? 'rgba(108,255,108,.75)' : 'rgba(108,255,108,.35)';
      ctx.fillRect(p.x - cw / 2 + 1, p.y - ch / 2 + 1, cw - 2, ch - 2);
    }
  }
  ctx.font = '14px "PT Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#b8ffb8';
  for (const l of MAP.labels ?? []) { const p = pt(l.col, l.row); ctx.fillText(t(l.key), p.x, p.y); }
  const toPx = (h: { q: number; r: number }) => {
    const s = toScreen(h);
    return { x: pad + (s.x + 18) * sx, y: pad + (s.y + 12) * sy };
  };
  for (const a of world.actors.values()) {
    if (a.dead || a.id === 'player') continue;
    const p = toPx(a.pos);
    ctx.fillStyle = a.hostile ? '#ff4a3a' : '#ffb84a';
    ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
  }
  const p = toPx(world.player.pos);
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = blink ? '#ffffff' : '#6cff6c';
  ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.fillText(t('pip.you'), p.x, p.y - 12);
}

export function openPipbuy(world: WorldScene, tab: Tab = 'status') {
  let current = tab;
  let raf = 0;
  const body = el('div', { class: 'pip-screen crt' });
  const tabs = el('div', { class: 'pip-tabs' });
  const win = el('div', { class: 'window pip' }, [
    el('div', { class: 'pip-top' }, [
      el('div', { class: 'pip-title' }, []),
      el('button', { class: 'pip-close', onclick: () => close() }, ['✕']),
    ]),
    el('div', { class: 'ornament pip-orn' }),
    tabs,
    body,
    el('div', { class: 'ornament pip-orn' }),
    el('div', { class: 'pip-footer' }),
  ]);

  const row = (k: string, v: string | number) => el('div', { class: 'pip-row' }, [el('span', {}, [k]), el('b', {}, [String(v)])]);

  const status = () => {
    const p = game.player;
    const url = portraitUrl(world, p.portrait);
    return el('div', { class: 'pip-status' }, [
      el('div', { class: 'pip-portrait' }, [url ? el('img', { src: url, alt: '' }) : null]),
      el('div', { class: 'pip-stats' }, [
        el('div', { class: 'pip-name' }, [t(p.nameKey)]),
        el('div', { class: 'pip-sub' }, [t('pip.vault')]),
        el('div', { class: 'pip-sub' }, [t('pip.date')]),
        row(t('pip.level'), game.level),
        row(t('pip.xp'), `${game.xp} / ${nextLevelXp()}`),
        row(t('pip.hp'), `${p.hp} / ${p.maxHp}`),
        row(t('pip.rads'), game.rads),
        row(t('pip.ac'), p.ac),
        row(t('pip.caps'), game.caps),
        el('div', { class: 'pip-special' }, SPECIAL_KEYS.map(k =>
          el('div', {}, [el('span', {}, [t(`check.stat.${k}`)]), el('b', {}, [String(p.special[k])])]))),
      ]),
    ]);
  };

  const quests = () => {
    const j = journal();
    if (!j.length) return el('div', { class: 'pip-empty' }, [t('pip.noQuests')]);
    return el('div', { class: 'pip-quests' }, j.map(q => el('div', { class: 'pip-quest' + (q.done ? ' done' : '') }, [
      el('div', { class: 'pip-qname' }, [q.done ? '☑ ' : '☐ ', q.name, q.done ? el('span', { class: 'pip-qdone' }, [` — ${t('pip.done')}`]) : null]),
      el('div', { class: 'pip-qtext' }, [q.text]),
    ])));
  };

  const map = () => {
    const cv = el('canvas', { class: 'pip-map', width: 620, height: 380 });
    let blink = false, last = 0;
    const loop = (ts: number) => {
      if (ts - last > 450) { blink = !blink; last = ts; drawMap(world, cv, blink); }
      raf = requestAnimationFrame(loop);
    };
    drawMap(world, cv, false);
    raf = requestAnimationFrame(loop);
    return el('div', {}, [el('div', { class: 'pip-sub' }, [t(MAP.nameKey)]), cv]);
  };

  const msg = el('div', { class: 'pip-msg' });
  const settings = () => {
    const langBtn = (l: 'ru' | 'tt', label: string) =>
      el('button', { class: getLang() === l ? 'active' : '', onclick: () => { setLang(l); render(); } }, [label]);
    return el('div', { class: 'pip-settings' }, [
      el('div', { class: 'pip-sub' }, [t('pip.lang')]),
      el('div', { class: 'pip-btnrow' }, [langBtn('ru', 'Русский'), langBtn('tt', 'Татарча')]),
      ...audioControls(),
      el('div', { class: 'pip-btnrow' }, [
        el('button', { onclick: () => { msg.textContent = save() ? t('pip.saved') : '—'; } }, [t('pip.save')]),
        el('button', {
          onclick: () => {
            if (!hasSave()) { msg.textContent = t('pip.noSave'); return; }
            try { sessionStorage.setItem(AUTOLOAD_KEY, '1'); } catch { /* ignore */ }
            location.reload();
          },
        }, [t('pip.load')]),
      ]),
      msg,
    ]);
  };

  const render = () => {
    cancelAnimationFrame(raf);
    (win.querySelector('.pip-title') as HTMLElement).textContent = t('pip.title');
    (win.querySelector('.pip-footer') as HTMLElement).textContent = t('pip.footer');
    tabs.innerHTML = '';
    (['status', 'quests', 'map', 'settings'] as Tab[]).forEach((k, i) => tabs.append(
      el('button', { class: k === current ? 'active' : '', onclick: () => { current = k; render(); } }, [`${i + 1}. ${t(`pip.tab.${k}`)}`])));
    body.innerHTML = '';
    body.append(current === 'status' ? status() : current === 'quests' ? quests() : current === 'map' ? map() : settings());
  };

  const onKey = (e: KeyboardEvent) => {
    const order: Tab[] = ['status', 'quests', 'map', 'settings'];
    const n = Number(e.key);
    if (n >= 1 && n <= 4) { current = order[n - 1]; render(); }
    else if (e.key.toLowerCase() === 'p' || e.key.toLowerCase() === 'з') close();
  };
  document.addEventListener('keydown', onKey);
  const close = modal(win, () => { cancelAnimationFrame(raf); document.removeEventListener('keydown', onKey); });
  render();
}

let off: (() => void) | null = null;
export function mountPipbuy(world: WorldScene) {
  off?.();
  off = bus.on('openPipbuy', () => openPipbuy(world));
}

// Music / SFX volume sliders + mute toggle.
function audioControls(): HTMLElement[] {
  const a = getAudioSettings();
  const slider = (label: string, val: number, set: (v: number) => void) => {
    const input = el('input', { type: 'range', min: 0, max: 100, value: Math.round(val * 100), class: 'pip-range' });
    input.addEventListener('input', () => set(Number(input.value) / 100));
    input.addEventListener('change', () => sfx('click'));
    return el('label', { class: 'pip-audio' }, [el('span', {}, [label]), input]);
  };
  const mute = el('input', { type: 'checkbox' });
  mute.checked = a.muted;
  mute.addEventListener('change', () => setAudio({ muted: mute.checked }));
  return [
    el('div', { class: 'pip-sub' }, [t('audio.header')]),
    slider(t('audio.music'), a.music, v => setAudio({ music: v })),
    slider(t('audio.sfx'), a.sfx, v => setAudio({ sfx: v })),
    el('label', { class: 'pip-audio' }, [mute, el('span', {}, [t('audio.mute')])]),
  ];
}
