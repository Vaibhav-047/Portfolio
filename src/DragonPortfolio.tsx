import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowUpRight, ArrowDown, Menu, X, Copy, Check, Printer, Pause, Play, Wind } from 'lucide-react';
import { profile } from './profile';
import type { Project } from './profile';
import { Dialog } from './components';

gsap.registerPlugin(ScrollTrigger);
const chapters = [['about', 'The story'], ['fall', 'Free fall'], ['projects', 'Selected work'], ['skills', 'Toolkit'], ['contact', 'Contact']];
const art = ['/dragon/goku-flight.png', '/dragon/sky-world.jpg'];

export default function DragonPortfolio() {
 const [loading, setLoading] = useState(true);
 const [ready, setReady] = useState(0);
 const [menu, setMenu] = useState(false);
 const [reduced, setReduced] = useState(() => { try { const saved = localStorage.getItem('dragon-motion'); return saved ? saved === 'reduced' : matchMedia('(prefers-reduced-motion:reduce)').matches; } catch { return true; } });
 const [paused, setPaused] = useState(false);
 const [selected, setSelected] = useState<Project | null>(null);
 const [copied, setCopied] = useState(false);
 const [copyError, setCopyError] = useState(false);
 const root = useRef<HTMLDivElement>(null), actor = useRef<HTMLDivElement>(null), warp = useRef<HTMLDivElement>(null);
 const jump = useRef<gsap.core.Timeline | null>(null), busy = useRef(false), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
 const clock = useRef(0);

 useEffect(() => {
  if (!loading) return;
  let cancelled = false;
  const old = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  const jobs = [...art.map(src => { const image = new Image(); image.src = src; return image.decode(); }), document.fonts.ready];
  jobs.forEach(job => Promise.resolve(job).catch(() => {}).finally(() => { if (!cancelled) setReady(n => n + 1); }));
  const fallback = setTimeout(() => setLoading(false), 8000);
  return () => { cancelled = true; clearTimeout(fallback); document.body.style.overflow = old; };
 }, [loading]);
 useEffect(() => {
  if (ready < 3 || !loading) return;
  const finish = setTimeout(() => setLoading(false), reduced ? 100 : 900);
  return () => clearTimeout(finish);
 }, [ready, loading, reduced]);
 useEffect(() => {
  document.documentElement.dataset.dragonMotion = reduced ? 'reduced' : 'full';
  try { localStorage.setItem('dragon-motion', reduced ? 'reduced' : 'full'); } catch {}
 }, [reduced]);
 useEffect(() => {
  const preference = matchMedia('(prefers-reduced-motion:reduce)');
  const change = () => { if (preference.matches) setReduced(true); };
  const hide = () => root.current?.classList.toggle('tab-hidden', document.hidden);
  const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenu(false); };
  preference.addEventListener('change', change); document.addEventListener('visibilitychange', hide); document.addEventListener('keydown', escape);
  return () => { preference.removeEventListener('change', change); document.removeEventListener('visibilitychange', hide); document.removeEventListener('keydown', escape); jump.current?.kill(); if (timer.current) clearTimeout(timer.current); };
 }, []);

 // One animation loop owns flight. Scroll adds a dive without fighting another transform timeline.
 useEffect(() => {
  if (loading) return;
  const sprite = actor.current!;
  let frame = 0, previous = 0;
  const draw = (now: number) => {
   const delta = previous ? Math.min(now - previous, 40) : 0; previous = now;
   if (!paused && !reduced && !document.hidden) clock.current += delta / 1000;
   const t = clock.current / 5;
   const width = innerWidth, height = innerHeight;
   const fall = document.getElementById('fall')!.getBoundingClientRect();
   const diving = fall.top < height * .2 && fall.bottom > height * .6;
   const dive = Math.max(0, Math.min(1, -fall.top / Math.max(1, fall.height - height)));
   const size = width < 700 ? 220 : Math.min(440, width * .33);
   const x = reduced ? width * .78 : width * (.52 + .33 * Math.cos(t));
   const y = reduced ? height * .64 : height * (.51 + .23 * Math.sin(t * 1.7));
   const rotation = reduced ? -12 : diving ? 145 + dive * 45 : -12 + Math.sin(t) * 24;
   sprite.style.width = `${size}px`;
   sprite.style.transform = `translate3d(${(diving && !reduced ? width * (.5 + .16 * Math.sin(t)) : x) - size / 2}px,${y - size * .75}px,0) rotate(${rotation}deg) scale(${diving ? 1.05 : scrollY > height * .6 ? .72 : 1})`;
   root.current?.style.setProperty('--fall-progress', `${dive}`);
   if (!paused && !reduced && !document.hidden) frame = requestAnimationFrame(draw);
  };
  const start = () => { cancelAnimationFrame(frame); previous = 0; draw(performance.now()); };
  start();
  window.addEventListener('resize', start); window.addEventListener('scroll', start, { passive: true }); document.addEventListener('visibilitychange', start);
  return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', start); window.removeEventListener('scroll', start); document.removeEventListener('visibilitychange', start); };
 }, [loading, reduced, paused]);

 useEffect(() => {
  if (loading || reduced) return;
  const ctx = gsap.context(() => {
   gsap.from('.hero-title span', { yPercent: 110, duration: .95, stagger: .12, ease: 'power4.out' });
   root.current!.querySelectorAll('.reveal').forEach(el => gsap.from(el, { y: 45, opacity: .15, duration: .8, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 93%', once: true } }));
   gsap.to('.world-background', { y: -90, ease: 'none', scrollTrigger: { trigger: '.sky-content', start: 'top top', end: 'bottom bottom', scrub: true } });
   gsap.fromTo('.fall-title', { scale: .8, rotate: -5 }, { scale: 1.2, rotate: 5, ease: 'none', scrollTrigger: { trigger: '#fall', start: 'top bottom', end: 'bottom top', scrub: true } });
  }, root);
  ScrollTrigger.refresh();
  return () => ctx.revert();
 }, [loading, reduced]);

 function navigate(id: string) {
  if (busy.current) return;
  setMenu(false);
  const arrive = () => { const section = document.getElementById(id); section?.scrollIntoView({ behavior: 'instant', block: 'start' }); history.pushState({}, '', `#${id}`); section?.focus({ preventScroll: true }); ScrollTrigger.update(); };
  if (reduced) { arrive(); return; }
  busy.current = true;
  jump.current = gsap.timeline({ onComplete: () => { busy.current = false; } })
   .set(warp.current, { visibility: 'visible' })
   .to('.goku-body', { opacity: 0, scaleY: 1.4, duration: .16 })
   .fromTo(warp.current, { opacity: 0 }, { opacity: 1, duration: .18 }, 0)
   .call(arrive, [], .24)
   .to(warp.current, { opacity: 0, duration: .3 }, .36)
   .set(warp.current, { visibility: 'hidden' })
   .to('.goku-body', { opacity: 1, scaleY: 1, duration: .25 }, .42);
 }
 function motion() { jump.current?.kill(); busy.current = false; gsap.set(warp.current, { opacity: 0, visibility: 'hidden' }); gsap.set('.goku-body', { opacity: 1, scaleY: 1 }); setReduced(v => !v); }
 async function copy() { try { await navigator.clipboard.writeText(profile.email); setCopied(true); setCopyError(false); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setCopied(false), 2000); } catch { setCopyError(true); } }
 const link = (id: string) => (event: React.MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); navigate(id); };

 return <div ref={root} className={`sky-site ${paused ? 'ambient-paused' : ''} ${reduced ? 'motion-reduced' : ''}`}>
  {loading && <div className="launch-screen" role="dialog" aria-modal="true" aria-label="Launching portfolio"><div className="launch-grid"/><span className="launch-brand">VT. / THE SKY IS ONLY THE BEGINNING</span><div className="launch-center"><div className="launch-orbit"><img src={art[0]} alt="Goku preparing to fly"/><span/><i/></div><p className="eyebrow">VAIBHAV TRIPATHI — PORTFOLIO</p><h1>READY TO<br/><em>TAKE OFF?</em></h1><p role="status">{ready === 3 ? 'Flight ready. Opening your next adventure.' : `Preparing artwork & typography · ${ready} / 3`}</p><div className="launch-progress"><i style={{ transform: `scaleX(${ready / 3})` }}/></div></div><button className="skip-launch" autoFocus onClick={() => setLoading(false)}>Skip intro <ArrowUpRight size={16}/></button><span className="launch-coordinate">18.5204° N / 73.8567° E</span></div>}
  <div className="world-background" aria-hidden="true"/><div className="world-shade" aria-hidden="true"/>
  <div ref={actor} className="goku-flight" aria-hidden="true"><div className="goku-body"><span className="ki-trail"/><span className="ki-trail second"/><img src={art[0]} alt=""/></div></div>
  <div ref={warp} className="transmission" aria-hidden="true"><div className="transmission-lines"/><span>瞬間移動<small>INSTANT TRANSMISSION</small></span></div>
  <div inert={loading}>
   <a className="skip-link" href="#about">Skip to content</a>
   <header className="sky-header"><a className="sky-logo" href="#home" onClick={link('home')} aria-label="Vaibhav Tripathi home">VT<span>.</span><small>CREATIVE<br/>DEVELOPER</small></a><nav className={menu ? 'open' : ''} aria-label="Main navigation">{chapters.map(([id, label]) => <a key={id} href={`#${id}`} onClick={link(id)}>{label}</a>)}</nav><div className="header-controls"><button className="motion-switch" onClick={motion} aria-label={`Motion ${reduced ? 'reduced' : 'full'}`}><Wind size={17}/><span>{reduced ? 'Motion off' : 'Motion on'}</span></button><button className="pause-button" aria-label={paused ? 'Resume flight' : 'Pause flight'} aria-pressed={paused} onClick={() => setPaused(v => !v)}>{paused ? <Play size={16}/> : <Pause size={16}/>}</button><button className="menu-button" aria-expanded={menu} aria-label="Toggle navigation" onClick={() => setMenu(!menu)}>{menu ? <X/> : <Menu/>}</button></div></header>
   <main className="sky-content">
    <section id="home" className="sky-hero" tabIndex={-1}><div className="hero-top"><span><i/> AVAILABLE FOR FREELANCE</span><span>PUNE, INDIA / WORLDWIDE</span></div><div className="hero-copy"><p className="eyebrow">A FRONTEND DEVELOPER WITH A LITTLE MAIN CHARACTER ENERGY.</p><h1 className="hero-title"><span>VAIBHAV</span><span>TRIPATHI<span className="title-dot">.</span></span></h1><div className="hero-bottom-copy"><p>I build interfaces.<br/>And chase the extraordinary.</p><a className="sky-button" href="#projects" onClick={link('projects')}>Explore my work <ArrowUpRight size={21}/></a></div></div><div className="hero-foot"><a href="#about" onClick={link('about')}><span className="scroll-icon"><ArrowDown size={19}/></span> SCROLL TO EXPLORE</a><span className="hero-caption">NO MAP. NO LIMITS.<br/><b>JUST THE NEXT ADVENTURE.</b></span><span>VOL. 047<br/><b>2026 EDITION</b></span></div></section>
    <section id="about" className="chapter about-chapter" tabIndex={-1}><div className="chapter-heading"><span>01 — THE ORIGIN</span><span>A LITTLE ABOUT ME ↘</span></div><div className="about-layout"><div className="reveal"><p className="eyebrow">EVERY HERO STARTS SOMEWHERE.</p><h2>Grounded roots.<br/><em>Sky-high ideas.</em></h2><span className="story-stamp">STILL<br/>LEVELING<br/>UP. ↗</span></div><div className="story-copy reveal"><p className="lead">A boy from a middle-class family in Pune. A curious mind. And a whole lot of things to build.</p><p>{profile.bio}</p><p>{profile.introduction}</p><div className="experience-note"><strong>03<span>YEARS</span></strong><div><h3>Freelance Frontend Developer</h3><p>{profile.experience[0].summary}</p></div></div><a className="text-link" href="#contact" onClick={link('contact')}>Let’s build something together <ArrowUpRight size={17}/></a></div></div></section>
    <section id="fall" className="freefall-chapter" tabIndex={-1} aria-label="Scroll-controlled free fall"><div className="fall-sticky"><div className="fall-speed"/><div className="fall-top"><span>02 — A LEAP OF FAITH</span><span>SCROLL TO DIVE ↓</span></div><h2 className="fall-title">TAKE<br/>THE <em>LEAP.</em></h2><div className="fall-bottom"><p>Good things happen<br/>outside your comfort zone.</p><a href="#projects" onClick={link('projects')}>LAND IN MY WORK <ArrowDown size={19}/></a></div><div className="altitude"><span>FREE FALL</span><i/><span>↓</span></div></div></section>
    <section id="projects" className="chapter work-chapter" tabIndex={-1}><div className="chapter-heading"><span>03 — SELECTED WORK</span><span>IDEAS MADE TANGIBLE</span></div><div className="section-intro reveal"><h2>A few things<br/><em>I’ve been building.</em></h2><p>Every project is a new world to explore.<br/>Here are two from mine.</p></div><div className="projects-grid">{profile.projects.map((project, i) => <button key={project.id} className={`project-card reveal project-${i}`} onClick={() => setSelected(project)} aria-label={`Open ${project.name}`}><div className="project-artwork"><span className="project-index">0{i + 1} / PROJECT</span><div className="project-symbol" aria-hidden="true">{i === 0 ? <><i/><i/><i/><b>S</b></> : <><i/><i/><i/><b>K</b></>}</div><span className="concept-label">CONCEPT COVER · PREVIEW COMING SOON</span><span className="project-arrow"><ArrowUpRight size={24}/></span></div><div className="project-caption"><h3>{project.name}</h3><span>EXPLORE PROJECT ↗</span></div></button>)}</div><p className="project-note">Full case studies and demo links are on their way.</p></section>
    <section id="skills" className="chapter toolkit-chapter" tabIndex={-1}><div className="chapter-heading"><span>04 — THE TOOLKIT</span><span>ALWAYS LEARNING. ALWAYS BUILDING.</span></div><div className="toolkit-layout"><div className="reveal"><h2>My everyday<br/><em>superpowers.</em></h2><p>No power levels. Just tools<br/>I use to bring ideas to life.</p></div><div className="skill-list">{profile.skillGroups.flatMap(group => group.skills).map((skill, i) => <div className="skill-row reveal" key={skill}><span>0{i + 1}</span><h3>{skill}</h3><span>{i < 3 ? 'FRONTEND' : 'PROGRAMMING'}</span><ArrowUpRight size={20}/></div>)}</div></div><div className="education-strip"><div><span className="eyebrow">EDUCATION</span><h3>{profile.education.degree}</h3><p>{profile.education.specialization}</p><small>Institution & dates to be added.</small></div><div><span className="eyebrow">CERTIFICATION</span><h3>{profile.certification.title}</h3><small>Issuer & verification details to be added.</small></div></div></section>
    <section id="contact" className="chapter contact-chapter" tabIndex={-1}><div className="chapter-heading"><span>05 — THE NEXT ADVENTURE</span><span>STARTS WITH A HELLO</span></div><div className="reveal"><span className="availability"><i/> OPEN FOR FREELANCE WORK</span><h2>Got a wild idea?<br/><em>Let’s make it real.</em></h2><a className="contact-email" href={`mailto:${profile.email}`}>{profile.email}<ArrowUpRight size={27}/></a><div className="contact-actions"><button onClick={copy} aria-label={copied ? 'Email copied' : 'Copy email'}>{copied ? <Check size={16}/> : <Copy size={16}/>}<span role="status">{copied ? 'Copied' : 'Copy email'}</span></button><a href={profile.github} target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={16}/></a><button onClick={() => window.print()}><Printer size={16}/>Print / Save resume</button></div>{copyError && <p role="alert">Clipboard unavailable. Select the email above to copy it.</p>}</div></section>
    <section className="print-resume"><h1>{profile.name}</h1><p>{profile.role} · {profile.location} · {profile.availability}</p><p>{profile.email} · {profile.github}</p><h2>Profile</h2><p>{profile.bio}</p><h2>Experience</h2><p>{profile.experience[0].summary}</p><h2>Projects</h2><p>{profile.projects.map(p => p.name).join(' · ')} — case studies to be added.</p><h2>Skills</h2><p>{profile.skillGroups.flatMap(g => g.skills).join(' · ')}</p><h2>Education</h2><p>{profile.education.degree} — {profile.education.specialization}</p><h2>Certification</h2><p>{profile.certification.title}</p></section>
   </main>
   <footer className="sky-footer"><a className="sky-logo" href="#home" onClick={link('home')} aria-label="Back to top">VT<span>.</span></a><p>MADE WITH CURIOSITY & A LITTLE KI.<br/>© {new Date().getFullYear()} VAIBHAV TRIPATHI</p><span>UNOFFICIAL DRAGON BALL FAN PORTFOLIO</span><a href="#home" onClick={link('home')}>BACK TO THE SKY ↑</a></footer>
  </div>
  {selected && <Dialog title={selected.name} onClose={() => setSelected(null)} className="sky-dialog"><p className="eyebrow">PROJECT FILE / {selected.number}</p><h2>{selected.name}</h2><p>{selected.description}</p><dl><dt>Contribution, approach & outcome</dt><dd>Case study details to be added.</dd><dt>Live demo / source code</dt><dd>Links not supplied yet.</dd></dl><a className="sky-button" href={`mailto:${profile.email}?subject=${encodeURIComponent(selected.name)}`}>Ask about this project <ArrowUpRight size={18}/></a></Dialog>}
 </div>;
}
