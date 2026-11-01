/** VOL.01 motion adapted to Vaibhav's original story. See VOL01-LICENSE.txt.
 * Scroll choreography, animated captions and pointer parallax follow upstream
 * comic.ts/title.ts/origin.ts patterns. Page folding uses the MIT pageTurn helper.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { createPageTurn } from './pageTurn';
import { startLivingInk } from './livingInk';
gsap.registerPlugin(ScrollTrigger,SplitText);

export function mountMangaMotion(root:HTMLElement) {
 const splits:SplitText[]=[];
 const disposers:(()=>void)[]=[];
 const transient:gsap.core.Animation[]=[];
 const listen=(el:EventTarget,name:string,fn:EventListener)=>{el.addEventListener(name,fn);disposers.push(()=>el.removeEventListener(name,fn));};
 const ctx=gsap.context(()=>{
  const heading=root.querySelector<HTMLElement>('.cover-copy h1');
  if(heading){const split=SplitText.create(heading,{type:'words,chars'});splits.push(split);gsap.from(split.chars,{yPercent:110,rotation:()=>gsap.utils.random(-12,12),opacity:0,duration:.9,stagger:.025,ease:'power4.out'});}
  gsap.from('.cover-copy .manga-kicker, .cover-name, .cover-deck, .cover-profession, .cover-actions',{opacity:0,y:16,duration:.7,stagger:.07,ease:'power3.out',delay:.25});
  gsap.from('.cover-art-wrap',{clipPath:'inset(48% 0 48% 0)',duration:1.1,ease:'power3.inOut'});

  const origin=root.querySelector<HTMLElement>('.cinema-origin');
  if(origin){
   const shots=Array.from(origin.querySelectorAll<HTMLElement>('.cinema-shot'));
   origin.dataset.enhanced='true';
   disposers.push(()=>{delete origin.dataset.enhanced;});
   gsap.set(shots.slice(1),{autoAlpha:0});
   const speed=origin.querySelector('.cinema-speed'),ink=origin.querySelectorAll('.cinema-ink i');
   const tl=gsap.timeline({defaults:{ease:'none'},scrollTrigger:{id:'manga-origin',trigger:origin.querySelector('.cinema-stage'),start:'top 82px',end:()=>`+=${innerHeight*(innerWidth<700?2.5:3.3)}`,pin:origin.querySelector('.cinema-stage'),scrub:true,invalidateOnRefresh:true}});
   tl.fromTo(shots[0].querySelector('.cinema-camera'),{scale:1},{scale:1.3,xPercent:-4,duration:1.7},0);
   shots.forEach((shot,index)=>{
    const caption=shot.querySelector<HTMLElement>('.cinema-caption')!;
    const split=SplitText.create(caption.querySelector('p')!,{type:'words'});splits.push(split);
    const at=index*2;
    if(index){tl.fromTo(shot,{autoAlpha:0,xPercent:index===1?55:-35,rotation:index===1?4:-3},{autoAlpha:1,xPercent:0,rotation:0,duration:.45,ease:'power3.out'},at).set(shots[index-1],{autoAlpha:0},at+.45);tl.fromTo(shot.querySelector('.cinema-camera'),{scale:1.2},{scale:1.03,duration:1.7},at);}
    tl.fromTo(caption,{clipPath:'inset(0 100% 0 0)',opacity:0},{clipPath:'inset(0 0% 0 0)',opacity:1,duration:.35,ease:'power2.out'},at+.15)
     .fromTo(split.words,{opacity:0,y:8},{opacity:1,y:0,stagger:.018,duration:.13},at+.32)
     .fromTo(shot.querySelector('.cinema-sfx'),{scale:1.6,opacity:0,rotation:-16},{scale:1,opacity:1,rotation:-8,duration:.24,ease:'power4.out'},at+.5);
    if(index)tl.fromTo(speed,{opacity:0},{opacity:.65,duration:.13},at).to(speed,{opacity:0,duration:.3},at+.14);
   });
   tl.fromTo(ink,{yPercent:-110},{yPercent:0,duration:.7,stagger:.035,ease:'power2.inOut'},5.5).to(origin.querySelector('.cinema-meter i'),{scaleX:1,duration:6.5},0);
  }

  // Real comic captions: ink box wipe, then its words arrive in reading order.
  root.querySelectorAll<HTMLElement>('.manga-chapter .chapter-copy>p, .narrator-box').forEach(el=>{
   const split=SplitText.create(el,{type:'words'});splits.push(split);
   gsap.timeline({scrollTrigger:{trigger:el,start:'top 92%',once:true}})
    .fromTo(el,{clipPath:'inset(0 100% 0 0)'},{clipPath:'inset(0 0 0 0)',duration:.55,ease:'power3.out'})
    .from(split.words,{opacity:0,y:8,duration:.2,stagger:.018,ease:'power2.out'},.1);
  });
  root.querySelectorAll<HTMLElement>('.chapter-copy h2, .mission-intro h2, .finale-copy h2').forEach(el=>{
   const split=SplitText.create(el,{type:'words,chars'});splits.push(split);
   gsap.from(split.chars,{yPercent:90,rotation:()=>gsap.utils.random(-9,9),opacity:0,duration:.65,stagger:.018,ease:'back.out(1.4)',scrollTrigger:{trigger:el,start:'top 92%',once:true}});
  });
  root.querySelectorAll<HTMLElement>('.chapter-illustration').forEach(el=>{
   gsap.fromTo(el,{clipPath:'inset(49% 0 49% 0)'},{clipPath:'inset(0 0 0 0)',duration:.85,ease:'power3.inOut',scrollTrigger:{trigger:el,start:'top 93%',once:true}});
   gsap.fromTo(el.querySelector('.manga-art'),{scale:1.05},{scale:1.15,yPercent:-2,ease:'none',scrollTrigger:{trigger:el,start:'top bottom',end:'bottom top',scrub:true}});
   const bubble=el.querySelector('.speech-bubble');if(bubble)gsap.from(bubble,{opacity:0,scale:.92,y:12,duration:.4,ease:'back.out(1.4)',scrollTrigger:{trigger:el,start:'top 70%',once:true}});
  });
  gsap.from('.manga-project',{y:80,rotation:index=>index?-5:5,opacity:0,duration:.8,stagger:.16,ease:'power3.out',scrollTrigger:{trigger:'.manga-projects',start:'top 87%',once:true}});

  // Page pile rewind in the finale, using our own illustrations as the pages.
  const finale=root.querySelector<HTMLElement>('.finale-panels');
  if(finale){
   const pile=document.createElement('div');pile.className='finale-page-pile';pile.setAttribute('aria-hidden','true');
   [0,1,2].forEach(scene=>{const page=document.createElement('div');page.className=`rewind-page art-${scene}`;page.style.backgroundPosition=`${scene*50}% 0%`;pile.append(page);});finale.append(pile);disposers.push(()=>pile.remove());
   const tl=gsap.timeline({scrollTrigger:{trigger:finale,start:'top 85%',end:'top 18%',scrub:true}});
   Array.from(pile.children).reverse().forEach((page,i)=>tl.to(page,{xPercent:140,yPercent:-12,rotation:18,opacity:0,duration:.5,ease:'power2.in'},i*.22));
  }

  // Fine-pointer parallax and cursor; normal OS cursor stays visible.
  if(matchMedia('(hover:hover) and (pointer:fine)').matches){
   const cursor=root.querySelector<HTMLElement>('.ink-cursor')!;
   const x=gsap.quickTo(cursor,'x',{duration:.25,ease:'power3.out'}),y=gsap.quickTo(cursor,'y',{duration:.25,ease:'power3.out'});
   const cover=root.querySelector<HTMLElement>('.cover-art-wrap');
   const rx=cover?gsap.quickTo(cover,'rotationY',{duration:.5,ease:'power3.out'}):null;
   const ry=cover?gsap.quickTo(cover,'rotationX',{duration:.5,ease:'power3.out'}):null;
   listen(window,'pointermove',((event:PointerEvent)=>{x(event.clientX);y(event.clientY);cursor.classList.add('visible');cursor.classList.toggle('interactive',Boolean((event.target as HTMLElement).closest('a,button')));rx?.((event.clientX/innerWidth-.5)*8);ry?.((.5-event.clientY/innerHeight)*6);}) as EventListener);
   listen(document,'pointerleave',()=>cursor.classList.remove('visible'));
   disposers.push(()=>cursor.classList.remove('visible','interactive'));
  }

  // Rare, contained reward beats; nothing shakes the browser or reading text.
  listen(window,'manga:power',()=>{
   const box=root.querySelector<HTMLElement>('.training-interaction');if(!box)return;
   const burst=document.createElement('div');burst.className='comic-reward';burst.setAttribute('aria-hidden','true');burst.innerHTML='<span>LEVEL UP!</span><i/><b/>';box.append(burst);
   const tl=gsap.timeline({onComplete:()=>burst.remove()}).fromTo(burst.querySelector('span'),{opacity:0,scale:1.7,rotation:-14},{opacity:1,scale:1,rotation:-6,duration:.22,ease:'power4.out'}).to(burst.querySelector('span'),{opacity:0,y:-22,duration:.25,delay:.45});transient.push(tl);disposers.push(()=>burst.remove());
   const stamp=Array.from(root.querySelectorAll('.lesson-stamps .earned')).at(-1);if(stamp)transient.push(gsap.fromTo(stamp,{scale:1.5,rotation:-10},{scale:1,rotation:0,duration:.35,ease:'back.out(1.4)'}));
  });
  listen(window,'manga:patch',()=>{
   const board=root.querySelector('.bug-board');if(!board)return;
   const rain=document.createElement('div');rain.className='patch-check-rain';rain.setAttribute('aria-hidden','true');
   for(let i=0;i<12;i++){const check=document.createElement('span');check.textContent='✓';check.style.left=`${8+(i*37)%84}%`;check.style.top=`${12+(i*23)%60}%`;rain.append(check);}board.append(rain);disposers.push(()=>rain.remove());
   transient.push(gsap.timeline({onComplete:()=>rain.remove()}).fromTo(rain.children,{opacity:0,scale:1.9,y:-35,rotation:-20},{opacity:.6,scale:1,y:0,rotation:0,duration:.28,stagger:.035,ease:'power3.out'}).to(rain,{opacity:0,duration:.25,delay:.25}));
  });
 },root);
 const stopLiving=innerWidth>=700?startLivingInk(root):()=>{};
 // Refresh after fonts/art layout settles; no delayed callbacks survive unmount.
 const refresh=requestAnimationFrame(()=>ScrollTrigger.refresh());
 return()=>{cancelAnimationFrame(refresh);disposers.forEach(fn=>fn());transient.forEach(t=>t.kill());stopLiving();ctx.revert();splits.forEach(s=>s.revert());};
}

/** A real geometric page fold (the upstream MIT helper) followed by an ink wash. */
export function turnMode(root:HTMLElement,commit:()=>void) {
 const front=document.createElement('div'),back=document.createElement('div'),shell=document.createElement('div');
 shell.className='mode-page-turn';shell.setAttribute('aria-hidden','true');front.className='mode-page-front';back.className='mode-page-back';
 front.innerHTML='<span>THE NEXT PAGE</span><small>VAIBHAV TRIPATHI / 047</small>';shell.append(front,back);root.append(shell);
 const fold=createPageTurn(front,back),state={p:0};
 let committed=false;const finish=()=>{if(!committed){committed=true;commit();}shell.remove();};
 const timeline=gsap.timeline({onComplete:finish}).to(state,{p:1,duration:.65,ease:'power2.inOut',onUpdate:()=>fold(state.p)})
  .call(()=>{if(!committed){committed=true;commit();}},[],.34).to(shell,{opacity:0,duration:.2},.52);
 return()=>{timeline.kill();shell.remove();};
}
