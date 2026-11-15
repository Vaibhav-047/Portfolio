import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import gsap from 'gsap';
import * as THREE from 'three';
import { ArrowLeft, ArrowUpRight, Check, Copy, Github, Mail } from 'lucide-react';
import content from './content.json';
import { createScene, pickTier, type SceneApi } from './scene';
import { SECTION_IDS, type SectionId } from './tree';

const LABELS: Record<SectionId, string> = { about: 'About', projects: 'Projects', skills: 'Skills', journey: 'Journey', contact: 'Contact' };
const params = new URLSearchParams(location.search);
const reduced = params.get('motion') === 'reduced' || matchMedia('(prefers-reduced-motion: reduce)').matches;
const hashId = () => (SECTION_IDS as readonly string[]).includes(location.hash.slice(1)) ? location.hash.slice(1) as SectionId : null;
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
type Project = typeof content.projects[number];

/** Loader: a seed drops, sprouts and grows into the tree as the assets arrive. */
function Loader({ progress, done }: { progress: number; done: boolean }) {
  return <div className="loader" data-done={done} style={{ '--p': progress } as React.CSSProperties} role="status" aria-live="polite">
    <svg viewBox="0 0 200 220" aria-hidden="true">
      <path className="l-ground" d="M30 190 Q100 172 170 190" />
      <g className="l-roots"><path pathLength={1} d="M100 188 C92 194 80 194 70 200" /><path pathLength={1} d="M100 188 C108 195 120 194 132 201" /></g>
      <path className="l-trunk" pathLength={1} d="M100 188 C97 162 106 142 100 116 C96 98 102 86 100 70" />
      <path className="l-branch" pathLength={1} d="M100 124 C84 112 70 108 56 94" />
      <path className="l-branch" pathLength={1} d="M100 114 C118 102 132 100 146 86" />
      <g className="l-crown"><circle cx="100" cy="58" r="30" /><circle cx="60" cy="82" r="24" /><circle cx="142" cy="76" r="25" /><circle cx="78" cy="48" r="20" /><circle cx="124" cy="46" r="21" /></g>
      <ellipse className="l-seed" cx="100" cy="188" rx="7" ry="5" />
    </svg>
    <p>{done ? 'The grove is ready' : 'A seed is sprouting…'}</p>
  </div>;
}

function Panel({ id, leaving, onBack, children }: { id: SectionId; leaving: boolean; onBack: () => void; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { ref.current?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true }); }, []);
  return <section ref={ref} id={`panel-${id}`} className={`panel${leaving ? ' leaving' : ''}`} aria-labelledby={`title-${id}`}>
    <svg className="vine-border" aria-hidden="true"><rect pathLength={1} rx="26" /><rect className="tendril" pathLength={1} rx="20" /></svg>
    {['tl', 'tr', 'br', 'bl'].map(c => <i key={c} className={`leaf leaf-${c}`} aria-hidden="true" />)}
    <div className="panel-body">
      <button className="back" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" />Back to the tree <kbd>Esc</kbd></button>
      {children}
    </div>
  </section>;
}

function About() {
  return <>
    <p className="kicker">{content.role} · {content.location}</p>
    <h2 id="title-about" tabIndex={-1}>{content.name}</h2>
    <p className="lead">{content.introduction}</p>
    <p>{content.bio}</p>
    <p className="chip"><i aria-hidden="true" />{content.availability}</p>
  </>;
}

/** Projects hang as gems; choosing one opens its details. */
function Projects() {
  const [sel, setSel] = useState<Project>(content.projects[0]);
  const facts = ([['The problem', sel.problem], ['My contribution', sel.contribution], ['The approach', sel.approach], ['The outcome', sel.outcome]] as [string, string | null][]).filter(([, v]) => v);
  return <>
    <p className="kicker">Selected work</p>
    <h2 id="title-projects" tabIndex={-1}>Projects</h2>
    <ul className="gems">
      {content.projects.map((p, i) => <li key={p.id} style={{ '--i': i } as React.CSSProperties}>
        <button className="gem-btn" aria-pressed={sel.id === p.id} onClick={() => setSel(p)}><span className="thread" aria-hidden="true" /><span className="gem" aria-hidden="true" />{p.name}</button>
      </li>)}
    </ul>
    <div className="project" aria-live="polite" key={sel.id}>
      <h3>{sel.name} <small>{sel.category} · {sel.status}</small></h3>
      <p>{sel.description}</p>
      {facts.length > 0 && <dl>{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
      {sel.technologies.length > 0 && <p className="tech">{(sel.technologies as string[]).join(' · ')}</p>}
      <p className="links">
        {sel.url && <a href={sel.url} target="_blank" rel="noreferrer">Live site<ArrowUpRight size={15} aria-hidden="true" /></a>}
        {sel.source && <a href={sel.source} target="_blank" rel="noreferrer"><Github size={15} aria-hidden="true" />Source on GitHub</a>}
      </p>
    </div>
  </>;
}

/** Skills are buds that open one after another. */
function Skills() {
  return <>
    <p className="kicker">What I work with</p>
    <h2 id="title-skills" tabIndex={-1}>Skills</h2>
    <ul className="buds">
      {content.skills.map((s, i) => <li key={s.name} style={{ '--i': i } as React.CSSProperties}>
        <span className="bud" aria-hidden="true">{[0, 1, 2, 3, 4].map(k => <i key={k} style={{ '--k': k } as React.CSSProperties} />)}<b /></span>
        <strong>{s.name}</strong><span>{s.group}</span><em>{s.note}</em>
      </li>)}
    </ul>
  </>;
}

function Journey() {
  const { experience: x, education: e } = content;
  return <>
    <p className="kicker">Experience & education</p>
    <h2 id="title-journey" tabIndex={-1}>Journey</h2>
    <ol className="rings">
      <li><span>Experience · {x.duration}</span><h3>{x.role}</h3><p className="where">{x.company}</p><p>{x.summary}</p></li>
      <li><span>Education</span><h3>{e.degree}</h3><p className="where">{e.specialization}</p></li>
      <li><span>Certification</span><h3>{content.certification}</h3></li>
    </ol>
  </>;
}

/** Contact: fireflies drift in and settle into the outline of each link. */
function Contact() {
  const flies = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const host = flies.current!, links = [...host.parentElement!.querySelectorAll<HTMLElement>('.contact-link')], dots: HTMLElement[] = [];
    links.forEach(link => {
      const { offsetLeft: x, offsetTop: y, offsetWidth: w, offsetHeight: h } = link, n = 20;
      for (let i = 0; i < n; i++) {
        let s = (i / n) * 2 * (w + h); const d = document.createElement('i'); d.style.setProperty('--d', `${Math.random() * 2}s`); host.append(d); dots.push(d);
        const [px, py] = s < w ? [s, 0] : (s -= w) < h ? [w, s] : (s -= h) < w ? [w - s, h] : [0, h - (s - w)];
        gsap.fromTo(d, { x: Math.random() * host.offsetWidth, y: Math.random() * 260 - 60, opacity: 0, scale: 2 },
          { x: x + px, y: y + py, opacity: 1, scale: 1, duration: reduced ? 0 : 1.3 + Math.random() * 0.7, delay: reduced ? 0 : 0.5 + Math.random() * 0.5, ease: 'power3.inOut' });
      }
    });
    gsap.fromTo(links, { opacity: 0 }, { opacity: 1, duration: 0.5, delay: reduced ? 0 : 2.1, stagger: 0.15 });
    return () => { gsap.killTweensOf([...dots, ...links]); dots.forEach(d => d.remove()); };
  }, []);
  const copy = async () => { try { await navigator.clipboard.writeText(content.email); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked: the mailto link still works */ } };
  return <>
    <p className="kicker">{content.availability}</p>
    <h2 id="title-contact" tabIndex={-1}>Say hello</h2>
    <p>Based in {content.location}. The quickest way to reach me is email.</p>
    <div className="contact-body">
      <a className="contact-link" href={`mailto:${content.email}`}><Mail size={18} aria-hidden="true" />{content.email}</a>
      <a className="contact-link" href={content.github} target="_blank" rel="noreferrer"><Github size={18} aria-hidden="true" />{content.github.replace('https://', '')}<ArrowUpRight size={15} aria-hidden="true" /></a>
      <div className="flies" ref={flies} aria-hidden="true" />
    </div>
    <button className="copy" onClick={copy}>{copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}<span role="status">{copied ? 'Email copied' : 'Copy email address'}</span></button>
  </>;
}
const BODY: Record<SectionId, () => ReactNode> = { about: About, projects: Projects, skills: Skills, journey: Journey, contact: Contact };

export default function App() {
  const canvas = useRef<HTMLCanvasElement>(null), stage = useRef<HTMLDivElement>(null);
  const api = useRef<SceneApi | null>(null), labelEls = useRef<Partial<Record<SectionId, HTMLButtonElement>>>({});
  const opened = useRef<SectionId | null>(null), busy = useRef(false);
  const [active, setActive] = useState<SectionId | null>(null), [leaving, setLeaving] = useState(false);
  const [progress, setProgress] = useState(0), [ready, setReady] = useState(false), [failed, setFailed] = useState(false);

  /** Brings the scene in line with the URL hash. One transition at a time; it re-checks when each one ends. */
  const sync = useCallback(async () => {
    const scene = api.current; if (!scene || busy.current) return;
    const want = hashId(); if (want === opened.current) return;
    busy.current = true;
    const fade = async (run: () => Promise<void>) => {       // reduced motion: crossfade instead of the flythrough
      if (!reduced) return run();
      stage.current!.dataset.fade = 'out'; await wait(320); await run(); stage.current!.dataset.fade = '';
    };
    if (opened.current) {
      const from = opened.current;
      setLeaving(true); await wait(reduced ? 0 : 360); setActive(null); setLeaving(false);
      await fade(() => scene.close(reduced)); opened.current = null;
      labelEls.current[from]?.focus({ preventScroll: true });
    } else if (want) {
      await fade(() => scene.open(want, reduced)); opened.current = want; setActive(want);
    }
    busy.current = false; void sync();
  }, []);

  const go = useCallback((id: SectionId) => {
    if (busy.current || opened.current === id) return;        // clicks are ignored while an animation runs
    history.pushState(null, '', `#${id}`); void sync();
  }, [sync]);
  const back = useCallback(() => {
    if (busy.current || !opened.current) return;
    history.pushState(null, '', location.pathname + location.search); void sync();   // the browser's own Back still returns to the section
  }, [sync]);

  useEffect(() => {
    let dead = false;
    THREE.DefaultLoadingManager.onProgress = (_u, loaded, total) => setProgress(p => Math.max(p, (loaded / total) * 0.9));
    createScene(canvas.current!, pickTier()).then(async scene => {
      if (dead) return scene.dispose();
      api.current = scene; scene.setLabels(labelEls.current);
      scene.onPick = go;
      scene.onHover = id => { scene.hover(id); for (const k of SECTION_IDS) labelEls.current[k]?.toggleAttribute('data-hot', k === id); };
      setProgress(1); await wait(reduced ? 0 : 900); setReady(true); void sync();
    }).catch(err => { console.warn('3D scene unavailable', err); setFailed(true); setReady(true); });
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') back(); };
    addEventListener('popstate', sync); addEventListener('hashchange', sync); addEventListener('keydown', key);
    return () => { dead = true; api.current?.dispose(); api.current = null; removeEventListener('popstate', sync); removeEventListener('hashchange', sync); removeEventListener('keydown', key); };
  }, [sync, go, back]);

  const Body = active ? BODY[active] : null;
  return <div className="site" data-reduced={reduced} data-open={!!active}>
    <div className="stage" ref={stage}><canvas ref={canvas} aria-hidden="true" /></div>
    <header className="top">
      <h1>{content.name}</h1>
      <p>{content.role} · {content.location}</p>
    </header>
    {failed
      ? <main className="fallback">{SECTION_IDS.map(id => { const B = BODY[id]; return <section key={id} className="panel static"><div className="panel-body"><B /></div></section>; })}</main>
      : <>
        <nav className="labels" aria-label="Sections">
          {SECTION_IDS.map(id => <button key={id} ref={el => { if (el) labelEls.current[id] = el; }} className="label" aria-controls={`panel-${id}`} aria-expanded={active === id}
            tabIndex={active ? -1 : 0} onClick={() => go(id)}
            onPointerEnter={() => api.current?.hover(id)} onPointerLeave={() => api.current?.hover(null)} onFocus={() => api.current?.hover(id)} onBlur={() => api.current?.hover(null)}>
            <span><i aria-hidden="true" />{LABELS[id]}</span>
          </button>)}
        </nav>
        <main>{active && Body && <Panel id={active} leaving={leaving} onBack={back}><Body /></Panel>}</main>
        {ready && !active && <p className="hint">Drag to look around · follow a vine to explore</p>}
      </>}
    {!failed && <Loader progress={progress} done={ready} />}
  </div>;
}
