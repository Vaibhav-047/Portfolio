import { gsap } from 'gsap';

/**
 * Small interactions that make the page feel alive: leaf cursor with a firefly trail,
 * magnetic buttons, tilting cards, springy presses, vine-like word reveals and growing card vines.
 * Everything is skipped in calm mode; touch devices get only the reveals.
 */
export function mountUiLife(reduced: boolean) {
  const cleanups: (() => void)[] = [];
  const on = <K extends keyof WindowEventMap>(t: Window | Document | HTMLElement, type: K, fn: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions) => {
    t.addEventListener(type, fn as EventListener, opts); cleanups.push(() => t.removeEventListener(type, fn as EventListener));
  };

  // Reveals: words unfurl and card vines grow when a heading or card comes into view.
  const io = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.35 });
  document.querySelectorAll('.reveal, .card-vine').forEach(el => reduced ? el.classList.add('in') : io.observe(el));
  cleanups.push(() => io.disconnect());
  if (reduced) return () => cleanups.forEach(c => c());

  const fine = matchMedia('(pointer: fine)').matches;

  // Springy press on every button-like control.
  document.querySelectorAll<HTMLElement>('.btn, .pill, .icon-btn, .site-header nav a').forEach(el => {
    on(el, 'pointerdown', () => gsap.to(el, { scale: 0.94, duration: 0.12, ease: 'power2.out', overwrite: 'auto' }));
    const release = () => gsap.to(el, { scale: 1, duration: 0.7, ease: 'elastic.out(1.1, 0.35)', overwrite: 'auto' });
    on(el, 'pointerup', release); on(el, 'pointerleave', release);
  });
  if (!fine) return () => cleanups.forEach(c => c());

  // Magnetic buttons lean toward the cursor.
  document.querySelectorAll<HTMLElement>('.magnetic').forEach(el => {
    const x = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' }), y = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });
    on(el, 'pointermove', e => { const r = el.getBoundingClientRect(); x((e.clientX - r.left - r.width / 2) * 0.28); y((e.clientY - r.top - r.height / 2) * 0.35); });
    on(el, 'pointerleave', () => { x(0); y(0); });
  });

  // Cards tilt a little under the cursor, like a leaf on water.
  document.querySelectorAll<HTMLElement>('.tilt').forEach(el => {
    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.8, ease: 'power3.out' }), ry = gsap.quickTo(el, 'rotationY', { duration: 0.8, ease: 'power3.out' });
    on(el, 'pointermove', e => { const r = el.getBoundingClientRect(); ry(((e.clientX - r.left) / r.width - 0.5) * 6); rx(-((e.clientY - r.top) / r.height - 0.5) * 5); el.style.setProperty('--gx', `${e.clientX - r.left}px`); el.style.setProperty('--gy', `${e.clientY - r.top}px`); });
    on(el, 'pointerleave', () => { rx(0); ry(0); });
  });

  // Leaf cursor with a trail of fireflies.
  const leaf = document.createElement('div'); leaf.className = 'cursor-leaf'; leaf.setAttribute('aria-hidden', 'true');
  leaf.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 20C4 11 9 4 20 4c0 11-7 16-16 16Z"/><path d="M4 20 14 10"/></svg>';
  const flies = Array.from({ length: 5 }, (_, i) => { const d = document.createElement('i'); d.className = 'cursor-fly'; d.style.setProperty('--s', String(1 - i * 0.14)); d.setAttribute('aria-hidden', 'true'); return d; });
  document.body.append(leaf, ...flies); document.documentElement.classList.add('has-cursor');
  cleanups.push(() => { leaf.remove(); flies.forEach(f => f.remove()); document.documentElement.classList.remove('has-cursor'); });
  const p = { x: innerWidth / 2, y: innerHeight / 2 }, l = { x: p.x, y: p.y, r: 0 }, trail = flies.map(() => ({ x: p.x, y: p.y }));
  let shown = false, hot = false, raf = 0;
  on(window, 'pointermove', e => { if (e.pointerType !== 'mouse') return; p.x = e.clientX; p.y = e.clientY; if (!shown) { shown = true; document.documentElement.classList.add('cursor-on'); } hot = !!(e.target as HTMLElement).closest?.('a, button, summary, [role=button], label') || document.body.classList.contains('over-object'); }, { passive: true });
  on(document, 'pointerleave', () => { shown = false; document.documentElement.classList.remove('cursor-on'); });
  on(window, 'pointerdown', () => leaf.classList.add('press'));
  on(window, 'pointerup', () => leaf.classList.remove('press'));
  const tick = () => {
    raf = requestAnimationFrame(tick);
    const vx = p.x - l.x; l.x += vx * 0.32; l.y += (p.y - l.y) * 0.32; l.r += (Math.max(-40, Math.min(40, vx * 1.5)) - l.r) * 0.15;
    leaf.style.transform = `translate3d(${l.x}px, ${l.y}px, 0) rotate(${l.r - 20}deg) scale(${hot ? 1.6 : 1})`;
    const t = performance.now() / 1000;
    trail.forEach((f, i) => {
      const lead = i ? trail[i - 1] : l, k = 0.16 - i * 0.02;
      f.x += (lead.x + Math.sin(t * 2.3 + i * 1.7) * (10 + i * 3) - f.x) * k; f.y += (lead.y + Math.cos(t * 1.9 + i * 2.1) * (8 + i * 3) - f.y) * k;
      flies[i].style.transform = `translate3d(${f.x}px, ${f.y}px, 0)`;
    });
  };
  raf = requestAnimationFrame(tick);
  cleanups.push(() => cancelAnimationFrame(raf));
  return () => cleanups.forEach(c => c());
}
