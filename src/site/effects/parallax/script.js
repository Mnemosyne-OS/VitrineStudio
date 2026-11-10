// The parallax: under the pointer each photo of the catalogue drifts a little, at its own depth.
// Only with a pointer that hovers, and never for who asked for less motion.
effect('parallax', (api) => {
  const MOVES = api.hovers && !api.reduced;
  return {
    gallery(g) {
      if (!MOVES) return;
      g.classList.add('parallax');
      let raf = 0;
      g.addEventListener('pointermove', (e) => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          const r = g.getBoundingClientRect();
          g.style.setProperty('--px', (((e.clientX - r.left) / r.width - 0.5) * 2).toFixed(3));
          g.style.setProperty('--py', (((e.clientY - r.top) / r.height - 0.5) * 2).toFixed(3));
        });
      });
      g.addEventListener('pointerleave', () => { cancelAnimationFrame(raf); g.style.setProperty('--px', '0'); g.style.setProperty('--py', '0'); });
    },
  };
});
