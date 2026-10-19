/**
 * Her social networks, shown as icons on the Contact page (Tony: « les icônes
 * fb, insta, linkedin, tiktok, youtube… pour que la personne voie ces réseaux »).
 *
 * She writes her name on the network (`@atelier`) or pastes the whole address;
 * the studio makes the link. Only an https address of the network itself is
 * kept from a paste: a field never becomes a link to anywhere else.
 *
 * Icons: Instagram, Facebook, LinkedIn, YouTube and the globe are Lucide's
 * (ISC); the others are drawn in the same line style. One source for the
 * studio and the site, inlined (no request to any network).
 */
export const SOCIALS = ['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin', 'pinterest', 'x', 'etsy', 'whatsapp', 'website'] as const;
export type SocialId = (typeof SOCIALS)[number];
export type Socials = Partial<Record<SocialId, string>>;

const svg = (inner: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

export const SOCIAL_ICON: Record<SocialId, string> = {
  instagram: svg('<rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>'),
  facebook: svg('<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>'),
  tiktok: svg('<path d="M9 12a4 4 0 1 0 4 4V3a5 5 0 0 0 5 5"/>'),
  youtube: svg('<path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/>'),
  linkedin: svg('<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/>'),
  pinterest: svg('<circle cx="12" cy="12" r="10"/><path d="M8 21l4-9"/><path d="M10.7 14c.44 1.26 1.43 2 2.55 2 2.07 0 3.75-1.55 3.75-4a5 5 0 1 0-9.7 1.7"/>'),
  x: svg('<path d="M4 4l11.7 16H20L8.3 4z"/><path d="M4 20l6.8-6.8M13.2 10.8 20 4"/>'),
  etsy: svg('<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M15 8H9v8h6"/><path d="M14 12H9"/>'),
  whatsapp: svg('<path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9z"/><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1"/>'),
  website: svg('<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>'),
};

/** The network's own name, the same in every language. */
export const SOCIAL_NAME: Record<SocialId, string> = {
  instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube', linkedin: 'LinkedIn',
  pinterest: 'Pinterest', x: 'X', etsy: 'Etsy', whatsapp: 'WhatsApp', website: 'Web',
};

/** The hosts a pasted address of each network may have. */
const HOSTS: Record<Exclude<SocialId, 'website'>, RegExp> = {
  instagram: /^(www\.)?instagram\.com$/, facebook: /^(www\.|m\.)?(facebook|fb)\.com$/, tiktok: /^(www\.)?tiktok\.com$/,
  youtube: /^(www\.|m\.)?(youtube\.com|youtu\.be)$/, linkedin: /^(www\.|[a-z]{2}\.)?linkedin\.com$/, pinterest: /^(www\.|[a-z]{2}\.)?pinterest\.(com|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2})$/,
  x: /^(www\.)?(x|twitter)\.com$/, etsy: /^(www\.)?etsy\.com$/, whatsapp: /^(wa\.me|(api\.|www\.)?whatsapp\.com)$/,
};
/** From her name on the network to its address. */
const FROM_NAME: Record<Exclude<SocialId, 'website'>, (n: string) => string> = {
  instagram: (n) => `https://instagram.com/${n}`, facebook: (n) => `https://facebook.com/${n}`, tiktok: (n) => `https://tiktok.com/@${n}`,
  youtube: (n) => `https://youtube.com/@${n}`, linkedin: (n) => `https://linkedin.com/in/${n}`, pinterest: (n) => `https://pinterest.com/${n}`,
  x: (n) => `https://x.com/${n}`, etsy: (n) => `https://etsy.com/shop/${n}`, whatsapp: (n) => `https://wa.me/${n.replace(/\D/g, '')}`,
};

/** The link a field makes, or null when it makes none (empty, another site, not an address). */
export function socialHref(id: SocialId, raw: string | undefined): string | null {
  const v = (raw ?? '').trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v) || (id === 'website' && /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(v))) {
    let url: URL;
    try { url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`); } catch { return null; }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (id !== 'website' && !HOSTS[id].test(url.hostname.toLowerCase())) return null;
    return url.toString();
  }
  if (id === 'website') return null;
  const name = v.replace(/^@/, '');
  if (id === 'whatsapp') return /^\+?[\d\s.-]{6,20}$/.test(name) ? FROM_NAME.whatsapp(name) : null;
  return /^[\w.-]{1,80}$/.test(name) ? FROM_NAME[id](name) : null;
}

/** Read back: known networks, one short line each. The old Instagram field counts when the list has none. */
export function normalizeSocials(raw: unknown, instagram = ''): Socials {
  const r = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const out: Socials = {};
  for (const id of SOCIALS) {
    const v = r[id];
    if (typeof v === 'string' && v.trim()) out[id] = v.trim().slice(0, 300);
  }
  if (!out.instagram && instagram.trim()) out.instagram = instagram.trim().slice(0, 300);
  return out;
}

/** What the page shows: each network with a link, in the list's order. */
export function socialLinks(socials: Socials): Array<{ id: SocialId; href: string; name: string; icon: string }> {
  return SOCIALS.flatMap((id) => {
    const href = socialHref(id, socials[id]);
    return href ? [{ id, href, name: SOCIAL_NAME[id], icon: SOCIAL_ICON[id] }] : [];
  });
}
