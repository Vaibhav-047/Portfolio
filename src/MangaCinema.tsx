import { Art } from './MangaArt';

const panels = [
  {scene:0, title:'Every story starts somewhere.', text:'Pune, India. An ordinary rooftop. A boy with a head full of possibilities.', alt:'A young boy looking across Pune from a rooftop at dawn'},
  {scene:1, title:'No chosen-one prophecy.', text:'A middle-class home. A shared table. The people who remind him to begin.', alt:'The boy sitting with his parents around their family table'},
  {scene:3, title:'Just the decision to try.', text:'One question becomes one idea. One idea becomes the first line of code.', alt:'The boy looking ahead with a determined expression'},
];

export function MangaCinema() {
  return <section id="origin" className="cinema-origin" data-chapter aria-label="The origin — a scroll-driven manga sequence">
    <div className="cinema-stage">
      <div className="cinema-running-head"><span>01 / THE STARTING POINT</span><span>SCROLL TO TURN THE PANELS ↓</span><a href="#family">Skip sequence ↗</a></div>
      <div className="cinema-viewport">
        {panels.map((panel,i)=><article className="cinema-shot" key={panel.scene}>
          <div className="cinema-camera"><Art scene={panel.scene} label={panel.alt}/></div>
          <div className="cinema-caption"><span>FRAME 00{i+1} / PUNE</span><h2>{panel.title}</h2><p>{panel.text}</p></div>
          <span className="cinema-sfx" aria-hidden="true">{['WHAT IF?','BEGIN.','LET’S GO!'][i]}</span>
        </article>)}
        <div className="cinema-speed" aria-hidden="true"/>
        <div className="cinema-ink" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/><i/></div>
      </div>
      <div className="cinema-bottom"><span>NO SECRET POWERS. JUST A START.</span><div className="cinema-meter"><i/></div><span className="cinema-page">001 — 003</span></div>
    </div>
  </section>;
}

export function MotionDecorations() {
  return <>
    <div className="ink-cursor" aria-hidden="true"><span>READ</span></div>
    <div className="manga-wash" aria-hidden="true"><span>TURNING THE PAGE…</span></div>
    <svg className="motion-filter" aria-hidden="true" width="0" height="0"><defs><filter id="manga-bleed-edge"><feTurbulence type="fractalNoise" baseFrequency=".012" numOctaves="2" seed="7" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="55"/></filter></defs></svg>
  </>;
}
