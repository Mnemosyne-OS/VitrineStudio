// Video on hover: in the catalogue, a creation under the pointer plays the clip of its scene.
// Only with a pointer that hovers (never on a touch screen), and never for who asked for less motion.
// The clip is fetched at the first hover, not before: a visitor who hovers nothing downloads nothing.
effect('hover-video', (api) => {
  if (!api.hovers || api.reduced) return {};
  // Read when it is needed: the creation's clip, as the export named it.
  const clipOf = (id) => {
    const D = api.D;
    const all = [...D.creations, ...(D.pages || []).flatMap((p) => p.creations || [])];
    const c = all.find((x) => x.id === id);
    return c && c.clip && api.on('hover-video', c) ? c.clip : '';
  };
  return {
    gallery(g) {
      g.querySelectorAll('figure').forEach((f) => {
        const ph = f.querySelector('.ph');
        if (!ph) return;
        f.addEventListener('pointerenter', (e) => {
          if (e.pointerType !== 'mouse') return;
          const clip = clipOf(f.dataset.id);
          if (!clip) return;
          let vid = ph.querySelector('.g-vid');
          if (!vid) {
            vid = document.createElement('video');
            vid.className = 'g-vid'; vid.muted = true; vid.loop = true; vid.playsInline = true; vid.preload = 'auto'; vid.src = clip;
            vid.setAttribute('aria-hidden', 'true');
            ph.appendChild(vid);
          }
          // A play refused (a browser saving power) leaves the photo as it is.
          vid.play().then(() => ph.classList.add('playing'), (err) => console.warn('[site] the clip did not play on hover:', err));
        });
        f.addEventListener('pointerleave', () => {
          const vid = ph.querySelector('.g-vid');
          ph.classList.remove('playing');
          if (vid) vid.pause();
        });
      });
    },
  };
});
