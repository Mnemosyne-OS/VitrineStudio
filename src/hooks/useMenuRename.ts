import { useEffect, type RefObject } from 'react';
import { MENU_ORDERED, MENU_RENAMED, PIECES_ORDERED } from '../site/preview';
import { normalizePieceOrder } from '../model/showcase';
import { MENU_KEYS, normalizeMenuOrder, type MenuChange, type MenuKey } from '../site/buildSite';

/**
 * A menu entry renamed, or the menu reordered, in a preview (site/preview.ts):
 * taken from that frame only, known entries only, then handed on to be saved.
 */
export function useMenuRename(frame: RefObject<HTMLIFrameElement | null>, onChange: ((change: MenuChange) => void) | undefined): void {
  useEffect(() => {
    if (!onChange) return;
    const take = (e: MessageEvent) => {
      if (!frame.current || e.source !== frame.current.contentWindow) return;
      const m = e.data as { type?: unknown; key?: unknown; name?: unknown; order?: unknown } | null;
      if (m?.type === PIECES_ORDERED) {
        const pieces = normalizePieceOrder(m.order);
        if (pieces.length) onChange({ pieces });
        return;
      }
      if (m?.type === MENU_ORDERED) {
        const order = normalizeMenuOrder(m.order);
        if (order.length) onChange({ order });
        return;
      }
      if (!m || m.type !== MENU_RENAMED || typeof m.name !== 'string' || !MENU_KEYS.includes(m.key as MenuKey)) return;
      const name = m.name.replace(/\s+/g, ' ').trim().slice(0, 40);
      if (name) onChange({ key: m.key as MenuKey, name });
    };
    window.addEventListener('message', take);
    return () => window.removeEventListener('message', take);
  }, [frame, onChange]);
}
