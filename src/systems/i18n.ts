import ru from '../locales/ru.json';
import tt from '../locales/tt.json';
import { bus } from './events';

type Dict = Record<string, string>;
const dicts: Record<'ru' | 'tt', Dict> = { ru: ru as Dict, tt: tt as Dict };
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
