import { FolderOutput, Globe, HardDriveDownload, Languages, Link2, Search, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useI18n } from '../i18n';
import { SITE_SECTIONS, type SiteSection } from '../model/spaces';
import type { SiteWork } from '../model/publish';

const ICON: Record<SiteSection, LucideIcon> = { online: Globe, seo: Search, languages: Languages, connect: Link2, copies: HardDriveDownload };

/**
 * The Online space (doc 145 §10.20, §10.25): whether the site is found. Its
 * parts behind one row of tabs: its state and address, search, its languages,
 * the connection, the copies. How it looks left for the Design space. Sending
 * the site is not here: it is the site bar's, on every screen.
 */
export function SiteScreen({ section, onSection, connected, children }: {
  section: SiteSection;
  onSection: (s: SiteSection) => void;
  /** The connection is what is missing: its tab says so. */
  connected: boolean;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <section className="site-page">
      <nav className="segmented glass site-sections" aria-label={t('space.online')}>
        {SITE_SECTIONS.map((s) => {
          const Icon = ICON[s];
          return (
            <button key={s} className={section === s ? 'on' : ''} aria-current={section === s ? 'page' : undefined} onClick={() => onSection(s)}>
              <Icon className="ico" aria-hidden />{t(`site.section.${s}`)}
              {s === 'connect' && !connected && <span className="sb-dot warn" aria-hidden />}
            </button>
          );
        })}
      </nav>
      {children}
    </section>
  );
}

/**
 * Site › Copies: the site written into its folder without sending it (for a host
 * other than Vercel), and the studio carried away and back (TakeawayCard, the kit inside).
 */
export function SiteCopies({ canExport, hasFolder, work, onExport, children }: {
  /** A scene online and a name: the site can be written. */
  canExport: boolean;
  /** The site folder is chosen (Site › Connection). */
  hasFolder: boolean;
  work: SiteWork;
  onExport: () => void;
  children?: ReactNode;
}) {
  const { t, tc } = useI18n();
  const busy = work.kind === 'exporting' || work.kind === 'publishing';
  return (
    <>
      <div className="glass card-pad site-folder-card">
        <h3><FolderOutput className="ico" aria-hidden /> {t('copies.folder.title')}</h3>
        <div className="row">
          <button disabled={!canExport || !hasFolder || busy} onClick={onExport}>{t('site.advancedExport')}</button>
          {work.kind === 'exporting' && <span className="muted small">{t('site.go.exporting', { done: work.done, total: work.total })}</span>}
          {work.kind === 'exported' && <span className="ok small">✓ {tc('site.go.exported', work.files)}</span>}
        </div>
      </div>
      {children}
    </>
  );
}
