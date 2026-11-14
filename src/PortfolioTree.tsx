import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowDown, ArrowUpRight, Check, Copy, Github, Mail, Pause, Play, Printer, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import content from './content.json';
import { Dialog } from './components';
import { SECTIONS, measureStops, scrollProgress } from './tree/sections';
import type { SectionId } from './tree/sections';
import type { TreeHandle } from './tree/scene';
import { createUiLeaves } from './ui/uiLeaves';
import { mountUiLife } from './ui/life';
import type { Ambience } from './ui/sound';

gsap.registerPlugin(ScrollTrigger);
type Project = typeof content.projects[number];
type Motion = 'full' | 'reduced';

function initialMotion(): Motion {
  try { const saved = localStorage.getItem('vt-motion'); if (saved === 'full' || saved === 'reduced') return saved; } catch { /* storage blocked */ }
  return matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'full';
}

/** Words wrapped for the vine-like reveal; the text stays one selectable, readable string. */
function Words({ text }: { text: string }) {
  return <>{text.split(' ').map((word, i) => <span className="w" style={{ '--i': i } as CSSProperties} key={i}>{word} </span>)}</>;
}

function Seed() {
  return <svg className="seed-mark" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 29c0-8 0-12 0-15" /><path d="M16 17c-6 0-9-4-9-9 6 0 9 4 9 9Z" /><path d="M16 14c5 0 8-3 8-8-5 0-8 3-8 8Z" /></svg>;
}

/** A vine that grows along the top-left corner of a card when it comes into view. */
function CardVine({ flip = false }: { flip?: boolean }) {
  return <svg className={`card-vine ${flip ? 'flip' : ''}`} viewBox="0 0 240 200" aria-hidden="true">
    <path className="stem" pathLength={1} d="M236 6C180 2 120 14 70 10 36 8 14 22 8 52c-6 30 4 60 0 96-2 20-6 34-2 48" />
    {[[188, 6, -30], [122, 12, 20], [62, 10, -10], [14, 40, 60], [6, 92, 110], [4, 150, 70]].map(([x, y, r], i) =>
      <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}><path className="vine-leaf" style={{ '--i': i } as CSSProperties} d="M0 0c6-10 18-12 22-4-6 10-16 10-22 4Z" /></g>)}
  </svg>;
}

/** Scroll progress as a vine growing up the left edge; a leaf unfurls at each branch passed. */
function VineProgress({ stops, active }: { stops: number[]; active: SectionId }) {
  const stem = useRef<SVGPathElement>(null), wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0; const p = scrollProgress();
      stem.current?.style.setProperty('stroke-dashoffset', String(1 - p));
      wrap.current?.querySelectorAll<HTMLElement>('.vp-leaf').forEach(el => el.classList.toggle('grown', p + 0.002 >= Number(el.dataset.at)));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    addEventListener('scroll', onScroll, { passive: true }); update();
    return () => { removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [stops]);
  return <div ref={wrap} className="vine-progress" aria-hidden="true">
    <svg viewBox="0 0 24 1000" preserveAspectRatio="none">
      <path className="vp-track" d="M12 1000C4 900 20 820 12 720S4 540 12 440 20 260 12 160 6 40 12 0" />
      <path ref={stem} className="vp-stem" pathLength={1} d="M12 1000C4 900 20 820 12 720S4 540 12 440 20 260 12 160 6 40 12 0" />
    </svg>
    {SECTIONS.slice(1, 7).map((s, i) => <span key={s.id} className={`vp-leaf ${i % 2 ? 'r' : 'l'} ${active === s.id ? 'here' : ''}`} data-at={stops[i + 1] ?? 0} style={{ bottom: `${(stops[i + 1] ?? 0) * 100}%` }}><i /><b>{s.label}</b></span>)}
  </div>;
}

/** A seed that sprouts into a sapling while the 3D tree loads. */
function Loader({ done }: { done: boolean }) {
  return <div className={`loader ${done ? 'done' : ''}`} aria-hidden={done}>
    <svg viewBox="0 0 120 140" aria-hidden="true">
      <path className="soil" d="M10 118c30-6 70-6 100 0" />
      <ellipse className="seed" cx="60" cy="116" rx="9" ry="6" />
      <path className="sprout" pathLength={1} d="M60 114c0-20-4-34 0-58 2-14 0-26 0-34" />
      <path className="lf l1" d="M60 80c-14 2-26-6-28-18 14-2 26 6 28 18Z" />
      <path className="lf l2" d="M60 62c12 0 22-8 24-20-12 0-22 8-24 20Z" />
      <path className="lf l3" d="M60 34c-10 0-18-8-18-18 10 0 18 8 18 18Z" />
      <path className="lf l4" d="M60 26c8-2 14-10 14-18-8 2-14 10-14 18Z" />
    </svg>
    <p role="status">{done ? 'The tree has grown.' : 'Planting the seed…'}</p>
  </div>;
}

export default function PortfolioTree() {
  const [motion, setMotion] = useState<Motion>(initialMotion);
  const [paused, setPaused] = useState(false), [sound, setSound] = useState(false);
  const [ready, setReady] = useState(false), [failed, setFailed] = useState(false), [loaderGone, setLoaderGone] = useState(false);
  const [active, setActive] = useState<SectionId>('roots');
  const [stops, setStops] = useState<number[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [copied, setCopied] = useState(false), [copyError, setCopyError] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null), scene = useRef<TreeHandle | undefined>(undefined), lenis = useRef<Lenis | null>(null);
  const leafCanvas = useRef<HTMLCanvasElement>(null), uiLeaves = useRef<ReturnType<typeof createUiLeaves> | null>(null), ambience = useRef<Ambience | null>(null);
  const tooltip = useRef<HTMLDivElement>(null), copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = motion === 'reduced';
  const [sprouted, setSprouted] = useState(false);
  const loaded = (ready || failed) && sprouted;
  useEffect(() => { const t = setTimeout(() => setSprouted(true), 1700); return () => clearTimeout(t); }, []); // let the sapling finish growing

  useEffect(() => {
    document.documentElement.dataset.motion = motion;
    try { localStorage.setItem('vt-motion', motion); } catch { /* storage blocked */ }
  }, [motion]);

  // OS-level reduced motion always wins when it switches on.
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { if (media.matches) setMotion('reduced'); };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  // The loader never holds the page hostage: it leaves when the tree is ready, or after 6s regardless.
  useEffect(() => {
    if (loaded || reduced) { const t = setTimeout(() => setLoaderGone(true), reduced ? 0 : 1100); return () => clearTimeout(t); }
    const t = setTimeout(() => setLoaderGone(true), 6000); return () => clearTimeout(t);
  }, [loaded, reduced]);

  // Smooth scroll + ScrollTrigger share one ticker.
  useEffect(() => {
    if (reduced) return;
    const instance = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 });
    lenis.current = instance;
    instance.on('scroll', ScrollTrigger.update);
    const tick = (time: number) => instance.raf(time * 1000);
    gsap.ticker.add(tick); gsap.ticker.lagSmoothing(0);
    return () => { gsap.ticker.remove(tick); instance.destroy(); lenis.current = null; };
  }, [reduced]);
  useEffect(() => { if (selected) lenis.current?.stop(); else lenis.current?.start(); }, [selected]);

  // The 3D scene is decoration: lazy-loaded, and the page works without it.
  useEffect(() => {
    let dead = false, handle: TreeHandle | undefined;
    // No WebGL2: keep the painted-sky fallback and skip loading three.js at all (and its console errors).
    const probe = document.createElement('canvas').getContext('webgl2');
    if (!probe) { setFailed(true); return; }
    probe.getExtension('WEBGL_lose_context')?.loseContext();
    import('./tree/scene').then(module => {
      if (dead || !canvas.current) return;
      try {
        handle = module.createTreeScene(canvas.current, { reduced, onReady: () => setReady(true), onHover: setHover, onSelect: select, onBurst: () => { uiLeaves.current?.burst(); ambience.current?.rustle(); } });
        scene.current = handle; handle.setStops(measureStops());
      } catch { setFailed(true); }
    }).catch(() => setFailed(true));
    return () => { dead = true; handle?.dispose(); scene.current = undefined; };
  }, [reduced]);

  useEffect(() => { scene.current?.setPaused(paused); uiLeaves.current?.setPaused(paused); }, [paused, ready]);

  // Foreground leaves that land on cards and the cursor (full motion only).
  useEffect(() => {
    if (reduced || !leafCanvas.current) return;
    const small = matchMedia('(pointer: coarse)').matches || innerWidth < 700 || new URLSearchParams(location.search).get('quality') === 'low';
    const layer = createUiLeaves(leafCanvas.current, small ? 10 : 30);
    uiLeaves.current = layer;
    return () => { layer.dispose(); uiLeaves.current = null; };
  }, [reduced]);

  useEffect(() => mountUiLife(reduced), [reduced]);
  useEffect(() => { document.documentElement.classList.toggle('loading', !loaderGone && !reduced); }, [loaderGone, reduced]);

  // Ambient sound: off by default, generated in the browser, only after the visitor turns it on.
  useEffect(() => {
    if (!sound) { ambience.current?.stop(); return; }
    let lastY = scrollY, lastT = performance.now();
    const go = async () => { if (!ambience.current) ambience.current = (await import('./ui/sound')).createAmbience(); ambience.current.start(); };
    void go();
    const onScroll = () => { const now = performance.now(), speed = Math.abs(scrollY - lastY) / Math.max(1, now - lastT); lastY = scrollY; lastT = now; ambience.current?.update(scrollProgress(), speed); };
    addEventListener('scroll', onScroll, { passive: true });
    return () => removeEventListener('scroll', onScroll);
  }, [sound]);
  useEffect(() => () => ambience.current?.dispose(), []);

  // Section cards drift in and out with their branch; the active stop drives the nav and the vine.
  useEffect(() => {
    let current = measureStops();
    const remeasure = () => { current = measureStops(); setStops(current); scene.current?.setStops(current); };
    const onScroll = () => {
      const p = scrollProgress();
      let best = 0; current.forEach((s, i) => { if (Math.abs(s - p) < Math.abs(current[best] - p)) best = i; });
      setActive(SECTIONS[best].id);
    };
    addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', remeasure);
    void document.fonts?.ready.then(remeasure);
    remeasure(); onScroll();
    const context = gsap.context(() => {
      if (reduced) return;
      gsap.utils.toArray<HTMLElement>('.branch-section').forEach(section => {
        const card = section.querySelector('.card-float'), dir = section.dataset.side === 'right' ? 1 : -1;
        gsap.timeline({ scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: 0.6 } })
          .fromTo(card, { opacity: 0, y: 140, x: dir * 40, rotate: dir * 2.5 }, { opacity: 1, y: 0, x: 0, rotate: 0, ease: 'power2.out', duration: 0.34 })
          .to(card, { opacity: 1, duration: 0.32 })
          .to(card, { opacity: 0, y: -140, x: -dir * 30, rotate: -dir * 1.5, ease: 'power2.in', duration: 0.34 });
      });
      gsap.to('.hero-inner', { opacity: 0, y: -90, ease: 'none', scrollTrigger: { trigger: '#roots', start: 'top top', end: 'bottom top', scrub: true } });
      gsap.to('.scroll-cue', { opacity: 0, ease: 'none', scrollTrigger: { trigger: '#roots', start: 'top top', end: '20% top', scrub: true } });
    });
    return () => { context.revert(); removeEventListener('scroll', onScroll); removeEventListener('resize', remeasure); };
  }, [reduced]);

  // Deep links: #section and #project-id.
  useEffect(() => {
    function hash() {
      const id = location.hash.slice(1), project = content.projects.find(p => `project-${p.id}` === id);
      if (project) { setSelected(project); goTo('projects', true); }
      else { setSelected(null); if (SECTIONS.some(s => s.id === id)) goTo(id as SectionId, true); }
    }
    // Wait for layout + the browser's own anchor jump, then land on the stop (card centred), not the section top.
    history.scrollRestoration = 'manual';
    const run = () => setTimeout(hash, 120);
    if (document.readyState === 'complete') run(); else addEventListener('load', run, { once: true });
    addEventListener('hashchange', hash);
    return () => { removeEventListener('load', run); removeEventListener('hashchange', hash); };
  }, []);

  useEffect(() => {
    const move = (event: PointerEvent) => tooltip.current?.style.setProperty('transform', `translate(${event.clientX + 20}px, ${event.clientY + 16}px)`);
    addEventListener('pointermove', move, { passive: true });
    return () => removeEventListener('pointermove', move);
  }, []);

  function goTo(id: SectionId, instant = false) {
    const el = document.getElementById(id); if (!el) return;
    const top = id === 'roots' ? 0 : id === 'canopy' ? document.documentElement.scrollHeight : el.offsetTop + el.offsetHeight / 2 - innerHeight / 2;
    if (lenis.current) lenis.current.scrollTo(top, instant ? { immediate: true } : { duration: 2.4 });
    else scrollTo({ top, behavior: 'instant' });
    el.querySelector<HTMLElement>('[data-focus]')?.focus({ preventScroll: true });
  }
  const nav = (id: SectionId) => (event: ReactMouseEvent) => { event.preventDefault(); history.pushState({}, '', `#${id}`); goTo(id); };
  function select(id: string) {
    const project = content.projects.find(p => `project:${p.id}` === id);
    if (project) openProject(project); else if (SECTIONS.some(s => s.id === id)) { history.pushState({}, '', `#${id}`); goTo(id as SectionId); }
  }
  function openProject(project: Project) { setSelected(project); history.replaceState({}, '', `#project-${project.id}`); }
  function closeProject() { setSelected(null); history.replaceState({}, '', '#projects'); }
  async function copy() {
    try {
      await navigator.clipboard.writeText(content.email);
      setCopied(true); setCopyError(false);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch { setCopyError(true); }
  }

  return <div className={`tree-site ${ready ? 'scene-ready' : ''} ${failed ? 'scene-failed' : ''}`}>
    <canvas ref={canvas} className="tree-canvas" aria-hidden="true" />
    {!reduced && <canvas ref={leafCanvas} className="ui-leaves" aria-hidden="true" />}
    <div ref={tooltip} className={`scene-tooltip ${hover ? 'show' : ''}`} aria-hidden="true">{hover}</div>
    {!loaderGone && <Loader done={loaded} />}
    {stops.length > 0 && <VineProgress stops={stops} active={active} />}
    <a className="skip-link" href="#about" onClick={nav('about')}>Skip to content</a>
    <header className="site-header">
      <a className="brand" href="#roots" onClick={nav('roots')}><Seed /><span>{content.name}<small>{content.role}</small></span></a>
      <nav aria-label="Sections"><ul>{SECTIONS.slice(1, 7).map(s => <li key={s.id}><a href={`#${s.id}`} aria-current={active === s.id ? 'true' : undefined} onClick={nav(s.id)}>{s.label}</a></li>)}</ul></nav>
      <div className="header-controls">
        <button className="pill" aria-pressed={!reduced} onClick={() => setMotion(reduced ? 'full' : 'reduced')}><span className={`status-dot ${reduced ? '' : 'on'}`} /><span className="label">{reduced ? 'Calm mode' : 'Motion on'}</span></button>
        <button className="icon-btn" onClick={() => setPaused(v => !v)} aria-label={paused ? 'Resume ambient animation' : 'Pause ambient animation'}>{paused ? <Play size={15} /> : <Pause size={15} />}</button>
        <button className="icon-btn" onClick={() => setSound(v => !v)} aria-pressed={sound} aria-label={sound ? 'Turn ambient sound off' : 'Turn ambient sound on'}>{sound ? <Volume2 size={15} /> : <VolumeX size={15} />}</button>
      </div>
    </header>

    <main>
      <section id="roots" className="hero" aria-labelledby="hero-title">
        <div className="hero-inner">
          <p className="note"><span className="status-dot on" />{content.availability.toLowerCase().replace(/^./, c => c.toUpperCase())} in {content.location}</p>
          <h1 id="hero-title" className="reveal" tabIndex={-1} data-focus><Words text={content.name} /></h1>
          <p className="hero-role">{content.role}. {content.introduction}</p>
          <div className="hero-actions">
            <a className="btn primary magnetic" href="#about" onClick={nav('about')}>Climb the tree <ArrowDown size={17} /></a>
            <a className="btn ghost magnetic" href="#contact" onClick={nav('contact')}>Get in touch</a>
          </div>
        </div>
        <p className="scroll-cue" aria-hidden="true"><span />scroll to climb</p>
      </section>

      <section id="about" className="branch-section" data-side="left" aria-labelledby="about-title">
        <div className="branch-sticky"><div className="card-float"><article className="branch-card tilt">
          <CardVine />
          <p className="note">the first branch</p>
          <h2 id="about-title" className="reveal" tabIndex={-1} data-focus><Words text="A little about me" /></h2>
          <p className="lead">{content.bio}</p>
          <p>{content.introduction}</p>
          <p className="hand">Usually building something. Probably listening to music. ♫</p>
        </article></div></div>
      </section>

      <section id="skills" className="branch-section" data-side="right" aria-labelledby="skills-title">
        <div className="branch-sticky"><div className="card-float"><article className="branch-card tilt">
          <CardVine flip />
          <p className="note">the second branch, where the fruit grows</p>
          <h2 id="skills-title" className="reveal" tabIndex={-1} data-focus><Words text="My everyday toolkit" /></h2>
          <ul className="skill-list">{content.skills.map(skill => <li key={skill.name}><span className="fruit" aria-hidden="true" /><strong>{skill.name}</strong><span className="group">{skill.group}</span><p>{skill.note}</p></li>)}</ul>
          <div className="split">
            <div><h3>Education</h3><p>{content.education.degree}<br />{content.education.specialization}</p></div>
            <div><h3>Certification</h3><p>{content.certification}</p></div>
          </div>
        </article></div></div>
      </section>

      <section id="projects" className="branch-section" data-side="left" aria-labelledby="projects-title">
        <div className="branch-sticky"><div className="card-float"><article className="branch-card tilt">
          <CardVine />
          <p className="note">the third branch, in blossom</p>
          <h2 id="projects-title" className="reveal" tabIndex={-1} data-focus><Words text="Selected work" /></h2>
          <div className="project-list">{content.projects.map(project => <div className="project" key={project.id}>
            <span className="tag">{project.category}</span>
            <h3>{project.name}</h3>
            <p className="muted">{project.status}</p>
            <p>{project.description}</p>
            <div className="row">
              <button className="btn small magnetic" onClick={() => openProject(project)} aria-label={`Open ${project.name} project`}>Read the story</button>
              {project.source && /^https?:\/\//.test(project.source) && <a className="text-link" href={project.source} target="_blank" rel="noreferrer">Source code ↗</a>}
            </div>
          </div>)}</div>
          <p className="small">Details that haven’t been published yet are marked as unpublished.</p>
        </article></div></div>
      </section>

      <section id="experience" className="branch-section" data-side="right" aria-labelledby="experience-title">
        <div className="branch-sticky"><div className="card-float"><article className="branch-card tilt">
          <CardVine flip />
          <p className="note">the fourth branch, a nest with an egg for every year</p>
          <h2 id="experience-title" className="reveal" tabIndex={-1} data-focus><Words text={content.experience.role} /></h2>
          <p className="lead">{content.experience.company}, for {content.experience.duration}</p>
          <p>{content.experience.summary}</p>
        </article></div></div>
      </section>

      <section id="contact" className="branch-section" data-side="left" aria-labelledby="contact-title">
        <div className="branch-sticky"><div className="card-float"><article className="branch-card tilt">
          <CardVine />
          <p className="note">the fifth branch, as the fireflies come out</p>
          <h2 id="contact-title" className="reveal" tabIndex={-1} data-focus><Words text="Got an idea? My inbox is open." /></h2>
          <p className="lead">Available for freelance frontend work. Tell me what you have in mind.</p>
          <a className="email-link" href={`mailto:${content.email}`}><Mail size={18} />{content.email}</a>
          <div className="row">
            <a className="btn primary magnetic" href={`mailto:${content.email}`}>Write me an email <ArrowUpRight size={16} /></a>
            <button className="btn ghost magnetic" onClick={copy}>{copied ? <Check size={15} /> : <Copy size={15} />}<span>{copied ? 'Copied' : 'Copy address'}</span></button>
            <a className="btn ghost magnetic" href={content.github} target="_blank" rel="noreferrer"><Github size={15} /> GitHub</a>
          </div>
          <p className="small" role="status">{copyError ? 'Clipboard unavailable. Select the email address above to copy it.' : copied ? 'Email address copied.' : 'Opens your email app. No message is sent by this website.'}</p>
        </article></div></div>
      </section>

      <section id="resume" className="branch-section" data-side="right" aria-labelledby="resume-title">
        <div className="branch-sticky"><div className="card-float"><article className="branch-card tilt resume">
          <CardVine flip />
          <p className="note">kept safe in a hollow of the trunk</p>
          <h2 id="resume-title" tabIndex={-1} data-focus>{content.name}</h2>
          <p>{content.role}, {content.location}</p>
          <p><a className="text-link" href={`mailto:${content.email}`}>{content.email}</a><br /><a className="text-link" href={content.github} target="_blank" rel="noreferrer">{content.github.replace('https://', '')}</a></p>
          <h3>Profile</h3><p>{content.bio}</p>
          <h3>Experience</h3><p>{content.experience.role}, {content.experience.duration}</p><p>{content.experience.summary}</p>
          <h3>Projects</h3>{content.projects.map(project => <p key={project.id}><strong>{project.name}.</strong> {project.description}</p>)}
          <h3>Skills</h3><p>{content.skills.map(skill => skill.name).join(', ')}</p>
          <h3>Education and certification</h3><p>{content.education.degree}, {content.education.specialization}</p><p>{content.certification}</p>
          <button className="btn small magnetic no-print" onClick={() => print()}><Printer size={15} /> Print or save as PDF</button>
        </article></div></div>
      </section>

      <section id="canopy" className="outro" aria-labelledby="outro-title">
        <p className="note">from the roots to your next idea</p>
        <h2 id="outro-title" className="reveal" tabIndex={-1} data-focus><Words text="Let’s grow something good." /></h2>
        <a className="email-link big magnetic" href={`mailto:${content.email}`}>{content.email}<ArrowUpRight size={24} /></a>
        <div className="outro-foot">
          <span>© {new Date().getFullYear()} {content.name}</span>
          <a href="#roots" onClick={nav('roots')} className="text-link">Climb down and start again <RotateCcw size={14} /></a>
        </div>
      </section>
    </main>

    {selected && <Dialog title={selected.name} onClose={closeProject} className="project-dialog">
      <p className="note">a blossom from the third branch</p>
      <span className="tag">{selected.category}</span>
      <h2>{selected.name}</h2>
      <p>{selected.description}</p>
      {(['problem', 'contribution', 'approach', 'outcome'] as const).map(key => selected[key] && <div key={key}><h3>{key === 'contribution' ? 'My contribution' : key[0].toUpperCase() + key.slice(1)}</h3><p>{selected[key]}</p></div>)}
      {selected.technologies.length > 0 && <p className="small">{selected.technologies.join(', ')}</p>}
      <div className="row">
        {selected.url && /^https?:\/\//.test(selected.url) && <a className="text-link" href={selected.url} target="_blank" rel="noreferrer">Visit project ↗</a>}
        {selected.source && /^https?:\/\//.test(selected.source) && <a className="text-link" href={selected.source} target="_blank" rel="noreferrer">Source code ↗</a>}
        <a className="btn primary" href={`mailto:${content.email}?subject=${encodeURIComponent(selected.name)}`}>Ask about this project</a>
      </div>
    </Dialog>}
  </div>;
}
