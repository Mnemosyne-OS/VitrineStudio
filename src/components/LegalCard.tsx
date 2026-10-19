import { useEffect, useState } from 'react';
import { Cookie, FileText, Heart, RotateCcw, Scale, Server, ShieldCheck } from 'lucide-react';
import { useI18n } from '../i18n';
import { LEGAL_PAGE_MAX, LEGAL_TEXT_MAX, legalMissing, siretLooksRight, VERCEL_HOST, type Legal } from '../model/legal';
import { LEGAL_PAGE_ID, PRIVACY_PAGE_ID, sameAsFields } from '../site/legalPages';
import type { MenuChange } from '../site/buildSite';
import { RichText } from './RichText';
import { PagePreview, type PreviewProgress } from './PagePreview';
import { describeError, errorText } from './errors';

type TextKey = 'owner' | 'status' | 'siret' | 'address' | 'phone' | 'director' | 'hostName' | 'hostAddress';
const LINES: TextKey[] = ['owner', 'status', 'siret', 'phone', 'director'];

/**
 * Who publishes the site (Tony: « les conditions générales, la pop RGPD, le
 * crédit »): her legal identity and host, written into the site's legal notice
 * and privacy page, the first visit's notice and the credit. Each field is kept
 * when it is left; « À faire » names only what a French site still lacks.
 */
export function LegalCard({ legal, email, onLegal, drafts, onPreview, onMenu }: {
  legal: Legal;
  email: string;
  onLegal: (next: Legal) => void;
  /** The two pages as written from the fields now: where her own text starts. */
  drafts: () => { notice: string; privacy: string };
  onPreview: (progress: PreviewProgress) => Promise<string>;
  onMenu: (change: MenuChange) => void;
}) {
  const { t } = useI18n();
  // The page open in the editor (Tony: « le CMS pour les pages légales »).
  const [open, setOpen] = useState<'notice' | 'privacy' | null>(null);
  const [previewError, setPreviewError] = useState<{ key: string; raw?: string } | null>(null);
  // Written again at each draw while a page is open: an untouched page follows the fields.
  const made = open ? drafts() : null;
  const textKey = open === 'notice' ? 'noticeText' : 'privacyText';
  const [draft, setDraft] = useState(legal);
  useEffect(() => setDraft(legal), [legal]);
  const keep = (k: TextKey) => { if (draft[k] !== legal[k]) onLegal({ ...legal, [k]: draft[k].trim() }); };
  const missing = legalMissing(legal, email);
  const field = (k: TextKey, multi = false) => (
    <label key={k}>{t(`legal.${k}`)}
      {multi
        ? <textarea rows={3} value={draft[k]} maxLength={LEGAL_TEXT_MAX} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} onBlur={() => keep(k)} />
        : <input value={draft[k]} maxLength={LEGAL_TEXT_MAX} placeholder={k === 'director' ? draft.owner : k === 'status' ? t('legal.statusHint') : undefined} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} onBlur={() => keep(k)} />}
      {k === 'siret' && legal.siret.trim() && !siretLooksRight(legal.siret) && <span className="error small">{t('legal.siretBad')}</span>}
    </label>
  );

  return (
    <div className="glass card-pad legal-card">
      <h3><Scale className="ico" aria-hidden /> {t('legal.title')}</h3>
      <div className="legal-grid">
        <div className="legal-col">
          {LINES.map((k) => field(k))}
          {field('address', true)}
        </div>
        <div className="legal-col">
          <span className="form-label"><Server className="ico" aria-hidden /> {t('legal.host')}</span>
          <button className={`chip-tile glass ${legal.hostName === VERCEL_HOST.hostName ? 'chosen' : ''}`} onClick={() => onLegal({ ...legal, ...VERCEL_HOST })}>{t('legal.vercel')}</button>
          {field('hostName')}
          {field('hostAddress', true)}
          <div className="idea-row compact">
            <button className={`chip-tile glass ${legal.notice ? 'chosen' : ''}`} aria-pressed={legal.notice} onClick={() => onLegal({ ...legal, notice: !legal.notice })}>
              <Cookie className="ico" aria-hidden /><strong>{t('legal.notice')}</strong>
            </button>
            <button className={`chip-tile glass ${legal.credit ? 'chosen' : ''}`} aria-pressed={legal.credit} onClick={() => onLegal({ ...legal, credit: !legal.credit })}>
              <Heart className="ico" aria-hidden /><strong>{t('legal.credit')}</strong>
            </button>
          </div>
          {missing.length > 0 && <p className="small muted">{t('site.go.notReady', { items: missing.map((m) => t(`legal.missing.${m}`)).join(', ') })}</p>}
        </div>
      </div>
      <div className="legal-pages">
        {(['notice', 'privacy'] as const).map((k) => {
          const Icon = k === 'notice' ? FileText : ShieldCheck;
          const own = !!legal[k === 'notice' ? 'noticeText' : 'privacyText'].trim();
          return (
            <button key={k} className={`chip-tile glass ${open === k ? 'chosen' : ''}`} aria-pressed={open === k} onClick={() => setOpen(open === k ? null : k)}>
              <Icon className="ico" aria-hidden /><strong>{t(`legal.page.${k}`)}</strong>{own && <span className="small muted">{t('legal.edited')}</span>}
            </button>
          );
        })}
        {open && (
          <>
            <PagePreview make={(p) => { setPreviewError(null); return onPreview(p); }} hash={open === 'notice' ? LEGAL_PAGE_ID : PRIVACY_PAGE_ID} onError={(err) => setPreviewError(describeError(err))} onMenu={onMenu} />
            {legal[textKey].trim() && (
              <button onClick={() => onLegal({ ...legal, [textKey]: '' })}><RotateCcw className="ico" aria-hidden />{t('legal.fromFields')}</button>
            )}
          </>
        )}
      </div>
      {previewError && <p className="error small">{errorText(previewError)}</p>}
      {open && made && (
        <RichText key={open} label={t(`legal.page.${open}`)}
          value={legal[textKey].trim() || made[open]}
          // Her words become the page; the same words as the fields' text keep it following the fields.
          onChange={(text) => onLegal({ ...legal, [textKey]: sameAsFields(text, made[open]) ? '' : text.slice(0, LEGAL_PAGE_MAX) })} />
      )}
    </div>
  );
}
