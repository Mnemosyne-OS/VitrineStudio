/**
 * The studio's agent actions (doc 149): the manifest's declaration passes the
 * HOST's own check, and every declared action has its handler here (a
 * declared action without one would be offered to agents and fail).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { agentActionsFromManifest } from '../../../infinity-edition/src/main/plugins/cartridgeAgentActions';

const root = join(__dirname, '..', '..');
const manifest = JSON.parse(readFileSync(join(root, 'mnemo-plugin.json'), 'utf8')) as unknown;
const source = readFileSync(join(root, 'src', 'components', 'StudioAgentActions.tsx'), 'utf8');
const block = source.slice(source.indexOf('sdk.onAgentActions({'), source.indexOf('sub.ready.catch'));
const handlers = [...block.matchAll(/^ {6}(\w+): (?:async )?\(/gm)].map((m) => m[1]);

describe('the studio\'s agent actions', () => {
  it('pass the host\'s check of the manifest', () => {
    const r = agentActionsFromManifest(manifest);
    expect(r.ok ? 'ok' : r.error).toBe('ok');
  });

  it('every declared action has its handler, and no handler is undeclared', () => {
    const r = agentActionsFromManifest(manifest);
    if (!r.ok) throw new Error(r.error);
    expect(handlers.length).toBeGreaterThan(5);
    expect([...handlers].sort()).toEqual(r.value.map((a) => a.id).sort());
  });

  it('what spends credits is declared spend', () => {
    const r = agentActionsFromManifest(manifest);
    if (!r.ok) throw new Error(r.error);
    expect(r.value.filter((a) => a.effect === 'spend').map((a) => a.id).sort()).toEqual(['makeClip', 'makeScene']);
  });
});
