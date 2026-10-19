/**
 * The site's font licence, written with every export. The font itself (Jost,
 * SIL Open Font License) is inside the page (fillShell): the host writes no
 * .woff2 into a site folder, and a page that loads its font from Google sends
 * every visitor's address there (doc 145, checked 09/10).
 */
import ofl from './fonts/OFL.txt?raw';
import { utf8Base64 } from '../data/bytes';

export const SITE_FONT_FILES: ReadonlyArray<{ rel: string; base64: string }> = [
  { rel: 'assets/jost-OFL.txt', base64: utf8Base64(ofl) },
];
