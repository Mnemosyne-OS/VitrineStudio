import { joinPath, type FolderIO } from './folderStore';
import { postExcerpt, postFileName, postImages, postPieces, postTitle, readingMinutes, type BlogPost } from '../model/blog';

/** New posts are written here, in the studio folder. One she already had stays where it is. */
export const BLOG_DIR = 'blog';

/** A post that could not be read for the site, named by its file. */
export class BlogError extends Error {
  constructor(public readonly code: 'POST_UNREADABLE' | 'POST_NOT_WRITTEN', public readonly path: string, detail?: string) {
    super(`${code}: ${path}${detail ? ` (${detail})` : ''}`);
    this.name = 'BlogError';
  }
}

/** A post as the site gets it: its whole file, made into HTML with the studio's pieces at build (site/buildSite.ts). */
export interface SitePost { id: string; title: string; date: string; text: string; /** An added blog page's (model/pages.ts). */ pageId?: string }

/**
 * The posts on the site, read from their files now: what she wrote in Notes a
 * minute ago is what goes online. One that cannot be read stops the export by
 * its name, never a site quietly missing a post.
 */
export async function readSitePosts(posts: BlogPost[], io: Pick<FolderIO, 'readFile'>): Promise<SitePost[]> {
  const out: SitePost[] = [];
  for (const p of posts.filter((x) => x.published)) {
    const res = await io.readFile(p.path);
    if (!res.success || typeof res.content !== 'string') throw new BlogError('POST_UNREADABLE', p.path, res.error);
    out.push({ id: p.id, title: postTitle(res.content, p.path), date: p.date, text: res.content, ...(p.pageId ? { pageId: p.pageId } : {}) });
  }
  return out;
}

/** What a post's tile shows: its title and first words. */
/** What a post's tile shows: as its tile on the site (site/template.html). */
export interface PostSummary {
  title: string;
  excerpt: string;
  minutes: number;
  /** Its first photo, on disk. */
  image?: string;
  /** The creations it shows: the first with a photo covers a post with none. */
  pieces: string[];
}

/** Every post's tile, read from its file; a file that cannot be read is null. */
export async function readPostSummaries(posts: BlogPost[], io: Pick<FolderIO, 'readFile'>): Promise<Record<string, PostSummary | null>> {
  const out: Record<string, PostSummary | null> = {};
  await Promise.all(posts.map(async (p) => {
    const res = await io.readFile(p.path).catch((err: unknown) => ({ success: false, error: String(err) }) as const);
    if (!res.success || typeof res.content !== 'string') {
      console.warn('[vitrine-studio] a post is unreadable:', p.path, res.error);
      out[p.id] = null;
    } else {
      const image = postImages(res.content)[0];
      out[p.id] = { title: postTitle(res.content, p.path), excerpt: postExcerpt(res.content), minutes: readingMinutes(res.content), pieces: postPieces(res.content), ...(image ? { image } : {}) };
    }
  }));
  return out;
}

/** A new post's file in `<root>/blog/`, its title as the first heading. Resolves its path. */
export async function createPostFile(root: string, title: string, io: Pick<FolderIO, 'mkdir' | 'readDir' | 'writeFile'>): Promise<string> {
  const dir = joinPath(root, BLOG_DIR);
  const made = await io.mkdir(dir);
  if (!made.success) throw new BlogError('POST_NOT_WRITTEN', dir, made.error);
  const listed = await io.readDir(dir);
  if (!listed.success) throw new BlogError('POST_NOT_WRITTEN', dir, listed.error);
  const taken = new Set((listed.files ?? []).map((f) => f.name.toLowerCase()));
  const path = joinPath(dir, postFileName(title, (n) => taken.has(n)));
  const written = await io.writeFile(path, `# ${title.trim()}\n\n`);
  if (!written.success) throw new BlogError('POST_NOT_WRITTEN', path, written.error);
  return path;
}
