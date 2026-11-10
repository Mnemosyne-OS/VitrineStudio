// The strip: one large photo at a time, its arrows, its thumbnails, the current one lit as it is swiped.
effect('strip', (api) => {
  const esc = api.esc;
  return {
    gallery(g) {
      g.classList.add('layout-strip');
      const wrap = document.createElement('div');
      wrap.className = 'strip-wrap';
      g.before(wrap);
      wrap.append(g);
      const figs = [...g.querySelectorAll('figure')];
      const centre = (f) => g.scrollTo({ left: f.offsetLeft - (g.clientWidth - f.clientWidth) / 2 });
      const step = (k) => { const at = figs.filter((f) => !f.hidden); const i = Math.max(0, at.findIndex((f) => f.classList.contains('cur'))); const to = at[Math.min(at.length - 1, Math.max(0, i + k))]; if (to) centre(to); };
      wrap.insertAdjacentHTML('beforeend', '<button class="strip-go prev" aria-label="‹">‹</button><button class="strip-go next" aria-label="›">›</button>');
      wrap.querySelector('.prev').addEventListener('click', () => step(-1));
      wrap.querySelector('.next').addEventListener('click', () => step(1));
      const thumbs = document.createElement('div');
      thumbs.className = 'strip-thumbs';
      thumbs.innerHTML = figs.map((f) => `<button data-c="${esc(f.dataset.c)}" aria-label="${esc(f.getAttribute('aria-label') || '')}"><img src="${esc(f.querySelector('img').getAttribute('src'))}" alt="" loading="lazy" decoding="async"></button>`).join('');
      wrap.after(thumbs);
      thumbs.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { const f = g.querySelector(`figure[data-c="${b.dataset.c}"]`); if (f) centre(f); }));
      const io = new IntersectionObserver((seen) => seen.forEach((x) => {
        if (!x.isIntersecting) return;
        figs.forEach((f) => f.classList.toggle('cur', f === x.target));
        thumbs.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.c === x.target.dataset.c));
      }), { root: g, threshold: 0.6 });
      figs.forEach((f) => io.observe(f));
    },
  };
});
