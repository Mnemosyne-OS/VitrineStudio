import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../i18n';
import { translateText, translatorModels, type TranslatorModel } from '../data/host';
import type { Lang } from '../model/profiles';
import {
  editEntry, fieldText, fromField, lineCounts, proposeEntry, readAll, readEntry, roomLines, WORD_GROUPS,
  type HerWord, type LineState, type RoomLine, type SiteTranslation, type WordGroup,
} from '../model/translation';
import { compareJobs, runTranslations, type RunJob, type RunTally } from '../model/translationRun';
import { describeError, errorText } from './errors';
import './translationRoom.css';

const NAME: Record<Lang, string> = { fr: 'FR', en: 'EN', es: 'ES' };
const MODEL_KEY = 'vitrine_tr_model';
const COMPARE_MAX = 3;
/** Sentences compared at once: each costs one inference per model. */
const COMPARE_LINES = 8;

/** The models the host offers, asked at each opening of the room: a model installed meanwhile shows up. */
const loadModels = () => translatorModels().catch((err: unknown) => {
  // A host before 02/11 has no `translator.models`: the person's current model, unnamed.
  console.warn('[vitrine-studio] the host lists no translation models:', err);
  return { current: null, choices: [] as TranslatorModel[] };
});

const remembered = (): string | null => {
  try { return localStorage.getItem(MODEL_KEY); } catch (err) { console.warn('[vitrine-studio] model choice unreadable:', err); return null; }
};
const remember = (id: string | null) => {
  try { if (id) localStorage.setItem(MODEL_KEY, id); else localStorage.removeItem(MODEL_KEY); } catch (err) { console.warn('[vitrine-studio] model choice not kept:', err); }
};

/** The words a line shows: its HTML read as text. */
const plain = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const TODO: LineState[] = ['missing', 'stale'];

/**
 * The translation room (doc 145 §10.22): her site as a canvas of widgets, one
 * per part of it (menu, scenes, creations, About, blog, contact, pages, legal),
 * each line with its source, its translation, its state and the model that
 * wrote it. Translating runs sentence after sentence with a live count of the
 * inferences and a Stop; comparing asks 2 or 3 models the same sentences side
 * by side. Only lines she read go online (`withSecondLanguage`), as before.
 *
 * Its own HUD night, like every screen made after 27/10 (style-cartouche),
 * while the rest of the studio keeps the host's glass (§10.20). An editing
 * room does not close on a click anywhere: ✕ or Escape.
 */
export function TranslationRoom({ lang, main, translation, words, onChange, onClose }: {
  lang: Lang;
  main: Lang;
  translation: SiteTranslation;
  words: HerWord[];
  onChange: (update: (current: SiteTranslation | undefined) => SiteTranslation | undefined) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [models, setModels] = useState<{ current: TranslatorModel | null; choices: TranslatorModel[] } | null>(null);
  const [model, setModel] = useState<string | null>(remembered);
  const [mode, setMode] = useState<'check' | 'compare'>('check');
  const [tally, setTally] = useState<RunTally | null>(null);
  const [error, setError] = useState<{ key: string; raw?: string } | null>(null);
  const [focus, setFocus] = useState<WordGroup | null>(null);
  const stop = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    void loadModels().then((m) => {
      if (!alive.current) return;
      setModels(m);
      // A remembered model the host no longer offers falls back to the current one.
      setModel((cur) => (cur && m.choices.some((c) => c.id === cur) ? cur : null));
    });
    // Escape writes the field being typed in first, as the ✕ does by taking the focus: closing never loses her words.
    const key = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return;
      const el = document.activeElement;
      if (el instanceof HTMLElement) el.blur();
      onClose();
    };
    window.addEventListener('keydown', key);
    // Leaving the room stops a run after its sentence in flight.
    return () => { alive.current = false; stop.current = true; window.removeEventListener('keydown', key); };
  }, [onClose]);

  const lines = useMemo(() => roomLines(words, translation), [words, translation]);
  const byGroup = useMemo(() => {
    const out = new Map<WordGroup, RoomLine[]>();
    for (const l of lines) out.set(l.group, [...(out.get(l.group) ?? []), l]);
    return WORD_GROUPS.filter((g) => out.has(g)).map((g) => ({ group: g, lines: out.get(g)! }));
  }, [lines]);
  const all = lineCounts(lines);
  const labelOf = (id: string | null | undefined) => {
    if (!id) return t('room.model.current');
    return models?.choices.find((c) => c.id === id)?.label ?? id.slice(id.indexOf(':') + 1);
  };
  const choose = (id: string | null) => { setModel(id); remember(id); };

  /** Runs jobs through the translator; each answer handed to `put` as it comes. */
  const run = async (jobs: RunJob[], put: (from: string, to: string, by: string | null) => void) => {
    if (!jobs.length || tally) return;
    stop.current = false;
    setError(null);
    const out = await runTranslations(jobs, {
      translate: (text, m) => translateText(text, main, lang, m),
      // An answer that comes back after the room closed is still kept: it was paid for, and the change is a function of the site's file, not of this screen.
      put,
      tally: (next) => { if (alive.current) setTally(next); },
      stopped: () => stop.current,
    });
    if (!alive.current) return;
    if (out.error) { console.error('[vitrine-studio] a translation failed:', out.error); setError(describeError(out.error)); }
    setTally(null);
  };
  const lineOf = useMemo(() => new Map(lines.map((l) => [l.text, l])), [lines]);
  // A proposal for a stale line lets the old translation it showed go.
  const propose = (from: string, to: string, by: string | null) =>
    onChange((cur) => (cur ? proposeEntry(cur, from, to, by, lineOf.get(from)?.where ?? '', lineOf.get(from)?.old?.from) : cur));
  const translateLines = (ls: RoomLine[]) => void run(ls.filter((l) => TODO.includes(l.state)).map((l) => ({ from: l.text, model })), propose);

  const running = !!tally;
  const chosenModel = model ?? models?.current?.id ?? null;
  return createPortal(
    <div className="tr-room hud-root" role="dialog" aria-modal="true" aria-label={t('room.title')}>
      <header className="tr-bar hud">
        <div className="tr-bar-title">
          <span className="lab">{t('room.title')}</span>
          <span className="tr-pair">{NAME[main]} <span aria-hidden>→</span> {NAME[lang]}</span>
        </div>
        <div className="segmented tr-modes" role="tablist">
          <button role="tab" aria-selected={mode === 'check'} className={mode === 'check' ? 'chosen' : ''} onClick={() => setMode('check')}>{t('room.mode.check')}</button>
          <button role="tab" aria-selected={mode === 'compare'} className={mode === 'compare' ? 'chosen' : ''} onClick={() => setMode('compare')}>{t('room.mode.compare')}</button>
        </div>
        <Readout counts={all} />
        <RunReadout tally={tally} labelOf={labelOf} onStop={() => { stop.current = true; setTally((c) => (c ? { ...c, stopping: true } : c)); }} />
        <button className="tr-close" aria-label={t('room.close')} title={t('room.close')} onClick={onClose}>
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" /></svg>
        </button>
      </header>
      {error && <p className="tr-error" role="alert">{t('tr.failed', { error: errorText(error) })}</p>}

      {mode === 'check' && (
        <>
          <ModelPicker models={models} chosen={model} onChoose={choose} t={t} />
          <div className="tr-actions">
            <button className="primary" disabled={running || all.missing + all.stale === 0} onClick={() => translateLines(lines)}>
              {t('room.translateAll', { n: all.missing + all.stale })}
            </button>
            <span className="lab">{t('room.with', { model: labelOf(chosenModel) })}</span>
          </div>
          <div className="tr-canvas">
            {byGroup.map(({ group, lines: ls }, i) => (
              <Widget key={group} n={i + 1} group={group} lines={ls} running={running} labelOf={labelOf}
                wide={focus === group} onFocus={() => setFocus((f) => (f === group ? null : group))}
                onTranslate={() => translateLines(ls)}
                onReadAll={() => onChange((cur) => (cur ? readAll(cur, ls.map((l) => l.text)) : cur))}
                onEdit={(l, to) => onChange((cur) => (cur ? editEntry(cur, l.text, to, l.where, l.old?.from) : cur))}
                onRead={(l, ok) => onChange((cur) => (cur ? readEntry(cur, l.text, ok) : cur))}
                onTakeOld={(l) => l.old && onChange((cur) => (cur ? proposeEntry(cur, l.text, l.old!.entry.to, l.old!.entry.by ?? null, l.where, l.old!.from) : cur))} />
            ))}
          </div>
        </>
      )}
      {mode === 'compare' && (
        <Compare lines={lines} groups={byGroup.map((g) => g.group)} models={models} running={running} labelOf={labelOf}
          onRun={(froms, ms, put) => void run(compareJobs(froms, ms), put)}
          onPick={(from, to, by) => propose(from, to, by)} />
      )}
    </div>,
    document.body,
  );
}

/** The whole site's states, as one bar of light. */
function Readout({ counts }: { counts: ReturnType<typeof lineCounts> }) {
  const { t } = useI18n();
  const done = counts.read + counts.edited;
  const pc = counts.total ? Math.round((done / counts.total) * 100) : 0;
  return (
    <div className="tr-readout" title={t('room.readout', { read: done, total: counts.total })}>
      <span className="lab">{t('room.online')}</span>
      <span className="tr-num">{String(done).padStart(2, '0')}<small>/{counts.total}</small></span>
      <span className="tr-bars" aria-hidden>
        {(['read', 'edited', 'proposed', 'stale', 'missing'] as const).map((s) => (
          counts[s] ? <i key={s} className={`st-${s}`} style={{ flexGrow: counts[s] }} /> : null
        ))}
      </span>
      <span className="tr-pc">{pc}%</span>
    </div>
  );
}

/** What the run is doing: inferences made, failures, the model asked, and Stop. */
function RunReadout({ tally, labelOf, onStop }: { tally: RunTally | null; labelOf: (id: string | null) => string; onStop: () => void }) {
  const { t } = useI18n();
  if (!tally) return <div className="tr-run idle"><span className="lab">{t('room.run.idle')}</span></div>;
  return (
    <div className="tr-run live" aria-live="polite">
      <span className="lab">{t('room.run.calls')}</span>
      <span className="tr-num">{tally.done}<small>/{tally.total}</small></span>
      {tally.failed > 0 && <span className="tr-fail">{t('room.run.failed', { n: tally.failed })}</span>}
      {tally.tooLong > 0 && <span className="tr-fail">{t('room.run.tooLong', { n: tally.tooLong })}</span>}
      <span className="tr-run-model">{tally.stopping ? t('room.run.stopping') : tally.current !== undefined ? labelOf(tally.current) : ''}</span>
      <button className="tr-stop" disabled={tally.stopping} onClick={onStop}>
        <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden><rect x="2" y="2" width="8" height="8" fill="currentColor" /></svg>
        {t('room.run.stop')}
      </button>
    </div>
  );
}

/** The model tiles: one chosen (translate), or up to three (compare, `multi`). */
function ModelPicker({ models, chosen, onChoose, t, multi }: {
  models: { current: TranslatorModel | null; choices: TranslatorModel[] } | null;
  chosen: string | null | string[];
  onChoose: (id: string | null) => void;
  t: (k: string, v?: Record<string, string | number>) => string;
  multi?: boolean;
}) {
  if (!models) return <div className="tr-models"><span className="lab">{t('room.model.loading')}</span></div>;
  const isChosen = (id: string | null) => (Array.isArray(chosen) ? chosen.includes(id ?? '') : chosen === id);
  return (
    <div className="tr-models" role="group" aria-label={t('room.model.title')}>
      <span className="lab">{t('room.model.title')}</span>
      {!multi && (
        <button className={`chip-tile ${isChosen(null) ? 'chosen' : ''}`} aria-pressed={isChosen(null)} onClick={() => onChoose(null)}>
          <span>{t('room.model.current')}</span>
          {models.current && <small>{models.current.label}</small>}
        </button>
      )}
      {models.choices.map((c) => (
        <button key={c.id} className={`chip-tile ${isChosen(c.id) ? 'chosen' : ''}`} aria-pressed={isChosen(c.id)} onClick={() => onChoose(c.id)}>
          <span>{c.label}</span>
          <small className={c.free ? 'tr-free' : 'tr-paid'}>{c.free ? t('room.model.free') : t('room.model.paid')}</small>
        </button>
      ))}
      {models.choices.length === 0 && <span className="small tr-muted">{t('room.model.none')}</span>}
    </div>
  );
}

/** One part of the site: its lines, its progress ring, its bulk actions. */
function Widget({ n, group, lines, running, labelOf, wide, onFocus, onTranslate, onReadAll, onEdit, onRead, onTakeOld }: {
  n: number; group: WordGroup; lines: RoomLine[]; running: boolean; labelOf: (id: string | null | undefined) => string;
  wide: boolean; onFocus: () => void; onTranslate: () => void; onReadAll: () => void;
  onEdit: (l: RoomLine, to: string) => void; onRead: (l: RoomLine, ok: boolean) => void; onTakeOld: (l: RoomLine) => void;
}) {
  const { t } = useI18n();
  const c = lineCounts(lines);
  const done = c.read + c.edited;
  const r = 15, len = 2 * Math.PI * r;
  return (
    <section className={`tr-widget hud ${wide ? 'wide' : ''} ${done === c.total ? 'complete' : ''}`} aria-label={t(`room.group.${group}`)}>
      <header className="tr-w-head">
        <span className="tr-w-n">{String(n).padStart(2, '0')}</span>
        <h3 className="tr-w-title">{t(`room.group.${group}`)}</h3>
        <svg className="tr-ring" viewBox="0 0 36 36" width="36" height="36" role="img" aria-label={t('room.readout', { read: done, total: c.total })}>
          <circle cx="18" cy="18" r={r} className="tr-ring-track" />
          <circle cx="18" cy="18" r={r} className="tr-ring-done" strokeDasharray={`${(done / Math.max(1, c.total)) * len} ${len}`} />
          <text x="18" y="21" textAnchor="middle">{done}</text>
        </svg>
        <button className="tr-icon" title={t(wide ? 'room.narrow' : 'room.widen')} aria-label={t(wide ? 'room.narrow' : 'room.widen')} onClick={onFocus}>
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>{wide ? <path d="M6 2v4H2M10 14v-4h4" stroke="currentColor" fill="none" /> : <path d="M2 6V2h4M14 10v4h-4" stroke="currentColor" fill="none" />}</svg>
        </button>
      </header>
      <div className="tr-w-counts">
        {(['missing', 'stale', 'proposed', 'read', 'edited'] as const).map((s) => (
          <span key={s} className={`tr-chip st-${s} ${c[s] ? '' : 'zero'}`}>{t(`room.state.${s}`)} <b>{c[s]}</b></span>
        ))}
      </div>
      <div className="tr-w-actions">
        <button disabled={running || c.missing + c.stale === 0} onClick={onTranslate}>{t('room.translateHere', { n: c.missing + c.stale })}</button>
        <button disabled={running || c.proposed === 0} onClick={onReadAll}>{t('room.readAll', { n: c.proposed })}</button>
      </div>
      <ol className="tr-lines">
        {lines.map((l) => <Line key={l.text} line={l} labelOf={labelOf} onEdit={(to) => onEdit(l, to)} onRead={(ok) => onRead(l, ok)} onTakeOld={() => onTakeOld(l)} />)}
      </ol>
    </section>
  );
}

/** One line: its state, its model, « Relu », the source and the translation edited in place. */
function Line({ line, labelOf, onEdit, onRead, onTakeOld }: { line: RoomLine; labelOf: (id: string | null | undefined) => string; onEdit: (to: string) => void; onRead: (ok: boolean) => void; onTakeOld: () => void }) {
  const { t } = useI18n();
  const value = line.entry ? fieldText(line.text, line.entry.to) : '';
  const [draft, setDraft] = useState(value);
  // An answer landing on this line while she types in it never takes her words away.
  const typing = useRef(false);
  useEffect(() => { if (!typing.current) setDraft(value); }, [value]);
  // A line translated before models were named says no model rather than a guess.
  const by = line.entry?.ed ? t('room.by.her') : line.entry?.by ? labelOf(line.entry.by) : null;
  return (
    <li className={`tr-line st-${line.state}`}>
      <div className="tr-line-head">
        <span className={`tr-chip st-${line.state}`}>{t(`room.state.${line.state}`)}</span>
        {by && <span className="tr-by" title={t('room.by.title')}>{by}</span>}
        <label className="tr-check">
          <input type="checkbox" checked={!!line.entry?.ok} disabled={!value.trim()} onChange={(ev) => onRead(ev.target.checked)} />
          {t('tr.read')}
        </label>
      </div>
      <p className="tr-src">{plain(line.text)}</p>
      {line.old && (
        <div className="tr-old">
          <span className="lab">{t('room.old')}</span>
          <s>{plain(line.old.from)}</s>
          <span>{plain(line.old.entry.to)}</span>
          <button onClick={onTakeOld}>{t('room.takeOld')}</button>
        </div>
      )}
      <textarea rows={Math.min(8, Math.max(1, Math.ceil(line.text.length / 60)))} value={draft} spellCheck
        placeholder={t('room.empty')} aria-label={t('room.field', { text: plain(line.text).slice(0, 60) })}
        onChange={(ev) => { typing.current = true; setDraft(ev.target.value); }}
        onBlur={() => { typing.current = false; if (draft !== value) onEdit(fromField(line.text, draft)); }} />
    </li>
  );
}

/**
 * The same sentences by 2 or 3 models, side by side. Results stay on screen
 * only (never in site.json); a pick becomes the line's proposal, to be read
 * like any other.
 */
function Compare({ lines, groups, models, running, labelOf, onRun, onPick }: {
  lines: RoomLine[]; groups: WordGroup[];
  models: { current: TranslatorModel | null; choices: TranslatorModel[] } | null;
  running: boolean; labelOf: (id: string | null) => string;
  onRun: (froms: string[], models: string[], put: (from: string, to: string, by: string | null) => void) => void;
  onPick: (from: string, to: string, by: string) => void;
}) {
  const { t } = useI18n();
  const [chosen, setChosen] = useState<string[]>([]);
  const [group, setGroup] = useState<WordGroup | null>(null);
  const [results, setResults] = useState<Record<string, Record<string, string>>>({});
  const [picked, setPicked] = useState<Record<string, string>>({});
  const toggle = (id: string | null) => {
    if (!id) return;
    setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length < COMPARE_MAX ? [...c, id] : c));
  };
  // Sentences not yet read, of the part she chose (or all), the first few.
  const pool = lines.filter((l) => (!group || l.group === group) && (l.state === 'missing' || l.state === 'stale' || l.state === 'proposed'));
  const rows = pool.slice(0, COMPARE_LINES);
  const pick = (from: string, m: string) => {
    const to = results[from]?.[m];
    if (!to) return;
    setPicked((p) => ({ ...p, [from]: m }));
    onPick(from, to, m);
  };
  const shown = Object.keys(results).length ? lines.filter((l) => results[l.text]) : [];
  return (
    <div className="tr-compare">
      <ModelPicker models={models} chosen={chosen} multi onChoose={toggle} t={t} />
      <div className="tr-models" role="group" aria-label={t('room.compare.part')}>
        <span className="lab">{t('room.compare.part')}</span>
        <button className={`chip-tile ${!group ? 'chosen' : ''}`} aria-pressed={!group} onClick={() => setGroup(null)}>{t('room.compare.all')}</button>
        {groups.map((g) => (
          <button key={g} className={`chip-tile ${group === g ? 'chosen' : ''}`} aria-pressed={group === g} onClick={() => setGroup(g)}>{t(`room.group.${g}`)}</button>
        ))}
      </div>
      <div className="tr-actions">
        <button className="primary" disabled={running || chosen.length < 2 || rows.length === 0}
          onClick={() => { setResults({}); setPicked({}); onRun(rows.map((l) => l.text), chosen, (from, to, by) => setResults((r) => ({ ...r, [from]: { ...r[from], [by ?? '']: to } }))); }}>
          {t('room.compare.run', { lines: rows.length, models: chosen.length, calls: rows.length * chosen.length })}
        </button>
        <span className="lab">{chosen.length < 2 ? t('room.compare.pick') : t('room.compare.calls', { n: rows.length * chosen.length })}</span>
      </div>
      {shown.length > 0 && (
        <div className="tr-grid hud" style={{ gridTemplateColumns: `minmax(160px, 1fr) repeat(${chosen.length}, minmax(200px, 1.4fr))` }}>
          <span className="lab tr-gh">{t('room.compare.source')}</span>
          {chosen.map((m) => (
            <div key={m} className="tr-gh">
              <span className="lab">{labelOf(m)}</span>
              <button onClick={() => shown.forEach((l) => pick(l.text, m))}>{t('room.compare.takeColumn')}</button>
            </div>
          ))}
          {shown.map((l) => (
            <div key={l.text} className="tr-grow">
              <p className="tr-src">{plain(l.text)}</p>
              {chosen.map((m) => {
                const to = results[l.text]?.[m];
                return (
                  <button key={m} className={`tr-cell ${picked[l.text] === m ? 'chosen' : ''}`} disabled={!to} aria-pressed={picked[l.text] === m} onClick={() => pick(l.text, m)}>
                    {to ? plain(to) : <span className="tr-wait">{running ? t('room.compare.waiting') : t('room.compare.none')}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
