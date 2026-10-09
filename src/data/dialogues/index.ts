import type { DialogueDef } from '../../systems/dialogue';
import { elder } from './elder';
import { badri } from './badri';
import { raider } from './raider';
import { trader } from './trader';
import { guard } from './guard';
import { ghoul } from './ghoul';

export const DIALOGUES: Record<string, DialogueDef> = { elder, badri, raider, trader, guard, ghoul };
