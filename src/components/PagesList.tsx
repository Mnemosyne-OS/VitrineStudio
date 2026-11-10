import { Mail, Plus, Scale, UserRound, type LucideIcon } from 'lucide-react';
import { useI18n } from '../i18n';
import type { SitePage } from '../model/pages';
import type { Screen } from '../model/spaces';
import { PAGE_ICON } from './pageIcons';

const BUILT_IN: Array<['about' | 'contact' | 'legal', LucideIcon]> = [['about', UserRound], ['contact', Mail], ['legal', Scale]];

/**
 * Her pages in one list (doc 145 §10.25): About, Contact, the legal pages,
 * then the pages she added in her order, and the way to add one. They were
 * five tabs or more of the top row; the page chosen is edited beside the list.
 */
export function PagesList({ current, pages, onOpen, onAdd }: {
  current: Screen;
  pages: readonly SitePage[];
  onOpen: (screen: Screen) => void;
  onAdd: () => void;
}) {
  const { t } = useI18n();
  return (
    <nav className="pages-list glass" aria-label={t('tab.pages')}>
      {BUILT_IN.map(([x, Icon]) => (
        <button key={x} className={current === x ? 'on' : ''} aria-current={current === x ? 'page' : undefined} onClick={() => onOpen(x)}>
          <Icon className="ico" aria-hidden /><span>{t(`tab.${x}`)}</span>
        </button>
      ))}
      {pages.map((p) => {
        const Icon = PAGE_ICON[p.type];
        const key: Screen = `page:${p.id}`;
        return (
          <button key={p.id} className={current === key ? 'on' : ''} aria-current={current === key ? 'page' : undefined} onClick={() => onOpen(key)}>
            <Icon className="ico" aria-hidden /><span>{p.name}</span><small className="muted">{t(`page.type.${p.type}`)}</small>
          </button>
        );
      })}
      <button className="pages-add" onClick={onAdd}><Plus className="ico" aria-hidden /><span>{t('page.add')}</span></button>
    </nav>
  );
}
