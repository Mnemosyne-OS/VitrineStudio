// The mosaic: the catalogue in columns, each photo at its own shape, so the rows fall staggered.
effect('mosaic', () => ({
  gallery(g) { g.classList.add('layout-mosaic'); },
}));
