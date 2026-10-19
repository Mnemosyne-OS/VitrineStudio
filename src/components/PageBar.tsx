import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import { PAGE_NAME_MAX, type SitePage } from '../model/pages';
import { PAGE_ICON } from './pageIcons';

/** The built-in page an added page's content goes back to, by type. */
const HOME_TAB: Partial<Record<SitePage['type'], string>> = { catalogue: 'tab.pieces', scenes: 'tab.scenes', blog: 'tab.blog' };

/**
 * Above an added page: its model, its name (renamed in place, saved on leaving
 * the field), and its removal. Removing a page deletes nothing: its content
 * goes back to the built-in page of its kind, and the dialog says how much.
 */
export function PageBar({ page, count, onRename, onRemove }: {
  page: SitePage;
  /** Products, scenes or posts that belong to it. */
  count: number;
  onRename: (name: string) => void;
  onRemove: () => void;
}) {
  const { t, tc } = useI18n();
  const [name, setName] = useState(page.name);
  const [asking, setAsking] = useState(false);
  useEffect(() => setName(page.name), [page.name]);
  useEffect(() => {
    if (!asking) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAsking(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [asking]);
  const Icon = PAGE_ICON[page.type];
  const commit = () => { const n = name.trim(); if (n && n !== page.name) onRename(n); else setName(page.name); };

  return (
    <div className="page-bar glass">
      <Icon className="ico" aria-hidden />
      <span className="small muted">{t(`page.type.${page.type}`)}</span>
      <input className="page-name" value={name} maxLength={PAGE_NAME_MAX} aria-label={t('page.name')}
        onChange={(e) => setName(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
      <button className="icon-btn glass page-trash" aria-label={t('page.remove')} data-tip={t('page.remove')} onClick={() => setAsking(true)}>
        <Trash2 className="ico solo" aria-hidden />
      </button>
      {/* On the page's body: inside the bar, its glass (backdrop-filter) would hold the veil to the bar's box. */}
      {asking && createPortal(
        <div className="veil" role="dialog" aria-modal="true" aria-label={t('page.removeTitle', { name: page.name })}>
          <div className="remove-dialog glass">
            <h2>{t('page.removeTitle', { name: page.name })}</h2>
            {/* A text or a form page holds its content itself: it goes with the page. */}
            <p className="muted">{!HOME_TAB[page.type] ? t('page.removeOwn') : count > 0 ? tc('page.removeBack', count, { home: t(HOME_TAB[page.type]!) }) : t('page.removeEmpty')}</p>
            <div className="remove-foot">
              <button onClick={() => setAsking(false)}>{t('remove.cancel')}</button>
              <button className="remove-delete" onClick={() => { setAsking(false); onRemove(); }}><Trash2 className="ico" aria-hidden />{t('page.remove')}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
