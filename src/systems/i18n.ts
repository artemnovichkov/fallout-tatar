import { bus } from './events';

type Dict = Record<string, string>;
// All src/locales/<lang>/*.json files are merged; each module owns its own file.
const files = import.meta.glob<Dict>('../locales/*/*.json', { eager: true, import: 'default' });
const dicts: Record<'ru' | 'tt', Dict> = { ru: {}, tt: {} };
for (const [path, d] of Object.entries(files)) {
  const lang = path.split('/').at(-2) as 'ru' | 'tt';
  if (dicts[lang]) Object.assign(dicts[lang], d);
}
let lang: 'ru' | 'tt' = (() => {
  try { return (localStorage.getItem('lang') as 'ru' | 'tt') || 'ru'; } catch { return 'ru'; }
})();

export const getLang = () => lang;
export function setLang(l: 'ru' | 'tt') {
  lang = l;
  try { localStorage.setItem('lang', l); } catch { /* ignore */ }
  bus.emit('langChanged', l);
}

// t('key', {name: 'Равиль'}) — {name} placeholders. Falls back to ru, then key.
export function t(k: string, vars?: Record<string, string | number>): string {
  let s = dicts[lang][k] ?? dicts.ru[k] ?? k;
  if (vars) for (const [n, v] of Object.entries(vars)) s = s.split(`{${n}}`).join(String(v));
  return s;
}
