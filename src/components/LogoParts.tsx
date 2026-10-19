import { useEffect, useMemo, useState } from 'react';
import { Layers, MousePointerClick } from 'lucide-react';
import { useI18n } from '../i18n';
import { countParts, defaultPart, PART_ANIMS, PART_DELAY_MAX, type PartAnim, type PartSetting } from '../site/logoParts';

/**
 * Each element of a vector logo, animated on its own. The elements are
 * touched on the PREVIEW itself (the logo there is magnified and in the
 * site's colours, so even a small detail can be hit), then given a movement
 * and a start time. A touch takes one element; Shift adds more. `stage` is the preview's stage, remounted at each replay.
 */
export function LogoParts({ svg, parts, stage, onPick, onChange }: {
  svg: string;
  parts: (PartSetting | null)[] | undefined;
  stage: HTMLElement | null;
  /** An element was touched: the choice shows again on the preview. */
  onPick: () => void;
  onChange: (next: PartSetting[]) => void;
}) {
  const { t, tc } = useI18n();
  const count = useMemo(() => countParts(svg), [svg]);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [draft, setDraft] = useState<number | null>(null);
  useEffect(() => { setSel(new Set()); }, [svg]);

  // A touch on an element of the preview takes it, or gives it back.
  useEffect(() => {
    if (!stage) return;
    const onClick = (e: Event) => {
      const g = (e.target as Element).closest('.lp');
      if (!g) return;
      const i = Array.from(stage.querySelectorAll('.lp')).indexOf(g);
      if (i < 0) return;
      const m = e as MouseEvent;
      onPick();
      // A touch takes this element alone (one effect per choice); Shift or Ctrl adds or removes it.
      if (m.shiftKey || m.ctrlKey || m.metaKey) setSel((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });
      else setSel((s) => (s.size === 1 && s.has(i) ? new Set() : new Set([i])));
    };
    stage.addEventListener('click', onClick);
    return () => stage.removeEventListener('click', onClick);
  }, [stage, onPick]);

  // The chosen elements stand out on the preview, the others step back.
  useEffect(() => {
    if (!stage) return;
    stage.classList.toggle('has-sel', sel.size > 0);
    stage.querySelectorAll('.lp').forEach((g, i) => g.classList.toggle('sel', sel.has(i)));
  }, [sel, stage, parts]);

  const all = (): PartSetting[] => Array.from({ length: count }, (_, i) => parts?.[i] ?? defaultPart(i));
  const chosen = [...sel].sort((a, b) => a - b);
  const current = all();
  const shared = <K extends keyof PartSetting>(k: K): PartSetting[K] | null => {
    const vals = new Set(chosen.map((i) => current[i]![k]));
    return vals.size === 1 ? [...vals][0]! : null;
  };
  const set = (patch: (i: number, k: number) => Partial<PartSetting>) => {
    const next = all();
    chosen.forEach((i, k) => { next[i] = { ...next[i]!, ...patch(i, k) }; });
    onChange(next);
  };

  const anim = shared('anim');
  const delay = shared('delay');
  const commitDelay = () => {
    if (draft === null) return;
    const d = draft;
    setDraft(null);
    if (d !== delay) set(() => ({ delay: d }));
  };

  return (
    <div className="logo-parts">
      <div className="row parts-head">
        <h3><Layers className="ico" aria-hidden />{t('parts.title')} · {count}</h3>
        <button onClick={() => setSel(new Set(Array.from({ length: count }, (_, i) => i)))}>{t('parts.all')}</button>
        <button onClick={() => setSel(new Set())} disabled={!sel.size}>{t('parts.clear')}</button>
        <span className="small muted">{sel.size ? tc('parts.selected', sel.size) : <><MousePointerClick className="ico" aria-hidden />{t('parts.pick')}</>}</span>
      </div>
      <div className="idea-row compact spaced">
        {PART_ANIMS.map((a: PartAnim) => (
          <button key={a} disabled={!sel.size} className={`chip-tile glass ${sel.size && anim === a ? 'chosen' : ''}`} onClick={() => set(() => ({ anim: a }))}>
            <strong>{t(`parts.anim.${a}`)}</strong>
          </button>
        ))}
      </div>
      <div className="idea-row compact spaced">
        <label className="chip-tile glass parts-delay">
          <span className="small">{t('parts.delay')}</span>
          {/* A draft while it moves; written once on release (pointer, key or leaving it), never at every step. */}
          <input type="range" min={0} max={PART_DELAY_MAX} step={0.1} disabled={!sel.size} value={draft ?? delay ?? 0}
            onChange={(e) => setDraft(Number(e.target.value))} onPointerUp={commitDelay} onKeyUp={commitDelay} onBlur={commitDelay} aria-label={t('parts.delay')} />
          <span className="small">{sel.size && (draft ?? delay) !== null ? `${(draft ?? delay)!.toFixed(1)} s` : '—'}</span>
        </label>
        <button className="chip-tile glass" disabled={sel.size < 2} onClick={() => set((_, k) => ({ delay: Math.min(PART_DELAY_MAX, Math.round(k * 2) / 10) }))}>
          <strong>{t('parts.cascade')}</strong>
        </button>
      </div>
    </div>
  );
}
