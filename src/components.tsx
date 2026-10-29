import { Component, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { X, ArrowUpRight } from 'lucide-react';
import type { Project } from './profile';

export function Emblem({ className = '', ...rest }: { className?: string; [key: string]: unknown }) {
  return <svg className={`emblem ${className}`} viewBox="0 0 64 64" fill="none" aria-hidden="true" {...rest}><circle cx="32" cy="32" r="25"/><circle cx="32" cy="32" r="19" strokeWidth="1.5"/><path d="M32 18 44 40H20Z" strokeWidth="2.5"/><path d="M32 7v6m0 38v6M7 32h6m38 0h6M14 14l4 4m28 28 4 4M14 50l4-4m28-28 4-4" strokeWidth="2"/></svg>;
}

export function SectionHeading({ number, label, title, children }: { number: string; label: string; title: ReactNode; children?: ReactNode }) {
  return <div className="section-heading"><div><p className="eyebrow"><span>{number} /</span> {label}</p><h2>{title}</h2></div>{children && <div className="section-aside">{children}</div>}</div>;
}

export function Dialog({ title, children, onClose, className = '' }: { title: string; children: ReactNode; onClose: () => void; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const closing = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function close() {
    if (closing.current) return;
    closing.current = true;
    if (document.documentElement.dataset.motion === 'full') {
      const animation = ref.current?.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.98)' }], { duration: 140, easing: 'ease-out', fill: 'forwards' });
      if (animation) { closeTimer.current = setTimeout(onClose, 150); return; }
    }
    onClose();
  }
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const el = ref.current!;
    el.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { if (closeTimer.current) clearTimeout(closeTimer.current); document.body.style.overflow = old; previous?.focus(); };
  }, []);
  return <dialog ref={ref} className={`dialog ${className}`} aria-label={title} onCancel={e => { e.preventDefault(); close(); }} onClick={e => { if (e.target === e.currentTarget) close(); }} onKeyDown={e => {
    if (e.key !== 'Tab') return;
    const focusable = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), textarea, select, summary, [tabindex="0"]')).filter(x => x.getClientRects().length > 0);
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
  }}>
    <div className="dialog-inner"><button className="icon-button close-dialog" onClick={close} aria-label={`Close ${title}`}><X size={20}/></button>{children}</div>
  </dialog>;
}

export function ProjectArt({ project }: { project: Project }) {
  const [failed, setFailed] = useState(false);
  if (project.preview && !failed) return <img className="project-image" src={project.preview} alt={`${project.name} project preview`} loading="lazy" width="800" height="500" onError={() => setFailed(true)}/>;
  return <div className={`project-art ${project.visual}`} aria-label={`${project.name} concept artwork, not a product screenshot`} role="img">
    <div className="art-grid"/>
    {project.visual === 'supremo' ? <><div className="supremo-symbol"><div/><div/><div/><div/></div><div className="art-wordmark">supremo<span>ai</span></div><div className="art-coordinate">INTELLIGENCE, REIMAGINED / CONCEPT STUDY</div></> : <><div className="khoj-orbits"><i/><i/><i/><span/></div><div className="art-wordmark">khoj<span> / ai</span></div><div className="art-coordinate">A NEW PERSPECTIVE / CONCEPT STUDY</div></>}
    <span className="preview-label">CONCEPT ARTWORK</span><ArrowUpRight className="art-arrow" size={24}/>
  </div>;
}

export function ReactorFallback({ power = 'powered', exploded = false }: { power?: string; exploded?: boolean }) {
  return <div className={`reactor-fallback ${power} ${exploded ? 'exploded' : ''}`} aria-hidden="true"><svg viewBox="0 0 400 400"><defs><radialGradient id="arc-core"><stop stopColor="#fff"/><stop offset=".6" stopColor="#c7f7ff"/><stop offset="1" stopColor="#36c6ec"/></radialGradient><linearGradient id="arc-metal"><stop stopColor="#808c96"/><stop offset=".3" stopColor="#202731"/><stop offset=".7" stopColor="#606c77"/><stop offset="1" stopColor="#141b25"/></linearGradient></defs><circle cx="200" cy="200" r="173" fill="#131922" stroke="#a61924" strokeWidth="15"/><circle cx="200" cy="200" r="155" fill="none" stroke="url(#arc-metal)" strokeWidth="22"/>{Array.from({length:12},(_,i)=><g key={i} transform={`rotate(${i*30} 200 200)`}><path d="M180 65 Q200 59 220 65 L217 98 Q200 92 183 98Z" fill="#ad8753" stroke="#dbb67b" strokeWidth="1"/><path d="M183 72h34m-34 7h34m-34 7h34" stroke="#31363b" strokeWidth="2"/><path d="M200 104v22" stroke="#68e9ff" strokeWidth="5"/></g>)}<circle cx="200" cy="200" r="86" fill="#09141c" stroke="url(#arc-metal)" strokeWidth="15"/><circle cx="200" cy="200" r="69" fill="url(#arc-core)" stroke="#89f0ff" strokeWidth="5"/></svg></div>;
}

/** An optional visual module must never take the readable portfolio down. */
export class SceneBoundary extends Component<{ children: ReactNode; onError?: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError?.(); }
  render() { return this.state.failed ? null : this.props.children; }
}
