import { useEffect, useRef } from 'react';
import { ArrowRight } from 'lucide-react';
const phases = [ ['01', 'COMPONENT ARRIVAL', 'Every idea begins with a spark.'], ['02', 'REACTOR ASSEMBLY', 'Precision. Piece by piece.'], ['03', 'CORE IGNITION', 'A little engineering. A lot of energy.'], ['04', 'INTERFACE PROJECTION', 'Built to make an impact.'], ['05', 'SYSTEM READY', 'Welcome to the workshop.'] ];
export default function CinematicIntro({ phase, onSkip }: { phase: number; onSkip: () => void }) {
  const skip = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const old = document.body.style.overflow; document.body.style.overflow = 'hidden'; window.scrollTo({ top: 0, behavior: 'instant' }); skip.current?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onSkip(); };
    document.addEventListener('keydown', key);
    return () => { document.body.style.overflow = old; document.removeEventListener('keydown', key); };
  }, []);
  const item = phases[phase] || phases[0];
  return <><div className={`boot-backdrop phase-${phase}`}/><div className={`boot-interface phase-${phase}`} role="region" aria-label="Arc reactor boot sequence">
    <span className="boot-corner">STARK-INSPIRED SYSTEMS / VT—047</span>
    <button ref={skip} className="boot-skip" onClick={onSkip}>Skip intro <ArrowRight size={14}/></button>
    <div className="boot-caption"><span>{item[0]} / {item[1]}</span><p>{item[2]}</p><div className="boot-phases">{phases.map((_,i) => <i className={i <= phase ? 'complete' : ''} key={i}/>)}</div></div>
  </div></>;
}
