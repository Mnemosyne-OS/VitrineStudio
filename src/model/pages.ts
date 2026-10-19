/**
 * Pages she adds to her site, each with its OWN content (Tony: « un bouton
 * ajout page, on choisit le type : scène / blog / catalogue », and a second
 * catalogue holds its own products, not a sorting of the first).
 *
 * The three built-in pages stay as they were: the scenes of the home, the
 * Creations catalogue, the Blog. A record (product, scene, post) carries
 * `pageId` only when it belongs to an added page; absent = the built-in page
 * of its kind, so every file written before pages existed keeps its place.
 * Nothing moves on disk: the records stay in their folders and say whose they are.
 */
/** The same rule as a record's file name: it becomes the site's `#address`. */
const isSafeId = (id: string) => /^[A-Za-z0-9_-]{1,80}$/.test(id);

/** A closed list: a type the studio does not know is dropped, never guessed. More will come. */
export const PAGE_TYPES = ['scenes', 'blog', 'catalogue', 'text', 'form'] as const;
export type PageType = (typeof PAGE_TYPES)[number];

/** Where a page's picture stands beside its words (a text page), or its form (a form page). */
export const PAGE_LAYOUTS = ['right', 'left', 'top'] as const;
export type PageLayout = (typeof PAGE_LAYOUTS)[number];

/** What a form asks: a closed list of kinds, each drawn as the browser's own field. */
export const FIELD_KINDS = ['text', 'email', 'tel', 'textarea', 'date', 'number', 'choice', 'check'] as const;
export type FieldKind = (typeof FIELD_KINDS)[number];
export interface FormField {
  id: string;
  label: string;
  kind: FieldKind;
  required: boolean;
  /** A choice's options, in her order. */
  options?: string[];
}
export const FORM_FIELDS_MAX = 20;
const PAGE_TEXT_MAX = 8000;

export interface SitePage {
  /** Also the page's address on the site (`#<id>`): letters, digits, dashes. */
  id: string;
  type: PageType;
  /** Her name for it, in the menu and on the studio's tab. */
  name: string;
  /** A text or a form page: its words, as Markdown. */
  text?: string;
  /** A text page: its picture on disk. */
  photo?: string;
  /** A text page: where the picture stands; a form page: which side the form. */
  layout?: PageLayout;
  /** A form page: what it asks. */
  fields?: FormField[];
}

export const PAGE_NAME_MAX = 40;
/** The built-in pages' addresses: an added page never takes one. */
const RESERVED = new Set(['accueil', 'creations', 'a-propos', 'blog', 'contact', 'scenes', 'mentions-legales', 'confidentialite']);

export function normalizePages(raw: unknown): SitePage[] {
  if (!Array.isArray(raw)) return [];
  const out: SitePage[] = [];
  for (const r of raw as Array<Record<string, unknown>>) {
    if (!r || typeof r !== 'object') continue;
    const id = typeof r.id === 'string' ? r.id : '';
    const name = typeof r.name === 'string' ? r.name.replace(/\s+/g, ' ').trim().slice(0, PAGE_NAME_MAX) : '';
    if (!isSafeId(id) || RESERVED.has(id) || id.startsWith('blog-') || out.some((p) => p.id === id)) continue;
    if (!(PAGE_TYPES as readonly unknown[]).includes(r.type) || !name) continue;
    const page: SitePage = { id, type: r.type as PageType, name };
    if (page.type === 'text' || page.type === 'form') {
      if (typeof r.text === 'string' && r.text.trim()) page.text = r.text.slice(0, PAGE_TEXT_MAX);
      // Only what differs from the type's own default is kept: a text page reads on the right, a form on the left (no top).
      const kept = page.type === 'text' ? ['left', 'top'] : ['right'];
      if ((PAGE_LAYOUTS as readonly unknown[]).includes(r.layout) && kept.includes(r.layout as string)) page.layout = r.layout as PageLayout;
    }
    if (page.type === 'text' && typeof r.photo === 'string' && r.photo) page.photo = r.photo.slice(0, 1000);
    if (page.type === 'form') page.fields = normalizeFields(r.fields);
    out.push(page);
  }
  return out;
}

/** A form's fields read back: known kinds, a label each, a choice with its options. */
function normalizeFields(raw: unknown): FormField[] {
  if (!Array.isArray(raw)) return [];
  const out: FormField[] = [];
  for (const r of raw.slice(0, FORM_FIELDS_MAX) as Array<Record<string, unknown>>) {
    if (!r || typeof r !== 'object') continue;
    const id = typeof r.id === 'string' && isSafeId(r.id) && !out.some((f) => f.id === r.id) ? r.id : null;
    const label = typeof r.label === 'string' ? r.label.replace(/\s+/g, ' ').trim().slice(0, 80) : '';
    if (!id || !label || !(FIELD_KINDS as readonly unknown[]).includes(r.kind)) continue;
    const field: FormField = { id, label, kind: r.kind as FieldKind, required: r.required === true };
    if (field.kind === 'choice') {
      const options = (Array.isArray(r.options) ? r.options : []).filter((o): o is string => typeof o === 'string' && !!o.trim()).map((o) => o.trim().slice(0, 60)).slice(0, 20);
      if (!options.length) continue;
      field.options = options;
    }
    out.push(field);
  }
  return out;
}

/** A readable, unique address from her name: « Bijoux d'été » → `bijoux-d-ete`. */
export function pageIdFor(name: string, taken: readonly string[]): string {
  const base = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'page';
  const used = new Set([...taken, ...RESERVED]);
  let id = base.startsWith('blog-') ? `p-${base}` : base;
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
  return id;
}

/** The records of one page: `null` = the built-in page (records without a page, or of a page that no longer exists). */
export function onPage<T extends { pageId?: string }>(records: readonly T[], pageId: string | null, pages: readonly SitePage[]): T[] {
  const known = new Set(pages.map((p) => p.id));
  return records.filter((r) => (pageId === null ? !r.pageId || !known.has(r.pageId) : r.pageId === pageId));
}

/** A record's page as read from a file: kept only when it is an address. */
export function normalizePageId(v: unknown): string | undefined {
  return typeof v === 'string' && isSafeId(v) && !RESERVED.has(v) ? v : undefined;
}
