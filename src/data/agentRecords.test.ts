/**
 * The records an agent adds through the host (doc 145 §10.19) are built on the
 * host, which cannot import this cartridge. This test runs the cartridge's own
 * normalizers on what the host builds: a field renamed on either side fails
 * here instead of shipping as an "unreadable" file in the person's folder.
 */
import { describe, expect, it } from 'vitest';
import { buildPiece, buildScene, studioId } from '../../../infinity-edition/src/main/widgets/studioRecords';
import { newId, normalizePiece, normalizeScene } from '../model/records';
import { isSafeId } from './folderStore';

const now = new Date(Date.UTC(2026, 9, 12, 12));

describe('records the host writes for an agent', () => {
  it('a piece reads back whole', () => {
    const built = buildPiece({ name: 'Vase', kind: 'series', price: 12.5, description: 'Grès', photoPath: 'C:/p/vase.jpg' }, now);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(normalizePiece(JSON.parse(JSON.stringify(built.record)))).toEqual(built.record);
  });

  it('a scene reads back whole, with no picture and not validated', () => {
    const built = buildScene({ pieceId: 'piece-a', universe: 'Salon', variant: 'Console', placeDescription: 'Un salon', animation: 'une plante' }, { aspectRatio: '4:3', profileId: 'ceramics-plants' }, now);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const scene = normalizeScene(JSON.parse(JSON.stringify(built.record)));
    expect(scene).toEqual(built.record);
    expect(scene?.images).toEqual({});
    expect(scene?.validated).toBe(false);
  });

  it('ids follow the studio\'s own format and are safe file names', () => {
    const rand = () => 0.5;
    expect(studioId('scene', now, rand)).toBe(newId('scene', now, rand));
    expect(isSafeId(studioId('piece', now))).toBe(true);
  });
});
