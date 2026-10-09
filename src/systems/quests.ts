// Quest journal: game.quests[id] = { stage, done }. Stage -1 = not started.
import { QUESTS } from '../data/quests';
import { game, log } from './state';
import { t } from './i18n';
import { hasItem } from './inventory';

export const questStage = (id: string): number => game.quests[id]?.stage ?? -1;
export const questDone = (id: string): boolean => !!game.quests[id]?.done;
export const questActive = (id: string): boolean => questStage(id) >= 0 && !questDone(id);
const qname = (id: string) => t(QUESTS[id]?.nameKey ?? id);

export function setStage(id: string, stage: number) {
  const q = game.quests[id];
  if (q?.done) return;
  if (q && q.stage >= stage) return; // stages only move forward
  game.quests[id] = { id, stage, done: false };
  log(t(q ? 'quest.log.update' : 'quest.log.new', { name: qname(id) }));
}

export function completeQuest(id: string) {
  const q = game.quests[id];
  if (q?.done) return;
  game.quests[id] = { id, stage: q?.stage ?? 0, done: true };
  log(t('quest.log.done', { name: qname(id) }));
}

export function questText(id: string): string {
  const q = game.quests[id];
  if (!q) return '';
  if (q.done) {
    const m = game.flags[`${id}_method`];
    const k = `quest.${id}.done.${m}`;
    return m && t(k) !== k ? t(k) : t(`quest.${id}.done`);
  }
  return t(`quest.${id}.s${q.stage}`);
}

export interface JournalEntry { id: string; name: string; text: string; done: boolean }
export function journal(): JournalEntry[] {
  return Object.values(game.quests)
    .sort((a, b) => Number(a.done) - Number(b.done))
    .map(q => ({ id: q.id, name: qname(q.id), text: questText(q.id), done: q.done }));
}

// Item-driven stage changes (e.g. kazan picked up from the chest). Returns true if anything changed.
export function checkQuestTriggers(): boolean {
  let ch = false;
  const p = game.player;
  if (!questDone('kazan') && questStage('kazan') < 30 && hasItem(p, 'kazan')) {
    if (!game.flags.kazan_method) game.flags.kazan_method = game.flags.badri_dead ? 'fight' : 'steal';
    setStage('kazan', 30); ch = true;
  }
  if (questStage('holotape') === 10 && hasItem(p, 'holotape')) { setStage('holotape', 20); ch = true; }
  for (const q of Object.values(QUESTS)) if (q.trigger?.(setStage)) ch = true;
  return ch;
}
