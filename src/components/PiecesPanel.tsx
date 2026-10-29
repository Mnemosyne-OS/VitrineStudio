import { useEffect, useState } from 'react';
import { ViewerSettings } from './ViewerSettings';
import type { ViewerSettings as Viewer } from '../model/viewer';
import type { CreationsHover } from '../model/showcase';
import { History, AlignLeft, Check, Settings, Euro, Eye, EyeOff, ImagePlus, Images, ImageUp, Ruler, Trash2, Type, Wand2, Weight, X, type LucideIcon } from 'lucide-react';
import { saveDroppedPhoto } from '../data/photos';
import { newId } from '../model/records';
import { describeError, errorText } from './errors';
import { pickImage } from '../data/host';
import { defaultShow, measure, moveId, onCreationsPage, PHOTOS_MAX, type Category, type PieceShow } from '../model/showcase';
import { CategoryBar } from './CategoryBar';
import { CategoryDock } from './CategoryDock';

/** A piece's tile dragged in the studio, told apart from a file. */
const PIECE_DRAG = 'application/x-atelier-piece';
import { useI18n } from '../i18n';
import type { Piece } from '../model/types';
import type { Upload } from '../data/photos';
import { DropZone } from './DropZone';
import { Thumb } from './Thumb';

/**
 * The person's pieces, as tiles. They are the SAME files as MnemoCRM's
 * products: a piece added here appears in the CRM, and the other way round.
 *
 * The fastest way in is a drop: one photo = one piece, named after its file,
 * renamed in place afterwards. A photo dropped ON a tile replaces that
 * piece's photo. Staging needs a photo of the real piece, so a piece without
 * one is flagged, never hidden.
 */
export function PiecesPanel({ pieces, busy, uploads, onAddFiles, onPickNew, onSetPhoto, onPickPhoto, onEdit, onRemove, onImprove, onEvolution, showcase, onShow, priceSymbol, online, viewer, onViewer, hover, onHover, onReorder, categories, onCategories }: {
  pieces: Piece[];
  busy: boolean;
  uploads: Upload[];
  onAddFiles: (files: File[]) => void;
  onPickNew: () => void;
  onSetPhoto: (piece: Piece, file: File) => void;
  onPickPhoto: (piece: Piece) => void;
  onEdit: (piece: Piece, patch: { name?: string; description?: string; price?: number | null }) => void;
  /** Asks to remove it (a dialog confirms). */
  onRemove: (piece: Piece) => void;
  /** Opens the photo's workbench: cut out, a plain colour, a new background. */
  onImprove: (piece: Piece) => void;
  /** Every picture of the piece over time (EvolutionView). */
  onEvolution: (piece: Piece) => void;
  /** How each piece shows on the site's Creations page. */
  showcase: Record<string, PieceShow>;
  onShow: (piece: Piece, next: PieceShow) => void;
  /** The site's currency symbol, in the price field's hint. */
  priceSymbol: string;
  /** The pieces with a scene online: the Creations page's own choice when she made none. */
  online: ReadonlySet<string>;
  /** A creation opened large on the site: its loupe and its frame. */
  viewer: Viewer;
  onViewer: (next: Viewer) => void;
  /** What a creation's picture does under the pointer on the site. */
  hover: CreationsHover;
  onHover: (next: CreationsHover) => void;
  /** The pieces in a new order, all of them, by id. */
  onReorder: (ids: string[]) => void;
  categories: Category[];
  onCategories: (next: Category[]) => void;
}) {
  const { t } = useI18n();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const onPage = pieces.filter((p) => onCreationsPage(p, showcase[p.id], online)).length;
  const [cat, setCat] = useState('');
  const inCat = (p: Piece, id: string) => (showcase[p.id]?.cats ?? []).includes(id);
  const counts: Record<string, number> = { '': pieces.length, ...Object.fromEntries(categories.map((c) => [c.id, pieces.filter((p) => inCat(p, c.id)).length])) };
  const seen = cat ? pieces.filter((p) => inCat(p, cat)) : pieces;
  // The piece being dragged: the category squares rise while it is held.
  const [dragging, setDragging] = useState<string | null>(null);
  const [filed, setFiled] = useState<{ name: string; at: number } | null>(null);
  // The filed line goes after a moment; leaving the panel cancels the timer.
  useEffect(() => {
    if (!filed) return;
    const id = setTimeout(() => setFiled(null), 1600);
    return () => clearTimeout(id);
  }, [filed]);
  const fileUnder = (catId: string, e: React.DragEvent) => {
    const id = e.dataTransfer.getData(PIECE_DRAG) || dragging;
    const piece = pieces.find((p) => p.id === id);
    setDragging(null);
    if (!piece) return;
    const sh = showcase[piece.id] ?? defaultShow();
    if (!(sh.cats ?? []).includes(catId)) onShow(piece, { ...sh, cats: [...(sh.cats ?? []), catId] });
    const name = categories.find((c) => c.id === catId)?.name ?? '';
    const at = Date.now();
    setFiled({ name: `${piece.name} → ${name}`, at });
  };
  return (
    <>
      <DropZone title={t('pieces.dropLabel')} onFiles={onAddFiles} onPick={onPickNew} busy={busy} uploads={uploads} />
      {pieces.length > 0 && (
        <div className="row spaced pieces-bar">
          <span className="small muted">{t('pieces.onPageCount', { count: onPage, total: pieces.length })}</span>
          <button className={`icon-btn glass ${settingsOpen ? 'on' : ''}`} aria-pressed={settingsOpen} aria-label={t('viewer.title')} data-tip={t('viewer.title')} onClick={() => setSettingsOpen((o) => !o)}><Settings className="ico solo" aria-hidden /></button>
        </div>
      )}
      {settingsOpen && pieces.length > 0 && <ViewerSettings value={viewer} onChange={onViewer} hover={hover} onHover={onHover} />}
      {pieces.length > 0 && <CategoryBar categories={categories} counts={counts} active={cat} onActive={setCat} onChange={onCategories} />}
      <section className="tiles">
        {seen.map((p) => <PieceTile key={p.id} piece={p} onSetPhoto={onSetPhoto} onPickPhoto={onPickPhoto} onEdit={onEdit} onRemove={onRemove} onImprove={onImprove} onEvolution={onEvolution} show={showcase[p.id] ?? defaultShow()} onShow={onShow} priceSymbol={priceSymbol} shown={onCreationsPage(p, showcase[p.id], online)}
          onMove={(id, after) => onReorder(moveId(pieces.map((x) => x.id), id, p.id, after))} categories={categories}
          onDragging={(on) => setDragging(on ? p.id : null)} />)}
      </section>
      <CategoryDock open={dragging !== null} categories={categories} onDrop={fileUnder}
        has={(catId) => !!dragging && (showcase[dragging]?.cats ?? []).includes(catId)} />
      {filed && <div className="cat-toast" key={filed.at}><Check className="ico" aria-hidden />{filed.name}</div>}
    </>
  );
}

/** What a piece can show on the site, each as an icon named on hover. */
const SHOWN: ReadonlyArray<readonly [keyof PieceShow['show'], LucideIcon]> = [['name', Type], ['description', AlignLeft], ['dimensions', Ruler], ['weight', Weight], ['price', Euro], ['photos', Images]];

function PieceTile({ piece, onSetPhoto, onPickPhoto, onEdit, onRemove, onImprove, onEvolution, show, onShow, priceSymbol, shown, onMove, categories, onDragging }: {
  piece: Piece;
  onSetPhoto: (piece: Piece, file: File) => void;
  onPickPhoto: (piece: Piece) => void;
  onEdit: (piece: Piece, patch: { name?: string; description?: string; price?: number | null }) => void;
  onRemove: (piece: Piece) => void;
  onImprove: (piece: Piece) => void;
  /** Every picture of the piece over time (EvolutionView). */
  onEvolution: (piece: Piece) => void;
  show: PieceShow;
  onShow: (piece: Piece, next: PieceShow) => void;
  priceSymbol: string;
  /** On the site's Creations page now. */
  shown: boolean;
  /** Another piece dropped on this one: before it, or after it past its middle. */
  onMove: (id: string, after: boolean) => void;
  categories: Category[];
  /** This tile is being dragged, or no longer. */
  onDragging: (on: boolean) => void;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(piece.name);
  const [description, setDescription] = useState(piece.description ?? '');
  const [price, setPrice] = useState(piece.price === undefined ? '' : String(piece.price));
  const text = (n: number | undefined) => (n === undefined ? '' : String(n));
  const [size, setSize] = useState({ l: text(show.size?.l), w: text(show.size?.w), h: text(show.size?.h) });
  const [weight, setWeight] = useState(text(show.weight));
  const [dropping, setDropping] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [moving, setMoving] = useState<'before' | 'after' | null>(null);
  const sideOf = (e: React.DragEvent) => { const r = e.currentTarget.getBoundingClientRect(); return e.clientX > r.left + r.width / 2 ? 'after' as const : 'before' as const; };

  const save = () => {
    setEditing(false);
    const patch: { name?: string; description?: string; price?: number | null } = {};
    if (name.trim() && name.trim() !== piece.name) patch.name = name.trim();
    if (description.trim() !== (piece.description ?? '')) patch.description = description.trim();
    // A price is a number of euros; an empty field takes the price off, anything else is left as it was.
    const p = price.trim().replace(',', '.');
    const n = p === '' ? null : Number(p);
    if ((n === null || (Number.isFinite(n) && n >= 0)) && n !== (piece.price ?? null)) patch.price = n;
    if (Object.keys(patch).length) onEdit(piece, patch);
    // The measures as numbers: what does not read as one is left out, never guessed.
    const nextSize: NonNullable<PieceShow['size']> = {};
    for (const k of ['l', 'w', 'h'] as const) { const v = measure(size[k], 10_000); if (v !== undefined) nextSize[k] = v; }
    const nextWeight = measure(weight, 1_000_000);
    const { size: _s, weight: _w, ...rest } = show;
    const next: PieceShow = { ...rest, ...(Object.keys(nextSize).length ? { size: nextSize } : {}), ...(nextWeight !== undefined ? { weight: nextWeight } : {}) };
    if (JSON.stringify(next) !== JSON.stringify(show)) onShow(piece, next);
  };

  return (
    <article
      className={`tile glass ${over ? 'over' : ''} ${moving ? `move-${moving}` : ''}`}
      // A closed tile moves by drag and drop; a photo dropped on it still changes its photo.
      draggable={!editing}
      onDragStart={(e) => { e.dataTransfer.setData(PIECE_DRAG, piece.id); e.dataTransfer.effectAllowed = 'copyMove'; onDragging(true); }}
      onDragEnd={() => onDragging(false)}
      onDragOver={(e) => {
        e.preventDefault();
        if (e.dataTransfer.types.includes(PIECE_DRAG)) setMoving(sideOf(e));
        else setOver(true);
      }}
      onDragLeave={() => { setOver(false); setMoving(null); }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        setMoving(null);
        const id = e.dataTransfer.getData(PIECE_DRAG);
        if (id) { if (id !== piece.id) onMove(id, sideOf(e) === 'after'); return; }
        const file = e.dataTransfer.files?.[0];
        if (file) onSetPhoto(piece, file);
      }}
    >
      <div className="tile-media-wrap">
        {/* The photo opens the card (and closes it); changing it is the icon that shows on hover. */}
        <button className="tile-media" onClick={() => (editing ? save() : setEditing(true))} aria-expanded={editing} aria-label={t('pieces.edit')}>
          <Thumb path={piece.photoPath} alt={piece.name} empty={t('pieces.dropPhotoHere')} />
        </button>
        <button className="tile-photo-change" onClick={() => onPickPhoto(piece)} aria-label={t('pieces.changePhoto')} data-tip={t('pieces.changePhoto')}>
          <ImageUp className="ico solo" aria-hidden />
        </button>
        {piece.photoPath && (
          <button className="tile-improve" aria-label={t('photo.open')} data-tip={t('photo.open')} onClick={() => onImprove(piece)}>
            <Wand2 className="ico solo" aria-hidden />
          </button>
        )}
        <button className="tile-history" aria-label={t('evolution.open')} data-tip={t('evolution.open')} onClick={() => onEvolution(piece)}>
          <History className="ico solo" aria-hidden />
        </button>
        <button className="tile-trash" aria-label={t('pieces.remove')} data-tip={t('pieces.remove')} onClick={() => onRemove(piece)}>
          <Trash2 className="ico solo" aria-hidden />
        </button>
        {/* On the Creations page or not: a choice once pressed; untouched, the page decides (a scene online, not sold). */}
        <button className={`tile-onpage ${shown ? 'chosen' : ''}`} aria-pressed={shown} disabled={!piece.photoPath}
          aria-label={t('pieces.onPage')}
          data-tip={!piece.photoPath ? t('pieces.onPageNeedsPhoto') : `${shown ? t('pieces.onPageYes') : t('pieces.onPageNo')}${show.onPage === undefined ? ` · ${t('pieces.onPageAuto')}` : ''}`}
          onClick={() => onShow(piece, { ...show, onPage: !shown })}>
          {shown ? <Eye className="ico solo" aria-hidden /> : <EyeOff className="ico solo" aria-hidden />}
        </button>
      </div>
      {editing ? (
        <div className="tile-edit">
          {/* What shows on the site, first: the fields below are what it shows. */}
          <div className="tile-show" role="group" aria-label={t('pieces.onSite')}>
            {SHOWN.map(([k, Icon]) => (
              <button key={k} className={`icon-toggle ${show.show[k] ? 'chosen' : ''}`} aria-pressed={show.show[k]} aria-label={t(`pieces.show.${k}`)} data-tip={t('pieces.showTip', { what: t(`pieces.show.${k}`) })}
                onClick={() => onShow(piece, { ...show, show: { ...show.show, [k]: !show.show[k] } })}>
                <Icon className="ico solo" aria-hidden />
              </button>
            ))}
          </div>
          {categories.length > 0 && (
            <div className="tile-label"><span>{t('cats.title')}</span>
              <div className="tile-cats">
                {categories.map((c) => {
                  const on = (show.cats ?? []).includes(c.id);
                  return <button key={c.id} className={`cat-chip small ${on ? 'chosen' : ''}`} aria-pressed={on}
                    onClick={() => onShow(piece, { ...show, cats: on ? (show.cats ?? []).filter((x) => x !== c.id) : [...(show.cats ?? []), c.id] })}>{c.name}</button>;
                })}
              </div>
            </div>
          )}
          <label className="tile-label"><span>{t('pieces.name')}</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </label>
          <label className="tile-label"><span>{t('pieces.description')}</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={2000} placeholder={t('pieces.descriptionHint')} />
          </label>
          <div className="tile-label"><span>{t('pieces.sizeLabel')}</span>
            <div className="tile-size" data-tip={t('pieces.sizeTip')}>
              {(['l', 'w', 'h'] as const).map((k) => (
                <input key={k} value={size[k]} onChange={(e) => setSize({ ...size, [k]: e.target.value })} inputMode="decimal" placeholder={t(`pieces.size.${k}`)} aria-label={t(`pieces.sizeName.${k}`)} />
              ))}
              <span className="small muted">cm</span>
            </div>
          </div>
          <div className="row tile-fields">
            <label className="tile-label"><span>{t('pieces.priceHint', { symbol: priceSymbol })}</span>
              <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="45" />
            </label>
            <label className="tile-label"><span>{t('pieces.weight')}</span>
              <input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" placeholder="850" />
            </label>
          </div>
          <span className="tile-label"><span>{t('pieces.morePhotos')}</span></span>
          {/* Photos dropped here join this piece's further photos; dropped elsewhere on the card they replace its own. */}
          <div className={`tile-photos ${dropping ? 'over' : ''}`} data-tip={t('pieces.dropMorePhotos')}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDropping(true); }}
            onDragLeave={() => setDropping(false)}
            onDrop={(e) => {
              e.preventDefault(); e.stopPropagation(); setDropping(false); setPhotoError(null);
              const files = Array.from(e.dataTransfer.files ?? []).slice(0, PHOTOS_MAX - show.photos.length);
              void (async () => {
                const added: string[] = [];
                for (const f of files) {
                  try { added.push(await saveDroppedPhoto(f, newId('photo'))); }
                  catch (err) { console.warn('[vitrine-studio] a dropped photo was not kept:', err); setPhotoError(errorText(describeError(err))); }
                }
                if (added.length) onShow(piece, { ...show, photos: [...show.photos, ...added] });
              })();
            }}>
            {show.photos.map((ph, i) => (
              <span key={ph} className="tile-photo">
                <Thumb path={ph} alt={`${piece.name} ${i + 2}`} />
                <button className="link" aria-label={t('pieces.removePhoto')} onClick={() => onShow(piece, { ...show, photos: show.photos.filter((_, j) => j !== i) })}><X className="ico solo" aria-hidden /></button>
              </span>
            ))}
            {show.photos.length < PHOTOS_MAX && (
              <button className="tile-photos-add" aria-label={t('pieces.addPhoto')} onClick={() => void pickImage(t('pieces.photoFilter')).then((path) => { if (path && !show.photos.includes(path)) onShow(piece, { ...show, photos: [...show.photos, path] }); })}>
                <ImagePlus className="ico" aria-hidden /><span>{t('pieces.dropMorePhotos')}</span>
              </button>
            )}
          </div>
          {photoError && <span className="error small">{photoError}</span>}
          <button className="primary small-btn" onClick={save}>{t('pieces.done')}</button>
        </div>
      ) : (
        <button className="tile-caption" onClick={() => setEditing(true)} title={t('pieces.edit')}>
          <strong>{piece.name}</strong>
          <span className="muted">{piece.description || t('pieces.addDescription')}</span>
          {!piece.photoPath && <span className="warn">{t('pieces.needsPhoto')}</span>}
          {piece.status === 'sold' && <span className="chip">{t('pieces.sold')}</span>}
        </button>
      )}
    </article>
  );
}
