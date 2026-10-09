// Procedural audio: all SFX and music are synthesized with WebAudio, no sound files.
// Music: explore theme = kurai-like flute over a steppe drone and wind (Tatar pentatonic);
// combat theme = drums + bass ostinato. Crossfades on combatStart/combatEnd.

export type Sfx =
  | 'step' | 'pistol' | 'shotgun' | 'rifle' | 'swing' | 'punch' | 'hit' | 'miss' | 'death'
  | 'reload' | 'click' | 'open' | 'close' | 'pip' | 'coins' | 'levelup' | 'type' | 'turn'
  | 'alarm' | 'geiger' | 'unlock' | 'fail';

interface Settings { music: number; sfx: number; muted: boolean }
const KEY = 'fallout-tatar-audio';
const settings: Settings = (() => {
  try { return { music: 0.5, sfx: 0.7, muted: false, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { music: 0.5, sfx: 0.7, muted: false }; }
})();
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* ignore */ } };

let ctx: AudioContext | null = null;
let master: GainNode, musicBus: GainNode, sfxBus: GainNode, noiseBuf: AudioBuffer;
let exploreBus: GainNode, combatBus: GainNode;

function init() {
  if (ctx) return ctx;
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4;
  master = ctx.createGain(); master.connect(comp).connect(ctx.destination);
  musicBus = gain(master, 0); sfxBus = gain(master, 0);
  exploreBus = gain(musicBus, 1); combatBus = gain(musicBus, 0);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyVolumes();
  return ctx;
}

function gain(dest: AudioNode, v: number) { const g = ctx!.createGain(); g.gain.value = v; g.connect(dest); return g; }

function applyVolumes() {
  if (!ctx) return;
  const m = settings.muted ? 0 : 1, now = ctx.currentTime;
  musicBus.gain.setTargetAtTime(settings.music * 0.55 * m, now, 0.1);
  sfxBus.gain.setTargetAtTime(settings.sfx * m, now, 0.05);
}

// Browsers require a user gesture before audio can start.
export function unlockOnGesture() {
  const go = () => {
    const c = init(); if (!c) return;
    if (c.state === 'suspended') c.resume();
    startMusic();
    window.removeEventListener('pointerdown', go); window.removeEventListener('keydown', go);
  };
  window.addEventListener('pointerdown', go); window.addEventListener('keydown', go);
}

export const getAudioSettings = (): Readonly<Settings> => settings;
export function setAudio(p: Partial<Settings>) { Object.assign(settings, p); persist(); applyVolumes(); }
export function toggleMute() { setAudio({ muted: !settings.muted }); return settings.muted; }

// ---------- primitives ----------
type Env = { a?: number; d: number; peak?: number };

function osc(type: OscillatorType, f0: number, f1: number | null, t: number, env: Env, dest: AudioNode = sfxBus, detune = 0) {
  const c = ctx!, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.detune.value = detune;
  if (f1 !== null) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + env.d);
  envelope(g.gain, t, env);
  o.connect(g).connect(dest); o.start(t); o.stop(t + (env.a ?? 0.005) + env.d + 0.05);
  return o;
}

function noise(t: number, env: Env, filter: { type: BiquadFilterType; f: number; f1?: number; q?: number }, dest: AudioNode = sfxBus) {
  const c = ctx!, s = c.createBufferSource(), bq = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noiseBuf; s.playbackRate.value = 0.8 + Math.random() * 0.4;
  bq.type = filter.type; bq.frequency.setValueAtTime(filter.f, t); bq.Q.value = filter.q ?? 1;
  if (filter.f1) bq.frequency.exponentialRampToValueAtTime(filter.f1, t + env.d);
  envelope(g.gain, t, env);
  s.connect(bq).connect(g).connect(dest);
  s.start(t, Math.random()); s.stop(t + (env.a ?? 0.005) + env.d + 0.05);
}

function envelope(p: AudioParam, t: number, { a = 0.005, d, peak = 1 }: Env) {
  p.setValueAtTime(0.0001, t);
  p.exponentialRampToValueAtTime(peak, t + a);
  p.exponentialRampToValueAtTime(0.0001, t + a + d);
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

// ---------- SFX ----------
let lastType = 0;
export function sfx(name: Sfx, vol = 1) {
  const c = init(); if (!c || c.state !== 'running' || settings.muted) return;
  const t = c.currentTime + 0.005;
  const out = vol === 1 ? sfxBus : gain(sfxBus, vol);
  switch (name) {
    case 'step':
      noise(t, { d: 0.07, peak: 0.25 }, { type: 'lowpass', f: rnd(500, 800) }, out);
      osc('sine', rnd(70, 90), 50, t, { d: 0.05, peak: 0.2 }, out);
      break;
    case 'pistol':
      noise(t, { d: 0.18, peak: 0.9 }, { type: 'bandpass', f: 2500, f1: 400, q: 0.7 }, out);
      osc('sine', 160, 40, t, { d: 0.15, peak: 0.9 }, out);
      noise(t + 0.05, { a: 0.02, d: 0.5, peak: 0.12 }, { type: 'lowpass', f: 900 }, out); // room tail
      break;
    case 'shotgun':
      noise(t, { d: 0.35, peak: 1 }, { type: 'lowpass', f: 3000, f1: 200 }, out);
      osc('sine', 110, 30, t, { d: 0.3, peak: 1 }, out);
      noise(t + 0.45, { d: 0.05, peak: 0.3 }, { type: 'bandpass', f: 1800, q: 4 }, out); // pump
      noise(t + 0.58, { d: 0.05, peak: 0.3 }, { type: 'bandpass', f: 1400, q: 4 }, out);
      break;
    case 'rifle':
      noise(t, { d: 0.12, peak: 1 }, { type: 'highpass', f: 1500 }, out);
      osc('square', 220, 50, t, { d: 0.1, peak: 0.4 }, out);
      noise(t + 0.03, { a: 0.03, d: 0.9, peak: 0.18 }, { type: 'lowpass', f: 700 }, out);
      break;
    case 'swing':
      noise(t, { a: 0.06, d: 0.15, peak: 0.4 }, { type: 'bandpass', f: 600, f1: 2500, q: 2 }, out);
      break;
    case 'punch':
      noise(t, { a: 0.04, d: 0.08, peak: 0.25 }, { type: 'bandpass', f: 800, f1: 1600, q: 2 }, out);
      osc('sine', 120, 60, t + 0.08, { d: 0.08, peak: 0.6 }, out);
      break;
    case 'hit':
      osc('triangle', 180, 70, t, { d: 0.12, peak: 0.6 }, out);
      noise(t, { d: 0.1, peak: 0.5 }, { type: 'lowpass', f: 1200 }, out);
      osc('sawtooth', rnd(240, 320), 150, t + 0.03, { a: 0.02, d: 0.18, peak: 0.12 }, out); // grunt
      break;
    case 'miss':
      osc('sine', 2400, 900, t, { d: 0.25, peak: 0.15 }, out); // ricochet whine
      noise(t, { d: 0.05, peak: 0.2 }, { type: 'highpass', f: 3000 }, out);
      break;
    case 'death':
      osc('sawtooth', 260, 70, t, { a: 0.02, d: 0.6, peak: 0.25 }, out);
      noise(t + 0.5, { d: 0.2, peak: 0.6 }, { type: 'lowpass', f: 400 }, out); // body falls
      osc('sine', 70, 35, t + 0.5, { d: 0.25, peak: 0.7 }, out);
      break;
    case 'reload':
      [0, 0.12, 0.3].forEach((dt, i) => noise(t + dt, { d: 0.04, peak: 0.45 }, { type: 'bandpass', f: [2200, 3200, 1600][i], q: 6 }, out));
      break;
    case 'click':
      osc('square', 1800, 1200, t, { d: 0.025, peak: 0.12 }, out);
      break;
    case 'open':
      osc('square', 600, null, t, { d: 0.04, peak: 0.08 }, out);
      osc('square', 900, null, t + 0.05, { d: 0.05, peak: 0.08 }, out);
      noise(t, { d: 0.12, peak: 0.15 }, { type: 'bandpass', f: 1500, q: 3 }, out);
      break;
    case 'close':
      osc('square', 900, null, t, { d: 0.04, peak: 0.07 }, out);
      osc('square', 500, null, t + 0.05, { d: 0.05, peak: 0.07 }, out);
      break;
    case 'pip': // Pip-Buy power on: CRT whine + beeps
      osc('sine', 15000, 12000, t, { a: 0.02, d: 0.4, peak: 0.03 }, out);
      [0, 0.08, 0.16].forEach((dt, i) => osc('square', [880, 1175, 1568][i], null, t + dt, { d: 0.06, peak: 0.08 }, out));
      noise(t, { d: 0.2, peak: 0.1 }, { type: 'highpass', f: 4000 }, out);
      break;
    case 'coins':
      for (let i = 0; i < 4; i++) osc('triangle', rnd(2600, 3600), null, t + i * 0.06 + rnd(0, 0.02), { d: 0.12, peak: 0.12 }, out);
      break;
    case 'levelup':
      [523, 659, 784, 1047].forEach((f, i) => osc('square', f, null, t + i * 0.11, { d: 0.25, peak: 0.12 }, out));
      osc('triangle', 1047, null, t + 0.44, { a: 0.02, d: 0.8, peak: 0.15 }, out);
      break;
    case 'type': {
      const now = performance.now(); if (now - lastType < 35) break; lastType = now;
      noise(t, { d: 0.015, peak: 0.12 }, { type: 'bandpass', f: rnd(2500, 4000), q: 3 }, out);
      break;
    }
    case 'turn':
      osc('sine', 660, null, t, { d: 0.08, peak: 0.15 }, out);
      osc('sine', 990, null, t + 0.09, { d: 0.12, peak: 0.15 }, out);
      break;
    case 'alarm': // combat start sting
      osc('sawtooth', 110, null, t, { a: 0.01, d: 0.5, peak: 0.25 }, out);
      osc('sawtooth', 116.5, null, t, { a: 0.01, d: 0.5, peak: 0.25 }, out);
      noise(t, { d: 0.6, peak: 0.5 }, { type: 'lowpass', f: 300 }, out);
      break;
    case 'geiger':
      for (let i = 0; i < 8; i++) noise(t + rnd(0, 0.6), { d: 0.006, peak: 0.5 }, { type: 'highpass', f: 2000 }, out);
      break;
    case 'unlock':
      noise(t, { d: 0.03, peak: 0.4 }, { type: 'bandpass', f: 3000, q: 8 }, out);
      noise(t + 0.15, { d: 0.06, peak: 0.6 }, { type: 'bandpass', f: 1200, q: 4 }, out);
      break;
    case 'fail':
      osc('square', 200, 120, t, { d: 0.25, peak: 0.12 }, out);
      break;
  }
}

// ---------- music ----------
// Tatar music is built on the anhemitonic pentatonic scale.
const PENTA = [0, 2, 4, 7, 9];
const ROOT = 196; // G3
const noteFreq = (deg: number, oct = 0) => {
  const i = ((deg % 5) + 5) % 5, o = Math.floor(deg / 5) + oct;
  return ROOT * Math.pow(2, (PENTA[i] + 12 * o) / 12);
};

let musicStarted = false;
let combat = false;
let nextPhrase = 0, nextBeat = 0, beat = 0, melodyDeg = 5;

function startMusic() {
  if (musicStarted || !ctx) return;
  musicStarted = true;
  drone();
  wind();
  nextPhrase = ctx.currentTime + 1.5;
  nextBeat = ctx.currentTime + 0.2;
  setInterval(schedule, 100);
}

export function setCombatMusic(on: boolean) {
  combat = on;
  if (!ctx) return;
  const now = ctx.currentTime;
  exploreBus.gain.setTargetAtTime(on ? 0.15 : 1, now, 0.8);
  combatBus.gain.setTargetAtTime(on ? 1 : 0, now, on ? 0.2 : 1.2);
  if (on) { nextBeat = now + 0.05; beat = 0; }
}

function schedule() {
  const c = ctx!; if (c.state !== 'running') return;
  const ahead = c.currentTime + 0.3;
  if (nextPhrase < ahead) nextPhrase += kuraiPhrase(nextPhrase) + rnd(3, 8);
  if (combat) while (nextBeat < ahead) { combatBeat(nextBeat, beat++); nextBeat += 0.18; }
}

// Kurai (end-blown reed flute): breathy sine with delayed vibrato and an upward scoop into each note.
function kurai(t: number, f: number, dur: number) {
  const c = ctx!, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain();
  const vib = c.createOscillator(), vibG = c.createGain();
  o.type = 'sine'; o2.type = 'triangle';
  o.frequency.setValueAtTime(f * 0.94, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.09);
  o2.frequency.setValueAtTime(f * 2 * 0.94, t); o2.frequency.exponentialRampToValueAtTime(f * 2, t + 0.09);
  vib.frequency.value = 5.2; vibG.gain.setValueAtTime(0, t); vibG.gain.linearRampToValueAtTime(f * 0.012, t + dur * 0.6);
  vib.connect(vibG); vibG.connect(o.frequency);
  const g2 = gain(g, 0.12);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.16, t + 0.08);
  g.gain.setTargetAtTime(0.11, t + 0.1, dur * 0.4);
  g.gain.setTargetAtTime(0.0001, t + dur, 0.12);
  o.connect(g); o2.connect(g2);
  const rev = reverb();
  g.connect(exploreBus); g.connect(rev);
  // breath
  noise(t, { a: 0.05, d: dur, peak: 0.035 }, { type: 'bandpass', f: f * 2, q: 1.5 }, exploreBus);
  [o, o2, vib].forEach(n => { n.start(t); n.stop(t + dur + 1); });
}

let revNode: ConvolverNode | null = null;
function reverb() {
  if (revNode) return revNode;
  const c = ctx!, len = c.sampleRate * 2.5, buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  revNode = c.createConvolver(); revNode.buffer = buf;
  revNode.connect(gain(exploreBus, 0.35));
  return revNode;
}

// Random-walk melody over the pentatonic scale, long held phrase endings. Returns phrase duration.
function kuraiPhrase(t: number): number {
  let time = 0;
  const notes = 4 + Math.floor(Math.random() * 5);
  for (let i = 0; i < notes; i++) {
    const step = [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)];
    melodyDeg = Math.max(3, Math.min(11, melodyDeg + step));
    const last = i === notes - 1;
    const dur = last ? rnd(1.8, 3) : [0.35, 0.5, 0.7, 1.0][Math.floor(Math.random() * 4)];
    kurai(t + time, noteFreq(melodyDeg, 1), dur);
    // ornament: quick grace note before longer notes
    if (dur >= 0.7 && Math.random() < 0.4) kurai(t + time - 0.07, noteFreq(melodyDeg + 1, 1), 0.06);
    time += dur;
  }
  if (Math.random() < 0.5) melodyDeg = 5 + Math.floor(Math.random() * 3);
  return time;
}

function drone() {
  const c = ctx!, lp = c.createBiquadFilter(), g = gain(exploreBus, 0.05);
  lp.type = 'lowpass'; lp.frequency.value = 400; lp.connect(g);
  const lfo = c.createOscillator(), lfoG = c.createGain();
  lfo.frequency.value = 0.07; lfoG.gain.value = 180; lfo.connect(lfoG).connect(lp.frequency); lfo.start();
  [ROOT / 2, ROOT * 0.75, ROOT / 2 * 1.003].forEach(f => {
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start();
  });
}

function wind() {
  const c = ctx!, s = c.createBufferSource(), bp = c.createBiquadFilter(), g = gain(exploreBus, 0.06);
  s.buffer = noiseBuf; s.loop = true;
  bp.type = 'bandpass'; bp.Q.value = 2; bp.frequency.value = 500;
  const lfo = c.createOscillator(), lfoG = c.createGain();
  lfo.frequency.value = 0.05; lfoG.gain.value = 300; lfo.connect(lfoG).connect(bp.frequency); lfo.start();
  const lfo2 = c.createOscillator(), lfo2G = c.createGain();
  lfo2.frequency.value = 0.11; lfo2G.gain.value = 0.04; lfo2.connect(lfo2G).connect(g.gain); lfo2.start();
  s.connect(bp).connect(g); s.start();
}

// 16-step combat loop: kick/tom pattern, minor-pentatonic bass ostinato.
const KICK = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0];
const TOM = [0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1];
const BASS = [0, 0, 3, 0, 5, 0, 3, 2, 0, 0, 3, 0, 7, 5, 3, 2]; // semitones above E1
function combatBeat(t: number, i: number) {
  const s = i % 16, bar = Math.floor(i / 16);
  const out = combatBus;
  if (KICK[s]) { osc('sine', 120, 40, t, { d: 0.18, peak: 0.7 }, out); }
  if (TOM[s]) { osc('triangle', 180, 90, t, { d: 0.14, peak: 0.35 }, out); noise(t, { d: 0.06, peak: 0.2 }, { type: 'bandpass', f: 900 }, out); }
  if (s % 2 === 1) noise(t, { d: 0.03, peak: 0.08 }, { type: 'highpass', f: 7000 }, out);
  const bf = 41.2 * Math.pow(2, (BASS[s] + (bar % 4 === 3 ? 3 : 0)) / 12);
  osc('sawtooth', bf * 2, null, t, { d: 0.16, peak: 0.12 }, out);
  if (s === 0 && bar % 2 === 1) { // dissonant stab
    osc('sawtooth', 329.6, null, t, { a: 0.01, d: 0.6, peak: 0.05 }, out);
    osc('sawtooth', 349.2, null, t, { a: 0.01, d: 0.6, peak: 0.05 }, out);
  }
}
