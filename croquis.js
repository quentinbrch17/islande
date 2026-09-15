/* Entering the viewport starts one complete scene. Scroll never controls its progress. */
(() => {
  const art = document.querySelector('.passage-sketch');
  if (!art) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const ink = [...art.querySelectorAll('[data-ink]')];
  const steps = [...art.querySelectorAll('[data-step]')];
  const returns = [...art.querySelectorAll('[data-return]')];
  const clamp = value => Math.max(0, Math.min(1, value));
  const duration = 9800;
  let frame = 0, started = false, elapsed = 0, lastTime = null;

  function render(time) {
    const phase = (start, length) => clamp((time - start) / length);
    const phases = {trail:phase(200, 3900), rope:phase(4200, 800), sign:phase(5100, 650)};
    for (const el of ink) el.style.strokeDashoffset = String(1 - phases[el.dataset.ink]);
    for (const el of steps) {
      const start = 600 + Number(el.dataset.step) * 3600;
      el.style.opacity = String(phase(start, 150));
    }
    for (const el of returns) {
      const start = 6100 + Number(el.dataset.return) * 3600;
      el.style.opacity = String(phase(start, 170));
    }
  }

  function paint(time) {
    frame = 0;
    if (document.hidden) return;
    if (reduced.matches || document.documentElement.classList.contains('motion-off')) {
      elapsed = duration;
      started = true;
      render(duration);
      return;
    }
    if (!started) {
      const rect = art.getBoundingClientRect();
      const visible = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 80));
      // Enough of the drawing is on screen to watch it, with no further scrolling needed.
      if (visible < Math.min(rect.height * .65, (innerHeight - 80) * .65)) return;
      started = true;
      lastTime = time;
    }
    if (lastTime !== null) elapsed = Math.min(duration, elapsed + time - lastTime);
    lastTime = time;
    render(elapsed);
    if (elapsed < duration) schedule();
  }
  function schedule() { if (!frame && !document.hidden) frame = requestAnimationFrame(paint); }
  art.classList.add('sketch-ready');
  render(0);
  addEventListener('scroll', schedule, {passive:true});
  addEventListener('resize', schedule, {passive:true});
  addEventListener('load', schedule);
  addEventListener('hashchange', schedule);
  reduced.addEventListener('change', schedule);
  new MutationObserver(schedule).observe(document.documentElement, {attributes:true, attributeFilter:['class']});
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {cancelAnimationFrame(frame);frame = 0;lastTime = null;}
    else schedule();
  });
  schedule();
})();
