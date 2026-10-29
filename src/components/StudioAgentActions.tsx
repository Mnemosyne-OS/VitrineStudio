import { useEffect, useRef } from 'react';
import { sdk } from '../data/host';
import { useI18n } from '../i18n';
import { newId, nextBeat } from '../model/records';
import { pageIdFor, PAGE_TYPES, type PageType } from '../model/pages';
import { BEATS, CLIP_CAMERAS, CLIP_LIGHTS, SCENE_MOTIONS, type Beat, type ClipStyle, type Piece, type Scene, type SceneMotion, type StudioSettings } from '../model/types';
import type { Studio } from '../hooks/useStudio';
import type { useScenes } from '../hooks/useScenes';
import type { useSite } from '../hooks/useSite';
import { makeSceneRefusal, validateSceneRefusal } from '../data/agentGuards';
import { cutoutPlan, cutoutTodo } from '../data/cutoutPlan';
import { cutOut } from '../data/photoEdit';
import type { usePieces } from '../hooks/usePieces';
import { findNamed, fold, listNames } from '../data/agentFind';
import type { SceneWizardInitial } from './SceneWizard';
import { siteLink } from '../model/publish';
import { slugify } from '../site/buildSite';

type SceneActions = ReturnType<typeof useScenes>;
type SiteActions = ReturnType<typeof useSite>;
type PieceActions = ReturnType<typeof usePieces>;

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** The studio's own screens, in the order of its menu; `hosting` is kept for agents and opens Site › Online (doc 145 §10.20). */
export const AGENT_TABS = ['pieces', 'scenes', 'blog', 'about', 'contact', 'film', 'logo', 'site', 'hosting', 'costs', 'settings'] as const;
/** The picture sizes the settings offer. */
export const AGENT_ASPECTS = ['16:9', '9:16', '1:1', '4:3', '3:4'] as const;
/** What the person's « About » and « Contact » say, as an agent may write it. */
const BRAND_FIELDS = ['name', 'tagline', 'about', 'email', 'instagram', 'introLine', 'contactNote'] as const;
const PIECE_STATUSES = ['available', 'reserved', 'sold'] as const;

/** What the studio shows full screen, opened and closed by an agent as by the person. */
export interface AgentView {
  showScene: (sceneId: string, beat: Beat) => void;
  showPiece: (pieceId: string) => void;
  /** Closes what is open over the screen: a scene, a piece, a preview, a dialog. */
  closeAll: () => void;
  /** Opens the « new scene » wizard with what was heard; the person finishes it on screen. */
  newScene: (initial: SceneWizardInitial) => void;
}

/**
 * What an agent may do in the studio (doc 149), declared in
 * `mnemo-plugin.json` › agentActions and served here while the studio is open.
 * Each handler calls the SAME function as the studio's own button, so the
 * person sees it happen and nothing has a second path. A job longer than a
 * minute (pictures, clip, publishing) answers « started »; `scenes` and
 * `siteStatus` say where it stands. Renders nothing.
 */
export function StudioAgentActions({ studio, sceneActions, siteActions, pieceActions, openTab, view }: {
  studio: Studio;
  /** The photo bench's own calls: keep a cut-out, show a better photo. */
  pieceActions: PieceActions;
  sceneActions: SceneActions;
  siteActions: SiteActions;
  /** Shows the page an agent just added, as the person's own « add a page » does. */
  openTab: (tab: string) => void;
  view: AgentView;
}) {
  const { t } = useI18n();
  const latest = useRef({ studio, sceneActions, siteActions, pieceActions, openTab, view, t });
  latest.current = { studio, sceneActions, siteActions, pieceActions, openTab, view, t };

  useEffect(() => {
    // A piece or a scene by its id, or by the words a person says (doc 149: the orb plans without reading the studio).
    const piece = (ref: unknown): Piece => findNamed(
      latest.current.studio.piecesRef.current.map((p) => ({ item: p, id: p.id, names: [p.name], label: p.name })),
      str(ref), { code: 'NO_PIECE', noun: 'piece' });
    const scene = (ref: unknown): Scene => {
      const pieces = latest.current.studio.piecesRef.current;
      return findNamed(latest.current.studio.scenesRef.current.map((s) => {
        const of = pieces.find((p) => p.id === s.pieceId)?.name ?? '';
        return { item: s, id: s.id, names: [of, s.universe, s.variant].filter(Boolean), label: [of, s.universe, s.variant].filter(Boolean).join(' · ') };
      }), str(ref), { code: 'NO_SCENE', noun: 'scene' });
    };
    const sceneLine = (s: Scene) => {
      const { studio: st, sceneActions: sa } = latest.current;
      const made = BEATS.filter((b) => s.images[b]);
      const work = sa.work[s.id];
      return {
        id: s.id, pieceId: s.pieceId, piece: st.piecesRef.current.find((p) => p.id === s.pieceId)?.name ?? null,
        universe: s.universe, variant: s.variant, made, missing: BEATS.filter((b) => !s.images[b]),
        online: s.validated, motion: s.motion ?? null, clip: !!s.clipPath,
        ...(work?.making ? { making: work.making } : {}), ...(work?.clipping ? { clipping: true } : {}),
        ...(work?.layering ? { layering: work.layering } : {}), ...(work?.error ? { error: work.error.key } : {}),
        ...(s.agentMake ? { agentMake: s.agentMake } : {}),
      };
    };

    if (typeof sdk.onAgentActions !== 'function') {
      // An iframe served an older SDK build: it must not take the window down.
      console.warn('[vitrine-studio] this SDK build has no onAgentActions; reload the cartridge to serve agent actions');
      return undefined;
    }

    /**
     * Backgrounds taken off one piece after the other, in the background: the
     * matte runs on this machine (free) and can take minutes the first time,
     * longer than an agent call. `pieces` says where it stands.
     */
    const cutJob = { queue: [] as string[], current: null as string | null, failed: {} as Record<string, string> };
    const runCutouts = async () => {
      while (cutJob.queue.length) {
        const id = cutJob.queue.shift()!;
        cutJob.current = id;
        try {
          const { studio: st, pieceActions: pa } = latest.current;
          const piece = st.piecesRef.current.find((p) => p.id === id);
          if (!piece) throw new Error('NO_PIECE');
          const plan = cutoutPlan(piece);
          if (plan.kind === 'shown' || plan.kind === 'noPhoto') continue;
          let base = piece;
          let path: string;
          if (plan.kind === 'reuse') path = plan.path;
          else {
            path = await cutOut(plan.from);
            const kept = await pa.keepCutout(piece, { from: plan.from, path });
            if (!kept) throw new Error('WRITE_FAILED');
            base = kept;
          }
          // The photo on show becomes the cut-out; the one before stays in the versions.
          if (!(await latest.current.pieceActions.improvePhoto(base, path))) throw new Error('WRITE_FAILED');
        } catch (err) {
          cutJob.failed[id] = err instanceof Error ? err.message : String(err);
          console.warn(`[vitrine-studio] background of ${id} not taken off:`, err);
        } finally {
          cutJob.current = null;
        }
      }
    };

    const sub = sdk.onAgentActions({
      pieces: () => latest.current.studio.piecesRef.current.map((p) => ({
        id: p.id, name: p.name, kind: p.kind, ...(p.price !== undefined ? { price: p.price } : {}), ...(p.status ? { status: p.status } : {}), hasPhoto: !!p.photoPath,
        background: cutoutPlan(p).kind === 'shown' ? 'off' : 'on',
        ...(cutJob.current === p.id ? { cutting: true } : cutJob.queue.includes(p.id) ? { cutting: 'queued' } : {}),
        ...(cutJob.failed[p.id] ? { cutoutError: cutJob.failed[p.id] } : {}),
      })),

      cutoutPieces: (args) => {
        if (cutJob.current || cutJob.queue.length) throw new Error('BUSY: backgrounds are being taken off now; call pieces to follow');
        const all = latest.current.studio.piecesRef.current;
        // Each piece by its id or its name: a name that is unknown or names several is refused here, with the names.
        const asked = Array.isArray(args.pieceIds) ? args.pieceIds.map(str).filter(Boolean).map((ref) => piece(ref).id) : null;
        const { todo, unknown, already } = cutoutTodo(all, asked);
        if (unknown.length) throw new Error(`NO_PIECE: ${unknown.join(', ')}; call pieces for the ids`);
        cutJob.failed = {};
        // A copy: the run starts synchronously and shifts the queue before this answer is built.
        cutJob.queue = [...todo];
        if (todo.length) void runCutouts();
        return { started: todo.length, pieces: todo, already };
      },

      scenes: () => latest.current.studio.scenesRef.current.map(sceneLine),

      createScene: async (args) => {
        const { studio: st, sceneActions: sa } = latest.current;
        let pieceId: string;
        try {
          pieceId = piece(args.pieceId).id;
        } catch (err) {
          // A piece she does not have is said to her: a repair call would pick one of hers in her place (field 2026-10-13).
          if (err instanceof Error && /^NO_PIECE\b/.test(err.message)) {
            const names = listNames(st.piecesRef.current.map((p) => p.name));
            throw new Error(`TO_PERSON: ${latest.current.t('agent.noPiece', { name: str(args.pieceId), names: names || '—' })}`);
          }
          throw err;
        }
        const created = await sa.createScene({
          pieceId, universe: str(args.universe), variant: str(args.variant), placeDescription: str(args.placeDescription),
          animation: str(args.animation), aspectRatio: st.settings.aspectRatio,
        }, false);
        if (!created) throw new Error('NO_FOLDER: the studio has no folder');
        return { sceneId: created.id, picturesMade: false };
      },

      // « crée une nouvelle scène dans le jardin » names no piece: the wizard opens with what was said,
      // and she chooses the rest, never the model (field 2026-10-13: the orb could only give it to the chat).
      newScene: (args) => {
        const { view: v, t: tr } = latest.current;
        const said = str(args.piece);
        let chosen: Piece | null = null;
        if (said) {
          try {
            chosen = piece(said);
          } catch (err) {
            console.warn(`[vitrine-studio] newScene: « ${said} » is not one piece; the wizard opens on the choice:`, err instanceof Error ? err.message : String(err));
          }
        }
        // A piece without its photo cannot be staged: the wizard opens on the choice of a piece.
        const staged = chosen?.photoPath ? chosen : null;
        const universe = str(args.universe);
        v.newScene({ ...(staged ? { pieceId: staged.id } : {}), ...(universe ? { universe } : {}) });
        const say = staged ? tr('agent.newScene.place', { piece: staged.name })
          : said && !chosen ? tr('agent.newScene.notFound', { name: said })
          : tr('agent.newScene.piece');
        return { opened: true, pieceId: staged?.id ?? null, universe: universe || null, say };
      },

      makeScene: (args) => {
        const s = scene(args.sceneId);
        const missing = BEATS.filter((b) => !s.images[b]);
        // One scene at a time, whichever door started the other: each picture is paid.
        const refused = makeSceneRefusal(s, latest.current.sceneActions.work, latest.current.studio.scenesRef.current);
        if (refused) throw new Error(refused);
        void latest.current.sceneActions.makeAll(s);
        return { started: true, missing, follow: 'call scenes: made / missing / error' };
      },

      validateScene: async (args) => {
        const s = scene(args.sceneId);
        const online = args.online !== false;
        const refused = validateSceneRefusal(s, online);
        if (refused) throw new Error(refused);
        const ok = await latest.current.sceneActions.validate(s, online);
        if (!ok) throw new Error('WRITE_FAILED: the scene could not be saved');
        return { sceneId: s.id, online };
      },

      setMotion: async (args) => {
        const s = scene(args.sceneId);
        const motion = str(args.motion) as SceneMotion;
        if (!(SCENE_MOTIONS as readonly string[]).includes(motion)) throw new Error(`BAD_ARG: motion is one of ${SCENE_MOTIONS.join(', ')}`);
        if (motion === 'video' && !s.clipPath) throw new Error('NO_CLIP: make the clip first (makeClip)');
        await latest.current.sceneActions.setMotion(s, motion);
        const now = latest.current.studio.scenesRef.current.find((x) => x.id === s.id);
        const error = latest.current.sceneActions.work[s.id]?.error;
        if (error) throw new Error(error.key);
        return { sceneId: s.id, motion: now?.motion ?? motion };
      },

      makeClip: (args) => {
        const s = scene(args.sceneId);
        if (nextBeat(s)) throw new Error('NOT_MADE: the clip goes from the second to the third picture; make the pictures first');
        const style: ClipStyle = { ...(s.clipStyle ?? {}) };
        const camera = str(args.camera), light = str(args.light), note = str(args.note);
        if (camera) { if (!(CLIP_CAMERAS as readonly string[]).includes(camera)) throw new Error(`BAD_ARG: camera is one of ${CLIP_CAMERAS.join(', ')}`); style.camera = camera as ClipStyle['camera']; }
        if (light) { if (!(CLIP_LIGHTS as readonly string[]).includes(light)) throw new Error(`BAD_ARG: light is one of ${CLIP_LIGHTS.join(', ')}`); style.light = light as ClipStyle['light']; }
        if (note) style.note = note.slice(0, 300);
        void latest.current.sceneActions.makeClip(s, style);
        return { started: true, follow: 'call scenes: clip / clipping / error' };
      },

      addPage: async (args) => {
        const { studio: st, openTab: open, t: tr } = latest.current;
        const type = str(args.type) as PageType;
        if (!(PAGE_TYPES as readonly string[]).includes(type)) throw new Error(`BAD_ARG: type is one of ${PAGE_TYPES.join(', ')}`);
        const name = str(args.name).slice(0, 40);
        if (!name) throw new Error('BAD_ARG: name is empty');
        const site = st.siteRef.current;
        const taken = [...site.pages.map((p) => p.id), ...[...st.piecesRef.current, ...st.scenesRef.current, ...site.posts].map((r) => r.pageId).filter((x): x is string => !!x)];
        const id = pageIdFor(name, taken);
        const fields = type === 'form' ? [
          { id: newId('f'), label: tr('form.kind.text'), kind: 'text' as const, required: true },
          { id: newId('f'), label: tr('form.kind.email'), kind: 'email' as const, required: true },
          { id: newId('f'), label: tr('form.kind.textarea'), kind: 'textarea' as const, required: false },
        ] : undefined;
        const text = str(args.text);
        const written = await st.patchSite((cur) => ({ ...cur, pages: [...cur.pages, { id, type, name, ...(fields ? { fields } : {}), ...(text && (type === 'text' || type === 'form') ? { text: text.slice(0, 20_000) } : {}) }] }));
        // A refused write is said, never reported done: the page would vanish at the next start.
        if (!written) throw new Error('WRITE_FAILED: the page could not be saved; the reason is on the person\'s screen');
        open(`page:${id}`);
        return { pageId: id };
      },

      publishSite: () => {
        const { studio: st, siteActions: si } = latest.current;
        if (!st.siteRef.current.siteId) throw new Error('NO_SITE: the site has no folder yet; the person sets it up once in Site › Connection');
        if (si.work.kind === 'exporting' || si.work.kind === 'publishing') throw new Error('BUSY: the site is being exported or published now');
        // The same rule as the bar's button: an agent never sends what the person could not.
        if (si.stage === 'unconnected') throw new Error('NO_SITE: the hosting is not connected (folder, Vercel token, address); the person sets it up in Site › Connection');
        if (si.stage === 'checking') throw new Error('NOT_READY: the hosting token is being read; call again in a moment');
        if (si.stage === 'incomplete') throw new Error(`INCOMPLETE: the site lacks ${si.missing.join(' and ')} (scene = a scene put on the site, name = the studio name); sending it would replace the site online with an empty page`);
        void si.publishNow();
        return { started: true, follow: 'call siteStatus' };
      },

      siteStatus: () => {
        const { studio: st, siteActions: si } = latest.current;
        const site = st.siteRef.current;
        const w = si.work as { kind: string; key?: string; done?: number; total?: number };
        return {
          // The site bar's own word (model/publish.ts): current, behind, never, unconnected…
          work: w.kind, stage: si.stage, ...(w.key ? { error: w.key } : {}), ...(w.total ? { done: w.done, total: w.total } : {}),
          // The one address the bar shows (without her own domain, read by the Site screen).
          address: siteLink(site.lastPublish, site.projectName || slugify(site.brand.name)),
          lastPublish: site.lastPublish ?? null, pages: site.pages.map((p) => ({ id: p.id, type: p.type, name: p.name })),
          onSite: st.scenesRef.current.filter((s) => s.validated).length,
        };
      },

      // ── What the person sees: the same screens and views as her own clicks ──

      showTab: (args) => {
        const { studio: st, openTab: open, view: v, t: tr } = latest.current;
        const asked = fold(str(args.tab));
        const builtIn = AGENT_TABS.find((x) => x === asked || fold(tr(`tab.${x}`)) === asked);
        const target = builtIn ?? `page:${findNamed(st.siteRef.current.pages.map((p) => ({ item: p, id: p.id, names: [p.name], label: p.name })), str(args.tab), { code: 'NO_TAB', noun: 'page' }).id}`;
        v.closeAll();
        open(target);
        return { tab: target };
      },

      showScene: (args) => {
        const s = scene(args.scene);
        const asked = str(args.beat) as Beat;
        if (asked && !BEATS.includes(asked)) throw new Error(`BAD_ARG: beat is one of ${BEATS.join(', ')}`);
        if (asked && !s.images[asked]) throw new Error(`NOT_MADE: this scene has no ${asked} picture yet; it has ${BEATS.filter((b) => s.images[b]).join(', ') || 'none'}`);
        // Its last picture made, as the studio opens a scene from its tile.
        const beat = asked || [...BEATS].reverse().find((b) => s.images[b]);
        if (!beat) throw new Error('NOT_MADE: this scene has no picture yet (makeScene makes them, it spends credits)');
        latest.current.view.showScene(s.id, beat);
        return { sceneId: s.id, beat };
      },

      showPiece: (args) => {
        const p = piece(args.piece);
        latest.current.view.showPiece(p.id);
        return { pieceId: p.id, name: p.name };
      },

      closeView: () => {
        latest.current.view.closeAll();
        return { closed: true };
      },

      previewSite: (args) => {
        const { siteActions: si } = latest.current;
        if (args.window === true) void si.previewInWindow();
        else void si.previewNow();
        return { started: true, window: args.window === true };
      },

      editPiece: async (args) => {
        const p = piece(args.piece);
        const patch: { name?: string; description?: string; price?: number; status?: Piece['status'] } = {};
        if (str(args.name)) patch.name = str(args.name).slice(0, 120);
        if (str(args.description)) patch.description = str(args.description).slice(0, 4000);
        if (typeof args.price === 'number') patch.price = Math.round(args.price * 100) / 100;
        const status = str(args.status);
        if (status) {
          if (!(PIECE_STATUSES as readonly string[]).includes(status)) throw new Error(`BAD_ARG: status is one of ${PIECE_STATUSES.join(', ')}`);
          patch.status = status as Piece['status'];
        }
        if (!Object.keys(patch).length) throw new Error('BAD_ARG: say what changes: name, description, price or status');
        if (!(await latest.current.pieceActions.editPiece(p, patch))) throw new Error('WRITE_FAILED: the piece could not be saved; the reason is on the person\'s screen');
        return { pieceId: p.id, ...patch };
      },

      setBrand: async (args) => {
        const change: Record<string, string> = {};
        for (const k of BRAND_FIELDS) if (str(args[k])) change[k] = str(args[k]).slice(0, k === 'about' || k === 'contactNote' ? 20_000 : 300);
        if (!Object.keys(change).length) throw new Error(`BAD_ARG: say what changes: ${BRAND_FIELDS.join(', ')}`);
        const written = await latest.current.studio.patchSite((cur) => ({ ...cur, brand: { ...cur.brand, ...change } }));
        if (!written) throw new Error('WRITE_FAILED: the site settings could not be saved; the reason is on the person\'s screen');
        return { changed: Object.keys(change) };
      },

      setSettings: async (args) => {
        const { studio: st } = latest.current;
        const next: StudioSettings = { ...st.settings };
        const quality = str(args.quality), aspect = str(args.aspectRatio);
        if (quality) { if (quality !== 'quality' && quality !== 'fast') throw new Error('BAD_ARG: quality is quality or fast'); next.quality = quality; }
        if (aspect) { if (!(AGENT_ASPECTS as readonly string[]).includes(aspect)) throw new Error(`BAD_ARG: aspectRatio is one of ${AGENT_ASPECTS.join(', ')}`); next.aspectRatio = aspect; }
        if (typeof args.showCosts === 'boolean') next.showCosts = args.showCosts;
        if (typeof args.advanced === 'boolean') next.advanced = args.advanced;
        await st.changeSettings(next);
        return { quality: next.quality, aspectRatio: next.aspectRatio, showCosts: next.showCosts, advanced: next.advanced };
      },

      moveScene: async (args) => {
        const s = scene(args.scene);
        const universe = str(args.universe).slice(0, 60);
        if (!universe) throw new Error('BAD_ARG: universe is empty');
        if (!(await latest.current.sceneActions.moveTo(s, universe))) throw new Error('WRITE_FAILED: the scene could not be saved');
        return { sceneId: s.id, universe };
      },
    });
    sub.ready.catch((err: unknown) => console.warn('[vitrine-studio] agent actions not served:', err instanceof Error ? err.message : err));
    return () => sub.off();
  }, []);

  return null;
}
