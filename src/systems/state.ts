import type { Actor, GameState } from './types';
import { baseSkills, maxHpFor, maxApFor, acFor } from './stats';
import { getLang } from './i18n';
import { bus } from './events';

const SAVE_KEY = 'fallout-tatar-save';

export function makeRavil(): Actor {
  const special = { S: 5, P: 6, E: 5, C: 6, I: 7, A: 6, L: 5 };
  return {
    id: 'player',
    nameKey: 'char.ravil',
    sprite: 'ravil',
    pos: { q: 0, r: 0 },
    facing: 2,
    hp: maxHpFor(special),
    maxHp: maxHpFor(special),
    ap: maxApFor(special),
    maxAp: maxApFor(special),
    ac: acFor(special),
    special,
    skills: baseSkills(special),
    inventory: [
      { id: 'knife', count: 1 },
      { id: 'pistol', count: 1, loaded: 6 },
      { id: 'ammo9', count: 18 },
      { id: 'stimpak', count: 2 },
      { id: 'echpochmak', count: 3 },
    ],
    weapon: 'pistol',
    hostile: false,
    dead: false,
    portrait: 'portrait_ravil',
  };
}

export function newGame(): GameState {
  return {
    version: 1,
    lang: getLang(),
    player: makeRavil(),
    level: 1,
    xp: 0,
    rads: 0,
    caps: 50,
    flags: {},
    quests: {},
    npcs: {},
    containers: {},
    log: [],
  };
}

// Global mutable state. Systems mutate `game` then call `changed()`.
export let game: GameState = newGame();
export const setGame = (g: GameState) => { game = g; };
export const changed = () => bus.emit('stateChanged');

export function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(game)); return true; } catch { return false; }
}
export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
}
export function load(): boolean {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const g = JSON.parse(raw) as GameState;
    if (g.version !== 1) return false;
    game = g;
    return true;
  } catch { return false; }
}

export function log(msg: string) {
  game.log.push(msg);
  if (game.log.length > 100) game.log.shift();
  bus.emit('log', msg);
}
