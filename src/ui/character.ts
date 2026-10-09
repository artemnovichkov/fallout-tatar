// Character screen: S.P.E.C.I.A.L., derived stats, skills with level-up point distribution, perks.
import type { WorldScene } from '../scenes/WorldScene';
import type { SkillId } from '../systems/types';
import { el } from './dom';
import { bus } from '../systems/events';
import { game, changed } from '../systems/state';
import { t } from '../systems/i18n';
import { SPECIAL_KEYS, SKILL_IDS, sequenceFor, critChanceFor } from '../systems/stats';
import { carryCapacity } from '../systems/inventory';
import { nextLevelXp, raiseSkill, lowerSkill } from '../systems/leveling';
import { openWindow, header, btn } from './inventory';
import { textureUrl } from './icons';

export function openCharacter() {
  const p = game.player;
  let info = 'cs.sp.S';
  // Points spent in this session can be refunded with "−"; Cancel reverts them.
  const spent: Partial<Record<SkillId, number>> = {};
  const startSkills = { ...p.skills };
  const startPoints = game.skillPoints ?? 0;
  let committed = false;

  openWindow('inv-char', (root, close) => {
    const sel = (k: string) => () => { info = k; changed(); };
    const special = el('div', { class: 'cs-box' }, [
      el('div', { class: 'inv-colhead' }, [t('cs.special')]),
      ...SPECIAL_KEYS.map(k => el('div', { class: `cs-row click${info === `cs.sp.${k}` ? ' sel' : ''}`, onclick: sel(`cs.sp.${k}`) }, [
        el('b', { class: 'cs-letter' }, [k]), el('span', {}, [t(`cs.sp.${k}`)]), el('b', { class: 'cs-val' }, [String(p.special[k])]),
      ])),
    ]);
    const derivedRows: [string, string][] = [
      ['cs.d.hp', `${p.hp}/${p.maxHp}`],
      ['cs.d.ap', String(p.maxAp)],
      ['cs.d.ac', String(p.ac)],
      ['cs.d.dr', `${p.dr ?? 0}%`],
      ['cs.d.carry', String(carryCapacity(p))],
      ['cs.d.seq', String(sequenceFor(p.special))],
      ['cs.d.crit', `${critChanceFor(p.special)}%`],
      ['cs.d.rads', String(game.rads)],
    ];
    const derived = el('div', { class: 'cs-box' }, [
      el('div', { class: 'inv-colhead' }, [t('cs.derived')]),
      ...derivedRows.map(([k, v]) => el('div', { class: `cs-row click${info === k ? ' sel' : ''}`, onclick: sel(k) }, [el('span', {}, [t(k)]), el('b', { class: 'cs-val' }, [v])])),
    ]);
    const pts = game.skillPoints ?? 0;
    const skills = el('div', { class: 'cs-box' }, [
      el('div', { class: 'inv-colhead' }, [t('cs.skills'), pts ? el('span', { class: 'cs-pts' }, [t('cs.points', { n: pts })]) : null]),
      ...SKILL_IDS.map(id => el('div', { class: `cs-row click${info === `cs.sk.${id}` ? ' sel' : ''}`, onclick: sel(`cs.sk.${id}`) }, [
        el('span', {}, [t(`cs.sk.${id}`)]),
        el('b', { class: 'cs-val' }, [`${p.skills[id]}%`]),
        pts || spent[id] ? el('span', { class: 'cs-pm' }, [
          btn('−', () => { if (spent[id] && lowerSkill(id)) { spent[id]!--; changed(); } }, { disabled: !spent[id] }),
          btn('+', () => { if (raiseSkill(id)) { spent[id] = (spent[id] ?? 0) + 1; changed(); } }, { disabled: !pts }),
        ]) : null,
      ])),
    ]);
    const perks = game.perks ?? [];
    const right = el('div', { class: 'cs-side' }, [
      el('div', { class: 'cs-box' }, [
        el('div', { class: 'inv-colhead' }, [t('cs.perks')]),
        ...(perks.length ? perks.map(k => el('div', { class: 'cs-row' }, [t(`perk.${k}`)])) : [el('div', { class: 'inv-emptyrow' }, [t('cs.noPerks')])]),
      ]),
      el('div', { class: 'cs-info' }, [el('h3', {}, [t(info)]), el('p', {}, [t(`${info}.d`)])]),
    ]);
    const portrait = textureUrl(p.portrait ?? 'portrait_ravil');
    const next = nextLevelXp();
    root.append(
      ...header(t('cs.title'), close),
      el('div', { class: 'cs-top' }, [
        portrait ? el('img', { class: 'cs-portrait', src: portrait, alt: '' }) : null,
        el('div', {}, [
          el('div', { class: 'cs-name' }, [t('char.ravil')]),
          el('div', {}, [t('cs.level', { n: game.level })]),
          el('div', {}, [t('cs.xp', { n: game.xp, next })]),
          el('div', { class: 'cs-xpbar' }, [el('span', { style: `width:${Math.min(100, (game.xp / next) * 100)}%` })]),
          pts ? el('div', { class: 'cs-pts' }, [t('cs.levelUpHint')]) : null,
        ]),
      ]),
      el('div', { class: 'cs-grid' }, [special, skills, el('div', { class: 'cs-mid' }, [derived]), right]),
      el('div', { class: 'inv-foot' }, [
        btn(t('cs.done'), () => { committed = true; close(); }, { cls: 'primary' }),
        Object.values(spent).some(Boolean) ? btn(t('cs.cancel'), close) : null,
      ].filter(Boolean) as HTMLElement[]),
    );
  }, () => {
    if (committed) return;
    if (Object.values(spent).some(Boolean)) {
      Object.assign(p.skills, startSkills);
      game.skillPoints = startPoints;
      changed();
    }
  });
}

let mounted = false;
export function mountCharacter(_world: WorldScene) {
  if (mounted) return;
  mounted = true;
  bus.on('openCharacter', openCharacter);
}
