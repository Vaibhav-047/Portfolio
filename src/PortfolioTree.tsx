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

export default function PortfolioTree() {
  const [motion, setMotion] = useState<Motion>(initialMotion);
  const [paused, setPaused] = useState(false), [sound, setSound] = useState(false);
  const [ready, setReady] = useState(false), [failed, setFailed] = useState(false);
  const [active, setActive] = useState<SectionId>('roots');
  const [selected, setSelected] = useState<Project | null>(null);
  const [copied, setCopied] = useState(false), [copyError, setCopyError] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null), scene = useRef<TreeHandle | undefined>(undefined), lenis = useRef<Lenis | null>(null);
  const tooltip = useRef<HTMLDivElement>(null), copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = motion === 'reduced';

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

  // The 3D scene is decoration: lazy-loaded, and the page works without it.
  useEffect(() => {
    let dead = false, handle: TreeHandle | undefined;
    import('./tree/scene').then(module => {
      if (dead || !canvas.current) return;
      try {
        handle = module.createTreeScene(canvas.current, { reduced, onReady: () => setReady(true), onHover: setHover, onSelect: select });
        scene.current = handle; handle.setStops(measureStops());
      } catch { setFailed(true); }
    }).catch(() => setFailed(true));
    return () => { dead = true; handle?.dispose(); scene.current = undefined; };
  }, [reduced]);

  useEffect(() => { scene.current?.setPaused(paused); }, [paused, ready]);

  // Section cards drift in and out with their branch; the active stop drives the nav.
  useEffect(() => {
    const remeasure = () => scene.current?.setStops(measureStops());
    const onScroll = () => {
      const p = scrollProgress(), stops = measureStops();
      let best = 0; stops.forEach((s, i) => { if (Math.abs(s - p) < Math.abs(stops[best] - p)) best = i; });
      setActive(SECTIONS[best].id);
    };
    addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', remeasure);
    void document.fonts?.ready.then(remeasure);
    onScroll();
    const context = gsap.context(() => {
      if (reduced) return;
      gsap.utils.toArray<HTMLElement>('.branch-section').forEach(section => {
        const card = section.querySelector('.branch-card'), dir = section.dataset.side === 'right' ? 1 : -1;
        gsap.timeline({ scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: 0.6 } })
          .fromTo(card, { opacity: 0, y: 140, x: dir * 40, rotate: dir * 2.5 }, { opacity: 1, y: 0, x: 0, rotate: 0, ease: 'power2.out', duration: 0.34 })
          .to(card, { opacity: 1, duration: 0.32 })
          .to(card, { opacity: 0, y: -140, x: -dir * 30, rotate: -dir * 1.5, ease: 'power2.in', duration: 0.34 });
      });
      gsap.to('.hero-inner', { opacity: 0, y: -90, ease: 'none', scrollTrigger: { trigger: '#roots', start: 'top top', end: 'bottom top', scrub: true } });
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
    const move = (event: PointerEvent) => tooltip.current?.style.setProperty('transform', `translate(${event.clientX + 18}px, ${event.clientY + 14}px)`);
    addEventListener('pointermove', move, { passive: true });
    return () => removeEventListener('pointermove', move);
  }, []);

  function goTo(id: SectionId, instant = false) {
    const el = document.getElementById(id); if (!el) return;
    const top = id === 'roots' ? 0 : id === 'canopy' ? document.documentElement.scrollHeight : el.offsetTop + el.offsetHeight / 2 - innerHeight / 2;
    if (lenis.current && !instant) lenis.current.scrollTo(top, { duration: 2.2 });
    else if (lenis.current) lenis.current.scrollTo(top, { immediate: true });
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
    <div ref={tooltip} className={`scene-tooltip ${hover ? 'show' : ''}`} aria-hidden="true">{hover}</div>
    <a className="skip-link" href="#about" onClick={nav('about')}>Skip to content</a>
    <header className="site-header">
      <a className="brand" href="#roots" onClick={nav('roots')}><Seed /><span>{content.name}<small>{content.role}</small></span></a>
      <nav aria-label="Sections"><ul>{SECTIONS.slice(1, 7).map(s => <li key={s.id}><a href={`#${s.id}`} aria-current={active === s.id ? 'true' : undefined} onClick={nav(s.id)}>{s.label}</a></li>)}</ul></nav>
      <div className="header-controls">
        <button className="pill" aria-pressed={!reduced} onClick={() => setMotion(reduced ? 'full' : 'reduced')}><span className={`status-dot ${reduced ? '' : 'on'}`} />{reduced ? 'Calm mode' : 'Motion on'}</button>
        <button className="icon-btn" onClick={() => setPaused(v => !v)} aria-label={paused ? 'Resume ambient animation' : 'Pause ambient animation'}>{paused ? <Play size={15} /> : <Pause size={15} />}</button>
        <button className="icon-btn" onClick={() => setSound(v => !v)} aria-pressed={sound} aria-label={sound ? 'Turn ambient sound off' : 'Turn ambient sound on'}>{sound ? <Volume2 size={15} /> : <VolumeX size={15} />}</button>
      </div>
    </header>

    <main>
      <section id="roots" className="hero" aria-labelledby="hero-title">
        <div className="hero-inner">
          <p className="kicker"><span className="status-dot on" />{content.availability} · {content.location}</p>
          <h1 id="hero-title" className="reveal" tabIndex={-1} data-focus><Words text={content.name} /></h1>
          <p className="hero-role">{content.role}. <em>{content.introduction}</em></p>
          <div className="hero-actions">
            <a className="btn primary magnetic" href="#about" onClick={nav('about')}>Climb the tree <ArrowDown size={17} /></a>
            <a className="btn ghost magnetic" href="#contact" onClick={nav('contact')}>Get in touch</a>
          </div>
        </div>
        <p className="scroll-cue" aria-hidden="true"><span />scroll to grow</p>
      </section>

      <section id="about" className="branch-section" data-side="left" aria-labelledby="about-title">
        <div className="branch-sticky"><article className="branch-card tilt">
          <p className="kicker">Branch 01 · About</p>
          <h2 id="about-title" className="reveal" tabIndex={-1} data-focus><Words text="A little about me" /></h2>
          <p className="lead">{content.bio}</p>
          <p>{content.introduction}</p>
          <p className="hand">Usually building something. Probably listening to music. ♫</p>
        </article></div>
      </section>

      <section id="skills" className="branch-section" data-side="right" aria-labelledby="skills-title">
        <div className="branch-sticky"><article className="branch-card tilt">
          <p className="kicker">Branch 02 · Skills</p>
          <h2 id="skills-title" className="reveal" tabIndex={-1} data-focus><Words text="My everyday toolkit" /></h2>
          <ul className="skill-list">{content.skills.map(skill => <li key={skill.name}><span className="fruit" aria-hidden="true" /><strong>{skill.name}</strong><span>{skill.group}</span><p>{skill.note}</p></li>)}</ul>
          <div className="split">
            <div><h3>Education</h3><p>{content.education.degree}<br />{content.education.specialization}</p></div>
            <div><h3>Certification</h3><p>{content.certification}</p></div>
          </div>
        </article></div>
      </section>

      <section id="projects" className="branch-section" data-side="left" aria-labelledby="projects-title">
        <div className="branch-sticky"><article className="branch-card tilt">
          <p className="kicker">Branch 03 · Projects</p>
          <h2 id="projects-title" className="reveal" tabIndex={-1} data-focus><Words text="Selected work" /></h2>
          <div className="project-list">{content.projects.map(project => <div className="project" key={project.id}>
            <span className="tag">{project.category}</span>
            <h3>{project.name}</h3>
            <p className="muted">{project.status}</p>
            <p>{project.description}</p>
            <div className="row">
              <button className="btn small magnetic" onClick={() => openProject(project)} aria-label={`Open ${project.name} project`}>Read the story <ArrowUpRight size={15} /></button>
              {project.source && /^https?:\/\//.test(project.source) && <a className="text-link" href={project.source} target="_blank" rel="noreferrer">Source code ↗</a>}
            </div>
          </div>)}</div>
          <p className="small">Unpublished details are labelled honestly.</p>
        </article></div>
      </section>

      <section id="experience" className="branch-section" data-side="right" aria-labelledby="experience-title">
        <div className="branch-sticky"><article className="branch-card tilt">
          <p className="kicker">Branch 04 · Experience</p>
          <h2 id="experience-title" className="reveal" tabIndex={-1} data-focus><Words text={content.experience.role} /></h2>
          <p className="lead">{content.experience.company} · {content.experience.duration}</p>
          <p>{content.experience.summary}</p>
        </article></div>
      </section>

      <section id="contact" className="branch-section" data-side="left" aria-labelledby="contact-title">
        <div className="branch-sticky"><article className="branch-card tilt">
          <p className="kicker">Branch 05 · Contact</p>
          <h2 id="contact-title" className="reveal" tabIndex={-1} data-focus><Words text="Got an idea? My inbox is open." /></h2>
          <p className="lead">Available for freelance frontend work. Tell me what you have in mind.</p>
          <a className="email-link" href={`mailto:${content.email}`}><Mail size={18} />{content.email}</a>
          <div className="row">
            <a className="btn primary magnetic" href={`mailto:${content.email}`}>Write me an email <ArrowUpRight size={16} /></a>
            <button className="btn ghost magnetic" onClick={copy}>{copied ? <Check size={15} /> : <Copy size={15} />}<span>{copied ? 'Copied' : 'Copy address'}</span></button>
            <a className="btn ghost magnetic" href={content.github} target="_blank" rel="noreferrer"><Github size={15} /> GitHub</a>
          </div>
          <p className="small" role="status">{copyError ? 'Clipboard unavailable. Select the email address above to copy it.' : copied ? 'Email address copied.' : 'Opens your email app. No message is sent by this website.'}</p>
        </article></div>
      </section>

      <section id="resume" className="branch-section" data-side="right" aria-labelledby="resume-title">
        <div className="branch-sticky"><article className="branch-card tilt resume">
          <p className="kicker">The hollow · Resume</p>
          <h2 id="resume-title" tabIndex={-1} data-focus>{content.name}</h2>
          <p>{content.role} · {content.location}</p>
          <p><a className="text-link" href={`mailto:${content.email}`}>{content.email}</a> · <a className="text-link" href={content.github} target="_blank" rel="noreferrer">{content.github.replace('https://', '')}</a></p>
          <h3>Profile</h3><p>{content.bio}</p>
          <h3>Experience</h3><p>{content.experience.role} / {content.experience.duration}</p><p>{content.experience.summary}</p>
          <h3>Projects</h3>{content.projects.map(project => <p key={project.id}><strong>{project.name}</strong> — {project.description}</p>)}
          <h3>Skills</h3><p>{content.skills.map(skill => skill.name).join(' · ')}</p>
          <h3>Education & certification</h3><p>{content.education.degree}, {content.education.specialization}</p><p>{content.certification}</p>
          <button className="btn small magnetic no-print" onClick={() => print()}><Printer size={15} /> Print / Save PDF</button>
        </article></div>
      </section>

      <section id="canopy" className="outro" aria-labelledby="outro-title">
        <p className="kicker">From the roots to your next idea</p>
        <h2 id="outro-title" className="reveal" tabIndex={-1} data-focus><Words text="Let’s grow something good." /></h2>
        <a className="email-link big magnetic" href={`mailto:${content.email}`}>{content.email}<ArrowUpRight size={24} /></a>
        <div className="outro-foot">
          <span>© {new Date().getFullYear()} {content.name}</span>
          <a href="#roots" onClick={nav('roots')} className="text-link">Take the trip again <RotateCcw size={14} /></a>
        </div>
      </section>
    </main>

    {selected && <Dialog title={selected.name} onClose={closeProject} className="project-dialog">
      <span className="kicker">Project · {selected.category}</span>
      <h2>{selected.name}</h2>
      <p>{selected.description}</p>
      {(['problem', 'contribution', 'approach', 'outcome'] as const).map(key => selected[key] && <div key={key}><h3>{key === 'contribution' ? 'My contribution' : key}</h3><p>{selected[key]}</p></div>)}
      {selected.technologies.length > 0 && <p className="small">{selected.technologies.join(' / ')}</p>}
      <div className="row">
        {selected.url && /^https?:\/\//.test(selected.url) && <a className="text-link" href={selected.url} target="_blank" rel="noreferrer">Visit project ↗</a>}
        {selected.source && /^https?:\/\//.test(selected.source) && <a className="text-link" href={selected.source} target="_blank" rel="noreferrer">Source code ↗</a>}
        <a className="btn primary" href={`mailto:${content.email}?subject=${encodeURIComponent(selected.name)}`}>Ask about this project <ArrowUpRight size={16} /></a>
      </div>
    </Dialog>}
  </div>;
}
