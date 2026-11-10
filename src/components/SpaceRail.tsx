import { Coins, Globe, Images, Palette, Settings, type LucideIcon } from 'lucide-react';
import { useI18n } from '../i18n';
import { SPACES, type Space } from '../model/spaces';

const SPACE_ICON: Record<Space, LucideIcon> = { content: Images, design: Palette, online: Globe };
const TOOLS = [['costs', Coins], ['settings', Settings]] as const;
type Tool = (typeof TOOLS)[number][0];

/**
 * The studio's three spaces, down its left edge (doc 145 §10.25): what she
 * shows, what it looks like, whether it is found. Each is an icon AND its
 * name. Costs and Settings are not part of her work: two icons at the foot.
 * On a narrow window the rail lies across the top.
 */
export function SpaceRail({ space, tool, onSpace, onTool, onlineDot, trialDot }: {
  /** The space in sight; null on a tool's screen. */
  space: Space | null;
  tool: Tool | null;
  onSpace: (space: Space) => void;
  onTool: (tool: Tool) => void;
  /** Something of the Online space waits for her (the hosting is not connected). */
  onlineDot: boolean;
  /** A trial of the Design screen is not kept yet. */
  trialDot?: boolean;
}) {
  const { t } = useI18n();
  return (
    <nav className="rail glass" aria-label={t('app.spaces')}>
      {SPACES.map((s) => {
        const Icon = SPACE_ICON[s];
        return (
          <button key={s} className={`rail-btn ${space === s ? 'on' : ''}`} aria-current={space === s ? 'page' : undefined} data-tip={t(`space.${s}Hint`)} onClick={() => onSpace(s)}>
            <Icon className="ico solo" aria-hidden />
            <span>{t(`space.${s}`)}</span>
            {((s === 'online' && onlineDot) || (s === 'design' && trialDot)) && <span className="sb-dot warn" aria-hidden />}
          </button>
        );
      })}
      <span className="rail-gap" aria-hidden />
      {TOOLS.map(([x, Icon]) => (
        <button key={x} className={`rail-btn rail-tool ${tool === x ? 'on' : ''}`} aria-current={tool === x ? 'page' : undefined} aria-label={t(`tab.${x}`)} data-tip={t(`tab.${x}`)} onClick={() => onTool(x)}>
          <Icon className="ico solo" aria-hidden />
        </button>
      ))}
    </nav>
  );
}
