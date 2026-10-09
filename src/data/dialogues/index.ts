import type { DialogueDef } from '../../systems/dialogue';
import { elder } from './elder';
import { badri } from './badri';
import { raider } from './raider';
import { trader } from './trader';
import { guard } from './guard';
import { ghoul } from './ghoul';

import { VAULT_DIALOGUES } from './vault';
import { KAZAN2_DIALOGUES } from './kazan2';

export const DIALOGUES: Record<string, DialogueDef> = { elder, badri, raider, trader, guard, ghoul, ...VAULT_DIALOGUES, ...KAZAN2_DIALOGUES };
