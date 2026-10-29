import { CheckCircle2, Copy, ExternalLink, Eye, Link2, RotateCcw, Rocket, X, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { useCopy } from '../hooks/useCopy';
import { errorText } from './errors';
import { bareAddress, type PublishStage } from '../model/publish';
import type { SiteWork } from './SitePanel';

/** What « See » opens on this screen: this page as on the site, or the whole site. */
export type SeeWhat = 'page' | 'site';

/** The dot beside the words: green online, amber something to do, red refused, grey not yet. */
const DOT: Record<PublishStage, 'ok' | 'warn' | 'error' | 'idle'> = {
  checking: 'idle', unconnected: 'idle', incomplete: 'warn', never: 'idle', pending: 'warn', failed: 'error', current: 'ok', behind: 'warn', unknown: 'ok',
};

/** Minutes and seconds since `since`, as a clock reads. */
function elapsed(since: number, now: number): string {
  const s = Math.max(0, Math.floor((now - since) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * The site, from every screen (doc 145 §10.20): the publish, its progress and
 * its address were spread over two tabs and every panel. Here: where it
 * stands in a few words, its one address to open or copy, « See » for the page
 * she is on, and the one button that sends it. While it is sent, the bar says
 * which step it is at: the files made, counted, then the time Vercel has taken
 * (the host gives no count of its own, so none is made up).
 */
export function SiteBar({ stage, tokenUnread = false, missing, link, work, staleLiving, see, seeing, seeError, onSee, onPublish, onOpen, onConnect, onFix, onRetryToken, onDismissError }: {
  stage: PublishStage;
  /** The token's state could not be read: the connection is not known, with a way to ask again. */
  tokenUnread?: boolean;
  /** What a publish still lacks, by its key (`site.go.missing.*`). */
  missing: readonly ('scene' | 'name')[];
  /** The one address of the site online (model/publish.ts siteLink), null before the first publish. */
  link: string | null;
  work: SiteWork;
  /** Online scenes chosen Living whose layers must be made again: they go to the site as pictures. */
  staleLiving: number;
  see: SeeWhat;
  /** The whole site being made for « See »: pictures read out of how many. */
  seeing: { done: number; total: number } | null;
  seeError: { key: string; raw?: string } | null;
  onSee: () => void;
  onPublish: () => void;
  onOpen: (url: string) => void;
  /** Site › Connection, where the folder, the token and the address are set. */
  onConnect: () => void;
  /** The screen where a missing item is set: the name (Site › Look), a scene online (Scenes). */
  onFix: (item: 'scene' | 'name' | 'living') => void;
  onRetryToken?: () => void;
  /** The error under the address is put away (a preview or a picture check that stopped). */
  onDismissError?: () => void;
}) {
  const { t, tc } = useI18n();
  const { copied, failed, copy } = useCopy();
  const [now, setNow] = useState(() => Date.now());
  const sending = work.kind === 'publishing';
  // The clock ticks only while the site is being sent; hidden from screen readers, which would read it every second.
  useEffect(() => {
    if (!sending) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [sending]);

  const busy = work.kind === 'exporting' || sending;
  // « It's online » only while it is true: a change made during the send is not on the site.
  const justOnline = work.kind === 'published' && stage === 'current';

  // The words: what is happening now first, else where the site stands.
  const state = (() => {
    if (work.kind === 'exporting') return <span className="sb-state">{t('bar.exporting', { done: work.done, total: work.total })}</span>;
    if (sending) return <span className="sb-state">{t('bar.sending')} <span className="sb-clock" aria-hidden>{elapsed(work.since, now)}</span></span>;
    if (justOnline) return <span className="sb-state ok"><CheckCircle2 className="ico" aria-hidden />{t('bar.published')}</span>;
    if (work.kind === 'error') return <span className="sb-state error">{errorText(work)}</span>;
    if (stage === 'checking' && tokenUnread) {
      return (
        <span className="sb-state warn">
          {t('bar.hostingUnread')}
          {onRetryToken && <button className="link" onClick={onRetryToken}>{t('app.retry')}</button>}
        </span>
      );
    }
    if (stage === 'incomplete') {
      return (
        <span className="sb-state warn">
          {t('bar.todo')}
          {missing.map((m) => <button key={m} className="link" onClick={() => onFix(m)}>{t(`site.go.missing.${m}`)}</button>)}
        </span>
      );
    }
    return <span className={`sb-state ${DOT[stage]}`}>{t(`bar.stage.${stage}`)}</span>;
  })();

  const progress = work.kind === 'exporting' ? Math.round((work.done / Math.max(1, work.total)) * 100) : null;
  const canSend = stage !== 'checking' && stage !== 'unconnected' && stage !== 'incomplete';
  // The button's word follows the stage; it is the green one only when sending is what is next.
  const strong = work.kind === 'error' || stage === 'never' || stage === 'behind' || stage === 'failed';
  // A site never sent has no address yet: its first send is « Publish », whatever is still missing.
  const sendLabel = !link ? t('site.go.publish') : stage === 'current' ? t('bar.republish') : t('site.hero.update');
  const dot = sending || work.kind === 'exporting' ? 'busy' : work.kind === 'error' ? 'error' : justOnline ? 'ok' : DOT[stage];

  return (
    <div className={`site-bar glass ${justOnline ? 'just-published' : ''}`} role="region" aria-label={t('bar.label')}>
      <div className="sb-status" aria-live="polite">
        <span className={`sb-dot ${dot}`} aria-hidden />
        {state}
        {link && (
          <span className="sb-link">
            <button className="sb-address" onClick={() => onOpen(link)} data-tip={t('bar.open')}>
              <span className="sb-address-text">{bareAddress(link)}</span><ExternalLink className="ico" aria-hidden />
            </button>
            {(() => {
              const said = failed === link ? 'bar.copyFailed' : copied === link ? 'hosting.dns.copied' : 'bar.copy';
              return (
                <button className={`icon-btn ${failed === link ? 'error' : ''}`} aria-label={t(said)} data-tip={t(said)} onClick={() => copy(link)}>
                  {failed === link ? <XCircle className="ico solo" aria-hidden /> : copied === link ? <CheckCircle2 className="ico solo" aria-hidden /> : <Copy className="ico solo" aria-hidden />}
                </button>
              );
            })()}
            {failed === link && <span className="sb-note error">{t('bar.copyFailed')}</span>}
          </span>
        )}
        {staleLiving > 0 && canSend && !busy && (
          <button className="link warn sb-note" onClick={() => onFix('living')}>{tc('site.staleLiving', staleLiving)}</button>
        )}
        {seeError && (
          <span className="sb-note error">
            {errorText(seeError)}
            {onDismissError && <button className="link" aria-label={t('wizard.close')} onClick={onDismissError}><X className="ico solo" aria-hidden /></button>}
          </span>
        )}
      </div>
      <div className="sb-actions">
        <button disabled={!!seeing} onClick={onSee} data-tip={t(see === 'page' ? 'bar.seePage' : 'bar.seeSite')}>
          {seeing ? <span className="spinner small-spin" aria-hidden /> : <Eye className="ico" aria-hidden />}
          {seeing && seeing.total > 0 ? t('bar.seeing', { done: seeing.done, total: seeing.total }) : t('bar.see')}
        </button>
        {stage === 'unconnected' ? (
          <button className="primary" onClick={onConnect}><Link2 className="ico" aria-hidden />{t('site.hero.connect')}</button>
        ) : (
          <button className={strong ? 'primary' : ''} disabled={!canSend || busy} onClick={onPublish}>
            {busy ? <span className="spinner small-spin" aria-hidden /> : stage === 'current' ? <RotateCcw className="ico" aria-hidden /> : <Rocket className="ico" aria-hidden />}
            {sendLabel}
          </button>
        )}
      </div>
      {(progress !== null || sending) && (
        <span className={`sb-progress ${progress === null ? 'indeterminate' : ''}`} aria-hidden><span style={progress === null ? undefined : { width: `${progress}%` }} /></span>
      )}
    </div>
  );
}
