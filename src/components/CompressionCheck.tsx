import { useEffect } from 'react';
import { useI18n } from '../i18n';
import { UpscaleCompare } from './UpscaleCompare';

/**
 * One picture of the site, full screen: the file the studio holds next to the
 * one the export would write with the current width, quality and weight. The
 * line and the drag come from the comparison; a click on the dark around it,
 * the close button or Escape closes.
 */
export function CompressionCheck({ before, after, onClose }: { before: string; after: string; onClose: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="compression-check" role="dialog" aria-modal="true" aria-label={t('check.title')}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <button className="lightbox-close glass" onClick={onClose} aria-label={t('wizard.close')} title={t('wizard.close')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
      <UpscaleCompare before={before} after={after} labels={{ before: t('check.before'), after: t('check.after') }} />
    </div>
  );
}
