// Before / after: a creation's first two photos compared under a divider. Nothing moves by itself:
// the divider goes where the visitor puts it (a mouse, a finger or the arrow keys, it is a range input).
effect('before-after', (api) => ({
  viewer(c, k, viewer) {
    if (k > 1 || c.images.length < 2 || !api.on('before-after', c)) return;
    // Both on for the whole site: a creation with three photos or more turns, one with two is compared.
    // Put on this creation from its own card, the comparison is what she asked for it.
    if (c.images.length >= 3 && api.on('spin', c) && !api.listed('before-after', c)) return;
    const main = viewer.querySelector('.v-main');
    const img = main && main.querySelector('img');
    if (!img || main.dataset.taken) return;
    // The picture is this effect's now: the loupe steps aside.
    main.dataset.taken = 'before-after';
    main.classList.add('ba');
    img.src = c.images[0];
    const after = document.createElement('img');
    after.className = 'ba-after'; after.alt = ''; after.src = c.images[1];
    const range = document.createElement('input');
    range.type = 'range'; range.className = 'ba-range'; range.min = '0'; range.max = '100'; range.value = '50';
    range.setAttribute('aria-label', (c.alt || '') + ' 1 / 2');
    const line = document.createElement('span');
    line.className = 'ba-line';
    const set = () => main.style.setProperty('--ba', range.value + '%');
    range.addEventListener('input', set);
    // The divider's own keys: the arrows move it, they do not go to the next creation.
    range.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.stopPropagation(); }, true);
    main.append(after, range, line);
    set();
  },
}));
