/**
 * Who publishes the site, and what it says about the visitor's data (Tony:
 * « la pop RGPD, les conditions générales, le crédit »). A showcase site sells
 * nothing, so its pages are the legal notice and the privacy page, never terms
 * of sale. Every field is hers; an empty one is left out of the page, never
 * replaced by a placeholder, and the studio names what is missing.
 */
export interface Legal {
  /** Her name or the company's. */
  owner: string;
  /** Her legal form, as she writes it (« Micro-entrepreneur (EI) », « SARL au capital de… »). */
  status: string;
  siret: string;
  /** Her professional address; its lines kept. */
  address: string;
  phone: string;
  /** The publication's director; empty = the owner. */
  director: string;
  hostName: string;
  hostAddress: string;
  /** A small notice on the first visit: no cookie, and the link to the privacy page. */
  notice: boolean;
  /** « Created with care with Mnemosyne OS » at the bottom of the site. */
  credit: boolean;
  /** Her own legal notice, as Markdown, once she has edited it; empty = written from the fields. */
  noticeText: string;
  /** Her own privacy page, as Markdown, once she has edited it; empty = written from the fields. */
  privacyText: string;
}

/** The host when the studio publishes the site (vercel.com/legal/terms, read on 2026-10-11). */
export const VERCEL_HOST = { hostName: 'Vercel Inc.', hostAddress: '440 N Barranca Ave #4133\nCovina, CA 91723\nUnited States' } as const;

const TEXT_FIELDS = ['owner', 'status', 'siret', 'address', 'phone', 'director', 'hostName', 'hostAddress'] as const;
export const LEGAL_TEXT_MAX = 300;
export const LEGAL_PAGE_MAX = 20_000;

export const EMPTY_LEGAL: Legal = { owner: '', status: '', siret: '', address: '', phone: '', director: '', hostName: '', hostAddress: '', notice: true, credit: true, noticeText: '', privacyText: '' };

export function normalizeLegal(raw: unknown): Legal {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out: Legal = { ...EMPTY_LEGAL };
  for (const k of TEXT_FIELDS) if (typeof r[k] === 'string') out[k] = r[k].slice(0, LEGAL_TEXT_MAX);
  if (typeof r.notice === 'boolean') out.notice = r.notice;
  if (typeof r.credit === 'boolean') out.credit = r.credit;
  if (typeof r.noticeText === 'string') out.noticeText = r.noticeText.slice(0, LEGAL_PAGE_MAX);
  if (typeof r.privacyText === 'string') out.privacyText = r.privacyText.slice(0, LEGAL_PAGE_MAX);
  return out;
}

/** What a French professional site must still say (LCEN art. 6): the studio lists these, the export is never blocked. */
export function legalMissing(l: Legal, email: string): Array<'owner' | 'address' | 'siret' | 'contact' | 'host'> {
  const out: Array<'owner' | 'address' | 'siret' | 'contact' | 'host'> = [];
  if (!l.owner.trim()) out.push('owner');
  if (!l.address.trim()) out.push('address');
  if (!l.siret.trim()) out.push('siret');
  if (!email.trim() && !l.phone.trim()) out.push('contact');
  if (!l.hostName.trim()) out.push('host');
  return out;
}

/** A SIRET is 14 digits; spaces are hers to keep. */
export const siretLooksRight = (s: string) => /^\d{14}$/.test(s.replace(/\s/g, ''));
