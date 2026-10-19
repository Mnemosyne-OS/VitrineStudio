import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Bold, Code, Eye, EyeOff, Heading2, Heading3, ImagePlus, Italic, LayoutGrid, Link, List, ListOrdered, Quote, Redo2, RemoveFormatting, Strikethrough, Undo2,
} from 'lucide-react';
import { useI18n } from '../i18n';
import { hostIO, pickImage, readImage } from '../data/host';
import { refusalOf, saveDroppedPhoto } from '../data/photos';
import { markdownToHtml, type PiecesLayout } from '../model/blog';
import { domToMarkdown, joinPost, splitPost } from '../model/blogEdit';
import type { BlogPost } from '../model/blog';
import type { Piece } from '../model/types';
import type { SitePost } from '../data/blogIO';
import { postTitle } from '../model/blog';
import { actOn, blockOf, dressBlocks, imageBlock, insertBlock, moveBlock, piecesBlock, setCaption, type BlockLabels } from './postBlocks';
import { Thumb } from './Thumb';
import { PagePreview } from './PagePreview';
import type { MenuChange } from '../site/buildSite';
import { describeError, errorText } from './errors';

type Load = { kind: 'loading' } | { kind: 'error'; error: { key: string; raw?: string } } | { kind: 'ready' };
type Save = 'saved' | 'pending' | 'saving' | { error: { key: string; raw?: string } };

const SAVE_AFTER_MS = 900;

/**
 * A post, written in the studio: its title, a formatting bar, the page.
 * Same principle as the Notes editor (an editable page written back as
 * Markdown), so the file stays a note any editor can open. Saved on its own a
 * moment after the last keystroke, and when the editor closes.
 */
export function PostEditor({ post, pieces, onPreview, onMenu, onClose, onToggle, onDate }: {
  /** A menu entry renamed in the preview. */
  onMenu: (change: MenuChange) => void;
  post: BlogPost;
  /** The post as its page on the site: an in-memory address, let go when the preview closes. */
  onPreview: (post: SitePost) => Promise<string>;
  /** The studio's pieces, for the blocks of pieces a post shows. */
  pieces: Piece[];
  onClose: () => void;
  onToggle: () => void;
  onDate: (date: string) => void;
}) {
  const { t } = useI18n();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [title, setTitle] = useState('');
  const [save, setSave] = useState<Save>('saved');
  const [linking, setLinking] = useState<string | null>(null);
  const page = useRef<HTMLDivElement>(null);
  const titleRef = useRef('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const alive = useRef(true);
  const range = useRef<Range | null>(null);
  /** The properties block the file opens with (the Notes app writes one): written back untouched. */
  const front = useRef('');
  /** Where the caret was when a panel took the focus: the block goes next to it. */
  const anchor = useRef<Node | null>(null);
  const [adding, setAdding] = useState(0);
  const [blockError, setBlockError] = useState<{ key: string; raw?: string } | null>(null);
  const [picking, setPicking] = useState<{ ids: string[]; layout: PiecesLayout } | null>(null);
  const labels: BlockLabels = useMemo(() => ({
    left: t('blog.block.left'), right: t('blog.block.right'), full: t('blog.block.full'),
    row: t('blog.block.row'), column: t('blog.block.column'), remove: t('blog.block.remove'), gone: t('blog.block.gone'),
    up: t('blog.block.up'), down: t('blog.block.down'), drag: t('blog.block.drag'), caption: t('blog.block.caption'),
  }), [t]);
  /** The post as its page on the site, from what is typed now. */
  const makePreview = () => {
    const text = joinPost(titleRef.current, page.current ? domToMarkdown(page.current) : '', front.current);
    setBlockError(null);
    return onPreview({ id: post.id, title: postTitle(text, post.path), date: post.date, text });
  };
  const dress = () => { if (page.current) dressBlocks(page.current, pieces, labels, readImage); };

  useEffect(() => {
    alive.current = true;
    let stop = false;
    hostIO.readFile(post.path).then((res) => {
      if (stop) return;
      if (!res.success || typeof res.content !== 'string') { setLoad({ kind: 'error', error: describeError(new Error(`POST_UNREADABLE: ${res.error ?? ''}`)) }); return; }
      const parts = splitPost(res.content);
      front.current = parts.front;
      titleRef.current = parts.title;
      setTitle(parts.title);
      if (page.current) {
        page.current.innerHTML = markdownToHtml(parts.body, { editor: true });
        dressBlocks(page.current, pieces, labels, readImage);
      }
      setLoad({ kind: 'ready' });
    }, (err: unknown) => { if (!stop) setLoad({ kind: 'error', error: describeError(err) }); });
    return () => { stop = true; alive.current = false; };
    // Read once per file: the pieces and labels dress it, they never reload it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.path]);

  const write = async () => {
    if (!dirty.current || !page.current) return;
    dirty.current = false;
    setSave('saving');
    try {
      const res = await hostIO.writeFile(post.path, joinPost(titleRef.current, domToMarkdown(page.current), front.current));
      if (!res.success) throw new Error(`POST_NOT_WRITTEN: ${res.error ?? ''}`);
      if (alive.current) setSave(dirty.current ? 'pending' : 'saved');
    } catch (err) {
      console.warn('[vitrine-studio] the post was not saved:', err);
      dirty.current = true;
      if (alive.current) setSave({ error: describeError(err) });
    }
  };
  const changed = () => {
    dirty.current = true;
    setSave('pending');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void write(), SAVE_AFTER_MS);
  };
  // Leaving the editor writes what is still waiting.
  const close = async () => {
    if (timer.current) clearTimeout(timer.current);
    await write();
    onClose();
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const run = (command: string, value?: string) => {
    page.current?.focus();
    document.execCommand(command, false, value);
    changed();
  };
  const block = (tag: string) => {
    const now = String(document.queryCommandValue('formatBlock')).toLowerCase();
    run('formatBlock', now === tag ? 'p' : tag);
  };
  const code = () => {
    const text = window.getSelection()?.toString() ?? '';
    if (!text) return;
    const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    run('insertHTML', `<code>${esc}</code>`);
  };
  const askLink = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    range.current = sel.getRangeAt(0).cloneRange();
    setLinking('https://');
  };
  const putLink = () => {
    const href = (linking ?? '').trim();
    setLinking(null);
    if (!range.current || !/^(https?:\/\/\S+|mailto:\S+)$/i.test(href)) return;
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range.current);
    run('createLink', href);
  };

  /** Pictures written into the studio's vault, then set before the paragraph at `at`. */
  const addPictures = async (files: File[], at: Node | null) => {
    // A refused file says why (not a photo, too large); the others still go in.
    const refused = files.map(refusalOf).find((k) => k !== null);
    const photos = files.filter((f) => refusalOf(f) === null);
    setBlockError(refused ? { key: refused } : null);
    if (!photos.length) return;
    setAdding((n) => n + photos.length);
    for (const file of photos) {
      try {
        const path = await saveDroppedPhoto(file, `blog-${post.id}-${Date.now().toString(36)}`);
        if (!alive.current || !page.current) return;
        insertBlock(page.current, imageBlock(path, 'left'), at, 'before');
        dress();
        changed();
      } catch (err) {
        console.warn('[vitrine-studio] a post picture was refused:', err);
        if (alive.current) setBlockError(describeError(err));
      } finally {
        if (alive.current) setAdding((n) => n - 1);
      }
    }
  };
  const caretNode = () => {
    const sel = window.getSelection();
    return sel && sel.rangeCount && page.current?.contains(sel.anchorNode) ? sel.anchorNode : null;
  };
  const pickPicture = async () => {
    const at = caretNode();
    try {
      const path = await pickImage(t('blog.block.pictures'));
      if (!path || !page.current) return;
      insertBlock(page.current, imageBlock(path, 'left'), at, 'before');
      dress();
      changed();
    } catch (err) {
      console.warn('[vitrine-studio] the picture picker failed:', err);
      setBlockError(describeError(err));
    }
  };
  const openPieces = () => {
    anchor.current = caretNode();
    setPicking({ ids: [], layout: 'row' });
  };
  const putPieces = () => {
    if (!picking?.ids.length || !page.current) { setPicking(null); return; }
    insertBlock(page.current, piecesBlock(picking.ids, picking.layout), anchor.current, 'after');
    setPicking(null);
    dress();
    changed();
  };
  /** A button inside a block: the picture's place, the pieces' layout, or out of the page. */
  const onPageClick = (e: React.MouseEvent) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!btn || !page.current) return;
    const block = blockOf(page.current, btn);
    if (block && actOn(block, btn.dataset.act!)) { e.preventDefault(); dress(); changed(); }
  };
  /** The block held by its handle, while it is dragged. */
  const dragging = useRef<HTMLElement | null>(null);
  const onDragStart = (e: React.DragEvent) => {
    const handle = (e.target as HTMLElement).closest?.('.pe-grip');
    const block = handle && page.current ? blockOf(page.current, handle) : null;
    if (!block) return;
    dragging.current = block;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/x-post-block', '1');
    e.dataTransfer.setDragImage(block, 20, 20);
    block.classList.add('dragging');
  };
  const endDrag = () => { dragging.current?.classList.remove('dragging'); dragging.current = null; };
  /** Typing a caption: the picture carries it, the file is written. */
  const onPageInput = (e: React.FormEvent) => {
    const field = e.target as HTMLElement;
    if (field instanceof HTMLInputElement && field.classList.contains('pe-cap') && page.current) {
      const fig = blockOf(page.current, field);
      if (fig) setCaption(fig, field.value);
    }
    changed();
  };
  const onDrop = (e: React.DragEvent) => {
    // A block moved by its handle: before the block under the pointer, or after it from its lower half.
    if (dragging.current && page.current) {
      e.preventDefault();
      // The drop's own target is what is under the pointer.
      const under = e.target as Node;
      const ref = blockOf(page.current, under);
      const box = ref?.getBoundingClientRect();
      if (moveBlock(page.current, dragging.current, under, !!box && e.clientY > box.top + box.height / 2)) changed();
      endDrag();
      return;
    }
    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;
    e.preventDefault();
    const at = document.caretRangeFromPoint?.(e.clientX, e.clientY)?.startContainer ?? null;
    void addPictures(files, at);
  };
  const withPhoto = pieces.filter((x) => x.photoPath);

  const tool = (label: string, icon: JSX.Element, onClick: () => void) => (
    <button className="icon-btn" aria-label={label} data-tip={label} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>{icon}</button>
  );
  const status = typeof save === 'object' ? <span className="error small">{errorText(save.error)}</span>
    : <span className="small muted">{t(`blog.save.${save}`)}</span>;

  return (
    <div className="post-editor">
      <div className="glass card-pad post-bar">
        <button onClick={() => void close()}><ArrowLeft className="ico" aria-hidden />{t('blog.back')}</button>
        {status}
        <PagePreview make={makePreview} hash={`blog-${post.id}`} onError={(err) => setBlockError(describeError(err))} onMenu={onMenu} />
        <input type="date" value={post.date} onChange={(e) => onDate(e.target.value)} aria-label={t('blog.date')} />
        <button className={`icon-toggle ${post.published ? 'chosen' : ''}`} aria-pressed={post.published} onClick={onToggle}
          aria-label={t('blog.onSite')} data-tip={post.published ? t('blog.onSite') : t('blog.offSite')}>
          {post.published ? <Eye className="ico" aria-hidden /> : <EyeOff className="ico" aria-hidden />}
        </button>
      </div>
      {load.kind === 'error' && <p className="notice glass error">{errorText(load.error)}</p>}
      {load.kind === 'loading' && <p className="muted"><span className="spinner small-spin" aria-hidden /> {t('blog.loading')}</p>}
      <div className="glass post-sheet" hidden={load.kind !== 'ready'}>
        <input className="post-title" value={title} maxLength={160} placeholder={t('blog.titleHint')}
          onChange={(e) => { setTitle(e.target.value); titleRef.current = e.target.value; changed(); }} />
        <div className="post-tools" role="toolbar" aria-label={t('blog.tools')}>
          {tool(t('blog.tool.undo'), <Undo2 className="ico" aria-hidden />, () => run('undo'))}
          {tool(t('blog.tool.redo'), <Redo2 className="ico" aria-hidden />, () => run('redo'))}
          <span className="post-sep" />
          {tool(t('blog.tool.bold'), <Bold className="ico" aria-hidden />, () => run('bold'))}
          {tool(t('blog.tool.italic'), <Italic className="ico" aria-hidden />, () => run('italic'))}
          {tool(t('blog.tool.strike'), <Strikethrough className="ico" aria-hidden />, () => run('strikeThrough'))}
          {tool(t('blog.tool.code'), <Code className="ico" aria-hidden />, code)}
          <span className="post-sep" />
          {tool(t('blog.tool.h2'), <Heading2 className="ico" aria-hidden />, () => block('h2'))}
          {tool(t('blog.tool.h3'), <Heading3 className="ico" aria-hidden />, () => block('h3'))}
          {tool(t('blog.tool.list'), <List className="ico" aria-hidden />, () => run('insertUnorderedList'))}
          {tool(t('blog.tool.numbered'), <ListOrdered className="ico" aria-hidden />, () => run('insertOrderedList'))}
          {tool(t('blog.tool.quote'), <Quote className="ico" aria-hidden />, () => block('blockquote'))}
          {tool(t('blog.tool.link'), <Link className="ico" aria-hidden />, askLink)}
          {tool(t('blog.tool.clear'), <RemoveFormatting className="ico" aria-hidden />, () => { run('removeFormat'); run('formatBlock', 'p'); })}
          <span className="post-sep" />
          {tool(t('blog.tool.picture'), <ImagePlus className="ico" aria-hidden />, () => void pickPicture())}
          {withPhoto.length > 0 && tool(t('blog.tool.pieces'), <LayoutGrid className="ico" aria-hidden />, openPieces)}
          {adding > 0 && <span className="small muted"><span className="spinner small-spin" aria-hidden /> {t('blog.block.adding', { count: adding })}</span>}
          {linking !== null && (
            <input className="post-link" autoFocus value={linking} onChange={(e) => setLinking(e.target.value)} aria-label={t('blog.tool.link')}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); putLink(); } if (e.key === 'Escape') setLinking(null); }} onBlur={putLink} />
          )}
        </div>
        {blockError && <p className="error small">{errorText(blockError)}</p>}
        {picking && (
          <div className="glass card-pad post-pick">
            <div className="post-pick-grid">
              {withPhoto.map((x) => {
                const on = picking.ids.includes(x.id);
                return (
                  <button key={x.id} className={`chip-tile glass ${on ? 'chosen' : ''}`} aria-pressed={on}
                    onClick={() => setPicking({ ...picking, ids: on ? picking.ids.filter((i) => i !== x.id) : [...picking.ids, x.id] })}>
                    <Thumb path={x.photoPath} alt={x.name} />
                    <span className="small">{x.name}</span>
                  </button>
                );
              })}
            </div>
            <div className="row spaced">
              {picking.ids.length > 1 && (['row', 'column'] as PiecesLayout[]).map((l) => (
                <button key={l} className={`chip-tile glass ${picking.layout === l ? 'chosen' : ''}`} onClick={() => setPicking({ ...picking, layout: l })}>
                  <strong>{t(`blog.block.${l}`)}</strong>
                </button>
              ))}
              <span className="small muted">{picking.ids.length === 1 ? t('blog.block.single') : t('blog.block.chosen', { count: picking.ids.length })}</span>
              <button onClick={() => setPicking(null)}>{t('blog.block.cancel')}</button>
              <button className="primary" disabled={!picking.ids.length} onClick={putPieces}>{t('blog.block.put')}</button>
            </div>
          </div>
        )}
        <div ref={page} className="post-page" contentEditable suppressContentEditableWarning spellCheck
          onClick={onPageClick}
          onDragStart={onDragStart}
          onDragEnd={endDrag}
          onDragOver={(e) => { if (dragging.current || e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
          onDrop={onDrop}
          data-empty={t('blog.bodyHint')}
          onFocus={() => document.execCommand('defaultParagraphSeparator', false, 'p')}
          onInput={onPageInput}
          onBlur={() => { if (dirty.current) { if (timer.current) clearTimeout(timer.current); void write(); } }}
          // Pasted text arrives as words: another page's markup never enters the post.
          onPaste={(e) => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); changed(); }} />
      </div>
    </div>
  );
}
