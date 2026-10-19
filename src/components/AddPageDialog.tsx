import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useI18n } from '../i18n';
import { PAGE_NAME_MAX, PAGE_TYPES, type PageType } from '../model/pages';
import { PAGE_ICON } from './pageIcons';

/**
 * A new page for the site (Tony: « un bouton ajout page, on choisit le type »):
 * its model, then its name. It starts empty, with its own content.
 */
export function AddPageDialog({ onAdd, onClose }: { onAdd: (type: PageType, name: string) => void; onClose: () => void }) {
  const { t } = useI18n();
  const [type, setType] = useState<PageType>('catalogue');
  const [name, setName] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const ok = name.trim().length > 0;
  const add = () => { if (ok) onAdd(type, name.trim()); };

  return (
    <div className="veil" role="dialog" aria-modal="true" aria-label={t('page.add')}>
      <div className="remove-dialog add-page glass">
        <h2>{t('page.add')}</h2>
        <div className="add-page-types">
          {PAGE_TYPES.map((k) => {
            const Icon = PAGE_ICON[k];
            return (
              <button key={k} className={`chip-tile glass ${type === k ? 'chosen' : ''}`} aria-pressed={type === k} onClick={() => setType(k)}>
                <Icon className="ico" aria-hidden /><strong>{t(`page.type.${k}`)}</strong>
              </button>
            );
          })}
        </div>
        <input autoFocus value={name} maxLength={PAGE_NAME_MAX} placeholder={t('page.name')} aria-label={t('page.name')}
          onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
        <div className="remove-foot">
          <button onClick={onClose}>{t('remove.cancel')}</button>
          <button className="primary" disabled={!ok} onClick={add}><Plus className="ico" aria-hidden />{t('page.create')}</button>
        </div>
      </div>
    </div>
  );
}
