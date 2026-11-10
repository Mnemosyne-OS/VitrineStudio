// The loupe over a creation opened large: a lens that follows the pointer (round or square), or the
// picture itself zooming where the pointer is. It reads the large copy of the picture; a touch screen
// zooms on a tap, a second tap comes back.
effect('loupe', (api) => {
  const D = api.D;
  // The loupe she chose for the whole site; on one creation only, the round lens.
  const SITE = (D.viewer && D.viewer.loupe) || 'none';
  return {
    viewer(c, k, viewer) {
      if (SITE === 'none' && !api.on('loupe', c)) return;
      const LOUPE = SITE === 'none' ? 'lens' : SITE;
      const main = viewer.querySelector('.v-main');
      const img = main && main.querySelector('img');
      // Another effect took this picture for itself (a comparison, a turn): the loupe leaves it alone.
      if (!img || main.dataset.taken) return;
      const big = (c.zoom && c.zoom[k]) || c.images[k];
      const Z = 2.6;
      // Where the picture is drawn inside its box (object-fit leaves margins; a mat adds padding).
      const box = () => {
        const r = img.getBoundingClientRect(), cs = getComputedStyle(img);
        const pl = parseFloat(cs.paddingLeft) || 0, pt = parseFloat(cs.paddingTop) || 0;
        const bw = r.width - pl - (parseFloat(cs.paddingRight) || 0), bh = r.height - pt - (parseFloat(cs.paddingBottom) || 0);
        const nw = img.naturalWidth || bw, nh = img.naturalHeight || bh, sc = Math.min(bw / nw, bh / nh), w = nw * sc, h = nh * sc;
        return { x: r.left + pl + (bw - w) / 2, y: r.top + pt + (bh - h) / 2, w, h };
      };
      const touch = matchMedia('(hover: none)').matches;
      if (LOUPE === 'zoom' || touch) {
        main.classList.add('loupe-zoom');
        const at = (e) => { const b = box(); img.style.transformOrigin = `${Math.max(0, Math.min(100, ((e.clientX - b.x) / b.w) * 100))}% ${Math.max(0, Math.min(100, ((e.clientY - b.y) / b.h) * 100))}%`; };
        const sharp = () => { if (!img.dataset.big) { img.dataset.big = '1'; img.src = big; } };
        if (touch) { img.addEventListener('click', (e) => { e.stopPropagation(); sharp(); at(e); img.classList.toggle('zoomed'); }); return; }
        img.addEventListener('pointerenter', (e) => { sharp(); at(e); img.classList.add('zoomed'); });
        img.addEventListener('pointermove', at);
        img.addEventListener('pointerleave', () => img.classList.remove('zoomed'));
        return;
      }
      main.classList.add('loupe-lens');
      const lens = document.createElement('div');
      lens.className = `v-lens ${LOUPE}`;
      lens.style.backgroundImage = `url("${String(big).replace(/"/g, '%22')}")`;
      main.appendChild(lens);
      main.addEventListener('pointermove', (e) => {
        const b = box(), x = e.clientX - b.x, y = e.clientY - b.y;
        if (x < 0 || y < 0 || x > b.w || y > b.h) { lens.classList.remove('on'); return; }
        const mr = main.getBoundingClientRect(), half = lens.offsetWidth / 2;
        lens.classList.add('on');
        lens.style.left = `${e.clientX - mr.left - half}px`;
        lens.style.top = `${e.clientY - mr.top - half}px`;
        lens.style.backgroundSize = `${b.w * Z}px ${b.h * Z}px`;
        lens.style.backgroundPosition = `${half - x * Z}px ${half - y * Z}px`;
      });
      main.addEventListener('pointerleave', () => lens.classList.remove('on'));
    },
  };
});
