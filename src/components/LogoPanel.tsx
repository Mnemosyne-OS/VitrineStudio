import { Repeat, RotateCw, Scissors } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useI18n } from '../i18n';
import { readImage, readMedia, sdk } from '../data/host';
import { readFileText, saveDroppedPhoto } from '../data/photos';
import { dataUrlText } from '../data/bytes';
import { newId } from '../model/records';
import { VectorizeCard } from './VectorizeCard';
import { LogoParts } from './LogoParts';
import { LogoOnPage } from './LogoOnPage';
import { canSplit, splitCompound } from '../site/logoParts';
import { brandMarkup, entranceSeconds, animFits, logoKind, LOGO_ANIMS, LOGO_CSS, LOGO_MODES, LOGO_SIZES, LOGO_SPEEDS, LOGO_SVG_MAX_CHARS, sanitizeSvg, setLogoSource, svgRatio, type Identity } from '../site/logo';
import type { Brand } from '../site/buildSite';
import { describeError, errorText } from './errors';
import { DropZone } from './DropZone';

/** These entrances need a vector logo's shapes. */
const vectorOnly = (a: string) => a === 'draw' || a === 'parts';

/**
 * The workshop's logo on its site: the file (a vector one can draw itself),
 * how the header shows it, and how it comes in, previewed live in the site's
 * own colours with the very markup and CSS the page will carry.
 */
export function LogoPanel({ identity, brand, onChange, makePage }: {
  identity: Identity;
  brand: Brand;
  onChange: (next: Identity) => void;
  /** The real top of the site with a logo being tried (useSite.previewHome). */
  makePage?: (identity: Identity) => Promise<string>;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ key: string; raw?: string } | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [replay, setReplay] = useState(0);
  // Replay and loop show the whole logo as the page will: the element choice steps aside until the next touch.
  const [whole, setWhole] = useState(false);
  const showChoice = useCallback(() => setWhole(false), []);
  // The preview plays again and again while the person tries entrances (never saved).
  const [loop, setLoop] = useState(false);
  // The logo alone, magnified (its entrance, its elements), or on the top of the page (its size and place).
  // A logo built element by element opens magnified, where its elements are picked.
  const [view, setView] = useState<'page' | 'logo'>(() => (identity.svg && identity.anim === 'parts' ? 'logo' : 'page'));
  const stage = useRef<HTMLDivElement | null>(null);
  // The same stage as state, for the element picker: it is remounted at every replay.
  const [stageEl, setStageEl] = useState<HTMLDivElement | null>(null);
  const stageRef = useCallback((el: HTMLDivElement | null) => { stage.current = el; setStageEl(el); }, []);
  const kind = logoKind(identity);
  const latest = useRef({ identity, onChange });
  latest.current = { identity, onChange };

  // A picture logo is read through the host for the preview.
  useEffect(() => {
    if (!identity.logoPath) { setSrc(null); return; }
    let alive = true;
    readImage(identity.logoPath).then(
      (url) => {
        if (!alive) return;
        setSrc(url);
        // The picture's own shape, kept for the tinted mask of the page.
        const img = new Image();
        img.onload = () => {
          const r = img.naturalWidth / Math.max(1, img.naturalHeight);
          const now = latest.current;
          if (alive && r > 0 && now.identity.logoPath === identity.logoPath && Math.abs((now.identity.ratio ?? 0) - r) > 0.01) now.onChange({ ...now.identity, ratio: r });
        };
        img.src = url;
      },
      (err: unknown) => alive && setError(describeError(err)),
    );
    return () => { alive = false; };
  }, [identity.logoPath]);

  // Same placeholders as the page: the address set after the markup is in place, then the play class.
  // Again when the view comes back to the logo alone: its stage is a new one.
  useEffect(() => {
    const root = stage.current;
    if (!root) return;
    if (src) setLogoSource(root, src, identity.ratio ?? null);
    const inner = root.querySelector('.brand-in');
    inner?.classList.remove('play');
    const raf = requestAnimationFrame(() => inner?.classList.add('play'));
    return () => cancelAnimationFrame(raf);
  }, [src, identity, replay, brand.name, view]);

  // The header is the page's own size (a 44 px logo): magnified to fill the stage, never cut.
  useEffect(() => {
    const root = stage.current;
    const header = root?.querySelector<HTMLElement>('.logo-header');
    if (!root || !header) return;
    const fit = () => {
      header.style.zoom = '1';
      const pad = 48;
      const z = Math.min(3, (root.clientWidth - pad) / Math.max(1, header.offsetWidth), (root.clientHeight - pad) / Math.max(1, header.offsetHeight));
      header.style.zoom = String(Math.max(1, Math.floor(z * 10) / 10));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(root);
    return () => ro.disconnect();
  }, [src, identity, replay, brand.name, view]);

  const period = entranceSeconds(identity, brand.name || t('logo.sampleName'));
  useEffect(() => {
    if (!loop) return;
    const id = setInterval(() => setReplay((n) => n + 1), period * 1000);
    return () => clearInterval(id);
  }, [loop, period]);

  const take = async (file: File | null) => {
    setBusy(true);
    setError(null);
    // Every change after a read spreads the identity as it is THEN, not as it was at the click.
    const tooBig = (text: string) => { if (text.length > LOGO_SVG_MAX_CHARS) throw new Error('LOGO_TOO_LARGE'); return text; };
    const apply = (change: Partial<Identity>) => latest.current.onChange({ ...latest.current.identity, ...change });
    const asPicture = (logoPath: string) => apply({ logoPath, svg: undefined, vectorFrom: undefined, parts: undefined, ...(vectorOnly(latest.current.identity.anim) ? { anim: 'fade' as const } : {}) });
    try {
      if (file && (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg'))) {
        const svg = sanitizeSvg(tooBig(await readFileText(file)));
        if (!svg) throw new Error('NOT_A_LOGO');
        apply({ svg, logoPath: undefined, vectorFrom: undefined, parts: undefined, ratio: svgRatio(svg) ?? undefined });
      } else if (file) {
        asPicture(await saveDroppedPhoto(file, newId('logo')));
      } else {
        const path = await sdk.selectFile([{ name: t('logo.formats'), extensions: ['svg', 'png', 'jpg', 'jpeg', 'webp'] }]);
        if (typeof path !== 'string' || !path) return;
        if (path.toLowerCase().endsWith('.svg')) {
          const svg = sanitizeSvg(tooBig(dataUrlText(await readMedia(path))));
          if (!svg) throw new Error('NOT_A_LOGO');
          apply({ svg, logoPath: undefined, vectorFrom: undefined, parts: undefined, ratio: svgRatio(svg) ?? undefined });
        } else {
          asPicture(path);
        }
      }
      setReplay((n) => n + 1);
    } catch (err) {
      console.warn('[vitrine-studio] the logo was not taken:', err);
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const splittable = kind === 'svg' && canSplit(identity.svg!);
  const split = () => {
    const svg = splitCompound(identity.svg!, LOGO_SVG_MAX_CHARS);
    if (!svg) { setError({ key: 'parts.tooHeavy' }); return; }
    onChange({ ...identity, svg, parts: undefined });
    setReplay((n) => n + 1);
  };

  const colours = { '--ink': brand.ink, '--paper': brand.paper } as CSSProperties;
  const markup = brandMarkup(identity, brand.name || t('logo.sampleName'));

  const parts = kind === 'svg' && identity.anim === 'parts';
  const onPage = view === 'page';
  const vectorizing = kind === 'raster' && !!src;

  return (
    <section className={`logo-tab${parts ? ' with-parts' : ''}${vectorizing ? ' with-vector' : ''}`}>
      <style>{LOGO_CSS}</style>
      {/* Left: what the person looks at (the preview, the logo's elements to pick, its tracing). */}
      <div className="logo-left">
        <div className="glass card-pad logo-preview-card">
          <div className="row spaced card-head">
            <div className="segmented glass" role="group" aria-label={t('logo.preview')}>
              <button className={onPage ? 'on' : ''} aria-pressed={onPage} onClick={() => setView('page')}>{t('logo.view.page')}</button>
              <button className={!onPage ? 'on' : ''} aria-pressed={!onPage} onClick={() => setView('logo')}>{t('logo.view.logo')}</button>
            </div>
            <button onClick={() => { setWhole(true); setReplay((n) => n + 1); }}><RotateCw className="ico" aria-hidden />{t('logo.replay')}</button>
            <button className={`chip-tile glass ${loop ? 'chosen' : ''}`} onClick={() => { setLoop(!loop); setWhole(!loop); }} aria-pressed={loop}>
              <Repeat className="ico" aria-hidden /><strong>{t('logo.loop')}</strong>
            </button>
          </div>
          {onPage ? (
            <LogoOnPage identity={identity} name={brand.name || t('logo.sampleName')} src={src} brand={brand} replay={replay} onChange={onChange} make={makePage} />
          ) : (
            <div className={`logo-stage${parts ? ' picking' : ''}${whole ? ' whole' : ''}`} style={colours} ref={stageRef} key={replay} onMouseEnter={() => { if (identity.hover) setReplay((n) => n + 1); }}>
              {/* The markup is the page's own: the name escaped, an svg reduced to its shapes (sanitizeSvg). */}
              <div className="logo-header" dangerouslySetInnerHTML={{ __html: markup }} />
            </div>
          )}
          {/* Picking a logo's elements needs it magnified: on the logo alone. */}
          {parts && !onPage && (
            <LogoParts svg={identity.svg!} parts={identity.parts} stage={stageEl} onPick={showChoice}
              onChange={(next) => { onChange({ ...identity, parts: next }); setReplay((n) => n + 1); }} />
          )}
        </div>
        {vectorizing && (
          <VectorizeCard src={src} paper={brand.paper} ink={brand.ink} onUse={(svg) => {
            // Already split into its elements by the card, cuts included.
            onChange({ ...identity, svg, vectorFrom: identity.logoPath, logoPath: undefined, parts: undefined, ratio: svgRatio(svg) ?? identity.ratio });
            setReplay((n) => n + 1);
          }} />
        )}
      </div>

      {/* Right: the choices. */}
      <div className="logo-right">
        <div className="glass card-pad">
          <h3>{t('logo.file')}</h3>
          {kind ? (
            <div className="row">
              <span className="ok small">✓ {t(kind === 'svg' ? 'logo.isSvg' : 'logo.isPicture')}</span>
              <button onClick={() => void take(null)} disabled={busy}>{t('logo.change')}</button>
              {identity.vectorFrom && kind === 'svg' && (
                <button onClick={() => onChange({ ...identity, svg: undefined, logoPath: identity.vectorFrom, vectorFrom: undefined, parts: undefined, ...(vectorOnly(identity.anim) ? { anim: 'fade' } : {}) })}>{t('vector.back')}</button>
              )}
              {splittable && (
                <button onClick={split}><Scissors className="ico" aria-hidden />{t('parts.split')}</button>
              )}
              <button className="link" onClick={() => onChange({ ...identity, svg: undefined, logoPath: undefined, vectorFrom: undefined, parts: undefined })}>{t('logo.remove')}</button>
            </div>
          ) : (
            <DropZone compact title={t('logo.drop')} formats={t('logo.accepts')} busy={busy} onFiles={(files) => files[0] && void take(files[0])} onPick={() => void take(null)} />
          )}
          {error && <p className="error small">{errorText(error)}</p>}
        </div>

        <div className="glass card-pad">
          <h3>{t('logo.show')}</h3>
          <div className="idea-row compact">
            {LOGO_MODES.map((m) => (
              <button key={m} className={`chip-tile glass ${identity.mode === m ? 'chosen' : ''}`} onClick={() => onChange({ ...identity, mode: m })}>
                <strong>{t(`logo.mode.${m}`)}</strong>
              </button>
            ))}
            <span className="idea-sep" aria-hidden />
            {LOGO_SIZES.map((s) => (
              <button key={s} className={`chip-tile glass ${identity.size === s && !identity.height ? 'chosen' : ''}`} onClick={() => onChange({ ...identity, size: s, height: undefined })}>
                <strong>{t(`logo.size.${s}`)}</strong>
              </button>
            ))}
            <button className={`chip-tile glass ${identity.tint ? 'chosen' : ''}`} onClick={() => onChange({ ...identity, tint: !identity.tint })}>
              <strong>{t('logo.tint')}</strong>
            </button>
          </div>
        </div>

        <div className="glass card-pad">
          <h3>{t('logo.anim')}</h3>
          <div className="idea-row compact">
            {LOGO_ANIMS.map((a) => (
              <button key={a} disabled={!animFits(a, kind)} title={vectorOnly(a) && kind !== 'svg' ? t('logo.svgOnly') : undefined}
                className={`chip-tile glass ${identity.anim === a ? 'chosen' : ''}`}
                onClick={() => { onChange({ ...identity, anim: a }); setReplay((n) => n + 1); }}>
                <strong>{t(`logo.anims.${a}`)}</strong>
              </button>
            ))}
          </div>
          <div className="idea-row compact spaced">
            {LOGO_SPEEDS.map((s) => (
              <button key={s} className={`chip-tile glass ${identity.speed === s ? 'chosen' : ''}`} onClick={() => { onChange({ ...identity, speed: s }); setReplay((n) => n + 1); }}>
                <strong>{t(`logo.speed.${s}`)}</strong>
              </button>
            ))}
            <button className={`chip-tile glass ${identity.hover ? 'chosen' : ''}`} onClick={() => onChange({ ...identity, hover: !identity.hover })}>
              <strong>{t('logo.hover')}</strong>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

