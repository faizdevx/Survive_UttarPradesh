// Pointer tilt for the 3D objects, and the drag handle that resizes the page panel.
const TILTS = [['.tv-set', 5], ['.g-card', 11], ['.sec > img', 12], ['.people a', 8], ['.cards button', 8]];

export function initTilt() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let active = null;
  let frame = 0;
  let last = null;
  const reset = () => {
    if (!active) return;
    active.style.removeProperty('--rx');
    active.style.removeProperty('--ry');
    active = null;
  };
  const apply = () => {
    frame = 0;
    const e = last;
    const hit = e.target.closest?.(TILTS.map(([s]) => s).join(','));
    if (hit !== active) reset();
    if (!hit) return;
    active = hit;
    const r = hit.getBoundingClientRect();
    const [, max] = TILTS.find(([s]) => hit.matches(s));
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    hit.style.setProperty('--ry', `${(x * max * 2).toFixed(2)}deg`);
    hit.style.setProperty('--rx', `${(-y * max * 2).toFixed(2)}deg`);
  };
  addEventListener('pointermove', (e) => {
    last = e;
    if (!frame) frame = requestAnimationFrame(apply);
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', reset);
}

const SNAPS = [0.2, 0.48, 0.8]; // Sheet tops on an upright phone, as parts of the screen height

export function initGrip({ store }) {
  const grip = document.querySelector('#dossierGrip');
  const box = document.querySelector('#dossier');
  const app = document.querySelector('.app');
  const upright = () => matchMedia('(max-width: 860px) and (orientation: portrait)').matches;
  const small = () => matchMedia('(max-width: 860px)').matches;
  const widthVar = () => (small() ? '--dw-land' : box.classList.contains('sheet') ? '--dw-sheet' : '--dw');
  const minW = 320;
  const maxW = () => Math.max(minW, innerWidth - (small() ? 120 : 300));
  const setWidth = (px, name = widthVar()) => app.style.setProperty(name, `${Math.round(Math.min(maxW(), Math.max(minW, px)))}px`);
  const setTop = (part) => document.documentElement.style.setProperty('--sheet-top', `${(Math.min(0.85, Math.max(0.12, part)) * 100).toFixed(1)}dvh`);

  // Sizes people chose come back on the next visit, as long as they still fit
  ['--dw', '--dw-sheet', '--dw-land'].forEach((name) => {
    const saved = Number(store.get(name));
    if (saved) setWidth(saved, name);
  });

  let dragging = false;
  grip.addEventListener('pointerdown', (e) => {
    dragging = true;
    grip.setPointerCapture(e.pointerId);
    app.classList.add('resizing');
    e.preventDefault();
  });
  grip.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    if (upright()) setTop(e.clientY / innerHeight);
    else setWidth(innerWidth - e.clientX);
  });
  const finish = (e) => {
    if (!dragging) return;
    dragging = false;
    app.classList.remove('resizing');
    if (upright()) {
      const part = e.clientY / innerHeight;
      setTop(SNAPS.reduce((best, s) => (Math.abs(s - part) < Math.abs(best - part) ? s : best)));
    } else store.set(widthVar(), Math.round(box.offsetWidth));
  };
  grip.addEventListener('pointerup', finish);
  grip.addEventListener('pointercancel', finish);
  // Arrow keys do the same as dragging, and a double click returns to the default size
  grip.addEventListener('keydown', (e) => {
    const step = { ArrowLeft: 40, ArrowRight: -40, ArrowUp: -0.05, ArrowDown: 0.05 }[e.key];
    if (step == null) return;
    e.preventDefault();
    if (upright()) {
      if (Math.abs(step) < 1) setTop(box.getBoundingClientRect().top / innerHeight + step);
    } else if (Math.abs(step) > 1) {
      setWidth(box.offsetWidth + step);
      store.set(widthVar(), Math.round(box.offsetWidth));
    }
  });
  grip.addEventListener('dblclick', () => {
    if (upright()) { document.documentElement.style.removeProperty('--sheet-top'); return; }
    const name = widthVar();
    app.style.removeProperty(name);
    store.set(name, '');
  });
}
