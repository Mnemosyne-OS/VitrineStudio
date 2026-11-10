import { contentEntryOf, destinationOf, isPageScreen, openingOf, spaceOf } from './spaces';

describe('the three spaces', () => {
  it('files every screen of before in one space, the two tools in none', () => {
    expect((['pieces', 'scenes', 'film', 'blog', 'about', 'contact', 'legal', 'page:atelier'] as const).map(spaceOf)).toEqual(Array(8).fill('content'));
    expect(spaceOf('design')).toBe('design');
    expect(spaceOf('site')).toBe('online');
    expect([spaceOf('costs'), spaceOf('settings')]).toEqual([null, null]);
  });

  it('her pages are one entry of Content: About, Contact, the legal pages and the added ones', () => {
    expect((['about', 'contact', 'legal', 'page:x'] as const).map(contentEntryOf)).toEqual(['pages', 'pages', 'pages', 'pages']);
    expect(contentEntryOf('film')).toBe('film');
    expect(contentEntryOf('site')).toBeNull();
    expect(isPageScreen('pieces')).toBe(false);
  });

  it('the names of before still lead somewhere: hosting, site, logo, Site › Look', () => {
    expect(destinationOf('hosting')).toEqual({ screen: 'site', section: 'online' });
    expect(destinationOf('site')).toEqual({ screen: 'site' });
    expect(destinationOf('site', 'connect')).toEqual({ screen: 'site', section: 'connect' });
    expect(destinationOf('logo')).toEqual({ screen: 'design', part: 'identity' });
    // Asked by « to do: the name » and « the tagline »: where those two are set.
    expect(destinationOf('site', 'look')).toEqual({ screen: 'design', part: 'identity' });
  });

  it('a part nobody knows opens the screen itself, a name nobody knows opens Creations', () => {
    expect(destinationOf('site', 'nope')).toEqual({ screen: 'site' });
    expect(destinationOf('design', 'effects')).toEqual({ screen: 'design', part: 'effects' });
    expect(destinationOf('design', 'nope')).toEqual({ screen: 'design' });
    expect(destinationOf('nowhere')).toEqual({ screen: 'pieces' });
    expect(destinationOf('page:')).toEqual({ screen: 'pieces' });
    expect(destinationOf('page:atelier')).toEqual({ screen: 'page:atelier' });
  });

  it('a space opens on the screen last seen there, else on its first', () => {
    expect(openingOf('content', {})).toBe('pieces');
    expect(openingOf('content', { content: 'page:atelier' })).toBe('page:atelier');
    expect(openingOf('online', { online: 'site' })).toBe('site');
    // A screen kept under the wrong space is not followed.
    expect(openingOf('design', { design: 'film' })).toBe('design');
  });
});
