import { useEffect, useRef, useState } from 'react';

/** How long the pointer rests before the bubble shows: a pass over a row of icons shows nothing. */
const DELAY_MS = 350;
const GAP = 8;

/**
 * Every hint of the studio in one glass bubble, never the system's grey box:
 * anything with `data-tip` (or a `title`, taken over on the first hover so
 * the system's own box never shows) gets it under the pointer or the
 * keyboard focus. Drawn fixed above the page, so no card clips it, and moved
 * inside the window when the element is near an edge.
 */
export function Tooltips() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number; below: boolean } | null>(null);
  const bubble = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let current: Element | null = null;
    const hide = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      current = null;
      setTip(null);
    };
    const take = (target: EventTarget | null) => {
      // A frame's title names it for screen readers: never taken.
      const el = target instanceof Element ? target.closest('[data-tip], [title]:not(iframe)') : null;
      if (!el || el === current) return;
      // A title becomes a data-tip: the system box would show beside ours.
      const title = el.getAttribute('title');
      if (title) {
        el.setAttribute('data-tip', title);
        el.removeAttribute('title');
        if (!el.hasAttribute('aria-label') && !el.textContent?.trim()) el.setAttribute('aria-label', title);
      }
      const text = el.getAttribute('data-tip');
      if (!text) return;
      hide();
      current = el;
      timer = setTimeout(() => {
        const r = el.getBoundingClientRect();
        const below = r.top < 48;
        setTip({ text, x: r.left + r.width / 2, y: below ? r.bottom + GAP : r.top - GAP, below });
      }, DELAY_MS);
    };
    const over = (e: PointerEvent) => take(e.target);
    const out = (e: PointerEvent) => {
      if (current && !(e.relatedTarget instanceof Node && current.contains(e.relatedTarget))) hide();
    };
    const focus = (e: FocusEvent) => { if (e.target instanceof Element && e.target.matches(':focus-visible')) take(e.target); };
    document.addEventListener('pointerover', over);
    document.addEventListener('pointerout', out);
    document.addEventListener('focusin', focus);
    document.addEventListener('focusout', hide);
    document.addEventListener('pointerdown', hide, true);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('blur', hide);
    return () => {
      hide();
      document.removeEventListener('pointerover', over);
      document.removeEventListener('pointerout', out);
      document.removeEventListener('focusin', focus);
      document.removeEventListener('focusout', hide);
      document.removeEventListener('pointerdown', hide, true);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('blur', hide);
    };
  }, []);

  // Kept inside the window: measured once drawn, then shifted.
  useEffect(() => {
    const el = bubble.current;
    if (!el || !tip) return;
    const r = el.getBoundingClientRect();
    const shift = Math.min(0, window.innerWidth - GAP - r.right) + Math.max(0, GAP - r.left);
    if (shift) el.style.setProperty('--shift', `${shift}px`);
  }, [tip]);

  if (!tip) return null;
  return (
    <div key={`${tip.text}@${tip.x},${tip.y}`} ref={bubble} className={`tooltip${tip.below ? ' below' : ''}`} role="tooltip" style={{ left: tip.x, top: tip.y }}>
      {tip.text}
    </div>
  );
}
