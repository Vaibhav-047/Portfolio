/**
 * Foreground leaves in screen space. They drift over the page, land on the top edge of
 * visible cards and on the cursor, rest there, then slide or fade away.
 */
type Leaf = { x: number; y: number; vx: number; vy: number; rot: number; vr: number; ph: number; f: number; size: number; color: string; mode: 0 | 1 | 2 | 3; t: number; on: Element | 'cursor' | null; dx: number; dy: number; alpha: number };
const COLORS = ['#8fbf55', '#a9cf6c', '#e3b24f', '#e98b4e', '#f2a7c3', '#6fa548', '#d9c26a'];

export function createUiLeaves(canvas: HTMLCanvasElement, max: number) {
  const ctx = canvas.getContext('2d')!;
  const leaves: Leaf[] = [];
  let w = 0, h = 0, dpr = 1, lastScroll = scrollY, raf = 0, last = performance.now(), budget = 0, paused = false;
  const pointer = { x: -999, y: -999, vx: 0, vy: 0, on: false };
  const leafPath = new Path2D('M0 -1 C 0.55 -0.55 0.6 0.3 0 1 C -0.6 0.3 -0.55 -0.55 0 -1 Z');
  const ribPath = new Path2D('M0 -0.9 L0 1.25');

  function resize() { dpr = Math.min(devicePixelRatio, 2); w = innerWidth; h = innerHeight; canvas.width = w * dpr; canvas.height = h * dpr; }
  const move = (e: PointerEvent) => { if (e.pointerType !== "mouse") return; pointer.vx = (e.clientX - pointer.x) * 60; pointer.vy = (e.clientY - pointer.y) * 60; pointer.x = e.clientX; pointer.y = e.clientY; pointer.on = true; };
  const leave = () => { pointer.on = false; };
  resize(); addEventListener('resize', resize); addEventListener('pointermove', move, { passive: true }); document.addEventListener('pointerleave', leave);

  function spawn(x = Math.random() * w, y = -20, impulse = 0) {
    if (leaves.length >= max) return;
    leaves.push({ x, y, vx: (Math.random() - 0.5) * 40 + impulse * (Math.random() - 0.3) * 160, vy: 20 + Math.random() * 20 - impulse * 120, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 2, ph: Math.random() * 6.28, f: 1.6 + Math.random() * 1.4, size: 7 + Math.random() * 7, color: COLORS[(Math.random() * COLORS.length) | 0], mode: 1, t: 0, on: null, dx: 0, dy: 0, alpha: 1 });
  }

  function surfaces() {
    const list: { el: Element; r: DOMRect }[] = [];
    document.querySelectorAll('.branch-card, .hero-actions .btn, .site-header nav ul').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > h || r.width < 40) return;
      const op = parseFloat(getComputedStyle(el).opacity || '1');
      if (op > 0.6) list.push({ el, r });
    });
    return list;
  }

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    if (paused || document.hidden) return;
    const scrollDelta = scrollY - lastScroll; lastScroll = scrollY;
    budget += dt * (0.18 + Math.min(Math.abs(scrollDelta) * 0.04, 3));
    while (budget > 1) { budget -= 1; spawn(); }
    const rects = leaves.some(l => l.mode !== 0) ? surfaces() : [];
    const time = now / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    for (let i = leaves.length - 1; i >= 0; i--) {
      const l = leaves[i]; l.t += dt;
      if (l.mode === 1) {
        const sw = Math.sin(time * l.f + l.ph);
        l.vx += (Math.cos(time * l.f + l.ph) * 55 + 18 - l.vx) * 1.4 * dt;
        l.vy += (40 + Math.abs(sw) * 45 - l.vy) * 1.8 * dt;
        const py = l.y; l.x += l.vx * dt; l.y += l.vy * dt - scrollDelta * 0.25; l.rot += l.vr * dt + sw * 0.02;
        if (l.t > 0.3) {
          for (const { el, r } of rects) if (l.x > r.left + 6 && l.x < r.right - 6 && py <= r.top - l.size * 0.25 && l.y >= r.top - l.size * 0.25) {
            l.mode = 2; l.on = el; l.dx = l.x - r.left; l.dy = -l.size * 0.25; l.t = 0; l.vx = 0; break;
          }
          if (l.mode === 1 && pointer.on && Math.hypot(l.x - pointer.x, l.y - pointer.y + 6) < 14 && l.vy > 0) { l.mode = 2; l.on = 'cursor'; l.dx = l.x - pointer.x; l.dy = -8; l.t = 0; }
        }
        if (l.y > h + 30 || l.x < -40 || l.x > w + 40) { leaves.splice(i, 1); continue; }
      } else if (l.mode === 2) {
        if (l.on === 'cursor') {
          l.x = pointer.x + l.dx; l.y = pointer.y + l.dy;
          if (!pointer.on || Math.hypot(pointer.vx, pointer.vy) > 900 || l.t > 2.2) { l.mode = 1; l.on = null; l.vx = pointer.vx * 0.15; l.vy = 10; l.t = 0.3; }
        } else {
          const hit = rects.find(s => s.el === l.on);
          if (!hit) { l.mode = 1; l.on = null; l.t = 0.3; }
          else { l.x = hit.r.left + l.dx; l.y = hit.r.top + l.dy; }
          if (l.t > 0.8 + l.f) l.mode = 3; // rest 2.4–3.8s
        }
        l.rot += Math.sin(time * 2.6 + l.ph) * 0.004;
      } else {
        l.alpha -= dt * 1.2; l.x += 20 * dt; l.y -= 4 * dt;
        if (l.alpha <= 0) { leaves.splice(i, 1); continue; }
      }
      const flip = l.mode === 1 ? Math.cos(time * l.f * 1.3 + l.ph) : 0.92;
      ctx.save(); ctx.globalAlpha = l.alpha; ctx.translate(l.x, l.y); ctx.rotate(l.rot); ctx.scale(l.size * 0.6, l.size * Math.max(0.15, Math.abs(flip)));
      ctx.fillStyle = l.color; ctx.fill(leafPath);
      ctx.lineWidth = 0.08; ctx.strokeStyle = 'rgba(40,30,10,.35)'; ctx.stroke(ribPath);
      ctx.restore();
    }
  }
  raf = requestAnimationFrame(frame);

  return {
    burst(n = 14) { for (let k = 0; k < n; k++) spawn(w * (0.2 + Math.random() * 0.6), -10 - Math.random() * 120, 0.4 + Math.random() * 0.4); },
    setPaused(v: boolean) { paused = v; if (v) ctx.clearRect(0, 0, w, h); },
    dispose() { cancelAnimationFrame(raf); removeEventListener('resize', resize); removeEventListener('pointermove', move); document.removeEventListener('pointerleave', leave); },
  };
}
