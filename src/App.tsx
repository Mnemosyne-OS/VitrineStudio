import { Coins, Globe, Plus, Settings, X, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { getLanguage, useI18n } from './i18n';
import { MODEL_FOR_QUALITY, openVideoSettings, pickImage } from './data/host';
import { saveDroppedPhoto } from './data/photos';
import { clipDeps } from './data/hostDeps';
import { filesOwnedBy } from './data/removeScene';
import { newId } from './model/records';
import { profileById } from './model/profiles';
import { firstSitePhoto, latestPicture } from './model/scenePhotos';
import { livingFallsBack, normalizeMenu, normalizeMenuOrder, onlineScenes, slugify, type MenuChange } from './site/buildSite';
import type { Beat, Piece, Scene } from './model/types';
import { errorText } from './components/errors';
import { Ambient } from './components/Ambient';
import { PiecesPanel } from './components/PiecesPanel';
import { ScenesPanel } from './components/ScenesPanel';
import { SceneWizard, type SceneWizardInitial } from './components/SceneWizard';
import { SettingsPanel } from './components/SettingsPanel';
import { Lightbox } from './components/Lightbox';
import { EvolutionView } from './components/EvolutionView';
import { SiteLook } from './components/SitePanel';
import { SiteBar, type SeeWhat } from './components/SiteBar';
import { SiteCopies, SiteScreen, type SiteSection } from './components/SiteScreen';
import { PreviewLayer, type PreviewProgress } from './components/PagePreview';
import { siteLink } from './model/publish';
import { describeError } from './components/errors';
import { FilmPanel } from './components/FilmPanel';
import { FilmWizard } from './components/FilmWizard';
import { filmOf } from './model/film';
import { estimateImage, formatUsd } from './model/costs';
import { UpscaleCard } from './components/UpscaleCard';
import { LogoPanel } from './components/LogoPanel';
import { SitePreview, type SiteColours } from './components/SitePreview';
import { CompressionCheck } from './components/CompressionCheck';
import { CostsPanel } from './components/CostsPanel';
import { RemoveSceneDialog } from './components/RemoveSceneDialog';
import { filesOwnedByFilm } from './data/removeFilm';
import { RemovePieceDialog } from './components/RemovePieceDialog';
import { useStudio } from './hooks/useStudio';
import { FolderWatch } from './components/FolderWatch';
import { AgentMakes } from './components/AgentMakes';
import { StudioAgentActions } from './components/StudioAgentActions';
import { anyMaking, sceneBusy } from './data/agentGuards';
import { useKit } from './hooks/useKit';
import { KitCard } from './components/KitCard';
import { TakeawayCard } from './components/TakeawayCard';
import { ConnectionCard, HostingPanel } from './components/HostingPanel';
import { useHosting } from './hooks/useHosting';
import { useTakeaway } from './hooks/useTakeaway';
import { BlogPanel } from './components/BlogPanel';
import { useBlog } from './hooks/useBlog';
import { CurrencyCard } from './components/CurrencyCard';
import { currencySymbol } from './model/currency';
import { useCosts } from './hooks/useCosts';
import { usePieces } from './hooks/usePieces';
import { useScenes } from './hooks/useScenes';
import { useFilm } from './hooks/useFilm';
import { IS_PREVIEW_WINDOW, useSite } from './hooks/useSite';
import { inPieceOrder, reorderSome } from './model/showcase';
import { onPage, pageIdFor, type PageType, type SitePage } from './model/pages';
import { TextPagePanel } from './components/TextPagePanel';
import { FormPagePanel } from './components/FormPagePanel';
import { AddPageDialog } from './components/AddPageDialog';
import { withIdentityChange } from './site/logo';
import { PAGE_ICON } from './components/pageIcons';
import { PageBar } from './components/PageBar';
import { PhotoWorkbench } from './components/PhotoWorkbench';
import { AboutPanel } from './components/AboutPanel';
import { ContactPanel } from './components/ContactPanel';
import type { Brand } from './site/buildSite';

type Kind = 'scenes' | 'pieces' | 'blog';
/** A built-in screen, or an added page by its id. */
type Tab = Kind | 'about' | 'contact' | 'film' | 'logo' | 'site' | 'hosting' | 'costs' | 'settings' | `page:${string}`;
// Her order of work: what she makes first, then its scenes, the words; her added pages; then the film and the logo (Tony).
const CONTENT_TABS: Tab[] = ['pieces', 'scenes', 'blog', 'about', 'contact'];
const AFTER_TABS: Tab[] = ['film', 'logo'];
/** The built-in screen that edits an added page, by its model. */
const KIND_OF: Partial<Record<PageType, Kind>> = { catalogue: 'pieces', scenes: 'scenes', blog: 'blog' };
// The tools, apart from the work, as icons: they are not part of her order of work.
// One for the site: its hosting is a part of the Site screen (doc 145 §10.20); `hosting` still opens it, on Online.
const TOOL_TABS: Array<[Tab, LucideIcon]> = [['site', Globe], ['costs', Coins], ['settings', Settings]];

/**
 * Vitrine Studio: stage your own pieces in generated rooms (doc 145).
 * The studio's state and its gestures live in hooks (src/hooks), one per
 * subject; this component picks the screen and wires them to the panels.
 */
export default function App() {
  const { t, tc } = useI18n();
  const [tab, setTab] = useState<Tab>('pieces');
  // The Site screen's part; null = the one that matters now (Connection until it is made, then Online).
  const [siteSection, setSiteSection] = useState<SiteSection | null>(null);
  /** A screen opened by a click, the agent door or the site bar: `hosting` is Site › Online. */
  const go = (x: Tab, section: SiteSection | null = null) => {
    if (x === 'hosting') { setTab('site'); setSiteSection('online'); return; }
    if (x === 'site') setSiteSection(section);
    setTab(x);
  };
  // This page as on the site, opened from the site bar's « See »; its error is said in the bar.
  const [seeing, setSeeing] = useState<{ make: (p: PreviewProgress) => Promise<string>; hash: string; n: number } | null>(null);
  const [seeError, setSeeError] = useState<{ key: string; raw?: string } | null>(null);
  // The new-scene wizard, with what an agent already heard; `n` remounts it when an agent opens it again.
  const [wizard, setWizard] = useState<{ initial: SceneWizardInitial; n: number } | null>(null);
  const openWizard = (initial: SceneWizardInitial = {}) => setWizard((w) => ({ initial, n: (w?.n ?? 0) + 1 }));
  const [viewing, setViewing] = useState<{ id: string; beat: Beat } | null>(null);
  const [removing, setRemoving] = useState<Scene | null>(null);
  const [removingPiece, setRemovingPiece] = useState<Piece | null>(null);
  // A piece's pictures over time, opened from its tile or from one of its scenes.
  const [evolving, setEvolving] = useState<string | null>(null);
  const [addingPage, setAddingPage] = useState(false);
  const [improving, setImproving] = useState<string | null>(null);

  const studio = useStudio();
  // An added page is edited by the built-in screen of its model, on its own content.
  const activePage = tab.startsWith('page:') ? studio.site.pages.find((p) => `page:${p.id}` === tab) : undefined;
  const kind: Tab = activePage ? KIND_OF[activePage.type] ?? tab : tab;
  const pageId = activePage?.id ?? null;
  const costs = useCosts(studio);
  const pieceActions = usePieces(studio);
  const sceneActions = useScenes(studio, costs, (id) => studio.site.showcase[id]?.size);
  const filmActions = useFilm(studio, costs);
  // The film wizard (a new film) and the film whose pictures it asked to start.
  const [filmWizard, setFilmWizard] = useState(false);
  const [makeFilmOf, setMakeFilmOf] = useState<string | null>(null);
  // The film whose removal is being asked.
  const [removingFilm, setRemovingFilm] = useState<string | null>(null);
  const siteActions = useSite(studio, tab === 'site');
  const siteAddress = studio.site.projectName || slugify(studio.site.brand.name);
  // The folder, the token and the address: what a publish needs, set in Site › Connection.
  // Null while the token's state is not read: Online waits, it never sends her to Connection for that.
  const siteConnected = siteActions.connected;
  const section: SiteSection = siteSection ?? (siteConnected === false ? 'connect' : 'online');
  const hosting = useHosting(siteAddress, tab === 'site' && section === 'online', siteConnected === true, !!studio.site.lastPublish);
  // The studio carried away on a key and brought back (doc 145 §10.13).
  const takeaway = useTakeaway(studio, siteActions.exportSiteTo);
  const kitActions = useKit(studio);
  const blog = useBlog(studio, kind === 'blog', pageId);
  // The first-launch kit card, put aside for this session by "later".
  const [kitLater, setKitLater] = useState(false);
  const { folder, loaded, notice, setNotice, pieces, scenes, settings, changeSettings, site, saveSite, patchSite, film, fail } = studio;
  /** A menu entry renamed, or the menu reordered, in a preview: saved with the site. */
  const renameMenu = (change: MenuChange) => void patchSite((cur) => ('pieces' in change
    // The page shows some of the pieces: their new order goes back among all of them.
    ? { ...cur, pieceOrder: reorderSome(inPieceOrder(studio.pieces, cur.pieceOrder).map((p) => p.id), change.pieces) }
    : 'order' in change
      ? { ...cur, menuOrder: normalizeMenuOrder(change.order) }
      : { ...cur, menu: normalizeMenu({ ...cur.menu, [change.key]: change.name }) }));

  /** Some of who she is (About, Contact), saved at once; a field set to undefined leaves. */
  const setBrand = (change: Partial<Brand>) => void patchSite((cur) => {
    const brand = { ...cur.brand, ...change };
    for (const k of Object.keys(change) as Array<keyof Brand>) if (change[k] === undefined) delete brand[k];
    return { ...cur, brand };
  });
  // Only the three colours: the preview window may have been opened long before.
  const setColours = (c: SiteColours) => void patchSite((cur) => ({ ...cur, brand: { ...cur.brand, ...c } }));

  if (folder === undefined) return <main className="app"><Ambient /><p className="muted">{t('app.loading')}</p></main>;

  if (!folder) {
    return (
      <main className="app">
        <Ambient />
        <div className="welcome glass">
          <h1>{t('app.title')}</h1>
          <p>{t('welcome.intro')}</p>
          <p className="muted">{t('welcome.folderHint')}</p>
          <button className="primary big" onClick={() => void studio.chooseFolder()}>{t('welcome.chooseFolder')}</button>
        </div>
      </main>
    );
  }

  if (IS_PREVIEW_WINDOW) {
    const { preview, previewError, previewWork } = siteActions;
    return preview ? <SitePreview preview={preview} standalone onClose={() => {}} onOpenWindow={() => {}} colours={site.brand} onColours={setColours} onMenu={renameMenu} /> : (
      <main className="app"><Ambient />
        {previewError
          ? <p className="error">{errorText(previewError)}</p>
          : <p className="muted"><span className="spinner small-spin" aria-hidden /> {t('preview.building', { done: previewWork?.done ?? 0, total: previewWork?.total ?? 1 })}</p>}
      </main>
    );
  }

  const profile = profileById(settings.profileId);
  const profileOf = (s: Scene) => profileById(s.profileId ?? settings.profileId);
  const validated = scenes.filter((s) => s.validated);
  const online = onlineScenes(scenes, pieces);
  const viewed = viewing ? scenes.find((s) => s.id === viewing.id) : undefined;
  const evolvingPiece = evolving ? pieces.find((p) => p.id === evolving) : undefined;
  const pageScenes = onPage(scenes, pageId, site.pages);
  const pagePieces = onPage(pieces, pageId, site.pages);
  // What « See » opens on this screen: this page alone, made quickly; elsewhere the whole site as it would be sent.
  const pageSee: { make: (p: PreviewProgress) => Promise<string>; hash: string } | null =
    kind === 'pieces' ? { make: siteActions.previewCreations, hash: pageId ?? 'creations' }
      : kind === 'scenes' ? { make: siteActions.previewScenes, hash: pageId ?? '' }
        : tab === 'about' ? { make: siteActions.previewInfo, hash: 'a-propos' }
          : tab === 'contact' ? { make: siteActions.previewInfo, hash: 'contact' }
            : activePage?.type === 'text' || activePage?.type === 'form' ? { make: siteActions.previewInfo, hash: activePage.id }
              : null;
  const seeWhat: SeeWhat = pageSee ? 'page' : 'site';
  const see = () => {
    setSeeError(null);
    siteActions.clearPreviewError();
    if (pageSee) setSeeing((cur) => ({ ...pageSee, n: (cur?.n ?? 0) + 1 }));
    else void siteActions.previewNow();
  };
  /** A new page, empty, opened at once. Its address is never one a record still carries (a removed page's content stays home). */
  /** A text or a form page's own content, saved at once. */
  const patchPage = (id: string, change: Partial<SitePage>) => void patchSite((cur) => ({ ...cur, pages: cur.pages.map((p) => {
    if (p.id !== id) return p;
    const next = { ...p, ...change };
    for (const k of Object.keys(change) as Array<keyof SitePage>) if (change[k] === undefined) delete next[k];
    return next;
  }) }));
  const addPage = (type: PageType, name: string) => {
    const taken = [...site.pages.map((p) => p.id), ...[...pieces, ...scenes, ...site.posts].map((r) => r.pageId).filter((x): x is string => !!x)];
    const id = pageIdFor(name, taken);
    // A form starts with what most ask: a name, an e-mail, a message.
    const fields = type === 'form' ? [
      { id: newId('f'), label: t('form.kind.text'), kind: 'text' as const, required: true },
      { id: newId('f'), label: t('form.kind.email'), kind: 'email' as const, required: true },
      { id: newId('f'), label: t('form.kind.textarea'), kind: 'textarea' as const, required: false },
    ] : undefined;
    void patchSite((cur) => ({ ...cur, pages: [...cur.pages, { id, type, name, ...(fields ? { fields } : {}) }] }));
    setAddingPage(false);
    setTab(`page:${id}`);
  };

  return (
    <main className="app">
      <Ambient path={latestPicture(scenes)} />
      <header className="top">
        <div className="title-block">
          <h1>{t('app.title')}</h1>
          <p className="muted small">{profile.label[getLanguage()]} · {tc('pieces.count', pieces.length)} · {tc('scenes.count', scenes.length)} · {tc('scenes.onSite', validated.length)}</p>
        </div>
        <nav className="segmented glass" aria-label={t('app.title')}>
          {CONTENT_TABS.map((x) => (
            <button key={x} className={tab === x ? 'on' : ''} aria-current={tab === x ? 'page' : undefined} onClick={() => setTab(x)}>{t(`tab.${x}`)}</button>
          ))}
          {site.pages.map((p) => {
            const Icon = PAGE_ICON[p.type];
            const key: Tab = `page:${p.id}`;
            return <button key={p.id} className={`tab-page ${tab === key ? 'on' : ''}`} aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)}><Icon className="ico" aria-hidden />{p.name}</button>;
          })}
          <button className="tab-add" aria-label={t('page.add')} data-tip={t('page.add')} onClick={() => setAddingPage(true)}><Plus className="ico solo" aria-hidden /></button>
          {AFTER_TABS.map((x) => (
            <button key={x} className={tab === x ? 'on' : ''} aria-current={tab === x ? 'page' : undefined} onClick={() => setTab(x)}>{t(`tab.${x}`)}</button>
          ))}
        </nav>
        <nav className="top-tools" aria-label={t('app.tools')}>
          {TOOL_TABS.map(([x, Icon]) => (
            <button key={x} className={`icon-btn glass ${tab === x ? 'chosen' : ''}`} aria-current={tab === x ? 'page' : undefined} aria-label={t(`tab.${x}`)} data-tip={t(`tab.${x}`)} onClick={() => go(x)}><Icon className="ico solo" aria-hidden /></button>
          ))}
        </nav>
      </header>
      {loaded && (
        <SiteBar stage={siteActions.stage} tokenUnread={siteActions.tokenUnread} onRetryToken={siteActions.rereadToken}
          onDismissError={() => { setSeeError(null); siteActions.clearPreviewError(); }} missing={siteActions.missing} link={siteLink(site.lastPublish, siteAddress, hosting.liveDomains)} work={siteActions.work}
          staleLiving={livingFallsBack(online)} see={seeWhat} seeing={siteActions.previewWork} seeError={seeError ?? siteActions.previewError}
          onSee={see} onPublish={() => void siteActions.publishNow()} onOpen={siteActions.openLink}
          onConnect={() => go('site', 'connect')}
          onFix={(item) => (item === 'name' ? go('site', 'look') : setTab('scenes'))} />
      )}
      {notice && (
        <p className={`notice glass ${notice.kind}`}>
          {notice.text}
          {notice.kind === 'error' && !loaded && <button className="link" onClick={() => void studio.load(folder)}>{t('app.retry')}</button>}
          <button className="link" onClick={() => setNotice(null)} aria-label={t('wizard.close')}><X className="ico solo" aria-hidden /></button>
        </p>
      )}
      {studio.unreadable.length > 0 && <p className="notice glass error">{tc('app.unreadable', studio.unreadable.length)} {studio.unreadable.join(', ')}</p>}
      {!loaded && !notice && <p className="muted">{t('app.loading')}</p>}
      {/* Records written into the folder by someone else (an agent, another app) show without reopening the studio. */}
      {loaded && folder && <FolderWatch folder={folder} onChange={studio.refresh} />}
      {/* What an agent may do here (doc 149): the studio's own functions, served while it is open. */}
      {loaded && folder && <StudioAgentActions studio={studio} sceneActions={sceneActions} siteActions={siteActions} pieceActions={pieceActions} openTab={(x) => go(x as Tab)}
        view={{
          showScene: (id, beat) => { setEvolving(null); setViewing({ id, beat }); },
          showPiece: (id) => { setViewing(null); setEvolving(id); },
          closeAll: () => { setViewing(null); setEvolving(null); setImproving(null); setWizard(null); setFilmWizard(false); setAddingPage(false); setSeeing(null); siteActions.closePreview(); siteActions.closeCheck(); },
          // The « new scene » button's own wizard, on the screen that has the button.
          newScene: (initial) => { setViewing(null); setEvolving(null); setImproving(null); if (kind !== 'scenes') setTab('scenes'); openWizard(initial); },
        }} />}
      {/* Pictures an agent asked for, made one scene at a time while the studio is open. */}
      {loaded && folder && (
        <AgentMakes folder={folder} scenesRef={studio.scenesRef} saveScene={studio.saveScene} replaceScene={studio.replaceScene} makeAll={sceneActions.makeAll}
          busy={(id) => sceneBusy(sceneActions.work, id)} making={() => anyMaking(sceneActions.work)} />
      )}
      {/* First launch of an empty studio: the site kit someone prepared, dropped once. */}
      {loaded && tab === 'pieces' && !site.kit && !kitLater && scenes.length === 0 && pieces.length === 0 && (
        <KitCard welcome kit={kitActions} installed={site.kit} pagesFolder={site.kitSource} onLater={() => setKitLater(true)} />
      )}
      {loaded && activePage && (
        <PageBar page={activePage} count={activePage.type === 'catalogue' ? pagePieces.length : activePage.type === 'scenes' ? pageScenes.length : blog.posts.length}
          onRename={(name) => void patchSite((cur) => ({ ...cur, pages: cur.pages.map((p) => (p.id === activePage.id ? { ...p, name } : p)) }))}
          onRemove={() => { const home = KIND_OF[activePage.type] ?? 'pieces'; void patchSite((cur) => ({ ...cur, pages: cur.pages.filter((p) => p.id !== activePage.id) })); setTab(home); }} />
      )}
      {loaded && kind === 'scenes' && (
        <ScenesPanel scenes={inPieceOrder(pageScenes, site.sceneOrder)} pieces={pieces}
          // This page's scenes in their new order, put back among all the others (each page keeps its own).
          onReorder={(ids) => void patchSite((cur) => ({ ...cur, sceneOrder: reorderSome(inPieceOrder(studio.scenes, cur.sceneOrder).map((x) => x.id), ids) }))} profileOf={profileOf} work={sceneActions.work}
          onNew={() => openWizard()}
          onMakeAll={(s) => void sceneActions.makeAll(s)}
          onValidate={(s, v) => void sceneActions.validate(s, v)}
          onMove={(s, u) => void sceneActions.moveTo(s, u)}
          onOpen={(s, b) => setViewing({ id: s.id, beat: b })}
          sceneMap={site.sceneMap} onSceneMap={(next) => void patchSite((cur) => ({ ...cur, sceneMap: next }))}
          onRemove={(s) => setRemoving(s)}
          costs={settings.showCosts ? studio.costs : null}
          imageModel={MODEL_FOR_QUALITY[settings.quality]} />
      )}
      {loaded && kind === 'pieces' && (
        <PiecesPanel pieces={inPieceOrder(pagePieces, site.pieceOrder)} onReorder={(ids) => void patchSite((cur) => ({ ...cur, pieceOrder: reorderSome(inPieceOrder(studio.pieces, cur.pieceOrder).map((x) => x.id), ids) }))}
          categories={site.categories} onCategories={(next) => void patchSite((cur) => ({ ...cur, categories: next }))} busy={pieceActions.busy} uploads={pieceActions.uploads}
          onAddFiles={(f) => void pieceActions.addPiecesFromFiles(f, pageId)}
          onPickNew={() => void pieceActions.pickNewPiece(pageId).catch(fail)}
          onSetPhoto={(p, f) => void pieceActions.setPhotoFromFile(p, f)}
          onPickPhoto={(p) => void pieceActions.pickPhoto(p)}
          onEdit={(p, patch) => void pieceActions.editPiece(p, patch)}
          onRemove={(p) => setRemovingPiece(p)}
          onImprove={(p) => setImproving(p.id)}
          onEvolution={(p) => setEvolving(p.id)}
          showcase={site.showcase}
          priceSymbol={currencySymbol(site.currency.main, getLanguage())}
          online={new Set(online.map((s) => s.pieceId))}
          viewer={site.viewer} onViewer={(viewer) => void patchSite((cur) => ({ ...cur, viewer }))} hover={site.creationsHover} onHover={(creationsHover) => void patchSite((cur) => ({ ...cur, creationsHover }))}
          onShow={(p, next) => void patchSite((cur) => ({ ...cur, showcase: { ...cur.showcase, [p.id]: next } }))} />
      )}
      {loaded && activePage?.type === 'text' && (
        <TextPagePanel key={activePage.id} text={activePage.text ?? ''} onText={(text) => patchPage(activePage.id, { text })}
          photo={activePage.photo} onPhoto={(photo) => patchPage(activePage.id, { photo })}
          layout={activePage.layout ?? 'right'} onLayout={(layout) => patchPage(activePage.id, { layout: layout === 'right' ? undefined : layout })}
          photoLabel={t('page.photo')} />
      )}
      {loaded && activePage?.type === 'form' && (
        <FormPagePanel key={activePage.id} text={activePage.text ?? ''} onText={(text) => patchPage(activePage.id, { text })}
          fields={activePage.fields ?? []} onFields={(fields) => patchPage(activePage.id, { fields })}
          layout={activePage.layout ?? 'left'} onLayout={(layout) => patchPage(activePage.id, { layout: layout === 'left' ? undefined : layout })}
          sendsTo={site.brand.formspree ? 'formspree' : site.brand.email ? 'email' : 'none'}
          />
      )}
      {loaded && tab === 'about' && <AboutPanel brand={site.brand} onBrand={setBrand} />}
      {loaded && tab === 'contact' && <ContactPanel brand={site.brand} onBrand={setBrand} onPreview={siteActions.previewInfo} onMenu={renameMenu} legal={site.legal} onLegal={(legal) => void patchSite((cur) => ({ ...cur, legal }))} legalDrafts={siteActions.legalDrafts} />}
      {loaded && tab === 'film' && film && (
        <FilmPanel key={film.id} films={studio.films ?? []} onPickFilm={studio.setFilmId} onNewFilm={() => setFilmWizard(true)} onRemoveFilm={() => setRemovingFilm(film.id)} onDuplicateFilm={(name) => void filmActions.duplicateFilm(film.id, name)}
          startMaking={makeFilmOf === film.id} onStarted={() => setMakeFilmOf(null)} film={film} getFilm={() => filmActions.getFilm(film.id) ?? film} updateFilm={(change) => filmActions.updateFilm(film.id, change)}
          followClip={(stepId, job) => filmActions.followFilmClip(film.id, stepId, job)} onSite={(on) => filmActions.setOnSite(film.id, on)}
          clipDeps={clipDeps} clipError={filmActions.clipErrorOf(film.id)}
          profile={profileById(film.profileId)} pieces={pieces} quality={settings.quality} advanced={settings.advanced}
          spendImage={costs.spendingImage(film.id)} folder={folder} />
      )}
      {loaded && filmWizard && (() => {
        const filmProfile = profileById(settings.profileId);
        const count = filmOf(filmProfile).steps.length;
        const each = estimateImage(MODEL_FOR_QUALITY[settings.quality]);
        return (
          <FilmWizard pieces={pieces} profile={filmProfile} aspectRatio={settings.aspectRatio} imageCount={count}
            imageCost={formatUsd(each === null ? null : each * count, getLanguage())} onClose={() => setFilmWizard(false)}
            onCreate={async (start, makeNow) => {
              const made = await filmActions.createFilm(start);
              // A film that could not be written is not opened: the wizard says why and stays.
              if (!made) throw new Error('WRITE_FAILED');
              setTab('film');
              if (makeNow) setMakeFilmOf(made.id);
            }} />
        );
      })()}
      {loaded && tab === 'logo' && (
        <LogoPanel identity={site.identity} brand={site.brand} makePage={siteActions.previewHome} onChange={(identity) => void patchSite((cur) => ({ ...cur, identity: withIdentityChange(cur.identity, site.identity, identity) }))} />
      )}
      {loaded && kind === 'blog' && <BlogPanel blog={blog} pieces={pieces} onPreview={siteActions.previewPost} onMenu={renameMenu} />}
      {loaded && tab === 'costs' && (
        <CostsPanel costs={studio.costs} readable={studio.costsReadable} scenes={scenes} pieces={pieces} settings={settings}
          onShowCosts={(show) => void changeSettings({ ...settings, showCosts: show })} />
      )}
      {loaded && tab === 'site' && (
        <SiteScreen section={section} onSection={setSiteSection} connected={siteConnected !== false}>
          {section === 'online' && (
            <HostingPanel settings={site} connected={siteConnected} host={hosting} onSave={(s) => void saveSite(s)} onOpen={siteActions.openLink}
              onConnect={() => setSiteSection('connect')}
              onVideoSettings={() => void openVideoSettings().catch((err: unknown) => console.warn('[vitrine-studio] video settings not opened:', err))} />
          )}
          {section === 'look' && (
            <SiteLook settings={site} onlineCount={online.length} enlarged={online.filter((s) => s.enlarged && Object.keys(s.enlarged).length > 0).length}
              samplePhoto={firstSitePhoto(online)} busy={siteActions.work.kind === 'exporting' || siteActions.work.kind === 'publishing'}
              onSave={(s) => void saveSite(s)} onCheck={() => void siteActions.checkCompression()} checking={siteActions.checking} />
          )}
          {section === 'connect' && (
            <ConnectionCard settings={site} token={siteActions.token} onSave={(s) => void saveSite(s)}
              onChooseFolder={() => void siteActions.chooseSiteFolder()} onSetToken={siteActions.saveToken}
              onRemoveToken={() => void siteActions.forgetToken()} onOpen={siteActions.openLink} />
          )}
          {section === 'copies' && (
            <SiteCopies canExport={online.length > 0 && !!site.brand.name.trim()} hasFolder={!!site.siteId} work={siteActions.work} onExport={() => void siteActions.exportNow()}>
              <TakeawayCard run={takeaway.run} restore={takeaway.restore}><KitCard kit={kitActions} installed={site.kit} pagesFolder={site.kitSource} /></TakeawayCard>
            </SiteCopies>
          )}
        </SiteScreen>
      )}
      {loaded && tab === 'settings' && (
        <SettingsPanel settings={settings} folder={folder} onChange={(s) => void changeSettings(s)} onChangeFolder={() => void studio.chooseFolder()}>
          <UpscaleCard scenes={scenes} getScenes={() => studio.scenesRef.current} scale={settings.upscaleScale}
            onScale={(s) => void changeSettings({ ...settings, upscaleScale: s })}
            onEnlarged={sceneActions.saveEnlarged} />
          <CurrencyCard currency={site.currency} onChange={(c) => void patchSite((cur) => ({ ...cur, currency: c }))} />
        </SettingsPanel>
      )}
      {viewing && viewed && (
        <Lightbox scene={viewed} profile={profileOf(viewed)} start={viewing.beat} onClose={() => setViewing(null)}
          tools={{
            piece: pieces.find((p) => p.id === viewed.pieceId), show: site.showcase[viewed.pieceId], currency: site.currency, work: sceneActions.work[viewed.id] ?? {}, advanced: settings.advanced,
            costs: settings.showCosts ? studio.costs : null, imageModel: MODEL_FOR_QUALITY[settings.quality],
            onMakeAll: (s) => void sceneActions.makeAll(s),
            onRemake: (s, b, change) => void sceneActions.remake(s, b, change),
            onValidate: (s, v) => void sceneActions.validate(s, v),
            onMakeClip: (s, style) => void sceneActions.makeClip(s, style),
            onCut: (s, cut) => void sceneActions.setClipCut(s, cut),
            onPrompt: (s, k, own) => void sceneActions.setScenePrompt(s, k, own),
            onRemove: (s) => setRemoving(s),
            onCaption: (s, c) => void sceneActions.setCaption(s, c),
            onChooseTake: (s, b, p) => void sceneActions.chooseTake(s, b, p),
            onDeleteTake: (s, b, p) => void sceneActions.deleteTake(s, b, p),
            onMotion: (s, m) => void sceneActions.setMotion(s, m),
            onEvolution: (p) => { setViewing(null); setEvolving(p.id); },
          }} />
      )}
      {evolvingPiece && (
        <EvolutionView piece={evolvingPiece} scenes={scenes} profileOf={profileOf}
          busy={(s) => { const w = sceneActions.work[s.id]; return !!(w?.making || w?.clipping || w?.layering); }}
          onClose={() => setEvolving(null)}
          actions={{
            onOpenScene: (s, b) => { setEvolving(null); setViewing({ id: s.id, beat: b }); },
            onChooseTake: (s, b, p) => void sceneActions.chooseTake(s, b, p),
            onDeleteTake: (s, b, p) => void sceneActions.deleteTake(s, b, p),
          }} />
      )}
      {seeing && <PreviewLayer key={seeing.n} make={seeing.make} hash={seeing.hash} onError={(err) => setSeeError(describeError(err))} onMenu={renameMenu} onClose={() => setSeeing(null)} />}
      {siteActions.preview && <SitePreview preview={siteActions.preview} standalone={false} onClose={siteActions.closePreview}
        onOpenWindow={() => void siteActions.previewInWindow()} colours={site.brand} onColours={setColours} onMenu={renameMenu} />}
      {siteActions.check && <CompressionCheck before={siteActions.check.before} after={siteActions.check.after} onClose={siteActions.closeCheck} />}
      {/* The scene is held here, not looked up: once removed it leaves the list, and the dialog may still have files to tell about. */}
      {removingPiece && (
        <RemovePieceDialog piece={removingPiece} scenes={scenes.filter((s) => s.pieceId === removingPiece.id).length}
          onRemove={() => pieceActions.removePiece(removingPiece)} onClose={() => setRemovingPiece(null)} />
      )}
      {removing && (
        <RemoveSceneDialog name={`${removing.variant || t('scenes.noVariant')} · ${pieces.find((p) => p.id === removing.pieceId)?.name ?? t('scenes.unknownPiece')}`}
          files={filesOwnedBy(removing, scenes, studio.filmsRef.current)}
          onRemove={(mode) => sceneActions.removeScene(removing, mode)}
          onClose={() => setRemoving(null)} />
      )}
      {removingFilm && studio.films?.some((f) => f.id === removingFilm) && (() => {
        const doomed = studio.films.find((f) => f.id === removingFilm)!;
        const index = studio.films.indexOf(doomed);
        return (
          <RemoveSceneDialog name={doomed.name || t('film.untitled', { n: index + 1 })} lead={t('film.remove.lead')}
            files={filesOwnedByFilm(doomed, studio.filmsRef.current, scenes)}
            onRemove={(mode) => filmActions.removeFilm(doomed.id, mode, scenes)}
            onClose={() => setRemovingFilm(null)} />
        );
      })()}
      {improving && pieces.find((p) => p.id === improving) && (
        <PhotoWorkbench key={improving} piece={pieces.find((p) => p.id === improving)!} size={site.showcase[improving]?.size} imageModel={MODEL_FOR_QUALITY[settings.quality]} siteColour={site.brand.paper}
          spend={costs.spendingImage(improving)}
          onImprove={(base, path) => pieceActions.improvePhoto(base, path)}
          onKeepCutout={(base, cutout) => pieceActions.keepCutout(base, cutout)}
          onChoose={(path) => { const p = pieces.find((x) => x.id === improving); if (p) void pieceActions.choosePhoto(p, path); }}
          onDrop={(path) => { const p = pieces.find((x) => x.id === improving); if (p) void pieceActions.dropPhoto(p, path); }}
          onClose={() => setImproving(null)} />
      )}
      {addingPage && <AddPageDialog onAdd={addPage} onClose={() => setAddingPage(false)} />}
      {wizard && (
        <SceneWizard key={wizard.n} pieces={pieces} profile={profile} aspectRatio={settings.aspectRatio} initial={wizard.initial}
          onClose={() => setWizard(null)}
          onCreate={async (input, makeNow) => { await sceneActions.createScene(input, makeNow, pageId); }}
          onAddPieces={pieceActions.addPiecesFromFiles}
          onPickPiece={pieceActions.pickNewPiece}
          uploads={pieceActions.uploads}
          busyUpload={pieceActions.busy}
          onSavePhoto={(file) => saveDroppedPhoto(file, newId('photo'))}
          onPickPhoto={() => pickImage(t('pieces.photoFilter'))} />
      )}
    </main>
  );
}
