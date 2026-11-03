/**
 * The screen a visitor sees while the site loads (asked for on 02/11: a
 * spinning ring, a loading page) and its animation, chosen in the studio. One source for the page and for the studio's sample: the markup and
 * the CSS below are what both draw.
 *
 * The page writes the screen in the HTML itself (fillShell), so it is on the
 * first paint, before any script; the page's script lifts it once everything
 * is loaded, never before half a second (no flash) nor after eight (a picture
 * that never comes does not hold the site hostage).
 */

export const LOADER_STYLES = ['ring', 'dots', 'line', 'name'] as const;
export type LoaderStyle = (typeof LOADER_STYLES)[number];
export const LOADER_SPEEDS = ['slow', 'normal', 'fast'] as const;
export type LoaderSpeed = (typeof LOADER_SPEEDS)[number];

export interface Loader {
  style: LoaderStyle;
  /** Absent = normal. */
  speed?: Exclude<LoaderSpeed, 'normal'>;
}

/** The loading screen as read from site.json: an unknown style is no screen at all, never a guessed one. */
export function normalizeLoader(raw: unknown): Loader | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  if (!(LOADER_STYLES as readonly unknown[]).includes(r.style)) return undefined;
  return { style: r.style as LoaderStyle, ...(r.speed === 'slow' || r.speed === 'fast' ? { speed: r.speed } : {}) };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** The screen's markup: `name` is the workshop's, drawn by the `name` style. */
export function loaderMarkup(loader: Loader, name: string): string {
  const inner = loader.style === 'dots' ? '<i></i><i></i><i></i>' : loader.style === 'name' ? `<b>${esc(name)}</b>` : '<i></i>';
  return `<div class="loader l-${loader.style} l-${loader.speed ?? 'normal'}" aria-hidden="true">${inner}</div>`;
}

export const LOADER_CSS = `
.loader { position: fixed; inset: 0; z-index: 99; display: grid; place-items: center; background: var(--paper); color: var(--accent); transition: opacity .6s ease, visibility .6s; --k: 1; }
.loader.gone { opacity: 0; visibility: hidden; }
.loader.l-slow { --k: 1.8; } .loader.l-fast { --k: .55; }
.loader.l-ring i { width: 38px; height: 38px; border-radius: 50%; border: 2px solid color-mix(in srgb, currentColor 22%, transparent); border-top-color: currentColor; animation: loader-spin calc(1s * var(--k)) linear infinite; }
.loader.l-dots { grid-auto-flow: column; justify-content: center; gap: 10px; }
.loader.l-dots i { width: 9px; height: 9px; border-radius: 50%; background: currentColor; animation: loader-dot calc(1.2s * var(--k)) ease-in-out infinite; }
.loader.l-dots i:nth-child(2) { animation-delay: calc(.15s * var(--k)); } .loader.l-dots i:nth-child(3) { animation-delay: calc(.3s * var(--k)); }
.loader.l-line { place-items: start stretch; }
.loader.l-line i { height: 2px; width: 35%; background: currentColor; animation: loader-line calc(1.4s * var(--k)) cubic-bezier(.65, 0, .35, 1) infinite; }
.loader.l-name b { font-weight: 400; font-size: 15px; letter-spacing: .3em; text-transform: uppercase; color: var(--ink); animation: loader-breathe calc(1.8s * var(--k)) ease-in-out infinite; }
@keyframes loader-spin { to { transform: rotate(360deg); } }
@keyframes loader-dot { 0%, 80%, 100% { transform: scale(.5); opacity: .35; } 40% { transform: none; opacity: 1; } }
@keyframes loader-line { 0% { transform: translateX(-100%); } 100% { transform: translateX(290%); } }
@keyframes loader-breathe { 0%, 100% { opacity: .25; } 50% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .loader i, .loader b { animation-duration: calc(3s * var(--k)) !important; } }
`;
