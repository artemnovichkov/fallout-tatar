// Extracts Phaser texture frames into dataURLs for HTML UI. Works for loaded sheets and generated placeholders.
import type Phaser from 'phaser';
import { ICONS, ICON_SIZE } from '../systems/assets';

let tm: Phaser.Textures.TextureManager | null = null;
const cache = new Map<string, string>();

export function setTextureManager(m: Phaser.Textures.TextureManager) {
  if (tm !== m) cache.clear();
  tm = m;
}

function frameToUrl(texKey: string, frame: string | number | undefined, size?: number): string {
  if (!tm || !tm.exists(texKey)) return '';
  try {
    const fr = tm.getFrame(texKey, frame as any);
    if (!fr) return '';
    const src = fr.source.image as CanvasImageSource;
    const c = document.createElement('canvas');
    c.width = size ?? fr.cutWidth;
    c.height = size ?? fr.cutHeight;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, fr.cutX, fr.cutY, fr.cutWidth, fr.cutHeight, 0, 0, c.width, c.height);
    return c.toDataURL();
  } catch {
    return '';
  }
}

// iconUrl('pistol') -> data URL of the 32x32 frame from texture 'icons'.
export function iconUrl(iconKey: string): string {
  const k = `icon:${iconKey}`;
  const hit = cache.get(k);
  if (hit) return hit;
  let idx = (ICONS as readonly string[]).indexOf(iconKey);
  if (idx < 0) idx = (ICONS as readonly string[]).indexOf('junk');
  const url = frameToUrl('icons', idx, ICON_SIZE);
  if (url) cache.set(k, url);
  return url;
}

// Whole-texture image (portraits etc).
export function textureUrl(texKey: string): string {
  const k = `tex:${texKey}`;
  const hit = cache.get(k);
  if (hit) return hit;
  const url = frameToUrl(texKey, undefined);
  if (url) cache.set(k, url);
  return url;
}
