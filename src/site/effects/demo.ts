/**
 * An effect's demonstration as a whole small page (doc 145 §10.25): the
 * effect's own markup (demo.html), drawn by its own CSS and played by its own
 * script, exactly the code the export writes into the site. Around it, only
 * what the page gives an effect: a few of the site's base rules, the `api`,
 * and a pointer drawn on the card for the effects that follow one.
 *
 * The page goes into a sandboxed frame of the catalogue's card; her photos
 * come in as small copies, her colours as the site's own variables.
 */
import type { EffectSheet } from './contract';

/** The site's own rules a demonstration stands on: the catalogue's tile, a creation opened large, a scene's room, a page. */
const BASE_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden}
body{background:var(--paper);color:var(--ink);font:300 13px/1.4 Futura,"Century Gothic",system-ui,sans-serif;padding:16px}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
.page{position:absolute;inset:0;overflow-y:auto;padding:16px;background:var(--paper);scrollbar-width:none}
.page h1{font-size:42px;font-weight:400;letter-spacing:-.035em;line-height:.9;margin-bottom:18px}
.page p{font-size:15px;line-height:1.5;margin-bottom:.8em;max-width:38em}
.cols{display:grid;grid-template-columns:repeat(12,1fr);gap:12px}
.gallery{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.gallery figure{position:relative;margin:0;cursor:pointer}
.gallery .ph{position:relative;aspect-ratio:4/5;overflow:hidden}
.gallery .ph img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;transition:transform .7s var(--ease),opacity .5s ease}
.viewer{position:absolute;inset:0;display:grid;grid-template-rows:minmax(0,1fr);padding:16px;background:var(--paper)}
.viewer>div:first-child{display:grid;grid-template-rows:minmax(0,1fr) auto;min-height:0}
.viewer .v-main{position:relative;min-height:0}
.viewer .v-main img{display:block;width:100%;height:100%;max-height:100%;object-fit:contain}
#stage{position:absolute;inset:0;overflow:hidden}
.cell{position:absolute;inset:0}
.room{position:absolute;inset:0;overflow:hidden}
.room img,.room video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 70%}
.steps{display:none}
.dm-dot{position:fixed;z-index:99;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;border:2px solid var(--accent);background:color-mix(in srgb,var(--paper) 55%,transparent);box-shadow:0 2px 8px rgb(0 0 0 / .25);pointer-events:none;opacity:0}
.dm-dot.on{opacity:1}
`;

/** What stands in for a photo she has not got: a plain tile in her own colours, never a stock picture. */
function blank(ink: string, paper: string, n: number): string {
  const mix = 10 + (n % 3) * 8;
  const h = [5, 4, 6, 5, 4, 5][n % 6]!;
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 ${h}"><rect width="4" height="${h}" fill="${paper}"/><rect width="4" height="${h}" fill="${ink}" opacity="${mix / 100}"/></svg>`)}`;
}

const hex = (c: string, fallback: string) => (/^#[0-9a-fA-F]{6}$/.test(c) ? c : fallback);

/**
 * The demonstration's page. `photos`: small copies of her creations' photos
 * (data URLs), as many as she has; the demo takes them in turn.
 */
export function demoDocument(effect: Pick<EffectSheet, 'css' | 'js' | 'demo'>, photos: readonly string[], colours: { ink: string; paper: string; accent: string }): string {
  const ink = hex(colours.ink, '#2B2926'), paper = hex(colours.paper, '#EEECE7'), accent = hex(colours.accent, '#5F5A53');
  // Only an image address made here goes into the markup: a data URL of a picture, quotes and angle brackets out.
  const safe = photos.filter((p) => /^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(p));
  const photo = (n: number) => (safe.length ? safe[n % safe.length]! : blank(ink, paper, n));
  const markup = effect.demo.replace(/__P(\d)__/g, (_, n: string) => photo(Number(n) - 1));
  return `<!doctype html><html><head><meta charset="utf-8"><style>
:root{--paper:${paper};--ink:${ink};--ink-soft:color-mix(in srgb,${ink} 72%,${paper});--line:color-mix(in srgb,${ink} 18%,transparent);--accent:${accent};--ease:cubic-bezier(.65,0,.2,1);--dur:750ms;--pad:16px}
${BASE_CSS}
${effect.css}
</style></head><body>
${markup}
<script>
(() => {
  const EFFECTS = [];
  const effect = (id, make) => EFFECTS.push([id, make]);
${effect.js}
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const api = {
    D: window.DEMO_D || { rows: [], creations: [] }, T: { generated: '' }, esc, src: (img) => img.l, reduced, small: false, hovers: true,
    stage: document.getElementById('stage') || document.body, current: () => document.querySelector('.cell'), on: () => true, listed: () => true,
  };
  const fx = EFFECTS.map(([, make]) => make(api) || {})[0] || {};
  // The pointer drawn on the card: where it goes, the effect receives a real pointer event.
  const dot = document.createElement('div'); dot.className = 'dm-dot'; document.body.appendChild(dot);
  const point = (el, x, y, type) => {
    dot.classList.add('on'); dot.style.left = x + 'px'; dot.style.top = y + 'px';
    el.dispatchEvent(new PointerEvent(type || 'pointermove', { bubbles: true, clientX: x, clientY: y, pointerType: 'mouse' }));
  };
  if (window.play) window.play(fx, { point, reduced, api });
})();
</script></body></html>`;
}
