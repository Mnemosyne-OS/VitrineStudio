import { animFits, brandMarkup, DEFAULT_IDENTITY, LOGO_SVG_MAX_CHARS, normalizeIdentity, sanitizeSvg, siteIdentity, svgRatio } from './logo';

describe('sanitizeSvg', () => {
  it('keeps the shapes and drops script, events, styles and outside links', () => {
    const out = sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40" onload="alert(1)">
      <script>alert(1)</script><style>*{}</style>
      <path d="M0 0L10 10" fill="url(#g)" style="fill:red" onclick="x()"/>
      <rect x="1" fill="url(https://evil.example/x)"/>
      <foreignObject><div>hi</div></foreignObject>
      <a href="javascript:alert(1)"><circle r="3"/></a>
    </svg>`)!;
    // `#g` is not in the logo: a paint that points at nothing goes with its attribute.
    expect(out).toContain('<path d="M0 0L10 10"/>');
    expect(out).not.toMatch(/script|onload|onclick|style|foreignObject|evil|javascript|<a\b/i);
    expect(out).toContain('viewBox="0 0 120 40"');
    expect(out).not.toMatch(/\swidth=|\sheight="40"/);
  });

  it('declares its namespace once, so the tab icon reads it as an svg', () => {
    const out = sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0"/></svg>')!;
    expect(out.match(/xmlns=/g)).toHaveLength(1);
  });

  it('prefixes its ids (never the page ones), keeps references to what it kept, once', () => {
    const src = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><defs><linearGradient id="pages"><stop offset="0"/></linearGradient></defs>
      <path d="M0 0" fill="url(#pages)"/><rect x="0" fill="url(#gone)"/></svg>`;
    const out = sanitizeSvg(src)!;
    expect(out).toContain('id="logo-pages"');
    expect(out).toContain('fill="url(#logo-pages)"');
    expect(out).not.toMatch(/id="pages"|url\(#gone\)/);
    // Read back from site.json, it is cleaned again and comes out the same.
    expect(sanitizeSvg(out)).toBe(out);
  });

  it('lets no element in that the list does not name: no <image>, no <use>', () => {
    const out = sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1 1">
      <path d="M0 0"/><image href="https://x.example/a.png"/><use xlink:href="#a"/></svg>`)!;
    expect(out).not.toMatch(/<image|<use|x\.example/);
  });

  it('refuses what is not an svg, or an svg with nothing to show', () => {
    expect(sanitizeSvg('<html><body>x</body></html>')).toBeNull();
    expect(sanitizeSvg('not xml at all <')).toBeNull();
    expect(sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg"><title>x</title></svg>')).toBeNull();
  });

  it('reads the shape of the logo from its viewBox', () => {
    expect(svgRatio('<svg viewBox="0 0 300 100"></svg>')).toBe(3);
    expect(svgRatio('<svg></svg>')).toBeNull();
  });
});

describe('brandMarkup', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0"/></svg>';
  it('shows the name alone when there is no logo, whatever the mode', () => {
    expect(brandMarkup({ ...DEFAULT_IDENTITY, mode: 'logo' }, 'Atelier <A>')).toBe('<span class="brand-in size-m anim-fade speed-normal"><span class="brand-name">Atelier &lt;A&gt;</span></span>');
  });
  it('splits the name letter by letter for that entrance, each character escaped', () => {
    expect(brandMarkup({ ...DEFAULT_IDENTITY, anim: 'letters' }, 'A<')).toContain('<span class="ch" style="--i:1">&lt;</span>');
  });
  it('draws only a vector logo: a picture falls back to a fade', () => {
    expect(animFits('draw', 'raster')).toBe(false);
    expect(brandMarkup({ ...DEFAULT_IDENTITY, logoPath: 'C:/l.png', anim: 'draw' }, 'A')).toContain('anim-fade');
    const drawn = brandMarkup({ ...DEFAULT_IDENTITY, svg, anim: 'draw', mode: 'logo' }, 'A');
    expect(drawn).toContain('anim-draw');
    expect(drawn).toContain('<path pathLength="1"');
    expect(drawn).not.toContain('brand-name');
  });
  it('paints a tinted picture as a mask whose address the page sets', () => {
    expect(brandMarkup({ ...DEFAULT_IDENTITY, logoPath: 'C:/l.png', tint: true }, 'A')).toContain('<span class="brand-logo mask" data-logo></span>');
  });
});

describe('normalizeIdentity', () => {
  it('cleans again an svg read back from site.json, never takes it as written', () => {
    const id = normalizeIdentity({ svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0" onclick="x()"/><script>x()</script></svg>' });
    expect(id.svg).toBeDefined();
    expect(id.svg).not.toMatch(/onclick|script/);
  });

  it('drops an svg heavier than a logo, and gives the tab icon only to a light one', () => {
    const heavy = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1">${'<path d="M0 0"/>'.repeat(Math.ceil(LOGO_SVG_MAX_CHARS / 16) + 1)}</svg>`;
    expect(normalizeIdentity({ svg: heavy }).svg).toBeUndefined();
    const light = normalizeIdentity({ svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0"/></svg>' });
    expect(siteIdentity(light, 'A').favicon).toMatch(/^data:image\/svg\+xml,/);
    const mid = normalizeIdentity({ svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1">${'<path d="M0 0"/>'.repeat(5000)}</svg>` });
    expect(mid.svg).toBeDefined();
    expect(siteIdentity(mid, 'A').favicon).toBeUndefined();
  });
});

describe('the logo\'s size and place', () => {
  it('leaves an identity without them as it was', () => {
    expect(brandMarkup(DEFAULT_IDENTITY, 'A')).not.toContain('style=');
    expect(siteIdentity(DEFAULT_IDENTITY, 'A').place).toBeUndefined();
  });

  it('carries a free height on the container and the place to the page', () => {
    expect(brandMarkup({ ...DEFAULT_IDENTITY, height: 90 }, 'A')).toContain('<span class="brand-in size-m anim-fade speed-normal" style="--logo-h:90px">');
    expect(siteIdentity({ ...DEFAULT_IDENTITY, place: 'center' }, 'A').place).toBe('center');
  });

  it('bounds a hand-edited height and drops an unknown place', () => {
    expect(normalizeIdentity({ height: 5000, place: 'top' })).toMatchObject({ height: 200 });
    expect(normalizeIdentity({ height: 5000, place: 'top' }).place).toBeUndefined();
    expect(normalizeIdentity({ height: 'big', place: 'right' })).toEqual({ ...DEFAULT_IDENTITY, place: 'right' });
  });
});
