// Reveal on scroll: on a page, the creations, the posts and the paragraphs rise into place as they are
// scrolled to. Never for who asked for less motion: everything is then simply there. What is already in
// sight when the page opens comes in at once, a little apart; nothing waits for a scroll that may not come.
effect('reveal', (api) => {
  if (api.reduced || !('IntersectionObserver' in window)) return {};
  const WHAT = '.gallery figure, .post-card, .rich > *, .post > *, .side > *, form.mail, .legal-text > *';
  return {
    page(el) {
      const fresh = [...el.querySelectorAll(WHAT)].filter((x) => !x.classList.contains('rv'));
      if (!fresh.length) return;
      let seen = false;
      const io = new IntersectionObserver((entries) => {
        seen = true;
        let k = 0;
        entries.forEach((x) => {
          if (!x.isIntersecting) return;
          // Those that arrive together come in one after the other, never more than half a second apart.
          x.target.style.setProperty('--rv-d', Math.min(k++ * 70, 490) + 'ms');
          x.target.classList.add('rv-in');
          io.unobserve(x.target);
        });
      }, { root: el, rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
      fresh.forEach((x) => { x.classList.add('rv'); io.observe(x); });
      // A browser that never calls back (a page not drawn) must not leave her words unseen.
      setTimeout(() => { if (!seen) fresh.forEach((x) => x.classList.add('rv-in')); }, 1200);
    },
  };
});
