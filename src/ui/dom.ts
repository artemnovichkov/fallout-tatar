type Child = Node | string | null | undefined | false;
type Attrs = Record<string, string | number | boolean | ((e: any) => void) | undefined>;

// Minimal hyperscript helper.
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, children: Child[] = []): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'class') e.className = String(v);
    else if (k === 'html') e.innerHTML = String(v);
    else e.setAttribute(k, String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) e.append(c);
  return e;
}

// Opens a modal window inside #overlay. Returns close fn. Only one modal at a time.
export function modal(content: HTMLElement, onClose?: () => void): () => void {
  closeModal();
  const back = el('div', { class: 'modal-back' }, [content]);
  back.id = 'modal';
  document.getElementById('overlay')!.appendChild(back);
  const close = () => { back.remove(); onClose?.(); document.removeEventListener('keydown', esc); };
  const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', esc);
  (back as any)._close = close;
  return close;
}
export function closeModal() { const m = document.getElementById('modal') as any; m?._close?.(); }
export const modalOpen = () => !!document.getElementById('modal');
