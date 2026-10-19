import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useI18n } from '../i18n';
import { newCategoryId, type Category } from '../model/showcase';

/**
 * The categories the creations are filed under (Tony: « des catégories qui
 * permettent de classer les créations »): a chip each, which also filters the
 * tiles; a double click renames one, its cross takes it away (the pieces keep
 * everything else), « + » adds one.
 */
export function CategoryBar({ categories, counts, active, onActive, onChange }: {
  categories: Category[];
  /** Pieces in each category, by id; `''` = all of them. */
  counts: Record<string, number>;
  /** The category the tiles are filtered on; `''` = all. */
  active: string;
  onActive: (id: string) => void;
  onChange: (next: Category[]) => void;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);

  const commit = () => {
    const name = draft.replace(/\s+/g, ' ').trim().slice(0, 40);
    if (adding && name) onChange([...categories, { id: newCategoryId(), name }]);
    else if (editing && name) onChange(categories.map((c) => (c.id === editing ? { ...c, name } : c)));
    setEditing(null);
    setAdding(false);
    setDraft('');
  };
  const field = (
    <input className="cat-input" autoFocus value={draft} maxLength={40} placeholder={t('cats.newHint')}
      onChange={(e) => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(null); setAdding(false); setDraft(''); } }} />
  );

  return (
    <div className="cat-bar" role="toolbar" aria-label={t('cats.title')}>
      <button className={`cat-chip ${active === '' ? 'chosen' : ''}`} aria-pressed={active === ''} onClick={() => onActive('')}>
        {t('cats.all')} <span className="cat-count">{counts[''] ?? 0}</span>
      </button>
      {categories.map((c) => (editing === c.id ? <span key={c.id}>{field}</span> : (
        <span key={c.id} className={`cat-chip ${active === c.id ? 'chosen' : ''}`}>
          <button className="cat-name" aria-pressed={active === c.id} onClick={() => onActive(active === c.id ? '' : c.id)}
            onDoubleClick={() => { setEditing(c.id); setDraft(c.name); }} data-tip={t('cats.renameTip')}>
            {c.name} <span className="cat-count">{counts[c.id] ?? 0}</span>
          </button>
          <button className="cat-x" aria-label={t('cats.remove', { name: c.name })} data-tip={t('cats.remove', { name: c.name })}
            onClick={() => { onChange(categories.filter((x) => x.id !== c.id)); if (active === c.id) onActive(''); }}>
            <X className="ico solo" aria-hidden />
          </button>
        </span>
      )))}
      {adding ? field : (
        <button className="cat-add" onClick={() => { setAdding(true); setDraft(''); }} data-tip={t('cats.add')} aria-label={t('cats.add')}>
          <Plus className="ico" aria-hidden />{categories.length ? '' : t('cats.add')}
        </button>
      )}
    </div>
  );
}
