// Turn by dragging: a creation's photos go by as it is dragged sideways. Nothing turns by itself:
// the photo follows the pointer or the finger, and a slider under it does the same from the keyboard.
effect('spin', (api) => ({
  viewer(c, k, viewer) {
    const n = c.images.length;
    if (n < 3 || !api.on('spin', c)) return;
    const main = viewer.querySelector('.v-main');
    const img = main && main.querySelector('img');
    if (!img || main.dataset.taken) return;
    // The picture is this effect's now: the loupe steps aside.
    main.dataset.taken = 'spin';
    main.classList.add('spin');
    // Every photo fetched at once: a turn never shows a hole.
    c.images.forEach((src) => { const pre = new Image(); pre.src = src; });
    let at = k;
    const range = document.createElement('input');
    range.type = 'range'; range.className = 'spin-range'; range.min = '0'; range.max = String(n - 1); range.step = '1'; range.value = String(at);
    range.setAttribute('aria-label', (c.alt || '') + ' 1 – ' + n);
    const show = (i) => {
      at = ((i % n) + n) % n;
      img.src = c.images[at];
      range.value = String(at);
      viewer.querySelectorAll('.v-thumbs button').forEach((b, j) => b.setAttribute('aria-current', String(j === at)));
    };
    range.addEventListener('input', () => show(+range.value));
    // The slider's own keys: the arrows turn the creation, they do not go to the next one.
    range.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.stopPropagation(); }, true);
    range.addEventListener('pointerdown', (e) => e.stopPropagation());
    main.appendChild(range);
    // One photo per stretch of the picture's width: a full drag across is a full turn.
    let from = null;
    main.addEventListener('pointerdown', (e) => { from = { x: e.clientX, at }; main.classList.add('turning'); main.setPointerCapture(e.pointerId); });
    main.addEventListener('pointermove', (e) => {
      if (!from) return;
      const step = Math.max(12, main.clientWidth / n);
      const to = from.at + Math.round((e.clientX - from.x) / step);
      if (to !== at) show(to);
    });
    const drop = () => { from = null; main.classList.remove('turning'); };
    main.addEventListener('pointerup', drop);
    // A photo shown alone closes on a click of its ground: the end of a drag on the photo is not that click.
    main.addEventListener('click', (e) => e.stopPropagation());
    main.addEventListener('pointercancel', drop);
  },
}));
