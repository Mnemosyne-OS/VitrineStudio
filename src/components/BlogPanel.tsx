import { useState } from 'react';
import { Eye, EyeOff, FileText, PenLine, Plus, X } from 'lucide-react';
import { getLanguage, useI18n } from '../i18n';
import { sortPosts } from '../model/blog';
import { errorText } from './errors';
import type { useBlog } from '../hooks/useBlog';
import { PostEditor } from './PostEditor';
import type { Piece } from '../model/types';
import type { PostSummary, SitePost } from '../data/blogIO';
import type { MenuChange } from '../site/buildSite';
import { Thumb } from './Thumb';

/**
 * The Blog tab: one tile per post (one Markdown file each), and the editor a
 * tile opens. A new post is created and opened there; one already written is linked.
 */
export function BlogPanel({ blog, pieces, onPreview, onMenu }: { blog: ReturnType<typeof useBlog>; pieces: Piece[]; onPreview: (post: SitePost) => Promise<string>; onMenu: (change: MenuChange) => void }) {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const start = () => {
    if (!title.trim()) return;
    void blog.write(title);
    setTitle('');
  };
  // As on the site: its first photo, else the first creation it shows that has one.
  const cover = (sum: PostSummary | null | undefined) => sum?.image ?? sum?.pieces.map((id) => pieces.find((x) => x.id === id)?.photoPath).find(Boolean);
  const dayOf = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(getLanguage(), { day: 'numeric', month: 'long', year: 'numeric' });
  const open = blog.editing;
  if (open) return <PostEditor key={open.id} post={open} pieces={pieces} onPreview={onPreview} onMenu={onMenu} onClose={blog.closeEditor} onToggle={() => blog.toggle(open)} onDate={(d) => blog.date(open, d)} />;
  return (
    <>
      <div className="glass card-pad blog-head">
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={t('blog.newHint')}
          onKeyDown={(e) => { if (e.key === 'Enter') start(); }} />
        <button onClick={start} disabled={blog.busy || !title.trim()}><Plus className="ico" aria-hidden />{t('blog.new')}</button>
        <button onClick={() => void blog.pick()} disabled={blog.busy} title={t('blog.pickTip')}><FileText className="ico" aria-hidden />{t('blog.pick')}</button>
      </div>
      {blog.error && <p className="notice glass error">{errorText(blog.error)}</p>}
      {blog.posts.length === 0 ? (
        <p className="muted">{t('blog.empty')}</p>
      ) : (
        <section className="tiles blog-tiles">
          {sortPosts(blog.posts).map((p) => {
            const sum = blog.summaries[p.id];
            return (
              <article key={p.id} className={`tile glass blog-tile ${p.published ? '' : 'off'}`}>
                <button className="tile-media blog-cover" onClick={() => blog.edit(p)} aria-label={t('blog.edit')} tabIndex={-1}>
                  {cover(sum) ? <Thumb path={cover(sum)} alt="" /> : <span className="blog-nocover" />}
                </button>
                <button className="tile-caption" onClick={() => blog.edit(p)} title={`${t('blog.edit')} · ${p.path}`}>
                  {sum && <span className="blog-meta">{[p.date ? dayOf(p.date) : '', t('blog.minutes', { count: sum.minutes })].filter(Boolean).join(' · ')}</span>}
                  {sum === null ? <span className="error small">{t('blog.unreadable')}</span> : <strong>{sum?.title ?? '…'}</strong>}
                  {sum?.excerpt && <span className="blog-excerpt">{sum.excerpt}</span>}
                </button>
                <div className="blog-tools">
                  <input type="date" value={p.date} onChange={(e) => blog.date(p, e.target.value)} aria-label={t('blog.date')} />
                  <button className="icon-btn" onClick={() => blog.edit(p)} aria-label={t('blog.edit')} data-tip={t('blog.edit')}><PenLine className="ico" aria-hidden /></button>
                  <button className={`icon-toggle ${p.published ? 'chosen' : ''}`} aria-pressed={p.published} onClick={() => blog.toggle(p)}
                    aria-label={t('blog.onSite')} data-tip={p.published ? t('blog.onSite') : t('blog.offSite')}>
                    {p.published ? <Eye className="ico" aria-hidden /> : <EyeOff className="ico" aria-hidden />}
                  </button>
                  <button className="icon-btn" onClick={() => blog.remove(p)} aria-label={t('blog.remove')} data-tip={t('blog.remove')}><X className="ico" aria-hidden /></button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </>
  );
}
