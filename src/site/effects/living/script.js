// A living scene (doc 145 §10.18): over the place, the piece and the life as layers set exactly on the
// cropped picture; the life sways on a canvas, and the pointer moves the room a little against the piece.
// It sways only in the scene on screen, and never for who asked for less motion; the two depths follow a mouse only.
effect('living', (api) => {
  const { D, T, esc, src, reduced, stage } = api;
  const ROWS = [...D.rows, ...(D.pages || []).flatMap((p) => p.rows || [])];
  const lay = (L, cls) => (L ? `<img class="${cls}" src="${esc(src(L))}" alt="" decoding="async" style="left:${+L.x}%;top:${+L.y}%;width:${+L.w}%;height:${+L.h}%">` : '');
  function livingRoom(s, alt) {
    const L = s.layers;
    const a = L.potAlive;
    // The shadows lie on the room, so they move with it; only the piece and the life come forward.
    return `<div class="lay"><div class="lb"><img class="lplace sa" src="${esc(src(L.room || s.images.place))}" alt="${esc(T.generated)}" decoding="async" fetchpriority="high">${lay(L.shadowPiece, 'lps')}${lay(L.shadowAlive, 'las')}</div>`
      + `<div class="lg">${lay(L.pot, 'lp')}`
      + `<canvas class="la" role="img" aria-label="${esc(alt)}" data-src="${esc(src(a))}"${L.sway ? ` data-sway="${esc(src(L.sway))}"` : ''} style="left:${+a.x}%;top:${+a.y}%;width:${+a.w}%;height:${+a.h}%"></canvas></div>`
      + `<div class="sun"></div></div>`;
  }
  // The box the cropped picture fills: object-fit cover, centred across, 70 % down (as .room img).
  function fitLay(el) {
    const box = el.querySelector('.lay'), img = box && box.querySelector('.lplace');
    if (!box || !img || !img.naturalWidth) return;
    const rw = el.clientWidth, rh = el.clientHeight, r = img.naturalWidth / img.naturalHeight;
    const w = rw / rh > r ? rw : rh * r, h = w / r;
    Object.assign(box.style, { width: w + 'px', height: h + 'px', left: (rw - w) * 0.5 + 'px', top: (rh - h) * 0.7 + 'px', right: 'auto', bottom: 'auto' });
    box.classList.add('fit');
  }
  // The life drawn on its canvas; it sways only in the scene on screen, and never for who asked for less motion.
  function wakeLife(el) {
    const c = el.querySelector('canvas.la');
    if (!c || c.dataset.ready) return;
    c.dataset.ready = '1';
    const load = (u) => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = u; });
    Promise.all([load(c.dataset.src), c.dataset.sway ? load(c.dataset.sway) : null]).then(([img, map]) => {
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      if (!map || reduced) return;
      const base = ctx.getImageData(0, 0, c.width, c.height);
      ctx.clearRect(0, 0, c.width, c.height); ctx.drawImage(map, 0, 0, c.width, c.height);
      const m = ctx.getImageData(0, 0, c.width, c.height).data;
      ctx.putImageData(base, 0, 0);
      c._sway = { ctx, base, m, out: ctx.createImageData(c.width, c.height) };
    }).catch(() => { c.dataset.ready = ''; });
  }
  let swayClock = 0, swayLast = 0;
  function swayTick(t) {
    swayClock = requestAnimationFrame(swayTick);
    // About 30 images a second, and nothing while the page is hidden.
    if (t - swayLast < 33 || document.hidden) return;
    swayLast = t;
    const current = api.current();
    const c = current && current.classList.contains('alive') ? current.querySelector('canvas.la') : null;
    const sw = c && c._sway;
    if (!sw) return;
    const { ctx, base, m, out } = sw, w = base.width, h = base.height, d = base.data;
    const S = 0.05 * w * Math.sin(t / 700), o = out.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, sx = Math.min(w - 1, Math.max(0, x + Math.round(S * (m[i] / 255 - 0.5)))), j = (y * w + sx) * 4;
      o[i] = d[j]; o[i + 1] = d[j + 1]; o[i + 2] = d[j + 2]; o[i + 3] = d[j + 3];
    }
    ctx.putImageData(out, 0, 0);
  }
  if (!reduced && ROWS.some((row) => row.scenes.some((s) => s.layers && s.layers.sway))) swayClock = requestAnimationFrame(swayTick);
  // The pointer moves the room a little against it and the piece a little with it: two depths.
  if (!reduced) {
    stage.addEventListener('pointermove', (e) => {
      const current = api.current();
      if (!current || e.pointerType !== 'mouse') return;
      const r = current.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * 2 - 1, py = (e.clientY - r.top) / r.height * 2 - 1;
      const b = current.querySelector('.lb'), g = current.querySelector('.lg');
      if (b) b.style.transform = `scale(1.04) translate(${-px * 10}px, ${-py * 6}px)`;
      if (g) g.style.transform = `scale(1.04) translate(${px * 14}px, ${py * 8}px)`;
    });
  }
  stage.addEventListener('pointerleave', () => {
    const current = api.current();
    if (!current) return;
    const b = current.querySelector('.lb'), g = current.querySelector('.lg');
    if (b) b.style.transform = '';
    if (g) g.style.transform = '';
  });
  addEventListener('resize', () => { const current = api.current(); if (current) fitLay(current); });
  return {
    room(s, alt) { return s.layers ? livingRoom(s, alt) : ''; },
    // No beats for a living scene: it is shown alive from the start (the cut would show between them).
    play(el) {
      const pl = el.querySelector('.lplace');
      if (!pl) return false;
      const fit = () => fitLay(el); pl.complete ? fit() : pl.addEventListener('load', fit, { once: true }); wakeLife(el);
      el.classList.add('living', 'lit', 'piece', 'alive');
      el.querySelectorAll('.steps li').forEach((li) => li.classList.add('on'));
      return true;
    },
  };
});
