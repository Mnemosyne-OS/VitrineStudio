import { Check, Fingerprint, Palette, SlidersHorizontal, Sparkles, Undo2, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '../i18n';
import { designOf, draftCount, tryDesign, withDesign, DESIGN_TARGETS, type DesignDraft, type DesignTarget } from '../model/design';
import type { DesignPart } from '../model/spaces';
import type { SiteSettings } from '../site/buildSite';
import type { Identity } from '../site/logo';
import { withDesignPicking } from '../site/preview';
import { BrandColours, BrandWords, DarkMode, ImageQuality } from './DesignCards';
import { DesignStage } from './DesignStage';
import { EffectsCatalogue } from './EffectsCatalogue';
import { ThemePicker, type ThemeSample } from './ThemePicker';
import { LoaderPicker } from './LoaderPicker';
import { LogoPanel } from './LogoPanel';
import { SceneMapSettings } from './SceneMapSettings';
import { ViewerSettings } from './ViewerSettings';

/** The parts of the panel this screen has, in order. */
const PARTS: readonly DesignPart[] = ['theme', 'identity', 'effects', 'details'];
const PART_ICON: Record<DesignPart, LucideIcon> = { theme: Palette, identity: Fingerprint, effects: Sparkles, details: SlidersHorizontal };
/** The card each part of the site leads to, and the part of the panel that holds it. */
const CARD_OF: Record<DesignTarget, { part: DesignPart; card: string }> = {
  logo: { part: 'identity', card: 'logo' },
  words: { part: 'identity', card: 'words' },
  menu: { part: 'theme', card: 'themes' },
  title: { part: 'theme', card: 'themes' },
  gallery: { part: 'effects', card: 'fx:mosaic' },
  viewer: { part: 'effects', card: 'fx:loupe' },
  scene: { part: 'details', card: 'map' },
  map: { part: 'details', card: 'map' },
  loader: { part: 'details', card: 'loader' },
};

/** A card of the panel a click on the site can lead to: it is scrolled into sight and lit a moment. */
function Card({ id, lit, children }: { id: string; lit: string | null; children: ReactNode }) {
  return <div data-card={id} className={`design-card${lit === id ? ' picked' : ''}`}>{children}</div>;
}

/**
 * The Design space, one screen (doc 145 §10.25): the real site in the middle,
 * a panel beside it. What she sets in the panel is TRIED: it shows on the site
 * at once and is written only by « Keep »; « Drop » brings the site back as it
 * is kept. A click on a part of the site opens that part's setting. Nothing
 * goes online from here: that is the site bar's, as on every screen.
 *
 * Theme lays a theme's tokens on the one template; Effects is the catalogue.
 * Identity and Details hold settings that existed before, as they were (the
 * logo, the colours, the loading screen, the dark pages, the map of the
 * places, the pictures' quality); they replace the four places they hid in.
 */
export function DesignScreen({ site, draft, onDraft, onKeep, onMeasured, part, onPart, make, demoPhotos, demoPending, themeSample, samplePhoto, onlineCount, enlarged, busy, onCheck, checking }: {
  /** The site as kept. */
  site: SiteSettings;
  /** What is tried and not kept yet. */
  draft: DesignDraft;
  onDraft: (next: DesignDraft) => void;
  /** Writes the trial into the site; false when the write was refused (the trial stays). */
  onKeep: () => Promise<boolean>;
  /** A picture logo's own shape, measured once it is read: a fact about the file, written at once, never a trial. */
  onMeasured: (ratio: number | undefined) => void;
  part: DesignPart;
  onPart: (part: DesignPart) => void;
  /** The whole site with a trial laid on it, at an in-memory address (useSite.previewDesign). */
  make: (tried: SiteSettings, dress: (html: string) => string) => Promise<string>;
  /** Small copies of her creations' photos, for the effects' demonstrations. */
  demoPhotos: readonly string[];
  /** Those photos are still being read: the demonstrations say so. */
  demoPending?: boolean;
  /** Her words and her photos, for the themes' thumbnails. */
  themeSample: ThemeSample;
  samplePhoto?: string;
  onlineCount: number;
  enlarged: number;
  /** The site is being exported or sent. */
  busy: boolean;
  /** One picture compared at the quality and weight tried. */
  onCheck: (tried: SiteSettings) => void;
  checking: boolean;
}) {
  const { t, tc } = useI18n();
  const tried = withDesign(site, draft);
  const d = designOf(tried);
  const changes = draftCount(site, draft);
  const attempt = (change: DesignDraft) => onDraft(tryDesign(site, draft, change));
  /** The logo's panel reports the picture's shape by itself: that alone is no trial, unless a logo is being tried. */
  const onIdentity = (identity: Identity) => {
    const before = d.identity as unknown as Record<string, unknown>, after = identity as unknown as Record<string, unknown>;
    const moved = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) => before[k] !== after[k]);
    if (moved.length === 1 && moved[0] === 'ratio' && !draft.identity) { onMeasured(identity.ratio); return; }
    attempt({ identity });
  };
  const [keeping, setKeeping] = useState(false);
  const [lit, setLit] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);
  const shownPart = PARTS.includes(part) ? part : PARTS[0]!;

  // The card a click on the site asked for: in sight, and lit long enough to be found.
  useEffect(() => {
    if (!lit) return;
    panel.current?.querySelector(`[data-card="${lit}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    const id = window.setTimeout(() => setLit(null), 1600);
    return () => window.clearTimeout(id);
  }, [lit, shownPart]);

  const pick = (target: DesignTarget) => {
    const to = CARD_OF[target];
    onPart(to.part);
    setLit(to.card);
  };
  const keep = async () => {
    setKeeping(true);
    try { if (await onKeep()) onDraft({}); }
    finally { setKeeping(false); }
  };
  // The frame over the site is the studio's own green, read from its theme: it reads the same on any site.
  const frameColour = () => getComputedStyle(document.documentElement).getPropertyValue('--accent-success-text').trim() || 'currentColor';
  const labels = Object.fromEntries(DESIGN_TARGETS.map((x) => [x, t(`design.pick.${x}`)]));

  return (
    <section className="design">
      <DesignStage version={JSON.stringify(d)} onPick={pick}
        make={() => make(tried, (html) => withDesignPicking(html, labels, frameColour()))}
        bar={changes > 0 ? (
          <>
            <span className="design-trial on"><span className="sb-dot warn" aria-hidden />{tc('design.trial.count', changes)}</span>
            <span className="design-trial-actions">
              <button disabled={keeping} onClick={() => onDraft({})}><Undo2 className="ico" aria-hidden />{t('design.drop')}</button>
              <button className="primary" disabled={keeping} onClick={() => void keep()}>{keeping ? <span className="spinner small-spin" aria-hidden /> : <Check className="ico" aria-hidden />}{t('design.keep')}</button>
            </span>
          </>
        ) : <span className="design-trial muted">{t('design.trial.none')}</span>} />

      <div className="design-panel" ref={panel}>
        <nav className="segmented glass design-parts" aria-label={t('space.design')}>
          {PARTS.map((p) => {
            const Icon = PART_ICON[p];
            return <button key={p} className={shownPart === p ? 'on' : ''} aria-current={shownPart === p ? 'page' : undefined} onClick={() => onPart(p)}><Icon className="ico" aria-hidden />{t(`design.part.${p}`)}</button>;
          })}
        </nav>

        {shownPart === 'theme' && (
          <Card id="themes" lit={lit}><ThemePicker theme={d.theme} look={d.look} kept={designOf(site).theme} sample={themeSample} onTry={(theme) => attempt({ theme })} /></Card>
        )}
        {shownPart === 'identity' && (
          <>
            <Card id="words" lit={lit}><BrandWords look={d.look} onTry={(look) => attempt({ look })} /></Card>
            <Card id="colours" lit={lit}><BrandColours look={d.look} samplePhoto={samplePhoto} overridden={d.theme.colours === 'theme'} onTry={(look) => attempt({ look })} /></Card>
            {/* The logo's own panel, as it was; the site beside it is the page it stands on. */}
            <Card id="logo" lit={lit}><LogoPanel identity={d.identity} brand={tried.brand} onChange={onIdentity} /></Card>
          </>
        )}
        {shownPart === 'effects' && (
          <>
            <EffectsCatalogue design={d} photos={demoPhotos} pending={!!demoPending} onTry={attempt} lit={lit} />
            <Card id="viewer" lit={lit}><ViewerSettings value={d.viewer} onChange={(viewer) => attempt({ viewer })} hover={d.creationsHover} onHover={(creationsHover) => attempt({ creationsHover })} /></Card>
          </>
        )}
        {shownPart === 'details' && (
          <>
            <Card id="loader" lit={lit}><LoaderPicker brand={tried.brand} onChange={(loader) => attempt({ look: { ...d.look, loader: loader ?? null } })} /></Card>
            <Card id="dark" lit={lit}><DarkMode look={d.look} onTry={(look) => attempt({ look })} /></Card>
            <Card id="map" lit={lit}><SceneMapSettings value={d.sceneMap} onChange={(sceneMap) => attempt({ sceneMap })} /></Card>
            <Card id="quality" lit={lit}>
              <ImageQuality quality={d.quality} imageKb={d.imageKb} videoLevel={d.videoLevel} busy={busy} onlineCount={onlineCount} enlarged={enlarged}
                onTry={attempt} onCheck={() => onCheck(tried)} checking={checking} />
            </Card>
          </>
        )}
      </div>
    </section>
  );
}
