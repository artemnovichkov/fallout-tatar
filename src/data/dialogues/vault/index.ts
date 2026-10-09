import type { DialogueDef } from '../../../systems/dialogue';
import { v_robot } from './robot';
import { v_overseer } from './overseer';
import { v_alsu } from './alsu';
import { v_security } from './security';
import { v_cook, v_timur, v_zuhra } from './dwellers';

export const VAULT_DIALOGUES: Record<string, DialogueDef> = { v_robot, v_overseer, v_alsu, v_security, v_cook, v_timur, v_zuhra };
