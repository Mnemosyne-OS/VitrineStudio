import { useEffect, useRef, useState } from 'react';
import { Bold, Heading2, Heading3, Italic, Link, List, ListOrdered, Quote, Redo2, RemoveFormatting, Undo2 } from 'lucide-react';
import { useI18n } from '../i18n';
import { markdownToHtml } from '../model/blog';
import { domToMarkdown } from '../model/blogEdit';

/**
 * A text with its formatting, edited as it will read (Tony: « mise en forme
 * facile »): the blog editor's bar, without pictures, kept as Markdown so the
 * site and the kit carry plain text. Written back when the field is left, and
 * a moment after the last keystroke.
 */
export function RichText({ value, onChange, placeholder, label }: {
  /** The text as Markdown. */
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  label: string;
}) {
  const { t } = useI18n();
  const page = useRef<HTMLDivElement>(null);
  const last = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const range = useRef<Range | null>(null);
  const [linking, setLinking] = useState<string | null>(null);

  // The text from outside (first open, a kit) is drawn; what she is typing is never redrawn under her caret.
  useEffect(() => {
    if (!page.current || value === last.current && page.current.innerHTML) return;
    page.current.innerHTML = markdownToHtml(value, { editor: true });
    last.current = value;
  }, [value]);
  const write = (el: HTMLElement | null = page.current) => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (!el) return;
    const md = domToMarkdown(el).trim();
    if (md === last.current.trim()) return;
    last.current = md;
    onChangeRef.current(md);
  };
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // Leaving the panel within a second of the last keystroke still writes it: the
  // element is held here, since the ref is already cleared when this cleanup runs.
  useEffect(() => {
    const el = page.current;
    return () => { if (timer.current) write(el); };
  }, []);
  const changed = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(write, 900);
  };
  const run = (command: string, v?: string) => {
    page.current?.focus();
    document.execCommand(command, false, v);
    changed();
  };
  const block = (tag: string) => {
    const now = String(document.queryCommandValue('formatBlock')).toLowerCase();
    run('formatBlock', now === tag ? 'p' : tag);
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
  const tool = (name: string, icon: JSX.Element, onClick: () => void) => (
    <button className="icon-btn" aria-label={t(`blog.tool.${name}`)} data-tip={t(`blog.tool.${name}`)} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>{icon}</button>
  );

  return (
    <div className="rich-text glass">
      <div className="post-tools" role="toolbar" aria-label={t('blog.tools')}>
        {tool('undo', <Undo2 className="ico" aria-hidden />, () => run('undo'))}
        {tool('redo', <Redo2 className="ico" aria-hidden />, () => run('redo'))}
        <span className="post-sep" />
        {tool('bold', <Bold className="ico" aria-hidden />, () => run('bold'))}
        {tool('italic', <Italic className="ico" aria-hidden />, () => run('italic'))}
        <span className="post-sep" />
        {tool('h2', <Heading2 className="ico" aria-hidden />, () => block('h2'))}
        {tool('h3', <Heading3 className="ico" aria-hidden />, () => block('h3'))}
        {tool('list', <List className="ico" aria-hidden />, () => run('insertUnorderedList'))}
        {tool('numbered', <ListOrdered className="ico" aria-hidden />, () => run('insertOrderedList'))}
        {tool('quote', <Quote className="ico" aria-hidden />, () => block('blockquote'))}
        {tool('link', <Link className="ico" aria-hidden />, askLink)}
        {tool('clear', <RemoveFormatting className="ico" aria-hidden />, () => { run('removeFormat'); run('formatBlock', 'p'); })}
        {linking !== null && (
          <input className="post-link" autoFocus value={linking} onChange={(e) => setLinking(e.target.value)} aria-label={t('blog.tool.link')}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); putLink(); } if (e.key === 'Escape') setLinking(null); }} onBlur={putLink} />
        )}
      </div>
      <div ref={page} className="post-page rich-page" contentEditable suppressContentEditableWarning spellCheck role="textbox" aria-multiline="true" aria-label={label}
        data-empty={placeholder}
        onFocus={() => document.execCommand('defaultParagraphSeparator', false, 'p')}
        onInput={changed}
        onBlur={() => write()}
        // Pasted text arrives as words: another page's markup never enters.
        onPaste={(e) => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); changed(); }} />
    </div>
  );
}
