/**
 * `#rrggbb` (or `#rgb` with `short`), the hash optional; the colour as the
 * swatch takes it, or null. While a code is being typed only six digits count:
 * the first three of any code are a valid short one (« 2b2 » of « 2b2926 »).
 */
export function parseHex(raw: string, short = false): string | null {
  const v = raw.trim().replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{6}$/.test(v)) return `#${v}`;
  if (short && /^[0-9a-f]{3}$/.test(v)) return `#${[...v].map((c) => c + c).join('')}`;
  return null;
}
