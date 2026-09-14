'use strict';

// Dialogs share the same photograph order as the reading experience.
const photos = Array.from(document.querySelectorAll('[data-photo]'));
const viewer = document.getElementById('viewer');
const viewerImage = document.getElementById('viewer-image');
const viewerTitle = document.getElementById('viewer-title');
const viewerCount = document.getElementById('viewer-count');
const photoIndex = document.getElementById('photo-index');
const about = document.getElementById('about');
// Every count shown follows the sequence itself, never a hand-written number.
// The markup keeps readable values so the page stays correct without scripting.
const pad = value => String(value).padStart(2, '0');
document.querySelectorAll('[data-photo-count]').forEach(node => { node.textContent = photos.length; });
photos.forEach((link, index) => {
  const caption = link.closest('figure')?.querySelector('figcaption span:last-child');
  if (caption && /^\d+\s*\/\s*\d+$/.test(caption.textContent.trim())) {
    caption.textContent = `${pad(index + 1)} / ${photos.length}`;
  }
});
document.querySelectorAll('[data-open-photo]').forEach(button => {
  const rank = photos.findIndex(photo => photo.dataset.photo === button.dataset.openPhoto);
  const number = button.querySelector('span > span');
  if (rank >= 0 && number) number.textContent = pad(rank + 1);
});

let current = 0;
let returnFocus = null;

function display(index) {
  current = (index + photos.length) % photos.length;
  const source = photos[current];
  viewerImage.src = source.href;
  viewerImage.alt = source.querySelector('img').alt;
  viewerTitle.textContent = source.dataset.title;
  viewerCount.textContent = `${String(current + 1).padStart(2, '0')} / ${photos.length}`;
}

function openPhoto(index, opener) {
  returnFocus = opener;
  display(index);
  viewer.showModal();
  document.body.classList.add('modal-open');
}

photos.forEach((link, index) => link.addEventListener('click', event => {
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  openPhoto(index, link);
}));
document.getElementById('viewer-close').addEventListener('click', () => viewer.close());
document.getElementById('previous').addEventListener('click', () => display(current - 1));
document.getElementById('next').addEventListener('click', () => display(current + 1));
viewer.addEventListener('keydown', event => {
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault();
    display(current + (event.key === 'ArrowRight' ? 1 : -1));
  }
});
viewer.addEventListener('close', () => {
  document.body.classList.remove('modal-open');
  returnFocus?.focus({ preventScroll: true });
});
let touchStart = null;
viewerImage.addEventListener('touchstart', event => {
  if (event.touches.length === 1) touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  else touchStart = null;
}, { passive: true });
viewerImage.addEventListener('touchend', event => {
  if (!touchStart) return;
  const dx = event.changedTouches[0].clientX - touchStart.x;
  const dy = event.changedTouches[0].clientY - touchStart.y;
  if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.5) display(current + (dx < 0 ? 1 : -1));
  touchStart = null;
}, { passive: true });
viewerImage.addEventListener('touchcancel', () => { touchStart = null; }, { passive: true });

function wireDialog(dialog, triggers, closeId) {
  triggers.forEach(button => button.addEventListener('click', () => {
    dialog.showModal();
    document.body.classList.add('modal-open');
  }));
  document.getElementById(closeId).addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    if (!document.querySelector('dialog[open]')) document.body.classList.remove('modal-open');
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
}
wireDialog(photoIndex, document.querySelectorAll('[data-index]'), 'index-close');
wireDialog(about, document.querySelectorAll('[data-about]'), 'about-close');
document.querySelectorAll('[data-open-photo]').forEach(button => button.addEventListener('click', () => {
  const index = photos.findIndex(photo => photo.dataset.photo === button.dataset.openPhoto);
  photoIndex.close();
  // Focus returns to whatever opened the viewer; the index dialog is gone by then.
  openPhoto(index, photoIndex.contains(button) ? document.querySelector('[data-index]') : button);
}));

// Progressive text entrances. Photographs are never hidden while loading.
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const motionToggle = document.getElementById('motion-toggle');
let motionPreference = null;
try { motionPreference = sessionStorage.getItem('islande-motion'); } catch { /* Storage is optional. */ }
let motionEnabled = !reduced.matches && motionPreference !== 'off';
if ('IntersectionObserver' in window) {
  document.documentElement.classList.add('motion-ready');
  const textObserver = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      textObserver.unobserve(entry.target);
    }
  }, { threshold: 0.16 });
  document.querySelectorAll('.reveal').forEach(element => textObserver.observe(element));
}

// The browser scrolls normally. Only image content moves inside its original frame.
// The image steadily zooms out as it crosses the viewport, without reversing at its centre.
// A short damped response continues after a scroll gesture, then the RAF loop stops.
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const progress = document.querySelector('.progress');
const states = photos.filter(frame => Number(frame.dataset.motion) > 0).map(frame => ({
  frame, strength: Number(frame.dataset.motion), active: false, scale: 1, shift: 0,
}));
let animationFrame = 0;
let lastTime = 0;
let lastScroll = window.scrollY;
let velocity = 0;
let pageHeight = document.documentElement.scrollHeight;
const chapterStage = document.querySelector('[data-chapter-stage]');
const geysirStage = document.querySelector('[data-geysir-stage]');

function updateGeysir() {
  if (!geysirStage || !motionEnabled) return;
  const rect = geysirStage.getBoundingClientRect();
  // The value is always written, even off-screen: landing straight on #geysir
  // must not leave the veil at its opaque fallback.
  // Native scrolling: the park emerges from the page's white as it enters.
  // The title stays above the photograph, never over it.
  const p = clamp((window.innerHeight * .95 - rect.top) / (window.innerHeight * .45), 0, 1);
  geysirStage.style.setProperty('--geysir-white', (1 - p).toFixed(3));
}

function updateChapter() {
  if (!chapterStage || !motionEnabled) return;
  const rect = chapterStage.getBoundingClientRect();
  const travel = Math.max(1, rect.height - window.innerHeight);
  const p = clamp(-rect.top / travel, 0, 1);
  // The title clears early, leaving over half of the held frame unobstructed.
  chapterStage.style.setProperty('--chapter-title', (1 - clamp(p / .40, 0, 1)).toFixed(3));
  chapterStage.style.setProperty('--chapter-veil', (1 - clamp(p / .48, 0, 1)).toFixed(3));
  chapterStage.style.setProperty('--chapter-rise', `${-p * 24}px`);
}


function schedule() {
  if (!animationFrame && !document.hidden) animationFrame = requestAnimationFrame(animate);
}

function animate(time) {
  animationFrame = 0;
  const dt = lastTime ? clamp(time - lastTime, 8, 48) : 16.7;
  lastTime = time;
  const y = window.scrollY;
  const speed = clamp(Math.abs(y - lastScroll) / dt, 0, 3);
  const damping = 1 - Math.exp(-dt / 130);
  velocity += (speed - velocity) * damping;
  lastScroll = y;
  const viewport = window.innerHeight;
  const maxScroll = Math.max(1, pageHeight - viewport);
  progress.style.transform = `scaleX(${clamp(y / maxScroll, 0, 1)})`;
  if (!motionEnabled || document.querySelector('dialog[open]')) return;
  updateChapter();
  updateGeysir();
  const mobile = window.innerWidth <= 700;
  const measurements = states.filter(state => state.active).map(state => ({ state, rect: state.frame.getBoundingClientRect() }));
  let moving = velocity > 0.006;
  for (const { state, rect } of measurements) {
    const p = clamp((viewport - rect.top) / (viewport + rect.height), 0, 1);
    const strength = state.strength * (mobile ? 0.85 : 1);
    const targetScale = 1.005 + strength * (1 - p) + velocity * (mobile ? .0007 : .0014);
    // Translation stays inside the edge coverage available from the scale.
    const targetShift = (0.5 - p) * (mobile ? .3 : .4);
    state.scale += (targetScale - state.scale) * damping;
    state.shift += (targetShift - state.shift) * damping;
    state.frame.style.setProperty('--image-scale', state.scale.toFixed(5));
    state.frame.style.setProperty('--image-shift', `${state.shift.toFixed(4)}%`);
    if (Math.abs(targetScale - state.scale) > .00008 || Math.abs(targetShift - state.shift) > .0008) moving = true;
  }
  if (moving) schedule();
}

if ('IntersectionObserver' in window) {
  const imageObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const state = states.find(item => item.frame === entry.target);
      state.active = entry.isIntersecting;
      state.frame.classList.toggle('is-active', state.active);
    }
    schedule();
  }, { rootMargin: '25% 0px', threshold: 0 });
  states.forEach(state => imageObserver.observe(state.frame));
} else states.forEach(state => { state.active = true; });

function syncMotion() {
  document.documentElement.classList.toggle('motion-off', !motionEnabled);
  document.documentElement.classList.toggle('chapter-motion', motionEnabled);
  pageHeight = document.documentElement.scrollHeight;
  motionToggle.setAttribute('aria-pressed', String(motionEnabled));
  motionToggle.textContent = reduced.matches ? 'Mouvement réduit' : `Mouvement ${motionEnabled ? 'activé' : 'désactivé'}`;
  motionToggle.disabled = reduced.matches;
  if (!motionEnabled) states.forEach(state => {
    state.frame.style.removeProperty('--image-scale');
    state.frame.style.removeProperty('--image-shift');
    state.scale = 1;
    state.shift = 0;
  });
  schedule();
}
motionToggle.addEventListener('click', () => {
  motionEnabled = !motionEnabled;
  motionPreference = motionEnabled ? 'on' : 'off';
  try { sessionStorage.setItem('islande-motion', motionPreference); } catch { /* Optional preference. */ }
  syncMotion();
});
reduced.addEventListener('change', () => {
  motionEnabled = !reduced.matches && motionPreference !== 'off';
  syncMotion();
});
window.addEventListener('scroll', schedule, { passive: true });
// A fragment jump can land before the first frame is measured, and emits no
// scroll event of its own. Recompute once the page has settled on its anchor.
window.addEventListener('load', schedule);
window.addEventListener('hashchange', schedule);
window.addEventListener('resize', () => { pageHeight = document.documentElement.scrollHeight; schedule(); }, { passive: true });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { cancelAnimationFrame(animationFrame); animationFrame = 0; }
  else { lastTime = 0; lastScroll = window.scrollY; velocity = 0; schedule(); }
});
if ('ResizeObserver' in window) new ResizeObserver(() => { pageHeight = document.documentElement.scrollHeight; schedule(); }).observe(document.body);
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('close', schedule));
syncMotion();
