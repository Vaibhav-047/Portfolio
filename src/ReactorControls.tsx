import { ArrowLeft, ArrowRight, Layers3, Play, RotateCcw, Zap } from 'lucide-react';
export type PowerMode = 'standby' | 'powered' | 'overdrive';
export type VisualQuality = 'auto' | 'low' | 'high';
export default function ReactorControls({ power, exploded, onPower, onExplode, onPulse, onReplay, onReset, onRotate }: {
  power: PowerMode; exploded: boolean; onPower: (p: PowerMode) => void; onExplode: () => void; onPulse: () => void; onReplay: () => void; onReset: () => void; onRotate: (delta: number) => void;
}) {
  return <div className="reactor-controls">
    <div className="reactor-control-heading"><span className="tiny-label">ARC REACTOR / INTERACTIVE MODEL</span><span className="reactor-online"><i/>{power.toUpperCase()}</span></div>
    <div className="power-options" aria-label="Reactor visual power mode">{(['standby', 'powered', 'overdrive'] as PowerMode[]).map(p => <button key={p} aria-pressed={power === p} onClick={() => onPower(p)}>{p === 'overdrive' && <Zap size={11}/>} {p}</button>)}</div>
    <div className="reactor-tools"><button aria-pressed={exploded} onClick={onExplode}><Layers3 size={13}/>{exploded ? 'Reassemble' : 'Exploded view'}</button><button onClick={onReset}><RotateCcw size={12}/>Reset view</button><button className="rotate-control" aria-label="Rotate reactor left" onClick={() => onRotate(-.3)}><ArrowLeft size={13}/></button><button className="rotate-control" aria-label="Rotate reactor right" onClick={() => onRotate(.3)}><ArrowRight size={13}/></button></div>
    <div className="reactor-control-bottom"><button onClick={onReplay}><Play size={10}/>Replay boot sequence</button><button onClick={onPulse}>Pulse core <Zap size={11}/></button></div>
    <span className="reactor-hint">Drag to inspect · click the core to energize</span>
  </div>;
}
