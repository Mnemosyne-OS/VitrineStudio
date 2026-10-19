import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, FolderInput } from 'lucide-react';
import { useI18n } from '../i18n';
import type { Category } from '../model/showcase';

/**
 * While a piece's tile is dragged, a big square per category rises at the
 * bottom of the window (Tony: « un gros carré qui apparaît, drop dedans, un
 * effet »): the one under the piece grows and lights up, and letting go files
 * the piece there. Drawn on the page's body, out of any glass card.
 */
export function CategoryDock({ open, categories, has, onDrop }: {
  open: boolean;
  categories: Category[];
  /** Whether the dragged piece is already filed under a category. */
  has: (catId: string) => boolean;
  onDrop: (catId: string, e: React.DragEvent) => void;
}) {
  const { t } = useI18n();
  const [over, setOver] = useState<string | null>(null);
  if (!categories.length) return null;
  return createPortal(
    <div className={`cat-dock ${open ? 'open' : ''}`} aria-hidden={!open}>
      {categories.map((c, i) => (
        <div key={c.id} className={`cat-square ${over === c.id ? 'over' : ''} ${has(c.id) ? 'has' : ''}`} style={{ transitionDelay: open ? `${i * 40}ms` : '0ms' }}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setOver(c.id); }}
          onDragLeave={() => setOver((o) => (o === c.id ? null : o))}
          onDrop={(e) => { e.preventDefault(); setOver(null); onDrop(c.id, e); }}>
          {has(c.id) ? <Check className="ico" aria-hidden /> : <FolderInput className="ico" aria-hidden />}
          <strong>{c.name}</strong>
          <span>{has(c.id) ? t('cats.already') : t('cats.dropHere')}</span>
        </div>
      ))}
    </div>,
    document.body,
  );
}
