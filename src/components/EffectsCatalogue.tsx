import { MousePointer2, PersonStanding, Weight } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getLanguage, useI18n } from '../i18n';
import type { DesignDraft, DesignFields } from '../model/design';
import { EFFECTS } from '../site/effects';
import { effectBytes, type EffectSheet } from '../site/effects/contract';
import { demoDocument } from '../site/effects/demo';

/** The demonstration's own size: its page is drawn at this size and shrunk to the card, so it reads as a small site. */
const DEMO = { w: 640, h: 400 };

/**
 * An effect's demonstration, playing (doc 145 §10.25): the effect's own
 * markup, CSS and script in a sandboxed frame, with her photos and her
 * colours. The frame has no access to the studio (no same-origin): a browser
 * holds back the animation of such a frame while it is out of sight.
 */
function Demo({ effect, photos, colours, title, pending }: { effect: EffectSheet; photos: readonly string[]; colours: { ink: string; paper: string; accent: string }; title: string; pending: boolean }) {
  const { t } = useI18n();
  const wrap = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0);
  const { ink, paper, accent } = colours;
  const page = useMemo(() => demoDocument(effect, photos, { ink, paper, accent }), [effect, photos, ink, paper, accent]);
  // The page that has finished loading: until it is this one (her photos still read, or the frame still drawing), the card says so.
  const [shown, setShown] = useState<string | null>(null);
  const waiting = pending || shown !== page;
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fit = () => setScale(el.clientWidth / DEMO.w);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div className={`fx-demo ${waiting ? 'is-waiting' : ''}`} ref={wrap} aria-busy={waiting}>
      {scale > 0 && !pending && (
        <iframe title={title} sandbox="allow-scripts" srcDoc={page} tabIndex={-1} onLoad={() => setShown(page)}
          style={{ width: DEMO.w, height: DEMO.h, transform: `scale(${scale})` }} />
      )}
      {waiting && <span className="fx-demo-wait small muted">{t('effects.demoWait')}</span>}
    </div>
  );
}

/**
 * The catalogue of effects (Design › Effects): one card per effect folder,
 * its demonstration playing, what it is and where it applies, what it adds to
 * the page, and its switch for the whole site. The switch tries the change
 * like every setting of the Design screen: nothing is written until she keeps it.
 */
export function EffectsCatalogue({ design, photos, pending = false, onTry, lit }: {
  /** The settings as tried. */
  design: DesignFields;
  /** Small copies of her creations' photos, for the demonstrations. */
  photos: readonly string[];
  /** Those photos are still being read. */
  pending?: boolean;
  onTry: (change: DesignDraft) => void;
  /** The card a click on the site asked for (`fx:<id>`). */
  lit: string | null;
}) {
  const { t } = useI18n();
  const lang = getLanguage();
  const colours = { ink: design.look.ink, paper: design.look.paper, accent: design.look.accent };
  return (
    <div className="fx-catalogue">
      {EFFECTS.map((e) => {
        const on = e.get(design);
        const kb = (effectBytes(e) / 1000).toLocaleString(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        return (
          <article key={e.id} data-card={`fx:${e.id}`} className={`fx-card glass design-card${on ? ' is-on' : ''}${lit === `fx:${e.id}` ? ' picked' : ''}`}>
            <Demo pending={pending} effect={e} photos={photos} colours={colours} title={t('effects.demo', { name: e.name[lang] })} />
            <div className="fx-head">
              <strong>{e.name[lang]}</strong>
              <button role="switch" aria-checked={on} aria-label={t('effects.switch', { name: e.name[lang] })} className={`fx-switch${on ? ' on' : ''}`} onClick={() => onTry(e.set(design, !on))}><span aria-hidden /></button>
            </div>
            <p className="fx-about">{e.about[lang]}</p>
            <p className="fx-facts small muted">
              {e.where.map((w) => <span key={w} className="chip">{t(`effects.where.${w}`)}</span>)}
              <span className="fx-fact"><Weight className="ico" aria-hidden />{t('effects.weight', { kb })}</span>
            </p>
            {e.adds && <p className="small muted">{e.adds[lang]}</p>}
            {e.pointer && <p className="small muted fx-fact"><MousePointer2 className="ico" aria-hidden />{t('effects.pointer')}</p>}
            {e.moves && <p className="small muted fx-fact"><PersonStanding className="ico" aria-hidden />{t('effects.moves')}</p>}
            {e.note && <p className="small muted">{e.note[lang]}</p>}
            {e.perCreation && <p className="small muted">{t('effects.perCreation')}</p>}
          </article>
        );
      })}
    </div>
  );
}
