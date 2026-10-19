import { useEffect, useState } from 'react';
import { PanelLeft, PanelRight, type LucideIcon } from 'lucide-react';
import { useI18n } from '../i18n';
import { CONTACT_LAYOUTS, formspreeId, type Brand, type ContactLayout, type MenuChange } from '../site/buildSite';
import { RichText } from './RichText';
import { normalizeSocials, SOCIAL_ICON, SOCIAL_NAME, SOCIALS, socialHref, type SocialId, type Socials } from '../model/socials';
import { PagePreview, type PreviewProgress } from './PagePreview';
import { describeError, errorText } from './errors';
import { LegalCard } from './LegalCard';
import type { Legal } from '../model/legal';

const LAYOUT_ICON: Record<ContactLayout, LucideIcon> = { left: PanelLeft, right: PanelRight };

/**
 * The Contact page, edited as it reads: her words beside the form with their
 * formatting, the ways to reach her, and which side the form stands.
 */
export function ContactPanel({ brand, onBrand, onPreview, onMenu, legal, onLegal, legalDrafts }: {
  brand: Brand;
  /** Who publishes the site: its legal notice, privacy page, notice and credit. */
  legal: Legal;
  onLegal: (next: Legal) => void;
  /** The legal pages as the site writes them from the fields now. */
  legalDrafts: () => { notice: string; privacy: string };
  onBrand: (next: Partial<Brand>) => void;
  onPreview: (progress: PreviewProgress) => Promise<string>;
  onMenu: (change: MenuChange) => void;
}) {
  const { t } = useI18n();
  const [fields, setFields] = useState({ email: brand.email, formspree: brand.formspree });
  const [error, setError] = useState<{ key: string; raw?: string } | null>(null);
  const saved = brand.socials ?? normalizeSocials(undefined, brand.instagram);
  const [socials, setSocials] = useState<Socials>(saved);
  useEffect(() => setSocials(brand.socials ?? normalizeSocials(undefined, brand.instagram)), [brand.socials, brand.instagram]);
  /** One network written back when its field is left; Instagram also in its old field, for the kits. */
  const keepSocial = (id: SocialId) => {
    const v = (socials[id] ?? '').trim();
    if (v === (saved[id] ?? '')) return;
    const next = { ...saved };
    if (v) next[id] = v; else delete next[id];
    onBrand({ socials: next, ...(id === 'instagram' ? { instagram: v } : {}) });
  };
  useEffect(() => setFields({ email: brand.email, formspree: brand.formspree }), [brand.email, brand.formspree]);
  const layout = brand.contactLayout ?? 'left';
  const keep = (k: 'email') => { if (fields[k] !== brand[k]) onBrand({ [k]: fields[k].trim() }); };
  const formBad = formspreeId(fields.formspree) === null;

  return (
    <section className="info-page">
      <div className="info-bar glass">
        <div className="segmented glass" role="group" aria-label={t('contact.layout')}>
          {CONTACT_LAYOUTS.map((l) => {
            const Icon = LAYOUT_ICON[l];
            return <button key={l} className={`icon-btn ${layout === l ? 'on' : ''}`} aria-pressed={layout === l} aria-label={t(`contact.layouts.${l}`)} data-tip={t(`contact.layouts.${l}`)} onClick={() => onBrand({ contactLayout: l })}><Icon className="ico solo" aria-hidden /></button>;
          })}
        </div>
        <PagePreview make={(p) => { setError(null); return onPreview(p); }} hash="contact" onError={(err) => setError(describeError(err))} onMenu={onMenu} />
      </div>
      {error && <p className="error small">{errorText(error)}</p>}
      <div className={`info-cols contact-${layout}`}>
        <div className="info-side glass card-pad">
          <label>{t('site.brand.email')}<input type="email" value={fields.email} maxLength={200} onChange={(e) => setFields({ ...fields, email: e.target.value })} onBlur={() => keep('email')} /></label>
          <span className="form-label">{t('contact.socials')}</span>
          <div className="social-fields">
            {SOCIALS.map((id) => {
              const v = socials[id] ?? '';
              const bad = !!v.trim() && !socialHref(id, v);
              return (
                <label key={id} className={`social-field ${v.trim() && !bad ? 'set' : ''}${bad ? ' bad' : ''}`} data-tip={bad ? t('contact.socialBad') : SOCIAL_NAME[id]}>
                  {/* Our own drawn icons (model/socials.ts), never markup from a field. */}
                  <span className="social-ico" aria-hidden dangerouslySetInnerHTML={{ __html: SOCIAL_ICON[id] }} />
                  <input value={v} maxLength={300} aria-label={SOCIAL_NAME[id]} placeholder={id === 'website' ? t('contact.siteHint') : id === 'whatsapp' ? t('contact.phoneHint') : t('contact.nameHint', { net: SOCIAL_NAME[id] })}
                    onChange={(e) => setSocials({ ...socials, [id]: e.target.value })} onBlur={() => keepSocial(id)} />
                </label>
              );
            })}
          </div>
          <label>{t('site.brand.formspree')}
            <input value={fields.formspree} maxLength={120} placeholder={t('site.brand.formspreeHint')} onChange={(e) => setFields({ ...fields, formspree: e.target.value })}
              onBlur={() => { const id = formspreeId(fields.formspree); if (id === null) return; setFields({ ...fields, formspree: id }); if (id !== brand.formspree) onBrand({ formspree: id }); }} />
            {formBad && <span className="error small">{t('site.brand.formspreeBad')}</span>}
          </label>
        </div>
        <RichText value={brand.contactNote} onChange={(contactNote) => onBrand({ contactNote })} label={t('site.brand.contactNote')} placeholder={t('site.brand.contactNoteHint')} />
      </div>
      <LegalCard legal={legal} email={brand.email} onLegal={onLegal} drafts={legalDrafts} onPreview={onPreview} onMenu={onMenu} />
    </section>
  );
}
