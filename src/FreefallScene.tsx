import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { MotionMode } from './App';
import type { VisualQuality } from './ReactorControls';

export default function FreefallScene({mode,paused,boost,quality}:{mode:MotionMode;paused:boolean;boost:boolean;quality:VisualQuality}){
 const host=useRef<HTMLDivElement>(null),settings=useRef({mode,paused,boost,quality}),wake=useRef<()=>void>(()=>{});
 useEffect(()=>{settings.current={mode,paused,boost,quality};wake.current();},[mode,paused,boost,quality]);
 useEffect(()=>{
  const el=host.current!,story=el.closest<HTMLElement>('.freefall-story')!;
  let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});}catch{return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0,0);el.appendChild(renderer.domElement);
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(43,1,.1,100);camera.position.set(0,0,11);
  scene.add(new THREE.AmbientLight(0xacc9df,2));const light=new THREE.DirectionalLight(0xffd9a2,5);light.position.set(3,5,5);scene.add(light);
  const cyanLight=new THREE.PointLight(0x39dfff,20);cyanLight.position.set(-2,1,3);scene.add(cyanLight);
  const red=new THREE.MeshStandardMaterial({color:0x991b28,metalness:.72,roughness:.28}),gold=new THREE.MeshStandardMaterial({color:0xd7b36c,metalness:.75,roughness:.25}),dark=new THREE.MeshStandardMaterial({color:0x141b24,metalness:.8,roughness:.35}),energy=new THREE.MeshBasicMaterial({color:0xa7f5ff});
  const suit=new THREE.Group();scene.add(suit);
  function box(w:number,h:number,d:number,mat:THREE.Material,x:number,y:number,z:number,parent:THREE.Group=suit){const shape=new THREE.Shape();const r=Math.min(.045,w*.15,h*.15);shape.moveTo(-w/2+r,-h/2);shape.lineTo(w/2-r,-h/2);shape.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);shape.lineTo(w/2,h/2-r);shape.quadraticCurveTo(w/2,h/2,w/2-r,h/2);shape.lineTo(-w/2+r,h/2);shape.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);shape.lineTo(-w/2,-h/2+r);shape.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);const m=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:d,bevelEnabled:true,bevelThickness:.018,bevelSize:.015,bevelSegments:2,steps:1}),mat);m.position.set(x,y,z-d/2);parent.add(m);return m;}
  box(.72,1.05,.44,red,0,.3,0);box(.42,.36,.4,gold,0,-.4,0);box(.5,.28,.36,dark,0,-.12,.03);
  const head=new THREE.Group();head.position.set(0,1.12,0);suit.add(head);box(.46,.55,.42,red,0,0,0,head);box(.36,.42,.05,gold,0,-.015,.23,head);
  [-1,1].forEach(side=>{box(.12,.035,.035,energy,side*.105,.06,.27,head);const arm=new THREE.Group();arm.position.set(side*.5,.65,0);arm.rotation.z=side*.35;suit.add(arm);box(.3,.42,.36,red,0,0,0,arm);box(.19,.44,.23,gold,0,-.4,0,arm);box(.24,.4,.29,red,0,-.75,.02,arm);box(.17,.15,.24,red,0,-1.03,.03,arm);const palm=new THREE.Mesh(new THREE.CircleGeometry(.07,20),energy);palm.position.set(0,-1.05,.16);arm.add(palm);
   const leg=new THREE.Group();leg.position.set(side*.23,-.62,0);leg.rotation.z=side*-.12;suit.add(leg);box(.3,.65,.33,gold,0,-.25,0,leg);box(.33,.65,.35,red,0,-.86,0,leg);box(.34,.22,.55,red,0,-1.24,.1,leg);
  });
  const core=new THREE.Mesh(new THREE.CircleGeometry(.15,40),energy);core.position.set(0,.45,.235);suit.add(core);
  const coreRim=new THREE.Mesh(new THREE.TorusGeometry(.18,.025,8,40),gold);coreRim.position.copy(core.position);suit.add(coreRim);
  const trailMat=new THREE.MeshBasicMaterial({color:0x67e8ff,transparent:true,opacity:.35,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
  [-.23,.23].forEach(x=>{const m=new THREE.Mesh(new THREE.ConeGeometry(.1,2,16,1,true),trailMat);m.position.set(x,-3.25,0);m.rotation.z=Math.PI;suit.add(m);});
  const shaft=new THREE.Group();scene.add(shaft);
  const lineMat=new THREE.LineBasicMaterial({color:0xb99a61,transparent:true,opacity:.055});
  for(let i=0;i<22;i++){const g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-3.5,-8+i*.8,-3),new THREE.Vector3(3.5,-8+i*.8,-3)]);shaft.add(new THREE.Line(g,lineMat));}
  const dustGeo=new THREE.BufferGeometry(),points=new Float32Array(180*3);for(let i=0;i<180;i++)points.set([Math.sin(i*52.3)*5,Math.cos(i*13.1)*9,-2-Math.abs(Math.sin(i))*5],i*3);dustGeo.setAttribute('position',new THREE.BufferAttribute(points,3));const dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({color:0xe9c992,size:.018,transparent:true,opacity:.55}));scene.add(dust);
  const ringMat=new THREE.MeshBasicMaterial({color:0x75e7ff,transparent:true,opacity:0,side:THREE.DoubleSide});const ring=new THREE.Mesh(new THREE.TorusGeometry(1,.018,8,100),ringMat);ring.rotation.x=Math.PI/2;ring.position.y=-2.1;scene.add(ring);
  let frame=0,visible=true,time=0,last=0,pointer=0,lastQuality='';
  const resize=()=>{const r=el.getBoundingClientRect();renderer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();start();};
  function draw(now:number){frame=0;const s=settings.current;const dt=last?Math.min((now-last)/1000,.05):.016;last=now;if(!visible||document.hidden)return;if(s.mode==='full'&&!s.paused)time+=dt;
   if(lastQuality!==s.quality){lastQuality=s.quality;renderer.setPixelRatio(s.quality==='low'?1:Math.min(devicePixelRatio,s.quality==='high'?2:1.5));dustGeo.setDrawRange(0,s.quality==='low'?70:180);}
   const progress=Math.max(0,Math.min(1,-story.getBoundingClientRect().top/(story.offsetHeight-innerHeight)));const fall=Math.min(1,progress/.62),land=Math.max(0,Math.min(1,(progress-.62)/.22));
   suit.rotation.set(-.22+Math.sin(fall*Math.PI)*.5,.3+pointer*.18+Math.sin(fall*4)*.3,-.18+Math.sin(fall*Math.PI*2)*.26);suit.position.set(Math.sin(fall*5)*.4,(1-land)*Math.sin(time*.7)*.08+land*-.3,0);suit.scale.setScalar(innerWidth<700?.56:.72+land*.15);
   shaft.position.y=(fall*34)% .8;dust.position.y=(fall*22+time*.08)%2;trailMat.opacity=land>.6?.06:s.boost?.8:.28;core.scale.setScalar(s.boost?1.2:1);ring.scale.setScalar(1+land*5);ringMat.opacity=land>0&&land<1?Math.sin(land*Math.PI)*.5:0;
   renderer.render(scene,camera);el.dataset.ready='true';if(s.mode==='full'&&!s.paused)frame=requestAnimationFrame(draw);
  }
  function start(){if(!frame&&visible&&!document.hidden){last=0;frame=requestAnimationFrame(draw);}}
  const scroll=()=>start();const pointerMove=(e:PointerEvent)=>{pointer=e.clientX/innerWidth-.5;};const visibility=()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else start();};const io=new IntersectionObserver(([e])=>{visible=e.isIntersecting;if(!visible){cancelAnimationFrame(frame);frame=0;}else start();});io.observe(story);const ro=new ResizeObserver(resize);ro.observe(el);window.addEventListener('scroll',scroll,{passive:true});window.addEventListener('pointermove',pointerMove);document.addEventListener('visibilitychange',visibility);wake.current=start;resize();
  return()=>{wake.current=()=>{};cancelAnimationFrame(frame);io.disconnect();ro.disconnect();window.removeEventListener('scroll',scroll);window.removeEventListener('pointermove',pointerMove);document.removeEventListener('visibilitychange',visibility);const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();scene.traverse(o=>{const m=o as THREE.Mesh;if(m.geometry)geometries.add(m.geometry);if(m.material)(Array.isArray(m.material)?m.material:[m.material]).forEach(v=>materials.add(v));});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();renderer.domElement.remove();};
 },[]);
 return <div ref={host} className="freefall-render" aria-hidden="true"/>;
}
