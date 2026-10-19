import { useCallback, useEffect, useState } from 'react';
import { hostIO, pickPostFile } from '../data/host';
import { createPostFile, readPostSummaries, type PostSummary } from '../data/blogIO';
import { describeError } from '../components/errors';
import type { BlogPost } from '../model/blog';
import type { Studio } from './useStudio';
import { onPage } from '../model/pages';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const newId = () => `post-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * The blog's posts: the list lives in `site.json`, the words in Markdown files
 * written in the studio's editor (or any other). Each tile is read again when the studio comes back
 * to the front, so what she just wrote in Notes shows on it.
 */
export function useBlog(studio: Studio, open: boolean, pageId: string | null = null) {
  const { folder, site, patchSite, alive } = studio;
  // The posts of this page: the Blog's, or an added blog page's own.
  const posts = onPage(site.posts, pageId, site.pages);
  const mine = pageId ? { pageId } : {};
  const [summaries, setSummaries] = useState<Record<string, PostSummary | null>>({});
  const [busy, setBusy] = useState(false);
  /** The post open in the editor, by id. */
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<{ key: string; raw?: string } | null>(null);

  const key = posts.map((p) => `${p.id}=${p.path}`).join('|');
  const refresh = useCallback(() => {
    if (!posts.length) return;
    readPostSummaries(posts, hostIO).then((t) => alive.current && setSummaries(t), (err: unknown) => console.warn('[vitrine-studio] post tiles unread:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, alive]);
  useEffect(() => {
    if (!open) return;
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [open, refresh]);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (err) {
      console.warn('[vitrine-studio] blog:', err);
      if (alive.current) setError(describeError(err));
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const add = (post: BlogPost) => patchSite((cur) => ({ ...cur, posts: [...cur.posts, post] }));
  const change = (id: string, next: Partial<BlogPost>) => patchSite((cur) => ({ ...cur, posts: cur.posts.map((p) => (p.id === id ? { ...p, ...next } : p)) }));

  return {
    posts, summaries, busy, error,
    editing: posts.find((p) => p.id === editing) ?? null,
    /** A new post in the studio's blog folder, opened in the editor. */
    write: (title: string) => run(async () => {
      if (!folder) return;
      const path = await createPostFile(folder, title, hostIO);
      const post: BlogPost = { id: newId(), path, date: today(), published: false, ...mine };
      await add(post);
      setSummaries((t) => ({ ...t, [post.id]: { title: title.trim(), excerpt: '', minutes: 1, pieces: [] } }));
      setEditing(post.id);
    }),
    /** A note she already wrote, wherever it is: linked, never copied. */
    pick: () => run(async () => {
      const path = await pickPostFile();
      if (!path) return;
      if (posts.some((p) => p.path === path)) return;
      await add({ id: newId(), path, date: today(), published: true, ...mine });
    }),
    edit: (post: BlogPost) => setEditing(post.id),
    /** Back to the tiles, each read again from its file. */
    closeEditor: () => { setEditing(null); refresh(); },
    toggle: (post: BlogPost) => void change(post.id, { published: !post.published }),
    date: (post: BlogPost, date: string) => void change(post.id, { date }),
    /** Off the list; the file stays where it is. */
    remove: (post: BlogPost) => void patchSite((cur) => ({ ...cur, posts: cur.posts.filter((p) => p.id !== post.id) })),
  };
}
