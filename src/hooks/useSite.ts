import type { PreviewProgress } from '../components/PagePreview';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getLanguage, useI18n } from '../i18n';
import { declareSiteFolder, deploySite, hostIO, joinFilm, openStudioWindow, readImage, readMedia, removeSiteToken, saveSiteAsset, sdk, takeawayDoor, setSiteToken, siteTokenState, videoToolsStatus, webClipBase, type TokenState } from '../data/host';
import { loadStudioJson, SITE_FILE } from '../data/folderStore';
import { loadKit } from '../data/kitIO';
import { readSitePosts, type SitePost } from '../data/blogIO';
import { KitError } from '../model/kit';
import { SITE_FONT_FILES } from '../site/fonts';
import { toWebp } from '../data/webp';
import { normalizeSiteSettings } from '../model/records';
import { profileById } from '../model/profiles';
import { filmOf } from '../model/film';
import { filmOnSite } from '../model/filmRecord';
import { firstSitePhoto } from '../model/scenePhotos';
import { publishStage, siteFields, sitePrint } from '../model/publish';
import { legalMarkdown } from '../site/legalPages';
import { allCreations, allRows, blogAssets, buildSiteData, cellFiles, legalSiteOf, pagePhotoAsset, PORTRAIT_ASSET, EXPORT_QUALITY, exportSite, fillShell, filmSources, onlineScenes, slugify, type ExportDeps, type SiteInput } from '../site/buildSite';
import { buildPreview, swapAsset, withErrorWatch, withMenuEditing, type Preview } from '../site/preview';
import { LOGO_ASSET } from '../site/logo';
import siteTemplate from '../site/template.html?raw';
import { describeError } from '../components/errors';
import type { SiteWork } from '../components/SitePanel';
import type { Studio } from './useStudio';

/** A window opened for the site preview only (plugins.detach, instance in the URL). */
export const PREVIEW_INSTANCE = 'site-preview';
function readInstance(): string | null {
  try { return new URLSearchParams(window.location.search).get('instance'); }
  catch (err) { console.warn('[vitrine-studio] no location to read the instance from:', err); return null; }
}
export const IS_PREVIEW_WINDOW = readInstance() === PREVIEW_INSTANCE;

type ErrorShown = { key: string; raw?: string };

/**
 * The website: its folder and hosting token, a preview built in memory with
 * the export's own settings, one picture compared as the site will get it,
 * the export, and the publication with the person's own account.
 */
export function useSite(studio: Studio, siteTabOpen: boolean) {
  const { t } = useI18n();
  const lang = getLanguage();
  const { folder, alive, loaded, site, setSite, patchSite, scenes, pieces, films, fail } = studio;
  // The website's home film: the one put on it.
  const film = filmOnSite(films ?? []);
  const [token, setToken] = useState<TokenState | null>(null);
  const [work, setWork] = useState<SiteWork>({ kind: 'idle' });
  /** The site as the export would write it, held in memory (object URLs). */
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewWork, setPreviewWork] = useState<{ done: number; total: number } | null>(null);
  const [previewError, setPreviewError] = useState<ErrorShown | null>(null);
  /** One picture, as held and as the site would get it. */
  const [check, setCheck] = useState<{ before: string; after: string } | null>(null);
  const [checking, setChecking] = useState(false);

  // The preview's object URLs are released when it is replaced, closed, or the studio closes.
  const previewRef = useRef<Preview | null>(null);
  const release = (p: Preview | null) => p?.urls.forEach((u) => URL.revokeObjectURL(u));
  useEffect(() => () => release(previewRef.current), []);
  const showPreview = (p: Preview | null) => {
    release(previewRef.current);
    previewRef.current = p;
    setPreview(p);
  };

  // The hosting token's state (never the token): asked once the folder is read, for the
  // site bar on every screen, and again each time the Site screen opens.
  useEffect(() => {
    if (!loaded || IS_PREVIEW_WINDOW) return;
    siteTokenState().then((s) => alive.current && setToken(s), (err: unknown) => console.warn('[vitrine-studio] token state unreadable:', err));
  }, [loaded, siteTabOpen, alive]);

  /** The trade's names for the three beats, in the site's language. */
  const beatsOf = (lang: ReturnType<typeof getLanguage>) => {
    const b = profileById(studio.settings.profileId).beats;
    return { place: b.place[lang], piece: b.piece[lang], alive: b.alive[lang] };
  };

  /** The added text pages' pictures on disk, by their name on the site. */
  const pagePhotos = () => site.pages.flatMap((p) => (p.type === 'text' && p.photo ? [{ name: pagePhotoAsset(p.id), path: p.photo }] : []));

  /** What the page shows, and the export's own settings, from the studio as it is now. */
  /** What every build of the site shares: her settings as they are now. Each caller adds its records. */
  const siteInput = (lang: SiteInput['lang'], records: Pick<SiteInput, 'scenes' | 'pieces'> & Partial<SiteInput>): SiteInput => ({
    ...siteFields(site), lang, today: new Date().toISOString().slice(0, 10), untitled: t('scenes.noUniverse'), beats: beatsOf(lang),
    ...records,
  });

  // The print of the site as the studio would send it now: equal to the one kept with the
  // last publish, the site online is up to date (model/publish.ts). Made again only when
  // something it reads changed.
  const untitled = t('scenes.noUniverse');
  const profileId = studio.settings.profileId;
  const printNow = useMemo(() => {
    const b = profileById(profileId).beats;
    const filmFiles = film ? filmSources(film, filmOf(profileById(film.profileId)).steps) : null;
    return sitePrint({ ...siteFields(site), lang, untitled, beats: { place: b.place[lang], piece: b.piece[lang], alive: b.alive[lang] }, scenes, pieces, film: filmFiles }, site, { scenes, pieces });
  }, [site, scenes, pieces, film, lang, untitled, profileId]);
  // What a publish needs: the folder, the token and the address (Site › Connection), a scene online and a name.
  const address = site.projectName || slugify(site.brand.name);
  const connected = !!site.siteId && !!token?.present && !!address;
  const missing = [...(onlineScenes(scenes, pieces).length > 0 ? [] : ['scene' as const]), ...(site.brand.name.trim() ? [] : ['name' as const])];
  const stage = publishStage({ connected, missing, ...(site.lastPublish ? { live: site.lastPublish } : {}), printNow });
  // « It is online » stays said until the site changes again.
  useEffect(() => setWork((w) => (w.kind === 'published' ? { kind: 'idle' } : w)), [printNow]);

  const build = (posts: SitePost[], links?: Array<{ title: string; href: string }>) => {
    const lang = getLanguage();
    const filmFiles = film ? filmSources(film, filmOf(profileById(film.profileId)).steps) : null;
    const data = buildSiteData(siteInput(lang, { scenes, pieces, posts, film: filmFiles, ...(links ? { links } : {}) }));
    const shell = fillShell(siteTemplate, site.brand, lang, data);
    const settings: Pick<ExportDeps, 'readImage' | 'readMedia' | 'toWebp' | 'quality' | 'imageKb' | 'logoPath' | 'portraitPath' | 'extraFiles' | 'creationPhotos' | 'blogFiles' | 'pagePhotos'> = {
      // Not the display cache: an export of a big site would keep every picture in memory.
      readImage: readMedia,
      readMedia,
      toWebp,
      quality: site.quality,
      imageKb: site.imageKb,
      ...(site.identity.logoPath ? { logoPath: site.identity.logoPath } : {}),
      ...(site.brand.portrait ? { portraitPath: site.brand.portrait } : {}),
      creationPhotos: Object.fromEntries(Object.entries(site.showcase).filter(([, s]) => s.show.photos).map(([id, s]) => [id, s.photos])),
      blogFiles: blogAssets(posts, pieces),
      pagePhotos: pagePhotos(),
      // The page's font travels with it.
      extraFiles: [...SITE_FONT_FILES],
    };
    return { data, shell, filmFiles, settings };
  };

  const chooseSiteFolder = async () => {
    try {
      const f = await declareSiteFolder();
      await patchSite((cur) => ({ ...cur, siteId: f.id, siteName: f.name }));
    } catch (err) {
      if (String(err).includes('CANCELED')) return;
      fail(err);
    }
  };

  /** Builds the site in memory, with the export's own settings, and shows it. */
  const previewNow = async () => {
    setPreviewError(null);
    setPreviewWork({ done: 0, total: 1 });
    try {
      // The posts as written in Notes now.
      const { data, shell, filmFiles, settings } = build(await readSitePosts(site.posts, hostIO));
      const built = await buildPreview(data, scenes, pieces, shell, {
        ...settings,
        onProgress: (done, total) => alive.current && setPreviewWork({ done, total }),
        toUrl: (bytes, type) => URL.createObjectURL(new Blob([bytes], { type })),
      }, filmFiles);
      if (!alive.current) { release(built); return; }
      showPreview(built);
    } catch (err) {
      console.error('[vitrine-studio] the preview stopped:', err);
      if (alive.current) setPreviewError(describeError(err));
    } finally {
      if (alive.current) setPreviewWork(null);
    }
  };

  const previewInWindow = async () => {
    try {
      await openStudioWindow(PREVIEW_INSTANCE);
    } catch (err) {
      console.error('[vitrine-studio] the preview window did not open:', err);
      setPreviewError(describeError(err));
    }
  };

  /** The first picture of the site, as it is and as the export would write it now. */
  const checkCompression = async () => {
    const path = firstSitePhoto(onlineScenes(scenes, pieces));
    if (!path) return;
    setChecking(true);
    setPreviewError(null);
    try {
      const before = await readMedia(path);
      const q = EXPORT_QUALITY[site.quality];
      const b64 = await toWebp(before, q.large, q.webp, site.imageKb === null ? undefined : site.imageKb * 1000);
      if (alive.current) setCheck({ before, after: `data:image/webp;base64,${b64}` });
    } catch (err) {
      console.error('[vitrine-studio] the compression check stopped:', err);
      if (alive.current) setPreviewError(describeError(err));
    } finally {
      if (alive.current) setChecking(false);
    }
  };

  // The site's settings can change in the preview window (its colours): back on
  // this window, they are read again, so a later save never writes the old ones.
  useEffect(() => {
    if (!folder || IS_PREVIEW_WINDOW) return;
    const onFocus = () => {
      loadStudioJson(hostIO, folder, SITE_FILE)
        .then((raw) => { if (alive.current && raw) setSite(normalizeSiteSettings(raw, '')); })
        .catch((err: unknown) => console.warn('[vitrine-studio] site settings not re-read on focus:', err));
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [folder, alive, setSite]);

  // The preview window builds the site once the folder is read, and shows only that.
  const previewStarted = useRef(false);
  useEffect(() => {
    if (!IS_PREVIEW_WINDOW || !loaded || previewStarted.current) return;
    previewStarted.current = true;
    void previewNow();
    // previewNow reads the state of the render that saw `loaded`; once per window.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  /** Writes the whole site into its folder. Resolves false when it stopped, after saying why. */
  /** The whole site written through `save` (its declared folder, or a folder she picked to carry it away). */
  const writeSite = async (save: ExportDeps['save'], onProgress: ExportDeps['onProgress']) => {
    if (!folder) throw new Error('NO_FOLDER');
    // The site kit's pages go with every export, linked from the menu.
    // A kit that can no longer be read says so, and Site › Copies offers to remove it.
    const kit = site.kit ? await loadKit(folder, hostIO).catch((err: unknown) => { console.warn('[vitrine-studio] the kit in place is unreadable:', err); throw new KitError('KIT_IN_PLACE_UNREADABLE'); }) : null;
    const links = kit?.pages.map((p) => ({ title: p.title, href: p.rel }));
    const { data, shell, filmFiles, settings } = build(await readSitePosts(site.posts, hostIO), links);
    // The clips go lighter when ffmpeg is installed (Settings › Video); the rushes stay as they are.
    const tools = await videoToolsStatus().catch((err: unknown) => { console.warn('[vitrine-studio] video tools unreadable, clips go as they are:', err); return null; });
    // 🚨 Only a copy the host says it made FOR THE WEB: a host before this option ignores it and
    // writes the film's quality, heavier than the clip itself.
    const webClip = tools?.installed ? async (path: string) => { const r = await joinFilm([{ path }], webClipBase(path), true); return r.web === true ? r.path : null; } : undefined;
    return exportSite(data, scenes, pieces, shell, {
      ...settings,
      ...(webClip ? { webClip } : {}),
      ...(kit ? { extraFiles: [...(settings.extraFiles ?? []), ...kit.files] } : {}),
      save,
      onProgress,
    }, filmFiles);
  };

  /**
   * The site into a folder she picked (a USB key), under site/, ready to put online anywhere.
   * A file the key refuses (a kit page of a kind it does not take) is named, the rest still written.
   */
  const exportSiteTo = async (folderId: string, onProgress: ExportDeps['onProgress']) => {
    const failed: string[] = [];
    const res = await writeSite(async (name, base64) => {
      try {
        await takeawayDoor.writeBase64(folderId, `site/${name}`, base64);
      } catch (err) {
        console.warn('[vitrine-studio] a site file was not written to the copy:', name, err);
        failed.push(name);
      }
    }, onProgress);
    return { files: res.files - failed.length, failed };
  };

  const exportNow = async (): Promise<boolean> => {
    const siteId = site.siteId;
    if (!siteId || !folder) return false;
    setWork({ kind: 'exporting', done: 0, total: 1 });
    try {
      const res = await writeSite(async (name, base64) => { await saveSiteAsset(siteId, name, base64); }, (done, total) => alive.current && setWork({ kind: 'exporting', done, total }));
      // The measured weight stays with the site: it is shown until the next export.
      await patchSite((cur) => ({ ...cur, lastExport: { ...res, at: new Date().toISOString() } }));
      if (alive.current) setWork({ kind: 'exported', files: res.files });
      return true;
    } catch (err) {
      console.error('[vitrine-studio] the site export stopped:', err);
      if (alive.current) setWork({ kind: 'error', ...describeError(err) });
      return false;
    }
  };

  /**
   * Prepares the site, then publishes it with the person's own hosting account.
   * The print kept is the one of the site as the export STARTS: a change made
   * while it is being sent reads as not online yet, which it is not.
   */
  const publishNow = async () => {
    if (!site.siteId) return;
    const projectName = site.projectName || slugify(site.brand.name);
    const print = printNow;
    if (!(await exportNow())) return;
    if (alive.current) setWork({ kind: 'publishing', since: Date.now() });
    try {
      const d = await deploySite(site.siteId, projectName);
      await patchSite((cur) => ({ ...cur, projectName, lastPublish: { url: d.url, aliases: d.aliases, readyState: d.readyState, at: new Date().toISOString(), ...(cur.analytics ? { analytics: true } : {}), print } }));
      if (alive.current) setWork(d.readyState === 'READY' ? { kind: 'published' } : { kind: 'idle' });
    } catch (err) {
      console.error('[vitrine-studio] the site was not published:', err);
      if (alive.current) setWork({ kind: 'error', ...describeError(err) });
    }
  };

  /** Resolves true when the host sealed it: the field keeps the draft otherwise. */
  const saveToken = async (value: string): Promise<boolean> => {
    try {
      const next = await setSiteToken(value);
      if (alive.current) setToken(next);
      return true;
    } catch (err) {
      if (alive.current) setWork({ kind: 'error', ...describeError(err) });
      return false;
    }
  };

  const forgetToken = async () => {
    try {
      const next = await removeSiteToken();
      if (alive.current) setToken(next);
    } catch (err) {
      fail(err);
    }
  };

  /**
   * One post as its page on the site, quickly: the real page and its style,
   * with this post alone, its photos, the creations it shows and the logo
   * read from disk as they are (the scenes are left out, the export is not run).
   * Resolves an in-memory address; the caller lets it go.
   */
  const previewPost = async (post: SitePost, progress?: PreviewProgress): Promise<string> => {
    const lang = getLanguage();
    const data = buildSiteData(siteInput(lang, { scenes: [], pieces, posts: [post] }));
    return pageUrl(data, lang, blogAssets([post], pieces), progress);
  };

  /**
   * Every picture the Creations page names, read as they are: each piece's photo,
   * its further photos and the loupe's large copies. Shared by every quick preview
   * that carries the Creations page, so a piece opened from any of them has its picture.
   */
  const creationFiles = (data: ReturnType<typeof buildSiteData>): Array<{ name: string; path: string }> => allCreations(data).flatMap((c) => {
    const own = pieces.find((p) => p.id === c.id)?.photoPath;
    const more = site.showcase[c.id]?.photos ?? [];
    return [...(own ? [{ name: c.images[0]!, path: own }] : []), ...c.images.slice(1).flatMap((name, n) => (more[n] ? [{ name, path: more[n] }] : [])),
      ...(c.zoom ?? []).flatMap((name, n) => { const path = n === 0 ? own : more[n - 1]; return path ? [{ name, path }] : []; })];
  });

  /**
   * The Creations page as on the site, quickly: the pieces it shows, their photos and the
   * hover she chose, the real page and its style; the scenes are left out of the page.
   */
  const previewCreations = async (progress?: PreviewProgress): Promise<string> => {
    const lang = getLanguage();
    const data = buildSiteData(siteInput(lang, { scenes, pieces }));
    const files = creationFiles(data);
    // The rooms are not what is looked at here: without them the page opens straight on its sections.
    return pageUrl({ ...data, rows: [], ...(data.pages ? { pages: data.pages.filter((x) => x.type !== 'scenes') } : {}) }, lang, files, progress);
  };

  /** A page held in memory: its pictures read as they are and the logo, swapped in for their names. */
  /**
   * The scenes' page as on the site, quickly: the rooms online in her order, their
   * pictures and clips, the words over them; the rest of the site as it is.
   */
  const previewScenes = async (progress?: PreviewProgress): Promise<string> => {
    const lang = getLanguage();
    const data = buildSiteData(siteInput(lang, { scenes, pieces }));
    const files = allRows(data).flatMap((row) => row.scenes.flatMap((cell) => {
      const scene = scenes.find((x) => x.id === cell.id);
      return scene ? cellFiles(cell, scene) : [];
    }));
    // The scenes' page is the whole site: a piece opened from it, or the Creations page
    // reached from its menu, shows its photo (field 2026-10-17: every piece was a broken image).
    return pageUrl(data, lang, [...files, ...creationFiles(data), ...pagePhotos()], progress);
  };

  /**
   * The top of the home as on the site, light, for the logo's card (Tony: « une
   * prévisu light du site en condition »): the real page with the logo being
   * tried (`identity`), its real menu, and only the opening scene's pictures read.
   */
  const previewHome = async (identity: SiteInput['identity']): Promise<string> => {
    const lang = getLanguage();
    const data = buildSiteData({ ...siteInput(lang, { scenes, pieces }), identity });
    const stages = (data.pages ?? []).filter((p) => p.type === 'scenes');
    const cell = (data.rows.length ? data.rows : stages[0]?.rows ?? [])[0]?.scenes[0];
    const scene = cell && scenes.find((x) => x.id === cell.id);
    const files = cell && scene ? cellFiles(cell, scene) : [];
    return pageUrl(data, lang, files);
  };

  /**
   * About or Contact as on the site, quickly: the words as formatted, the portrait read
   * from disk, the rest of the site left out so the page opens straight on itself.
   */
  const previewInfo = async (progress?: PreviewProgress): Promise<string> => {
    const lang = getLanguage();
    // The text and form pages come along, so their own preview opens on them.
    const pages = site.pages.filter((p) => p.type === 'text' || p.type === 'form');
    const data = buildSiteData(siteInput(lang, { scenes: [], pieces: [], pages }));
    if (site.brand.portrait) data.portrait = PORTRAIT_ASSET;
    return pageUrl(data, lang, [...(site.brand.portrait ? [{ name: PORTRAIT_ASSET, path: site.brand.portrait }] : []), ...pagePhotos()], progress);
  };

  /** The two legal pages as the site would write them now, for the editor to start from. */
  const legalDrafts = (): { notice: string; privacy: string } => {
    const input = siteInput(getLanguage(), { scenes, pieces });
    return legalMarkdown(site.legal, legalSiteOf(input, buildSiteData(input)));
  };

  const pageUrl = async (data: ReturnType<typeof buildSiteData>, lang: ReturnType<typeof getLanguage>, files: Array<{ name: string; path: string }>, progress?: PreviewProgress): Promise<string> => {
    let html = fillShell(siteTemplate, site.brand, lang, data);
    const all = [...files, ...(data.identity?.logoSrc && site.identity.logoPath ? [{ name: LOGO_ASSET, path: site.identity.logoPath }] : [])];
    let done = 0;
    progress?.(0, all.length);
    for (const f of all) {
      // A photo that cannot be read stays a hole in the preview: the export would say so by name.
      // A clip is read as a video; everything else as a picture.
      const url = await (/\.mp4$/i.test(f.name) ? readMedia(f.path) : readImage(f.path)).catch((err: unknown) => { console.warn('[vitrine-studio] preview picture unreadable:', f.path, err); return ''; });
      if (url) html = swapAsset(html, f.name, url);
      progress?.(++done, all.length);
    }
    return URL.createObjectURL(new Blob([withErrorWatch(withMenuEditing(html))], { type: 'text/html' }));
  };

  const openLink = (url: string) => {
    sdk.invoke('shell.openExternal', { url }, 15_000).catch((err: unknown) => fail(err));
  };

  return {
    token, work, preview, previewWork, previewError, check, checking, stage, missing, connected,
    chooseSiteFolder, previewNow, previewPost, previewCreations, previewScenes, previewInfo, previewHome, legalDrafts, exportSiteTo, closePreview: () => showPreview(null), previewInWindow, checkCompression,
    closeCheck: () => setCheck(null), exportNow, publishNow, saveToken, forgetToken, openLink,
  };
}
