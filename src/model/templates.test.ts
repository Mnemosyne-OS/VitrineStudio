import { PAGE_TEMPLATES, POST_TEMPLATES, templateName, templateText } from './templates';
import { normalizePages } from './pages';
import { markdownToHtml, PHOTO_SLOT, postImages } from './blog';
import { aboutPhotoAsset, buildSiteData, EMPTY_BRAND, exportSite } from '../site/buildSite';

describe('the models offered against a blank page', () => {
  it('each speak the three languages, with brackets to replace and a name', () => {
    for (const tpl of [...PAGE_TEMPLATES, ...POST_TEMPLATES]) {
      for (const lang of ['fr', 'en', 'es']) {
        expect(templateText(tpl, lang)).toMatch(/\[[^\]]+\]/);
        expect(templateName(tpl, lang).trim()).not.toBe('');
      }
    }
    expect(templateText(PAGE_TEMPLATES[0]!, 'de')).toBe(PAGE_TEMPLATES[0]!.text.en);
  });
  it('a page model sets where its picture stands, the picture under the words included', () => {
    expect(PAGE_TEMPLATES.map((t) => t.layout)).toEqual(['right', 'top', 'bottom']);
    const [page] = normalizePages([{ id: 'atelier', type: 'text', name: 'Atelier', layout: 'bottom' }]);
    expect(page!.layout).toBe('bottom');
  });
});

describe('the empty photo frames a model leaves', () => {
  it('are drawn in the editor, never on the site nor in the export', () => {
    const text = `# T\n\n${templateText(POST_TEMPLATES[0]!, 'fr')}\n\n![four](C:/D/four.jpg "left")`;
    expect(text.match(/photo:slot/g)).toHaveLength(2);
    expect(postImages(text)).toEqual(['C:/D/four.jpg']);
    const site = markdownToHtml(text, { image: (img) => `<img data-p="${img.path}">` });
    expect(site).not.toContain(PHOTO_SLOT);
    expect(site).toContain('data-p="C:/D/four.jpg"');
    expect(markdownToHtml(text, { editor: true })).toContain(`data-path="${PHOTO_SLOT}"`);
  });
  it('a page model leaves its frames beside the portrait, and the site writes only the filled ones', async () => {
    expect(PAGE_TEMPLATES.map((t) => t.photos)).toEqual([2, 3, 1]);
    const brand = { ...EMPTY_BRAND, name: 'A', aboutPhotos: ['', 'C:/a.jpg', ''] };
    const data = buildSiteData({ brand, lang: 'fr', today: '2026-11-02', untitled: 'x', scenes: [], pieces: [] });
    expect(data.aboutPhotos).toEqual([aboutPhotoAsset(0)]);
    expect('aboutPhotos' in data.brand).toBe(false);
    const saved: Array<[string, string]> = [];
    await exportSite(data, [], [], '<html>', { readImage: async (p) => p, readMedia: async () => 'd', onProgress: () => {}, toWebp: async (d) => d, save: async (n, b) => { saved.push([n, b]); }, aboutPhotoPaths: ['C:/a.jpg'] });
    expect(saved.find(([n]) => n === aboutPhotoAsset(0))?.[1]).toBe('C:/a.jpg');
  });
});
