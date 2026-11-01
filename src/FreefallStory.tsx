import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUpRight, Zap } from 'lucide-react';
import { SceneBoundary } from './components';
import type { MotionMode } from './App';
import type { VisualQuality } from './ReactorControls';
const Scene=lazy(()=>import('./FreefallScene'));
export default function FreefallStory({mode,paused,quality}:{mode:MotionMode;paused:boolean;quality:VisualQuality}){
 const ref=useRef<HTMLElement>(null),[boost,setBoost]=useState(false);
 useEffect(()=>{if(!boost)return;const t=setTimeout(()=>setBoost(false),2200);return()=>clearTimeout(t);},[boost]);
 useEffect(()=>{const el=ref.current!,words=Array.from(el.querySelectorAll<HTMLElement>('.fall-word'));let frame=0;function update(){frame=0;const p=Math.max(0,Math.min(1,-el.getBoundingClientRect().top/Math.max(1,el.offsetHeight-innerHeight)));el.style.setProperty('--fall-progress',String(p));el.dataset.chapter=p<.25?'leap':p<.62?'fall':p<.82?'impact':'rise';const altitude=el.querySelector('.altitude-value');if(altitude)altitude.textContent=String(Math.round((1-p)*3000)).padStart(4,'0');words.forEach((word,i)=>{const local=(p*6.5-i*.82);word.style.transform=`translate3d(${Math.sin(i*2)*15}vw,${(1-local)*65}vh,${local*280}px) rotate(${(i%2?1:-1)*7}deg)`;word.style.opacity=String(p<.13||p>.84?0:Math.max(0,1-Math.abs(local-.6)*1.4));});}const scroll=()=>{if(!frame)frame=requestAnimationFrame(update);};window.addEventListener('scroll',scroll,{passive:true});window.addEventListener('resize',scroll);update();return()=>{cancelAnimationFrame(frame);window.removeEventListener('scroll',scroll);window.removeEventListener('resize',scroll);};},[]);
 return <section ref={ref} id="home" className={`freefall-story ${mode!=='full'?'story-static':''}`}>
  <div className="freefall-stage"><div className="fall-light"/><SceneBoundary><Suspense fallback={null}><Scene mode={mode} paused={paused} boost={boost} quality={quality}/></Suspense></SceneBoundary>
   <div className="freefall-intro"><p>VAIBHAV TRIPATHI / INDEPENDENT FRONTEND DEVELOPER</p><h1>MAKE THE<br/><em>leap.</em></h1><div className="fall-intro-bottom"><span>PUNE, INDIA<br/>AVAILABLE WORLDWIDE</span><p>Good interfaces don’t happen<br/>by standing still.</p></div></div>
   <div className="fall-type-world" aria-hidden="true">{['IDEAS','INTO','INTERFACES.','BREAK','THE NOISE.','BUILD','WHAT’S NEXT.'].map((w,i)=><span className={`fall-word word-${i}`} key={w}>{w}</span>)}</div>
   <div className="rise-message"><span>03 / THE ARRIVAL</span><h2>BUILT TO<br/><em>rise.</em></h2><a href="#projects">Explore the work <ArrowUpRight size={18}/></a></div>
   <div className="fall-hud"><span>ALTITUDE <b className="altitude-value">3000</b><small>M / STORY POSITION</small></span><button onClick={()=>setBoost(true)} className={boost?'boost-active':''}><Zap size={12}/>{boost?'REPULSORS ACTIVE':'ACTIVATE REPULSORS'}</button><a href="#about">SKIP TO PROFILE <ArrowUpRight size={12}/></a></div>
   <a className="fall-scroll" href="#descent">SCROLL TO FREEFALL <ArrowDown size={16}/></a><div className="fall-rail"><i/></div><span className="fall-chapter">A LITTLE STARK ENERGY. A LEAP OF MY OWN.</span>
  </div><div id="descent" className="descent-anchor"/>
 </section>;
}
