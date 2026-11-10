import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ExternalLink, Pencil, RefreshCw } from 'lucide-react';
import { useI18n } from '../i18n';
import { useCopy } from '../hooks/useCopy';
import { ADDRESS_WORDS, AI_BOTS, SEO_DESCRIPTION_MAX, SEO_TITLE_MAX, WORD_DEFAULTS, originOf, slugOf, verificationOf, type AddressWord, type SeoSettings } from '../model/seo';
import { seoTodo, type SeoPage } from '../site/seo';
import type { SiteData } from '../site/buildSite';
import type { Lang } from '../model/profiles';
import type { Piece } from '../model/types';
import { describeError } from './errors';
import { Thumb } from './Thumb';

const LOAD_TIMEOUT_MS = 15_000;
/** What Google shows of a title and a description before cutting them (about; it measures pixels). */
const TITLE_SHOWN = 60;
const DESCRIPTION_SHOWN = 160;

/** A text field that keeps what is typed until it is left: one write per field, never one per key. */
function Draft({ value, onCommit, placeholder, maxLength, area, label, disabled }: { value: string; onCommit: (v: string) => void; placeholder?: string; maxLength?: number; area?: boolean; label: string; disabled?: boolean }) {
  const [text, setText] = useState(value);
  // What she is typing wins over a value that comes back; a value changed elsewhere replaces what was shown.
  useEffect(() => setText(value), [value]);
  const commit = () => { if (text !== value) onCommit(text); };
  const props = { value: text, placeholder, maxLength, disabled, 'aria-label': label, onBlur: commit };
  return area
    ? <textarea rows={2} {...props} onChange={(e) => setText(e.target.value)} />
    : <input {...props} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />;
}

/** One choice among a few, as tiles: the chosen one is ticked. */
function Choice<T extends string>({ label, hint, value, options, onChoose }: { label: string; hint?: string; value: T; options: Array<{ id: T; name: string }>; onChoose: (v: T) => void }) {
  return (
    <div className="seo-choice">
      <span className="form-label">{label}</span>
      <div className="viewer-tiles">
        {options.map((o) => (
          <button key={o.id} className={`chip-tile glass ${value === o.id ? 'chosen' : ''}`} aria-pressed={value === o.id} onClick={() => onChoose(o.id)}><span>{o.name}</span></button>
        ))}
      </div>
      {hint && <p className="muted seo-hint">{hint}</p>}
    </div>
  );
}

const Card = ({ title, children }: { title: string; children: ReactNode }) => <div className="glass card-pad seo-card"><h3>{title}</h3>{children}</div>;

/**
 * Site › Search (doc 145 §10.24): what search engines, AI crawlers and a
 * shared link read of the site. Every choice is hers, each with a starting
 * value, and the screen says what each one does. Nothing here is a score.
 */
export function SeoPanel({ seo, lang, onChange, load, published, hasSecondLanguage, pieces, onDescribe, onOpen, onGo }: {
  seo: SeoSettings;
  /** The site's main language: the words of its addresses. */
  lang: Lang;
  onChange: (update: (cur: SeoSettings) => SeoSettings) => void;
  /** The site as it would be sent now, with its addresses. */
  load: () => Promise<SiteData>;
  /** The site was sent at least once: an address that moves leaves a redirect behind. */
  published: boolean;
  hasSecondLanguage: boolean;
  pieces: Piece[];
  /** A creation's description written here: saved on the piece and shown on the site. */
  onDescribe: (piece: Piece, text: string) => Promise<boolean>;
  onOpen: (url: string) => void;
  /** Leads to the screen that fills a gap. */
  onGo: (where: 'look' | 'about' | 'legal') => void;
}) {
  const { t, tc } = useI18n();
  const { copied, failed, copy } = useCopy();
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error'; what: string } | { status: 'ready'; data: SiteData }>({ status: 'loading' });
  const [again, setAgain] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [badOrigin, setBadOrigin] = useState(false);
  const [badCode, setBadCode] = useState(false);
  const [takenSlug, setTakenSlug] = useState<string | null>(null);
  const [describing, setDescribing] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;
  // The site is read again a moment after a setting changed, never at each one of a burst.
  const print = JSON.stringify(seo);
  useEffect(() => {
    let alive = true;
    let limit: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(() => {
      const late = new Promise<never>((_, reject) => { limit = setTimeout(() => reject(new Error('TIMEOUT')), LOAD_TIMEOUT_MS); });
      Promise.race([loadRef.current(), late])
        .then((data) => { if (alive) setState({ status: 'ready', data }); })
        .catch((err: unknown) => {
          console.error('[vitrine-studio] the site could not be read for its search settings:', err);
          if (alive) setState({ status: 'error', what: t(describeError(err).key) });
        })
        // The safety limit goes with the read it guarded, answered or not.
        .finally(() => clearTimeout(limit));
    }, 300);
    return () => { alive = false; clearTimeout(timer); clearTimeout(limit); };
  }, [print, again, pieces, t]);

  const set = (update: (cur: SeoSettings) => SeoSettings) => onChange(update);
  /** A sparse flag: the starting value is the absence of the key. */
  const flag = <K extends keyof SeoSettings>(key: K, value: SeoSettings[K] | undefined) => set((cur) => { const next = { ...cur }; if (value === undefined) delete next[key]; else next[key] = value; return next; });
  const pages = state.status === 'ready' ? state.data.seo?.pages ?? [] : [];
  const slugNow = (p: SeoPage) => p.path.split('/').filter(Boolean).pop() ?? '';
  /** The addresses that are about to move, kept so the old ones lead to the new ones. */
  const moving = (ids: string[], cur: SeoSettings): SeoSettings['redirects'] => {
    if (!published) return cur.redirects;
    const old = pages.filter((p) => ids.includes(p.id) && p.path).map((p) => ({ from: p.path, id: p.id }));
    const list = [...(cur.redirects ?? []).filter((r) => !old.some((o) => o.from === r.from)), ...old];
    return list.length ? list : undefined;
  };
  const withRedirects = (cur: SeoSettings, next: SeoSettings, ids: string[]): SeoSettings => {
    const redirects = moving(ids, cur);
    const out = { ...next };
    if (redirects) out.redirects = redirects; else delete out.redirects;
    return out;
  };
  const setWord = (k: AddressWord, raw: string) => set((cur) => {
    const word = slugOf(raw);
    const words = { ...(cur.words ?? {}) };
    if (word && word !== WORD_DEFAULTS[lang][k]) words[k] = word; else delete words[k];
    const next = { ...cur };
    if (Object.keys(words).length) next.words = words; else delete next.words;
    // The page and everything under it move with the word.
    const pageId = { creations: 'creations', about: 'a-propos', blog: 'blog', contact: 'contact' }[k];
    const base = pages.find((p) => p.id === pageId)?.path;
    return withRedirects(cur, next, base ? pages.filter((p) => p.path.startsWith(base)).map((p) => p.id) : []);
  });
  const setSlug = (id: string, raw: string) => {
    const slug = slugOf(raw);
    const me = pages.find((p) => p.id === id);
    // An address another page already has is refused, and said: it would lead her visitors to the wrong one.
    const taken = !!slug && !!me && pages.some((p) => p.id !== id && p.path === `${me.path.slice(0, me.path.length - slugNow(me).length - 1)}${slug}/`);
    setTakenSlug(taken ? id : null);
    if (!slug || !me || taken) return;
    set((cur) => withRedirects(cur, { ...cur, slugs: { ...(cur.slugs ?? {}), [id]: slug } }, [id]));
  };
  const setMeta = (id: string, field: 'title' | 'description', raw: string) => set((cur) => {
    const text = raw.replace(/\s+/g, ' ').trim();
    const one = { ...(cur.meta?.[id] ?? {}) };
    if (text) one[field] = text; else delete one[field];
    const meta = { ...(cur.meta ?? {}) };
    if (Object.keys(one).length) meta[id] = one; else delete meta[id];
    const next = { ...cur };
    if (Object.keys(meta).length) next.meta = meta; else delete next.meta;
    return next;
  });
  const setOrigin = (raw: string) => {
    // Emptied: hers goes whole, and the host's reading comes back by itself.
    if (!raw.trim()) { setBadOrigin(false); set((cur) => { if (!cur.originOwn) return cur; const next = { ...cur }; delete next.originOwn; delete next.origin; return next; }); return; }
    const origin = originOf(raw);
    setBadOrigin(!origin);
    if (origin) set((cur) => ({ ...cur, origin, originOwn: true }));
  };
  const setCode = (raw: string) => {
    if (!raw.trim()) { setBadCode(false); flag('verification', undefined); return; }
    const code = verificationOf(raw);
    setBadCode(!code);
    if (code) flag('verification', code);
  };
  const structured = (k: 'business' | 'products' | 'articles', on: boolean) => set((cur) => {
    const s = { ...(cur.structured ?? {}) };
    if (on) delete s[k]; else s[k] = false;
    const next = { ...cur };
    if (Object.keys(s).length) next.structured = s; else delete next.structured;
    return next;
  });
  const yesNo = [{ id: 'on' as const, name: t('seo.on') }, { id: 'off' as const, name: t('seo.off') }];

  const todo = state.status === 'ready' ? seoTodo(state.data) : null;
  const bare = todo ? todo.bare.map((id) => pieces.find((p) => p.id === id)).filter((p): p is Piece => !!p) : [];
  const gaps = todo ? [todo.origin, todo.tagline, todo.about, todo.address, bare.length > 0, todo.nameless > 0].filter(Boolean).length : 0;
  const origin = seo.origin;
  // An address can only be moved once the addresses are read: the old one is what the redirect is made from.
  const ready = state.status === 'ready';

  return (
    <div className="seo-panel">
      <p className="muted seo-intro">{t('seo.intro')}</p>

      <Card title={t('seo.todo.title')}>
        {state.status === 'loading' && <p className="muted" aria-busy="true">{t('seo.loading')}</p>}
        {state.status === 'error' && <p className="seo-error" role="alert">{t('seo.error', { what: state.what })} <button className="chip-tile glass seo-inline" onClick={() => { setState({ status: 'loading' }); setAgain((n) => n + 1); }}><RefreshCw className="ico" aria-hidden /> {t('seo.retry')}</button></p>}
        {todo && gaps === 0 && <p className="muted"><Check className="ico" aria-hidden /> {t('seo.todo.none')}</p>}
        {todo && gaps > 0 && (
          <ul className="seo-todo">
            {todo.origin && <li>{t('seo.todo.origin')}</li>}
            {todo.tagline && <li>{t('seo.todo.tagline')} <button className="chip-tile glass seo-inline" onClick={() => onGo('look')}>{t('seo.todo.go')}</button></li>}
            {todo.about && <li>{t('seo.todo.about')} <button className="chip-tile glass seo-inline" onClick={() => onGo('about')}>{t('seo.todo.go')}</button></li>}
            {todo.address && <li>{t('seo.todo.address')} <button className="chip-tile glass seo-inline" onClick={() => onGo('legal')}>{t('seo.todo.go')}</button></li>}
            {todo.nameless > 0 && <li>{tc('seo.todo.nameless', todo.nameless)}</li>}
            {bare.length > 0 && <li>{tc('seo.todo.bare', bare.length)} <button className="chip-tile glass seo-inline" aria-expanded={describing} onClick={() => setDescribing((v) => !v)}><Pencil className="ico" aria-hidden /> {t('seo.describe.title')}</button></li>}
          </ul>
        )}
        {describing && bare.length > 0 && (
          <div className="seo-describe">
            <p className="muted seo-hint">{t('seo.describe.hint')}</p>
            {bare.map((p) => (
              <div key={p.id} className="seo-describe-row">
                <Thumb path={p.photoPath} alt={p.name} />
                <div>
                  <strong>{p.name}</strong>
                  <Draft area label={`${t('seo.describe.placeholder')} · ${p.name}`} value={p.description ?? ''} placeholder={t('seo.describe.placeholder')} maxLength={600}
                    onCommit={(text) => { if (text.trim()) void onDescribe(p, text.trim()).then((ok) => { if (ok) setSaved(p.id); }); }} />
                  {saved === p.id && <span className="muted seo-hint"><Check className="ico" aria-hidden /> {t('seo.describe.saved')}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={t('seo.address.title')}>
        <p>{origin ? <strong>{origin}</strong> : <span className="muted">{t('seo.address.none')}</span>}{origin && <span className="muted"> · {t(seo.originOwn ? 'seo.address.own' : 'seo.address.auto')}</span>}</p>
        <label className="seo-field"><span className="form-label">{t('seo.address.field')}</span>
          <Draft label={t('seo.address.field')} value={seo.originOwn ? origin ?? '' : ''} placeholder="https://" maxLength={200} onCommit={setOrigin} />
        </label>
        <p className={badOrigin ? 'seo-error' : 'muted seo-hint'} role={badOrigin ? 'alert' : undefined}>{t(badOrigin ? 'seo.address.bad' : 'seo.address.hint')}</p>
      </Card>

      <Card title={t('seo.read.title')}>
        <Choice label={t('seo.engines.label')} value={seo.engines ?? 'open'} hint={t(`seo.engines.hint.${seo.engines ?? 'open'}`)}
          options={[{ id: 'open', name: t('seo.open') }, { id: 'closed', name: t('seo.closed') }]} onChoose={(v) => flag('engines', v === 'closed' ? 'closed' : undefined)} />
        <Choice label={t('seo.ai.label')} value={seo.aiBots ?? 'open'} hint={seo.aiBots === 'closed' ? t('seo.ai.hint.closed', { count: AI_BOTS.length }) : t('seo.ai.hint.open')}
          options={[{ id: 'open', name: t('seo.open') }, { id: 'closed', name: t('seo.closed') }]} onChoose={(v) => flag('aiBots', v === 'closed' ? 'closed' : undefined)} />
      </Card>

      <Card title={t('seo.addresses.title')}>
        <Choice label={t('seo.addresses.label')} value={seo.addresses ?? 'real'} hint={t(`seo.addresses.hint.${seo.addresses ?? 'real'}`)}
          options={[{ id: 'real', name: t('seo.addresses.real') }, { id: 'single', name: t('seo.addresses.single') }]} onChoose={(v) => flag('addresses', v === 'single' ? 'single' : undefined)} />
        {seo.addresses !== 'single' && (
          <>
            <Choice label={t('seo.creations.label')} value={seo.creationPages ?? 'all'}
              options={[{ id: 'all', name: t('seo.creations.all') }, { id: 'described', name: t('seo.creations.described') }, { id: 'none', name: t('seo.creations.none') }]}
              onChoose={(v) => flag('creationPages', v === 'all' ? undefined : v)} />
            {seo.creationPages !== 'none' && (
              <Choice label={t('seo.sold.label')} value={seo.sold ?? 'keep'} options={[{ id: 'keep', name: t('seo.sold.keep') }, { id: 'drop', name: t('seo.sold.drop') }]} onChoose={(v) => flag('sold', v === 'drop' ? 'drop' : undefined)} />
            )}
            <div className="seo-choice">
              <span className="form-label">{t('seo.words.label')}</span>
              <div className="seo-words">
                {ADDRESS_WORDS.map((k) => (
                  <label key={k} className="seo-field"><span className="muted">{t(`seo.words.${k}`)}</span>
                    <Draft label={`${t('seo.words.label')} · ${t(`seo.words.${k}`)}`} value={seo.words?.[k] ?? ''} placeholder={WORD_DEFAULTS[lang][k]} maxLength={60} disabled={!ready} onCommit={(v) => setWord(k, v)} />
                  </label>
                ))}
              </div>
              <p className="muted seo-hint">{t('seo.words.hint')}{published ? ` ${t('seo.pages.moved')}` : ''}</p>
            </div>
            {hasSecondLanguage && (
              <Choice label={t('seo.lang.label')} value={seo.visitorLanguage === 'address' ? 'address' : 'follow'} hint={t(`seo.lang.hint.${seo.visitorLanguage === 'address' ? 'address' : 'follow'}`)}
                options={[{ id: 'follow', name: t('seo.lang.follow') }, { id: 'address', name: t('seo.lang.address') }]} onChoose={(v) => flag('visitorLanguage', v === 'address' ? 'address' : undefined)} />
            )}
            <Choice label={t('seo.legal.label')} value={seo.legalInSitemap ? 'on' : 'off'} options={yesNo} onChoose={(v) => flag('legalInSitemap', v === 'on' ? true : undefined)} />
          </>
        )}
      </Card>

      <Card title={t('seo.structured.title')}>
        <p className="muted seo-hint">{t('seo.structured.hint')}</p>
        {(['business', 'products', 'articles'] as const).map((k) => (
          <Choice key={k} label={t(`seo.structured.${k}`)} value={seo.structured?.[k] === false ? 'off' : 'on'} options={yesNo} onChoose={(v) => structured(k, v === 'on')} />
        ))}
      </Card>

      <Card title={t('seo.google.title')}>
        <p className="muted seo-hint">{t('seo.google.hint')}</p>
        <label className="seo-field"><span className="form-label">{t('seo.google.field')}</span>
          <Draft label={t('seo.google.field')} value={seo.verification ?? ''} maxLength={300} onCommit={setCode} />
        </label>
        {badCode && <p className="seo-error" role="alert">{t('seo.google.bad')}</p>}
        <div className="row">
          <button className="chip-tile glass seo-inline" onClick={() => onOpen('https://search.google.com/search-console')}><ExternalLink className="ico" aria-hidden /> {t('seo.google.open')}</button>
          {origin && seo.engines !== 'closed' && (
            <button className="chip-tile glass seo-inline" onClick={() => copy(`${origin}/sitemap.xml`)}>{t('seo.google.sitemap')} · {origin}/sitemap.xml · {t(failed ? 'seo.google.copyFailed' : copied ? 'seo.google.copied' : 'seo.google.copy')}</button>
          )}
        </div>
      </Card>

      <Card title={t('seo.pages.title')}>
        <p className="muted seo-hint">{t('seo.pages.hint')}</p>
        {state.status === 'loading' && <p className="muted" aria-busy="true">{t('seo.loading')}</p>}
        {state.status === 'error' && <p className="seo-error" role="alert">{t('seo.error', { what: state.what })}</p>}
        {pages.map((p) => {
          const own = seo.meta?.[p.id] ?? {};
          const editing = open === p.id;
          return (
            <div key={p.id || 'home'} className="seo-page">
              <div className="seo-snippet">
                <span className="seo-snippet-url">{(origin ?? '').replace(/^https?:\/\//, '')}/{p.path}<span className="muted"> · {t(`seo.pages.kinds.${p.kind}`)}{p.unlisted ? ` · ${t('seo.pages.unlisted')}` : ''}</span></span>
                <span className="seo-snippet-title">{p.title.length > TITLE_SHOWN ? `${p.title.slice(0, TITLE_SHOWN)}…` : p.title}</span>
                <span className="seo-snippet-text">{p.description.length > DESCRIPTION_SHOWN ? `${p.description.slice(0, DESCRIPTION_SHOWN)}…` : p.description}</span>
              </div>
              <button className="chip-tile glass seo-inline" aria-expanded={editing} onClick={() => setOpen(editing ? null : p.id)}><Pencil className="ico" aria-hidden /> {t(editing ? 'seo.pages.close' : 'seo.pages.edit')}</button>
              {editing && (
                <div className="seo-edit">
                  <label className="seo-field"><span className="form-label">{t('seo.pages.pageTitle')} <span className="muted">{(own.title ?? p.title).length} / {TITLE_SHOWN}</span></span>
                    <Draft label={t('seo.pages.pageTitle')} value={own.title ?? ''} placeholder={p.title} maxLength={SEO_TITLE_MAX} onCommit={(v) => setMeta(p.id, 'title', v)} />
                  </label>
                  <label className="seo-field"><span className="form-label">{t('seo.pages.pageDescription')} <span className="muted">{(own.description ?? p.description).length} / {DESCRIPTION_SHOWN}</span></span>
                    <Draft area label={t('seo.pages.pageDescription')} value={own.description ?? ''} placeholder={p.description} maxLength={SEO_DESCRIPTION_MAX} onCommit={(v) => setMeta(p.id, 'description', v)} />
                  </label>
                  {(p.kind === 'creation' || p.kind === 'post') && (
                    <label className="seo-field"><span className="form-label">{t('seo.pages.slug')}</span>
                      <Draft label={t('seo.pages.slug')} value={slugNow(p)} maxLength={60} onCommit={(v) => setSlug(p.id, v)} />
                      {takenSlug === p.id && <span className="seo-error" role="alert">{t('seo.pages.slugTaken')}</span>}
                    </label>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}
