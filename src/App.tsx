import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { FormEvent, PointerEvent as ReactPointerEvent } from 'react';
import { flushSync } from 'react-dom';
import { ArrowUpRight, ArrowDown, ArrowUp, Download, Github, MapPin, Menu, X, SlidersHorizontal, Pause, Play, Volume2, VolumeX, Check, Copy, Plus, Code2, Headphones, GraduationCap, BadgeCheck } from 'lucide-react';
import { gsap } from 'gsap';
import { profile } from './profile';
import type { Project } from './profile';
import { Emblem, ProjectArt, ReactorFallback, SectionHeading, SceneBoundary } from './components';

const ReactorScene = lazy(() => import('./ReactorScene'));
import CinematicIntro from './CinematicIntro';
import ReactorControls from './ReactorControls';
import type { PowerMode, VisualQuality } from './ReactorControls';
import EnergyConnections from './EnergyConnections';
import ResumeView from './ResumeView';
import MotionSettings from './MotionSettings';
import ProjectDetails from './ProjectDetails';
export type MotionMode = 'full' | 'reduced' | 'off';
const nav = ['About', 'Experience', 'Projects', 'Skills', 'Resume', 'Contact'];
const skillNames = profile.skillGroups.flatMap(g => g.skills);


export default function App() {
  const [mode, setMode] = useState<MotionMode>('full');
  const [paused, setPaused] = useState(false);
  const [audio, setAudio] = useState(false);
  const [settings, setSettings] = useState(false);
  const [menu, setMenu] = useState(false);
  const [active, setActive] = useState('');
  const [recruiter, setRecruiter] = useState(false);
  const [filter, setFilter] = useState('All projects');
  const [project, setProject] = useState<Project | null>(null);
  const [skill, setSkill] = useState('JavaScript');
  const [copied, setCopied] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [shareStatus, setShareStatus] = useState('');
  const [copyError, setCopyError] = useState(false);
  const [power, setPower] = useState<PowerMode>('powered');
  const [exploded, setExploded] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [resetView, setResetView] = useState(0);
  const [quality, setQuality] = useState<VisualQuality>('auto');
  const [bootPhase, setBootPhase] = useState(0);
  const [pulse, setPulse] = useState(0);
  const [formStatus, setFormStatus] = useState('');
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState(false);
  const [intro, setIntro] = useState(false);
  const [cinematicRun, setCinematicRun] = useState(0);
  const [sceneReady, setSceneReady] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const progress = useRef<HTMLDivElement>(null);
  const activeRef = useRef('');
  const progressText = useRef<HTMLSpanElement>(null);
  const halo = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const savedProjectFocus = useRef<HTMLElement | null>(null);

  function later(fn: () => void, ms: number) { const id = setTimeout(fn, ms); timers.current.push(id); }
  useEffect(() => () => { timers.current.forEach(clearTimeout); void audioContext.current?.close(); }, []);

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let saved: string | null = null;
    try { saved = localStorage.getItem('arc-motion'); setPaused(localStorage.getItem('arc-paused') === 'true'); } catch { /* private browsing */ }
    setMode(saved === 'full' || saved === 'reduced' || saved === 'off' ? saved : media.matches ? 'reduced' : 'full');
    const syncSystem = () => { let preferred = null; try { preferred = localStorage.getItem('arc-motion'); } catch {} if (!preferred) setMode(media.matches ? 'reduced' : 'full'); };
    media.addEventListener('change', syncSystem);
    const syncUrl = () => {
      const params = new URLSearchParams(location.search);
      setRecruiter(params.get('view') === 'resume');
      setProject(profile.projects.find(p => p.id === params.get('project')) || null);
    };
    syncUrl(); window.addEventListener('popstate', syncUrl);
    let firstVisit = true;
    try { firstVisit = !sessionStorage.getItem('arc-boot-v1'); sessionStorage.setItem('arc-boot-v1', 'true'); } catch {}
    if (firstVisit && !media.matches && (!saved || saved === 'full') && !location.search && !location.hash) { setIntro(true); }
    const load = setTimeout(() => setSceneReady(true), 300);
    return () => { media.removeEventListener('change', syncSystem); window.removeEventListener('popstate', syncUrl); clearTimeout(load); };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.motion = mode;
    document.documentElement.dataset.paused = String(paused);
    if (mode !== 'full') setIntro(false);
    // Kill scripted transitions as well as CSS/3D motion when preferences change.
    if (mode !== 'full' || paused) { gsap.globalTimeline.clear(); gsap.set('.project-card', { clearProps: 'transform,opacity' }); }
  }, [mode, paused]);

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>('main > section'));
    const observer = new IntersectionObserver(entries => entries.forEach(e => {
      (e.target as HTMLElement).dataset.visible = String(e.isIntersecting);
      if (e.isIntersecting) (e.target as HTMLElement).dataset.lit = 'true';
    }), { rootMargin: '80px' });
    sections.forEach(s => observer.observe(s));
    let frame = 0;
    function update() {
      frame = 0;
      const max = document.documentElement.scrollHeight - innerHeight;
      const pct = max > 0 ? Math.min(100, scrollY / max * 100) : 0;
      progress.current?.style.setProperty('transform', `scaleX(${pct / 100})`);
      if (progressText.current) progressText.current.textContent = `${Math.round(pct)}%`;
      let current = '';
      sections.forEach(s => { if (s.offsetHeight && s.getBoundingClientRect().top < 230) current = s.id; });
      if (activeRef.current !== current) { activeRef.current = current; setActive(current); }
      if (mode === 'full' && !paused) {
        const timeline = document.querySelector<HTMLElement>('.timeline');
        if (timeline) { const r = timeline.getBoundingClientRect(); timeline.style.setProperty('--line-progress', `${Math.min(1, Math.max(0, (innerHeight * .7 - r.top) / r.height))}`); }

      }
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    const onVisibility = () => { document.documentElement.dataset.hidden = String(document.hidden); };
    window.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('resize', onScroll);
    document.addEventListener('visibilitychange', onVisibility); update();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); document.removeEventListener('visibilitychange', onVisibility); };
  }, [mode, paused, recruiter, filter]);

  useEffect(() => {
    if (mode !== 'full' || paused) return;
    const ctx = gsap.context(() => {
      const observer = new IntersectionObserver(entries => entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        gsap.fromTo(entry.target, { y: 22, opacity: .4 }, { y: 0, opacity: 1, duration: .65, ease: 'power3.out', clearProps: 'all' });
        observer.unobserve(entry.target);
      }), { threshold: .1 });
      document.querySelectorAll('[data-reveal]').forEach(e => observer.observe(e));
      return () => observer.disconnect();
    }, root);
    return () => { ctx.revert(); gsap.killTweensOf('[data-reveal]'); gsap.set('[data-reveal]', { clearProps: 'transform,opacity' }); };
  }, [mode, paused]);

  useEffect(() => {
    if (!menu) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenu(false); menuButton.current?.focus(); } };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [menu]);

  useEffect(() => {
    if (!intro) return;
    const safety = setTimeout(() => setIntro(false), 11000);
    return () => clearTimeout(safety);
  }, [intro, cinematicRun]);
  function replayArrival() {
    if (mode !== 'full') { setSettings(true); return; }
    setBootPhase(0); setExploded(false); setPower('powered'); setRotation(0); setResetView(r => r + 1); setCinematicRun(r => r + 1); setIntro(true); sound('ignite');
  }
  function skipArrival() { setIntro(false); requestAnimationFrame(() => (document.querySelector('.hero-buttons a') as HTMLElement | null)?.focus({ preventScroll: true })); }
  function changeMode(next: MotionMode) { setMode(next); try { localStorage.setItem('arc-motion', next); } catch {} }
  function togglePause() { setPaused(p => { try { localStorage.setItem('arc-paused', String(!p)); } catch {} return !p; }); }
  function sound(kind: 'ignite' | 'click' | 'success', force = false) {
    if (!audio && !force) return;
    try {
      const ctx = audioContext.current || new AudioContext(); audioContext.current = ctx; void ctx.resume();
      const gain = ctx.createGain(); gain.connect(ctx.destination); gain.gain.setValueAtTime(.035, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .4);
      const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.setValueAtTime(kind === 'ignite' ? 220 : 550, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(kind === 'ignite' ? 880 : 720, ctx.currentTime + .25); osc.connect(gain); osc.start(); osc.stop(ctx.currentTime + .4); osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    } catch { setAudio(false); }
  }
  useEffect(() => {
    if (power !== 'overdrive') return;
    const timer = setTimeout(() => setPower('powered'), 8000);
    return () => clearTimeout(timer);
  }, [power]);
  function pulseReactor() { setPulse(n => n + 1); sound('ignite'); }
  function changePower(next: PowerMode) { setPower(next); pulseReactor(); }
  function pointerMove(e: ReactPointerEvent<HTMLElement>) {
    if (mode !== 'full' || paused || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (halo.current) { halo.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`; halo.current.style.opacity = '1'; }
    const card = (e.target as HTMLElement).closest<HTMLElement>('[data-tilt]');
    if (card) { const r = card.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height; card.style.setProperty('--pointer-x', `${x * 100}%`); card.style.setProperty('--pointer-y', `${y * 100}%`); card.style.transform = `perspective(1000px) rotateX(${(y - .5) * -3}deg) rotateY(${(x - .5) * 3}deg)`; }
    const button = (e.target as HTMLElement).closest<HTMLElement>('.magnetic');
    if (button) { const r = button.getBoundingClientRect(); const child = button.querySelector<HTMLElement>('.button-content'); if (child) child.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .07}px, ${(e.clientY - r.top - r.height / 2) * .1}px)`; }
    const hero = (e.target as HTMLElement).closest('.hero');
    if (hero) { const r = hero.getBoundingClientRect(); const trail = hero.querySelector<HTMLElement>('.pointer-trail'); if (trail) trail.style.transform = `translate(${e.clientX - r.left}px, ${e.clientY - r.top}px)`; }
  }
  function resetTilt(e: ReactPointerEvent<HTMLElement>) { e.currentTarget.style.transform = ''; }
  function resetMagnet(e: ReactPointerEvent<HTMLElement>) { const child = e.currentTarget.querySelector<HTMLElement>('.button-content'); if (child) child.style.transform = ''; }
  function ripple(e: ReactPointerEvent<HTMLElement>) {
    if (mode !== 'full' || paused) return;
    const button = (e.target as HTMLElement).closest<HTMLElement>('.button'); if (!button) return;
    const r = button.getBoundingClientRect(); const dot = document.createElement('span'); dot.className = 'click-ripple'; dot.style.left = `${e.clientX - r.left}px`; dot.style.top = `${e.clientY - r.top}px`; button.appendChild(dot); later(() => dot.remove(), 600);
  }
  function openProject(p: Project) {
    savedProjectFocus.current = document.activeElement as HTMLElement;
    const rect = savedProjectFocus.current?.getBoundingClientRect();
    if (rect) { document.documentElement.style.setProperty('--dialog-from-x', `${(rect.left + rect.width / 2 - innerWidth / 2) * .12}px`); document.documentElement.style.setProperty('--dialog-from-y', `${(rect.top + rect.height / 2 - innerHeight / 2) * .12}px`); }
    setShareStatus(''); setProject(p); const url = new URL(location.href); url.searchParams.set('project', p.id); history.pushState({}, '', url);
  }
  function closeProject() { setProject(null); const url = new URL(location.href); url.searchParams.delete('project'); history.replaceState({}, '', url); savedProjectFocus.current?.focus(); }
  function changeFilter(next: string) {
    if (next === filter) return;
    const boxes = new Map<string, DOMRect>(); document.querySelectorAll<HTMLElement>('.project-card').forEach(el => boxes.set(el.dataset.id!, el.getBoundingClientRect()));
    flushSync(() => setFilter(next));
    if (mode === 'full' && !paused) document.querySelectorAll<HTMLElement>('.project-card').forEach(el => { const before = boxes.get(el.dataset.id!); const after = el.getBoundingClientRect(); gsap.fromTo(el, { x: before ? before.left - after.left : 0, y: before ? before.top - after.top : 12, opacity: before ? 1 : 0 }, { x: 0, y: 0, opacity: 1, duration: .35, clearProps: 'all' }); });
  }
  function toggleRecruiter(next: boolean) { setRecruiter(next); setMenu(false); const url = new URL(location.href); if (next) url.searchParams.set('view', 'resume'); else url.searchParams.delete('view'); url.hash = next ? 'resume' : ''; history.pushState({}, '', url); window.scrollTo({ top: 0, behavior: 'instant' }); }
  async function copyEmail() {
    try { await navigator.clipboard.writeText(profile.email); setCopied(true); setCopyError(false); sound('success'); later(() => setCopied(false), 2200); }
    catch { setCopyError(true); }
  }
  async function submitContact(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget; const data = Object.fromEntries(new FormData(form)); setFormError(false);
    if (!profile.contactEndpoint) {
      const subject = encodeURIComponent(`Project enquiry from ${data.name}`);
      const body = encodeURIComponent(`Hi ${profile.name.split(' ')[0]},\n\n${data.message}\n\n${data.name}\n${data.email}`);
      window.location.href = `mailto:${profile.email}?subject=${subject}&body=${body}`;
      setFormStatus('Email draft prepared. Send it from your email app. This website has not sent a message.'); return;
    }
    setSending(true); setFormStatus('Sending your message…');
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 12000);
    try { const response = await fetch(profile.contactEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: controller.signal }); if (!response.ok) throw new Error('Failed'); setFormStatus('Message sent. Thanks for reaching out!'); sound('success'); form.reset(); }
    catch { setFormError(true); setFormStatus('Your message could not be sent. Please try again or email me directly.'); }
    finally { clearTimeout(timeout); setSending(false); }
  }

  return <div ref={root} className={`site ${recruiter ? 'recruiter-mode' : ''} ${intro ? 'intro-active' : ''}`} onPointerMove={pointerMove} onPointerDown={ripple} onPointerLeave={() => { if (halo.current) halo.current.style.opacity = '0'; }}>
    {sceneReady && !recruiter && <SceneBoundary onError={() => setIntro(false)}><Suspense fallback={null}><ReactorScene mode={mode} paused={paused} power={power} exploded={exploded} pulse={pulse} reset={resetView} rotation={rotation} quality={quality} boot={intro} run={cinematicRun} onPhase={setBootPhase} onComplete={() => setIntro(false)} onFailure={() => setIntro(false)}/></Suspense></SceneBoundary>}
    <a className="skip-link" href="#main">Skip to content</a>
    <div className="reading-progress" ref={progress} aria-hidden="true"/>
    <div ref={halo} className="cursor-halo" aria-hidden="true"/>
    <header className="site-header" inert={intro}>
      <a className="brand" href={recruiter ? '#resume' : '#home'} aria-label="Vaibhav Tripathi home"><Emblem/><span>{profile.name.split(' ')[0].toUpperCase()}<span className="accent">.</span></span></a>
      {!recruiter && <nav id="main-navigation" className={menu ? 'nav open' : 'nav'} aria-label="Main navigation">{nav.map(item => <a key={item} href={`#${item.toLowerCase()}`} className={active === item.toLowerCase() ? 'active' : ''} aria-current={active === item.toLowerCase() ? 'location' : undefined} onClick={() => setMenu(false)}>{item}</a>)}</nav>}
      <div className="header-actions"><button className="recruiter-button" onClick={() => toggleRecruiter(!recruiter)}>{recruiter ? 'Portfolio view' : 'Recruiter view'}<ArrowUpRight size={14}/></button><button className="icon-button settings-trigger" aria-label="Open experience settings" onClick={() => setSettings(true)}><SlidersHorizontal size={17}/></button>{!recruiter && <button ref={menuButton} className="icon-button mobile-menu" aria-label={menu ? 'Close navigation' : 'Open navigation'} aria-expanded={menu} aria-controls="main-navigation" onClick={() => setMenu(!menu)}>{menu ? <X/> : <Menu/>}</button>}</div>
    </header>

    <main id="main" className="site-main" inert={intro}>
      <section id="home" className="hero" data-visible="true">
        <div className="workshop-grid" aria-hidden="true"/><div className="armor-wash" aria-hidden="true"/><div className="hero-system-label" aria-hidden="true">MK.047 / PERSONAL INTERFACE</div>
        <div className="pointer-trail" aria-hidden="true"/>
        <EnergyConnections active={mode === 'full' && !paused && (!intro || bootPhase >= 3)} pulse={pulse} trackLayout={intro}/><div className="hero-main container">
          <div className="hero-copy"><div className="availability"><span className="status-dot"/>{profile.availability}<span className="availability-line"/></div><p className="eyebrow hero-eyebrow">{profile.role.toUpperCase()} <span>✦</span> CREATIVE THINKER</p>
            <h1 data-energy-anchor="identity">{profile.name.split(' ')[0].toUpperCase()}<br/><span>{profile.name.split(' ').slice(1).join(' ').toUpperCase()}<span className="hero-period">.</span></span></h1>
            <p className="hero-manifesto" data-energy-anchor="manifesto">Ideas into <em>interfaces.</em><br/>Engineered to make an impact.</p><p className="hero-description" data-energy-anchor="introduction">{profile.introduction}<br/>Based in {profile.location.split(',')[0]}. A little Stark energy. All my own work.</p>
            <div className="hero-buttons" data-energy-anchor="actions"><a className="button primary magnetic" href="#projects" onPointerLeave={resetMagnet}><span className="button-content">Explore my work <ArrowUpRight size={18}/></span></a><a className="button secondary" href="#resume"><Download size={16}/> {profile.resumeUrl ? 'Download resume' : 'View resume'}</a></div>
            <a className="hero-contact text-link" href="#contact">Have something in mind? Let’s talk <ArrowUpRight size={14}/></a>
          </div>
          <div className="hero-visual">
            <span className="reactor-id"><span>ARC / MK.047</span><span>INTERACTIVE ASSEMBLY</span></span>
            <div className="scene-stage" role="group" tabIndex={0} aria-label="Interactive arc reactor. Drag to inspect, or use arrow keys to rotate.">
              <ReactorFallback power={power} exploded={exploded}/>
              <button className="core-hit" aria-label="Pulse arc reactor" onClick={pulseReactor}/>
            </div>
            <div className="reactor-reticle" aria-hidden="true"><i/><i/><i/><i/></div>
            {exploded && <div className="exploded-labels"><span>01 / OUTER HOUSING</span><span>02 / FIELD COILS</span><span>03 / ENERGY CORE</span></div>}
            <span className="reactor-side-label">DESIGNED TO DO SOMETHING EXTRAORDINARY.</span>
            <ReactorControls power={power} exploded={exploded} onPower={changePower} onExplode={() => { setExploded(v => !v); sound('click'); }} onPulse={pulseReactor} onReplay={replayArrival} onReset={() => { setResetView(n => n + 1); setRotation(0); }} onRotate={delta => setRotation(r => r + delta)}/>
          </div>
        </div>
        <div className="hero-bottom container"><a href="#about" className="scroll-cue"><span><ArrowDown size={15}/></span>SCROLL TO EXPLORE</a><div className="hero-location"><MapPin size={13}/>{profile.location}<span className="separator">/</span>AVAILABLE WORLDWIDE</div><span className="hero-edition">PORTFOLIO — 2026</span></div>
        
      </section>

      <div className="stack-strip" aria-label="Technology stack"><div className="container"><span className="tiny-label">TOOLS OF THE TRADE</span><div>{skillNames.map(s => <span key={s}><i/> {s}</span>)}</div><Code2 size={20}/></div></div>

      <section id="about" className="section container about-section">
        <SectionHeading number="01" label="PERSONNEL PROFILE" title={<>The mind<br/>behind the <span className="serif">armor.</span></>}/>
        <div className="about-grid" data-reveal><div className="portrait-frame"><div className="portrait-grid"/><span className="portrait-label">IDENTITY / VT—047</span>{photoFailed ? <div className="photo-fallback"><Emblem/><span>Profile artwork unavailable</span></div> : <img src={profile.photo} alt={profile.photoAlt} width="329" height="237" loading="lazy" onError={() => setPhotoFailed(true)}/>}<span className="portrait-bottom"><span className="status-dot"/>A DIFFERENT KIND OF FIREPOWER</span><i className="corner tl"/><i className="corner br"/></div>
          <div className="about-copy"><p className="about-lead">A developer by craft.<br/>A creator by <span className="accent">instinct.</span></p><p>{profile.bio}</p><p>I’ve spent {profile.yearsExperience} years working independently on premium frontend projects. This is my corner of the internet — a collection of what I build and what I’m learning along the way.</p><div className="about-facts"><div><span className="fact-number">{String(profile.yearsExperience).padStart(2,'0')}<span>.</span></span><span>YEARS FREELANCING</span></div><div><Headphones size={25}/><span>USUALLY LISTENING<br/>TO SOMETHING GOOD</span></div></div><a href={profile.github} target="_blank" rel="noreferrer" className="text-link">Find me on GitHub <ArrowUpRight size={16}/></a></div>
        </div>
      </section>

      <section id="projects" className="section projects-section"><div className="container"><SectionHeading number="02" label="ENGINEERING SHOWCASE" title={<>Imagination.<br/>Made <span className="serif">tangible.</span></>}><p>Ideas I’ve turned into projects.<br/>Each one, a new possibility.</p><span className="tiny-label">02 SELECTED PROJECTS ↙</span></SectionHeading>
        <div className="project-toolbar"><div className="filter-group" aria-label="Filter projects">{['All projects', ...profile.projects.map(p => p.category)].map(f => <button key={f} aria-pressed={filter === f} className={filter === f ? 'selected' : ''} onClick={() => changeFilter(f)}>{f}{f === 'All projects' && <span>02</span>}</button>)}</div><span className="tiny-label results-count" role="status">{filter === 'All projects' ? '2 PROJECTS' : '1 PROJECT'}</span></div>
        <div className="project-grid">{profile.projects.filter(p => filter === 'All projects' || p.category === filter).map(p => <article className="project-card" data-id={p.id} key={p.id} data-tilt onPointerLeave={resetTilt}>
          <button className="project-open" onClick={() => openProject(p)} aria-label={`View ${p.name} project details`}><ProjectArt project={p}/><div className="project-meta"><div><span className="tiny-label">{p.number} / {p.kind}</span><h3>{p.name}<ArrowUpRight size={25}/></h3></div><span className="project-tag">CASE STUDY SOON</span></div></button><p>{p.description}</p>
        </article>)}</div>
        <p className="project-note">Visuals are concept artwork. Product screenshots, technology details, and case studies will be added when available.</p>
      </div></section>

      <section id="experience" className="section container experience-section"><SectionHeading number="03" label="MISSION HISTORY" title={<>Every project.<br/>A little more <span className="serif">power.</span></>}><p>Independent by choice.<br/>Building one project at a time.</p></SectionHeading>
        <div className="timeline" data-reveal>{profile.experience.map(exp => <div className="timeline-entry" key={exp.role}><div className="timeline-date"><span className="timeline-node"/><span className="tiny-label">{exp.dates || `${exp.duration.toUpperCase()} OF EXPERIENCE`}</span><span className="experience-type">INDEPENDENT / FREELANCE</span></div><div className="timeline-content"><span className="small-chip">THE JOURNEY SO FAR</span><h3>{exp.role}</h3><p>{exp.summary}</p><details className="exp-details"><summary>Explore my experience <Plus size={18}/></summary><div className="details-content"><ul>{exp.responsibilities.map(x => <li key={x}>{x}</li>)}</ul><p className="muted">{exp.note}</p><a className="text-link" href="#projects">See selected projects <ArrowUpRight size={14}/></a></div></details></div></div>)}</div>
      </section>

      <section id="skills" className="section skills-section"><div className="container"><SectionHeading number="04" label="SYSTEMS TOOLKIT" title={<>Different tools.<br/>One <span className="serif">creative mind.</span></>}><p>The building blocks behind the work.<br/>Select a skill to explore.</p></SectionHeading>
        <div className="skills-layout"><div className="constellation" aria-label="Interactive systems diagram"><svg viewBox="0 0 600 350" aria-hidden="true"><defs><linearGradient id="connection"><stop stopColor="#50e8ff"/><stop offset="1" stopColor="#1c3447"/></linearGradient></defs>{[[90,90],[490,65],[510,260],[120,285],[300,50]].map(([x,y], i) => <g className={skill === skillNames[i] ? 'connection selected' : 'connection'} key={i}><path d={`M300 190 L${x} ${y}`} pathLength="100"/>{skill === skillNames[i] && <path key={skill} className="connection-pulse" d={`M300 190 L${x} ${y}`} pathLength="100"/>}<circle r="3" cx={x} cy={y}/></g>)}<circle cx="300" cy="190" r="62" className="constellation-circle"/><circle cx="300" cy="190" r="85" className="constellation-circle outer"/></svg><button className="constellation-core" aria-label="Pulse the arc reactor" title="Send an energy pulse" onClick={pulseReactor}><Emblem key={pulse} className={pulse ? 'pulsed' : ''}/></button>{skillNames.map((s,i) => <button key={s} className={`skill-node skill-${i} ${skill === s ? 'selected' : ''}`} aria-pressed={skill === s} onClick={() => setSkill(s)}><span>{['</>', '#', 'JS', 'Py', 'Rs'][i]}</span>{s}<i/></button>)}<span className="constellation-label tiny-label">CONNECTED BY CURIOSITY</span></div>
          <div className="skill-detail"><span className="tiny-label">CURRENTLY SELECTED / {String(skillNames.indexOf(skill) + 1).padStart(2,'0')}</span><h3>{skill}<span className="accent">.</span></h3><span className="small-chip">{profile.skillGroups.find(g => g.skills.includes(skill))?.name}</span><p>Part of my development toolkit.</p><div className="skill-evidence"><span className="tiny-label">PROJECT CONNECTIONS</span>{profile.projects.some(p => p.technologies.includes(skill)) ? profile.projects.filter(p => p.technologies.includes(skill)).map(p => <button className="text-link" key={p.id} onClick={() => openProject(p)}>{p.name}<ArrowUpRight size={15}/></button>) : <p>Specific project examples for this skill haven’t been added yet.</p>}</div><div className="skill-list" aria-label="All skills">{profile.skillGroups.map(g => <div key={g.name}><span>{g.name}</span><div>{g.skills.map(s => <button key={s} aria-pressed={s === skill} onClick={() => setSkill(s)}>{s}</button>)}</div></div>)}</div></div>
        </div>
        <div className="credentials"><div><GraduationCap size={23}/><div><span className="tiny-label">EDUCATION</span><h3>{profile.education.degree}</h3><p>{profile.education.specialization}</p><span className="pending">{[profile.education.institution, profile.education.dates].filter(Boolean).join(' · ') || 'Institution and dates to be added'}</span></div></div><div><BadgeCheck size={23}/><div><span className="tiny-label">CERTIFICATION</span><h3>{profile.certification.title}</h3><details><summary>Credential details <Plus size={14}/></summary><p>{[profile.certification.issuer, profile.certification.date].filter(Boolean).join(' · ') || 'Issuer and completion date to be added.'}</p>{profile.certification.url ? <a className="text-link" href={profile.certification.url} target="_blank" rel="noreferrer">Verify credential<ArrowUpRight size={13}/></a> : <span className="tiny-note">Verification link to be added.</span>}</details></div></div></div>
      </div></section>

      <ResumeView recruiter={recruiter} onRecruiter={toggleRecruiter}/>

      <section id="contact" className="section contact-section"><div className="container"><SectionHeading number="06" label="OPEN A CHANNEL" title={<>Got a big idea?<br/>Let’s give it <span className="serif">power.</span></>}/><div className="contact-grid"><div className="contact-copy"><p>A new website, a fresh interface, or something that hasn’t been built yet. I’m open to freelance conversations.</p><div className="availability"><span className="status-dot"/>{profile.availability}</div><a className="email-link" href={`mailto:${profile.email}`}>{profile.email}<ArrowUpRight size={20}/></a><button className="copy-button" aria-label={copied ? 'Copied' : 'Copy email address'} onClick={copyEmail}>{copied ? <Check size={14}/> : <Copy size={14}/>}<span role="status">{copied ? 'Copied' : 'Copy email address'}</span></button>{copyError && <p role="alert">Copy unavailable. Select the email address above to copy it manually.</p>}<div className="social-links"><a href={profile.github} target="_blank" rel="noreferrer"><Github size={17}/>GitHub<ArrowUpRight size={14}/></a>{profile.linkedin && <a href={profile.linkedin} target="_blank" rel="noreferrer">LinkedIn<ArrowUpRight size={14}/></a>}{profile.otherLinks.map(l => <a key={l.url} href={l.url} target="_blank" rel="noreferrer">{l.label}<ArrowUpRight size={14}/></a>)}</div></div><form onSubmit={submitContact} action={`mailto:${profile.email}`} method="post" encType="text/plain" className="contact-form"><div className="form-row"><label>Your name<input name="name" autoComplete="name" placeholder="Your name" required minLength={2} maxLength={100}/></label><label>Your email<input name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={254}/></label></div><label>What are we creating?<textarea name="message" placeholder="Tell me about your project, timeline, and what you have in mind…" required minLength={10} maxLength={5000} rows={4}/></label><div className="form-bottom"><p>{profile.contactEndpoint ? 'Let’s start a conversation.' : 'Opens your email app. Nothing is sent automatically.'}</p><button className="button primary" type="submit" disabled={sending}>{sending ? 'Sending…' : profile.contactEndpoint ? 'Send message' : 'Compose email'}<ArrowUpRight size={17}/></button></div><p className={`form-status ${formError ? 'error' : ''}`} role={formError ? 'alert' : 'status'}>{formStatus.startsWith('Message sent') && <Check className="success-check" size={18}/>} {formStatus}</p></form></div></div></section>
    </main>

    <footer className="site-footer container" inert={intro}><div className="footer-top"><button className="footer-brand" onClick={pulseReactor} aria-label="Activate arc reactor pulse"><Emblem key={pulse} className={pulse ? 'pulsed' : ''}/><span>STARK-INSPIRED.<br/><strong>HUMAN-BUILT.</strong></span></button><p>Engineering a little extraordinary.</p><a className="back-top" href={recruiter ? '#resume' : '#home'} aria-label="Back to top"><span ref={progressText}>0%</span><ArrowUp size={17}/></a></div><div className="footer-bottom"><span>© 2026 {profile.name}</span><div><button onClick={togglePause}>{paused ? <Play size={12}/> : <Pause size={12}/>} {paused ? 'Resume ambient' : 'Pause ambient'}</button><button onClick={() => { setAudio(!audio); if (!audio) sound('click', true); }}>{audio ? <Volume2 size={13}/> : <VolumeX size={13}/>}Sound {audio ? 'on' : 'off'}</button><button onClick={() => setSettings(true)}><SlidersHorizontal size={12}/>Motion: {mode}</button></div><a href={`mailto:${profile.email}`}>LET’S BUILD SOMETHING <ArrowUpRight size={12}/></a></div></footer>

    {intro && mode === 'full' && <CinematicIntro phase={bootPhase} onSkip={skipArrival}/>}
    {settings && <MotionSettings mode={mode} paused={paused} audio={audio} quality={quality} onMode={changeMode} onPause={togglePause} onAudio={() => { setAudio(!audio); if (!audio) sound('click', true); }} onQuality={setQuality} onClose={() => setSettings(false)}/>}
    {project && <ProjectDetails project={project} onClose={closeProject} shareStatus={shareStatus} onShare={async () => { try { await navigator.clipboard.writeText(location.href); setShareStatus('Project link copied.'); } catch { setShareStatus('Copy the current address to share this project.'); } }}/>}
  </div>;
}
