/**
 * The effects she turned on or off (doc 145 §10.25), beside what each effect
 * already had as a setting of its own. Stored sparse: an effect she never
 * touched is ABSENT, so a site from before reads as `{}` and keeps what it had.
 *
 * - `state`: an effect turned on, or turned off, for the whole site.
 * - `only`: the creations an effect plays on when it is not on for the whole site.
 *
 * The five effects of before keep their own settings (the catalogue's layout,
 * the parallax, the loupe live in `viewer`; a living scene is chosen scene by
 * scene): their switch in the catalogue writes THOSE, so there is one truth.
 */
export interface EffectsSettings {
  state?: Record<string, 'on' | 'off'>;
  only?: Record<string, string[]>;
}

const ID = /^[a-z][a-z0-9-]{0,39}$/;
const ONLY_MAX = 500;

/**
 * The effects' settings as read from site.json. What is not a known shape is dropped, never guessed:
 * a state other than on or off, an id that is not one, an empty list. Nothing she never set is added.
 */
export function normalizeEffects(raw: unknown): EffectsSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: EffectsSettings = {};
  if (r.state && typeof r.state === 'object') {
    const state: Record<string, 'on' | 'off'> = {};
    for (const [k, v] of Object.entries(r.state as Record<string, unknown>)) if (ID.test(k) && (v === 'on' || v === 'off')) state[k] = v;
    if (Object.keys(state).length) out.state = state;
  }
  if (r.only && typeof r.only === 'object') {
    const only: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(r.only as Record<string, unknown>)) {
      if (!ID.test(k) || !Array.isArray(v)) continue;
      const ids = [...new Set(v.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 120))].slice(0, ONLY_MAX);
      if (ids.length) only[k] = ids;
    }
    if (Object.keys(only).length) out.only = only;
  }
  return out;
}

/** An effect's state set for the whole site; `null` forgets it (back to its starting state). Sparse. */
export function withEffectState(effects: EffectsSettings, id: string, to: 'on' | 'off' | null): EffectsSettings {
  const state = { ...(effects.state ?? {}) };
  if (to === null) delete state[id]; else state[id] = to;
  const next: EffectsSettings = { ...effects };
  if (Object.keys(state).length) next.state = state; else delete next.state;
  return next;
}

/** An effect put on one creation, or taken off it. Sparse: an empty list leaves. */
export function withEffectOn(effects: EffectsSettings, id: string, pieceId: string, on: boolean): EffectsSettings {
  const before = effects.only?.[id] ?? [];
  const ids = on ? [...new Set([...before, pieceId])] : before.filter((x) => x !== pieceId);
  const only = { ...(effects.only ?? {}) };
  if (ids.length) only[id] = ids; else delete only[id];
  const next: EffectsSettings = { ...effects };
  if (Object.keys(only).length) next.only = only; else delete next.only;
  return next;
}
