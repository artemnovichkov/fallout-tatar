// Tiny typed event bus to decouple systems/UI.
import type { Actor } from './types';
import type { Hex } from './hex';

export interface GameEvents {
  log: string;                                  // already-translated message
  stateChanged: void;                           // HUD should refresh
  combatStart: void;
  combatEnd: void;
  turnStart: Actor;
  talk: { npc: Actor };                         // open dialogue
  openInventory: void;
  openCharacter: void;
  openPipbuy: void;
  openBarter: { npc: Actor };
  openContainer: { id: string };
  actorDied: Actor;
  hexClicked: { hex: Hex; button: number };
  modeChanged: 'move' | 'attack' | 'use' | 'look';
  langChanged: 'ru' | 'tt';
}

type Handler<T> = (payload: T) => void;

class Bus {
  private map = new Map<keyof GameEvents, Set<Handler<any>>>();
  on<K extends keyof GameEvents>(k: K, h: Handler<GameEvents[K]>) {
    if (!this.map.has(k)) this.map.set(k, new Set());
    this.map.get(k)!.add(h);
    return () => this.map.get(k)!.delete(h);
  }
  emit<K extends keyof GameEvents>(k: K, ...p: GameEvents[K] extends void ? [] : [GameEvents[K]]) {
    this.map.get(k)?.forEach(h => h(p[0]));
  }
}

export const bus = new Bus();
