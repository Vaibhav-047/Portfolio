import { useEffect, useRef } from 'react';

/** Real geometric attachments to the hero's DOM panels; no per-frame React updates. */
export default function EnergyConnections({ active, pulse, trackLayout = false }: { active: boolean; pulse: number; trackLayout?: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = ref.current!;
    const hero = svg.closest<HTMLElement>('.hero')!;
    const paths = Array.from(svg.querySelectorAll<SVGPathElement>('.energy-strand'));
    const sparks = Array.from(svg.querySelectorAll<SVGCircleElement>('.tether-spark'));
    const sockets = Array.from(svg.querySelectorAll<SVGCircleElement>('.tether-socket'));
    let frame = 0, time = 0, previous = 0, visible = true;
    let bounds: DOMRect, targets: { x: number; y: number }[] = [], source = { x: 0, y: 0 };
    function measure() {
      bounds = hero.getBoundingClientRect(); svg.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
      const anchor = hero.querySelector<HTMLElement>('.scene-stage')!.getBoundingClientRect();
      source = { x: anchor.left - bounds.left + anchor.width * .51, y: anchor.top - bounds.top + anchor.height * .5 };
      targets = Array.from(hero.querySelectorAll<HTMLElement>('[data-energy-anchor]')).map(el => { const box = el.getBoundingClientRect(); return { x: box.right - bounds.left + 7, y: box.top - bounds.top + box.height * .5 }; });
    }
    function draw(t: number) {
      const renderer = document.querySelector('.reactor-layer') as (HTMLElement & { reactorMetrics?: { coreX: number; coreY: number } }) | null;
      if (renderer?.reactorMetrics && !renderer.dataset.failed) source = { x: renderer.reactorMetrics.coreX - bounds.left, y: renderer.reactorMetrics.coreY - bounds.top };
      targets.forEach((target, i) => {
        const mobile = bounds.width < 700;
        const start = mobile ? { x: source.x, y: source.y } : source;
        const bend = Math.sin(t * 1.4 + i * 1.9) * (mobile ? 8 : 14);
        const dx = target.x - start.x, dy = target.y - start.y;
        const control1 = { x: start.x + dx * .3, y: start.y + dy * .15 - 30 + bend };
        const control2 = { x: start.x + dx * .7, y: start.y + dy * .8 + 24 - bend };
        for (let layer = 0; layer < 2; layer++) {
          const path = paths[i * 2 + layer]; if (!path) continue;
          const offset = layer ? Math.sin(t * 2 + i) * 5 : 0;
          path.setAttribute('d', `M${start.x},${start.y} C${control1.x},${control1.y + offset} ${control2.x},${control2.y - offset} ${target.x},${target.y}`);
        }
        const path = paths[i * 2];
        if (path && sparks[i]) { const pos = path.getPointAtLength(path.getTotalLength() * ((t * .2 + i * .19) % 1)); sparks[i].setAttribute('cx', String(pos.x)); sparks[i].setAttribute('cy', String(pos.y)); }
        sockets[i]?.setAttribute('cx', String(target.x)); sockets[i]?.setAttribute('cy', String(target.y));
      });
    }
    function loop(now: number) {
      frame = 0;
      if (!active || !visible || document.hidden) return;
      if (!previous || now - previous > 30) { time += previous ? Math.min((now - previous) / 1000, .1) : .03; previous = now; if (trackLayout) measure(); draw(time); }
      frame = requestAnimationFrame(loop);
    }
    const start = () => { if (active && visible && !document.hidden && !frame) { previous = 0; frame = requestAnimationFrame(loop); } };
    const onVisible = () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else start(); };
    const ro = new ResizeObserver(() => { measure(); draw(time); }); ro.observe(hero);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (!visible) { cancelAnimationFrame(frame); frame = 0; } else start(); }); io.observe(hero);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('scroll', measure, { passive: true });
    document.fonts.ready.then(() => { if (svg.isConnected) { measure(); draw(time); } });
    measure(); draw(0); start();
    return () => { cancelAnimationFrame(frame); ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('scroll', measure); };
  }, [active, trackLayout]);
  useEffect(() => {
    if (!active || !ref.current) return;
    ref.current.classList.remove('connection-burst');
    void ref.current.getBoundingClientRect();
    ref.current.classList.add('connection-burst');
    const timer = setTimeout(() => ref.current?.classList.remove('connection-burst'), 1100);
    return () => clearTimeout(timer);
  }, [pulse, active]);
  useEffect(() => {
    if (!active) return;
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-energy-anchor]'));
    const timers: ReturnType<typeof setTimeout>[] = [];
    const callbacks = nodes.map((_, i) => () => {
      const group = ref.current?.querySelector(`.tether-${i}`);
      group?.classList.remove('tether-ping');
      group?.getBoundingClientRect(); group?.classList.add('tether-ping');
      timers.push(setTimeout(() => group?.classList.remove('tether-ping'), 750));
    });
    nodes.forEach((node, i) => { node.addEventListener('pointerenter', callbacks[i]); node.addEventListener('focusin', callbacks[i]); });
    return () => { timers.forEach(clearTimeout); nodes.forEach((node,i) => { node.removeEventListener('pointerenter',callbacks[i]);node.removeEventListener('focusin',callbacks[i]); }); };
  }, [active]);
  return <svg ref={ref} className="energy-tethers" aria-hidden="true"><defs><filter id="tether-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2.8"/></filter><linearGradient id="tether-color"><stop stopColor="#50e8ff" stopOpacity=".8"/><stop offset=".4" stopColor="#31b7ff" stopOpacity=".2"/><stop offset="1" stopColor="#c4f6ff" stopOpacity=".9"/></linearGradient></defs>{Array.from({ length: 4 }, (_, i) => <g key={i} className={`tether tether-${i}`}><path className="energy-strand strand-glow"/><path className="energy-strand strand-core"/><circle className="tether-spark" r="2.2"/><circle className="tether-socket" r="3"/></g>)}</svg>;
}
