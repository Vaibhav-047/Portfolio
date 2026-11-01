/** Adapted from VOL.01 living.ts (Ines Cherif, MIT code).
 * New atlas sampling and zones for our original illustrations; shared scheduler,
 * visibility/motion teardown, context-loss fallback and resource disposal.
 * See VOL01-LICENSE.txt. No upstream art is used.
 */
const vertex = `attribute vec2 pos; varying vec2 uv;
void main(){uv=vec2(pos.x*.5+.5,.5-pos.y*.5);gl_Position=vec4(pos,0.,1.);}`;
const fragment = `precision mediump float;
uniform sampler2D tex; uniform vec4 region; uniform float time,gust,scene;
varying vec2 uv;
void main(){
 vec2 p=uv; vec2 d=vec2(0.);
 // Rooftop skies drift while the face, body and architectural lines stay pinned.
 float sky=(1.-smoothstep(.28,.45,p.y))*(scene<.5||scene>4.5?1.:0.);
 d+=vec2(sin(p.y*7.+time*.35),cos(p.x*5.+time*.3))*.003*sky;
 // Only the outer shirt hem breathes; not the central face or the whole image.
 float cloth=smoothstep(.58,.78,p.y)*(1.-smoothstep(.95,1.,p.y));
 cloth*=smoothstep(.24,.32,p.x)*(1.-smoothstep(.74,.82,p.x));
 d.x+=sin(p.y*18.-time*3.)*.0025*cloth*(1.+gust);
 vec2 sampleUV=region.xy+clamp(p+d,.002,.998)*region.zw;
 gl_FragColor=texture2D(tex,sampleUV);
}`;

export function startLivingInk(root:HTMLElement) {
 let disposed=false, frame=0, lastTime=0, gust=0;
 const cleanups:(()=>void)[]=[];
 const frames:{draw:(time:number)=>void;visible:boolean}[]=[];
 const image=new Image(); image.src='/manga/origin-panels.png';
 const targets=root.querySelectorAll<HTMLElement>('.cover-art-wrap .manga-art, .cinema-shot:first-child .manga-art, .training-chapter .manga-art, .finale-panels>.manga-art');
 const observer=new IntersectionObserver(entries=>{for(const entry of entries){const index=Number((entry.target as HTMLElement).dataset.liveIndex);if(frames[index])frames[index].visible=entry.isIntersecting;}schedule();});
 function tick(time:number){frame=0;if(disposed||document.hidden)return;if(time-lastTime>32){lastTime=time;gust*=.96;for(const f of frames)if(f.visible)f.draw(time/1000);}schedule();}
 function schedule(){if(!disposed&&!document.hidden&&frames.some(f=>f.visible)&&!frame)frame=requestAnimationFrame(tick);}
 const visibility=()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else schedule();};
 let lastX=0,lastY=0;
 const pointer=(event:PointerEvent)=>{gust=Math.min(1,Math.hypot(event.clientX-lastX,event.clientY-lastY)/140);lastX=event.clientX;lastY=event.clientY;};
 document.addEventListener('visibilitychange',visibility);
 window.addEventListener('pointermove',pointer,{passive:true});
 image.decode().then(()=>{
  if(disposed)return;
  targets.forEach(el=>{
   const canvas=document.createElement('canvas');canvas.className='living-ink';canvas.setAttribute('aria-hidden','true');
   const gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'low-power'});if(!gl)return;
   const shaders:WebGLShader[]=[];
   function shader(type:number,source:string){const s=gl!.createShader(type)!;gl!.shaderSource(s,source);gl!.compileShader(s);shaders.push(s);return s;}
   const program=gl.createProgram()!,buffer=gl.createBuffer()!,texture=gl.createTexture()!;
   gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
   if(!gl.getProgramParameter(program,gl.LINK_STATUS)){gl.deleteProgram(program);gl.deleteBuffer(buffer);gl.deleteTexture(texture);shaders.forEach(s=>gl.deleteShader(s));return;}
   gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
   const pos=gl.getAttribLocation(program,'pos');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
   gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
   const scene=Number(el.dataset.sceneArt||0), row=scene<3?0:1;
   gl.uniform4f(gl.getUniformLocation(program,'region'),(scene%3)/3,row*.4785,1/3,row?.5215:.4785);
   gl.uniform1f(gl.getUniformLocation(program,'scene'),scene);
   const uTime=gl.getUniformLocation(program,'time'),uGust=gl.getUniformLocation(program,'gust');
   const f={visible:false,draw:(time:number)=>{const dpr=Math.min(devicePixelRatio,1.25);const w=Math.round(el.clientWidth*dpr),h=Math.round(el.clientHeight*dpr);if(!w||!h||gl.isContextLost())return;if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}gl.uniform1f(uTime,time%1000);gl.uniform1f(uGust,gust);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);}};
   el.dataset.liveIndex=String(frames.length);frames.push(f);el.append(canvas);observer.observe(el);
   const lost=(e:Event)=>{e.preventDefault();f.visible=false;canvas.remove();};canvas.addEventListener('webglcontextlost',lost);
   cleanups.push(()=>{canvas.removeEventListener('webglcontextlost',lost);canvas.remove();delete el.dataset.liveIndex;gl.deleteTexture(texture);gl.deleteBuffer(buffer);gl.deleteProgram(program);shaders.forEach(s=>gl.deleteShader(s));gl.getExtension('WEBGL_lose_context')?.loseContext();});
  });
 }).catch(()=>{/* CSS illustration remains the fallback. */});
 return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pointermove',pointer);cleanups.forEach(fn=>fn());};
}
