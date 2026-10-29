import { BarChart3, CheckCircle2, Copy, ExternalLink, Globe, Link2, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { errorText } from './errors';
import { getLanguage, useI18n } from '../i18n';
import { formatWeight } from '../format';
import { slugify, type SiteSettings } from '../site/buildSite';
import type { DomainState, TokenState, Traffic } from '../data/host';
import { TRAFFIC_SPANS, type useHosting } from '../hooks/useHosting';
import { bareAddress, siteLink } from '../model/publish';

/** Where a Vercel token is made (the person's own account). */
const VERCEL_TOKENS_URL = 'https://vercel.com/account/tokens';
/** Where a domain name is bought, in her own Vercel account (no purchase from here). */
const VERCEL_DOMAINS_URL = 'https://vercel.com/domains';

type Hosting = ReturnType<typeof useHosting>;

/**
 * Site › Connection: the three things a publish needs, one line each, the
 * number turning green once it is set (the folder, the Vercel token, the
 * address). Always shown whole: on its own screen there is nothing to fold.
 */
export function ConnectionCard({ settings, token, onSave, onChooseFolder, onSetToken, onRemoveToken, onOpen }: {
  settings: SiteSettings;
  token: TokenState | null;
  onSave: (next: SiteSettings) => void;
  onChooseFolder: () => void;
  onSetToken: (token: string) => Promise<boolean>;
  onRemoveToken: () => void;
  onOpen: (url: string) => void;
}) {
  const { t } = useI18n();
  const [project, setProject] = useState(settings.projectName || slugify(settings.brand.name));
  useEffect(() => setProject(settings.projectName || slugify(settings.brand.name)), [settings.projectName, settings.brand.name]);
  const [tokenDraft, setTokenDraft] = useState('');
  const saveProject = () => {
    const name = slugify(project) || slugify(settings.brand.name);
    setProject(name);
    if (name !== settings.projectName) onSave({ ...settings, projectName: name });
  };

  return (
    <div className="glass card-pad connect-card">
      <h3><Link2 className="ico" aria-hidden /> {t('hosting.connect.title')}</h3>
      {/* The three steps side by side on a wide screen, one under the other on a phone. */}
      <div className="connect-steps">
        <div className="step-row">
          <span className={`step-num ${settings.siteId ? 'done' : ''}`}>1</span>
          <strong>{t('site.where.folderStep')}</strong>
          <button onClick={onChooseFolder}>{settings.siteId ? t('site.where.changeFolder') : t('site.where.chooseFolder')}</button>
          {settings.siteName && <span className="muted small">{settings.siteName}</span>}
        </div>
        <div className="step-row">
          <span className={`step-num ${token?.present ? 'done' : ''}`}>2</span>
          <strong>{t('site.where.tokenStep')}</strong>
          {token?.present ? (
            <>
              <span className="ok small">✓ {t('site.where.tokenSaved')}</span>
              {token.seal === 'plaintext' && <span className="warn small">{t('site.where.tokenPlain')}</span>}
              <button className="link" onClick={onRemoveToken}>{t('site.where.tokenRemove')}</button>
            </>
          ) : (
            <>
              <input className="step-input" type="password" autoComplete="off" value={tokenDraft} onChange={(e) => setTokenDraft(e.target.value)} placeholder={t('site.where.tokenPlaceholder')} />
              <button disabled={!tokenDraft.trim()} onClick={() => void onSetToken(tokenDraft).then((ok) => ok && setTokenDraft(''))}>{t('site.where.tokenSave')}</button>
              <button className="link" onClick={() => onOpen(VERCEL_TOKENS_URL)}>{t('site.where.tokenLink')}</button>
            </>
          )}
        </div>
        <div className="step-row">
          <span className={`step-num ${slugify(project) ? 'done' : ''}`}>3</span>
          <strong>{t('site.where.project')}</strong>
          <span className="address">
            <input className="step-input" value={project} onChange={(e) => setProject(e.target.value)} onBlur={saveProject} onKeyDown={(e) => { if (e.key === 'Enter') saveProject(); }} maxLength={60} placeholder={t('site.where.projectHint')} />
            <span className="muted">.vercel.app</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Site › Online (doc 145 §10.14, §10.20): the site's addresses, her own domain names with what to write at her registrar
 * as Vercel gives it, and the visits once she turns the counter on. What
 * Vercel says is read, never assumed: a domain shows whether it is accepted
 * and whether it points there, apart. Sending the site is the site bar's.
 */
export function HostingPanel({ settings, connected, host, onSave, onOpen, onConnect, onVideoSettings }: {
  settings: SiteSettings;
  /** The folder, the token and the address are set (Site › Connection). */
  connected: boolean;
  host: Hosting;
  onSave: (next: SiteSettings) => void;
  onOpen: (url: string) => void;
  /** Site › Connection. */
  onConnect: () => void;
  /** Settings › Video, where ffmpeg (which makes the clips lighter) is installed. */
  onVideoSettings: () => void;
}) {
  const { t, tc } = useI18n();
  const [domainDraft, setDomainDraft] = useState('');
  // Removing a domain takes two presses: the first arms it.
  const [armed, setArmed] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const address = settings.projectName || slugify(settings.brand.name);
  const live = settings.lastPublish;
  const published = !!live;
  // The address Vercel gave: the bar's too, until a domain of hers points there.
  const vercelUrl = siteLink(live, address);
  const when = (at: string) => new Date(at).toLocaleString(getLanguage(), { dateStyle: 'medium', timeStyle: 'short' });
  const copy = (value: string) => {
    navigator.clipboard.writeText(value).then(() => setCopied(value), (err: unknown) => console.warn('[vitrine-studio] copy refused:', err));
  };

  if (!connected) {
    return (
      <div className="glass card-pad site-empty">
        <Globe className="ico hero-ico" aria-hidden />
        <strong>{t('site.hero.needHosting')}</strong>
        <button className="primary" onClick={onConnect}><Link2 className="ico" aria-hidden />{t('site.hero.connect')}</button>
      </div>
    );
  }

  const h = host.hosting;
  const domains = h.kind === 'ready' ? h.data.domains : [];
  const addresses = (
    <div className="glass card-pad">
      <h3 className="hosting-head">
        <Globe className="ico" aria-hidden /> {t('hosting.addresses.title')}
        {published && (
          <button className="icon-btn glass" disabled={h.kind === 'loading'} aria-label={t('hosting.check')} data-tip={t('hosting.check')} onClick={() => void host.refresh()}>
            {h.kind === 'loading' ? <span className="spinner small-spin" aria-hidden /> : <RefreshCw className="ico solo" aria-hidden />}
          </button>
        )}
      </h3>
      <div className="domain-row glass">
        {vercelUrl ? <button className="link" onClick={() => onOpen(vercelUrl)}>{bareAddress(vercelUrl)}</button> : <span className="muted">{address}.vercel.app</span>}
        <span className={`status-chip ${live?.readyState === 'READY' ? 'is-ok' : ''}`}>{live?.readyState === 'READY' ? `✓ ${t('hosting.domain.live')}` : t(published ? 'hosting.domain.sent' : 'hosting.domain.notYet')}</span>
      </div>
      {live && (
        <p className="muted small">
          {t('site.hero.lastSent', { when: when(live.at) })}
          {settings.lastExport ? ` · ${formatWeight(settings.lastExport.bytes)}` : ''}
        </p>
      )}
      {/* Clips sent at the generator's weight: the way to make them lighter, next to the count. */}
      {!!settings.lastExport?.heavyClips && (
        <div className="step-row">
          <span className="warn small">{tc('site.heavyClips', settings.lastExport.heavyClips)}</span>
          <button onClick={onVideoSettings}>{t('site.heavyClipsFix')}</button>
        </div>
      )}
      {!published && <p className="muted small">{t('hosting.addresses.afterPublish')}</p>}
      {h.kind === 'error' && <p className="error small">{errorText(h.error)}</p>}
      {domains.map((d) => (
        <DomainRow key={d.name} d={d} busy={host.busyDomain === d.name} armed={armed === d.name} copied={copied}
          onOpen={() => onOpen(`https://${d.name}`)} onCopy={copy}
          onRemove={() => { if (armed !== d.name) { setArmed(d.name); return; } setArmed(null); void host.removeDomain(d.name); }} />
      ))}
      {published && (
        <form className="domain-add" onSubmit={(e) => { e.preventDefault(); const d = domainDraft.trim(); if (d) void host.addDomain(d).then((ok) => ok && setDomainDraft('')); }}>
          <input value={domainDraft} onChange={(e) => setDomainDraft(e.target.value)} placeholder={t('hosting.domain.placeholder')} maxLength={253} autoComplete="off" spellCheck={false} />
          <button type="submit" className="primary" disabled={!domainDraft.trim() || !!host.busyDomain}>{host.busyDomain === domainDraft.trim() ? <span className="spinner small-spin" aria-hidden /> : null}{t('hosting.domain.add')}</button>
          <button type="button" className="link" onClick={() => onOpen(VERCEL_DOMAINS_URL)}>{t('hosting.domain.buy')}</button>
        </form>
      )}
      {host.domainError && <p className="error small">{errorText(host.domainError)}</p>}
    </div>
  );

  const counting = !!settings.analytics;
  // The counter is in the page only once the site is sent again with it: the bar says so too.
  const pending = published && counting !== !!live?.analytics;
  const vercelOff = h.kind === 'ready' && h.data.analytics !== true;
  const analyticsUrl = h.kind === 'ready' ? h.data.analyticsUrl : null;
  const tr = host.traffic;
  const visits = (
    <div className="glass card-pad">
      <h3><BarChart3 className="ico" aria-hidden /> {t('hosting.visits.title')}</h3>
      <div className="idea-row">
        <button className={`chip-tile glass ${counting ? 'chosen' : ''}`} aria-pressed={counting} onClick={() => onSave({ ...settings, analytics: !counting })}>
          <strong>{t('hosting.visits.count')}</strong>
          <span className="muted small">{t('hosting.visits.noCookie')}</span>
        </button>
      </div>
      {/* On or off, the site online keeps what it was sent with until it is sent again. */}
      {pending && <p className="warn small">{t('hosting.visits.republish')}</p>}
      {counting && (
        <>
          {analyticsUrl && (vercelOff || (tr.kind === 'error' && tr.error.key === 'error.ANALYTICS_OFF')) && (
            <div className="step-row">
              <span className="step-num">!</span>
              <strong>{t('hosting.visits.vercelOff')}</strong>
              <button onClick={() => onOpen(analyticsUrl)}><ExternalLink className="ico" aria-hidden />{t('hosting.visits.enable')}</button>
            </div>
          )}
          {published && (
            <div className="segmented glass" role="group" aria-label={t('hosting.visits.span')}>
              {TRAFFIC_SPANS.map((d) => (
                <button key={d} className={host.span === d ? 'on' : ''} aria-pressed={host.span === d} onClick={() => host.setSpan(d)}>{t('hosting.visits.days', { n: d })}</button>
              ))}
            </div>
          )}
          {tr.kind === 'loading' && <span className="spinner" aria-hidden />}
          {/* While Vercel says the counter is off, its refusal to answer is that, already said above. */}
          {tr.kind === 'error' && tr.error.key !== 'error.ANALYTICS_OFF' && !vercelOff && <p className="error small">{errorText(tr.error)}</p>}
          {tr.kind === 'ready' && <TrafficView traffic={tr.data} />}
        </>
      )}
    </div>
  );

  return (
    <div className="site-grid">
      {addresses}
      {visits}
    </div>
  );
}

/** One of her domains: whether it works, and what to write at the registrar while it does not. */
function DomainRow({ d, busy, armed, copied, onOpen, onCopy, onRemove }: {
  d: DomainState; busy: boolean; armed: boolean; copied: string | null;
  onOpen: () => void; onCopy: (v: string) => void; onRemove: () => void;
}) {
  const { t } = useI18n();
  const ok = d.verified && d.configured === true;
  const state = ok ? 'live' : d.configured === null && d.verified ? 'unread' : 'todo';
  return (
    <div className="domain-block glass">
      <div className="domain-row">
        <button className="link" onClick={onOpen}>{d.name}</button>
        <span className={`status-chip ${ok ? 'is-ok' : state === 'todo' ? 'is-todo' : ''}`}>{ok ? `✓ ${t('hosting.domain.live')}` : t(`hosting.domain.${state}`)}</span>
        <button className={`icon-btn glass ${armed ? 'is-armed' : ''}`} disabled={busy} aria-label={t(armed ? 'hosting.domain.removeSure' : 'hosting.domain.remove')} data-tip={t(armed ? 'hosting.domain.removeSure' : 'hosting.domain.remove')} onClick={onRemove}>
          {busy ? <span className="spinner small-spin" aria-hidden /> : <Trash2 className="ico solo" aria-hidden />}
        </button>
      </div>
      {d.records.length > 0 && (
        <table className="dns-table">
          <thead><tr><th>{t('hosting.dns.type')}</th><th>{t('hosting.dns.name')}</th><th>{t('hosting.dns.value')}</th><th /></tr></thead>
          <tbody>
            {d.records.map((r) => (
              <tr key={`${r.type}${r.host}${r.value}`}>
                <td>{r.type}</td>
                <td><code>{r.host}</code></td>
                <td><code className="dns-value">{r.value}</code></td>
                <td><button className="icon-btn glass" aria-label={t('hosting.dns.copy')} data-tip={t(copied === r.value ? 'hosting.dns.copied' : 'hosting.dns.copy')} onClick={() => onCopy(r.value)}>{copied === r.value ? <CheckCircle2 className="ico solo" aria-hidden /> : <Copy className="ico solo" aria-hidden />}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {d.error && <p className="muted small">{d.error}</p>}
    </div>
  );
}

/** The visits: the totals, one bar a day, where people came from and from which country. */
function TrafficView({ traffic }: { traffic: Traffic }) {
  const { t } = useI18n();
  const lang = getLanguage();
  const nf = new Intl.NumberFormat(lang);
  // A country's name in her language; a code the browser does not know stays a code.
  const country = (code: string) => {
    if (!code) return '—';
    try { return new Intl.DisplayNames([lang], { type: 'region' }).of(code) ?? code; } catch (err) { console.warn('[vitrine-studio] country name unknown:', code, err); return code; }
  };
  const daily = traffic.daily;
  const max = daily ? Math.max(1, ...daily.map((d) => d.visitors)) : 1;
  const sum = (k: 'visitors' | 'pageviews') => (daily ? daily.reduce((n, d) => n + d[k], 0) : null);
  const when = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString(lang, { day: 'numeric', month: 'short' });
  const list = (rows: Traffic['referrers'], name: (n: string) => string) => rows === null
    ? <p className="muted small">{t('hosting.visits.notRead')}</p>
    : rows.length === 0 ? <p className="muted small">{t('hosting.visits.none')}</p>
      : <ol className="traffic-list">{rows.slice(0, 5).map((r) => <li key={r.name}><span>{name(r.name)}</span><strong>{nf.format(r.visitors)}</strong></li>)}</ol>;
  return (
    <div className="traffic">
      <div className="traffic-totals">
        <div><strong>{sum('visitors') === null ? '—' : nf.format(sum('visitors')!)}</strong><span className="muted small">{t('hosting.visits.visits')}</span></div>
        <div><strong>{sum('pageviews') === null ? '—' : nf.format(sum('pageviews')!)}</strong><span className="muted small">{t('hosting.visits.pageviews')}</span></div>
      </div>
      {daily && daily.length > 0 && (
        <div className="traffic-bars" role="img" aria-label={t('hosting.visits.byDay')}>
          {daily.map((d) => <span key={d.day} style={{ height: `${Math.max(3, Math.round((d.visitors / max) * 100))}%` }} title={`${when(d.day)} · ${nf.format(d.visitors)}`} />)}
        </div>
      )}
      <div className="traffic-cols">
        <div><h4 className="sub-title">{t('hosting.visits.from')}</h4>{list(traffic.referrers, (n) => n || t('hosting.visits.direct'))}</div>
        <div><h4 className="sub-title">{t('hosting.visits.countries')}</h4>{list(traffic.countries, country)}</div>
      </div>
    </div>
  );
}
