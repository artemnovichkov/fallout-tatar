import { sfx } from '../systems/audio';
// New-game intro: typewriter slides on a dark screen. Click = finish line / next slide, Esc = skip all.
import { el } from './dom';
import { t } from '../systems/i18n';
import './content.css';

export const INTRO_SLIDES = ['intro.1', 'intro.2', 'intro.3', 'intro.4', 'intro.5'];

export function playIntro(onDone: () => void) {
  const root = document.getElementById('overlay')!;
  const text = el('div', { class: 'intro-text' });
  const counter = el('div', { class: 'intro-counter' });
  const box = el('div', { class: 'intro crt' }, [
    el('div', { class: 'intro-frame' }, [text, el('span', { class: 'intro-caret' })]),
    counter,
    el('div', { class: 'intro-skip' }, [t('intro.skip')]),
  ]);
  root.appendChild(box);

  let slide = 0, pos = 0, full = '', timer = 0, done = false;
  const typing = () => pos < full.length;

  const show = () => {
    full = t(INTRO_SLIDES[slide]);
    pos = 0;
    text.textContent = '';
    counter.textContent = `${slide + 1} / ${INTRO_SLIDES.length}`;
    box.classList.toggle('intro-first', slide === 0);
    clearInterval(timer);
    timer = window.setInterval(() => {
      pos++;
      text.textContent = full.slice(0, pos);
      if (full[pos - 1] !== ' ') sfx('type', 0.6);
      if (!typing()) clearInterval(timer);
    }, slide === 0 ? 70 : 28);
  };
  const finish = () => {
    if (done) return;
    done = true;
    clearInterval(timer);
    document.removeEventListener('keydown', onKey);
    box.classList.add('intro-out');
    setTimeout(() => { box.remove(); onDone(); }, 350);
  };
  const next = () => {
    if (typing()) { pos = full.length; text.textContent = full; clearInterval(timer); return; }
    if (++slide >= INTRO_SLIDES.length) finish(); else show();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') finish();
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); next(); }
  };
  box.addEventListener('click', next);
  document.addEventListener('keydown', onKey);
  show();
}
