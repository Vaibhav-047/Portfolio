import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createReactor } from './reactorModel';
import type { MotionMode } from './App';
import type { PowerMode, VisualQuality } from './ReactorControls';
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => { const t = clamp(x); return t * t * (3 - 2 * t); };
export type ReactorSceneProps = { mode: MotionMode; paused: boolean; power: PowerMode; exploded: boolean; pulse: number; reset: number; rotation: number; quality: VisualQuality; boot: boolean; run: number; onPhase: (n: number) => void; onComplete: () => void; onFailure: () => void };

export default function ReactorScene(props: ReactorSceneProps) {
  const host = useRef<HTMLDivElement>(null), state = useRef(props), wake = useRef<() => void>(() => {});
  const [failed, setFailed] = useState(false);
  useEffect(() => { state.current = props; wake.current(); }, [props]);
  useEffect(() => {
    const el = host.current!; const anchor = document.querySelector<HTMLElement>('.scene-stage')!;
    const coreHit = anchor.querySelector<HTMLElement>('.core-hit');
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' }); }
    catch { setFailed(true); state.current.onFailure(); return; }
    renderer.setClearColor(0x000000, 0); renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, .1, 100); camera.position.z = 12;
    const environment = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer), env = pmrem.fromScene(environment, .04); scene.environment = env.texture; scene.environmentIntensity = .7; environment.dispose(); pmrem.dispose();
    scene.add(new THREE.AmbientLight(0xa9c3df, 1.2));
    const key = new THREE.DirectionalLight(0xe1f2ff, 3.8); key.position.set(-4, 6, 6); scene.add(key);
    const rim = new THREE.PointLight(0x42cfff, 23); rim.position.set(2, 1, 3); scene.add(rim);
    const warm = new THREE.DirectionalLight(0xffb369, 1.6); warm.position.set(-5, -2, 1); scene.add(warm);
    const reactor = createReactor(); scene.add(reactor.root);
    const composer = new EffectComposer(renderer);
    const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .42, .45, .8);
    const output = new OutputPass(); composer.addPass(new RenderPass(scene, camera)); composer.addPass(bloom); composer.addPass(output);
    const count = innerWidth < 700 ? 64 : 160, positions = new Float32Array(count * 3);
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const dustMaterial = new THREE.PointsMaterial({ color: 0x8fefff, size: .018, transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending });
    const particles = new THREE.Points(geometry, dustMaterial); reactor.root.add(particles);
    let frame = 0, time = 0, last = 0, visible = !document.hidden, lost = false, reducedQuality = false, slowFrames = 0;
    let bootTime = 0, bootActive = false, run = -1, phase = -1, explosion = 0, intensity = 1.8, pulseAt = -100, lastPulse = 0, lastReset = 0, lastRotation = 0;
    let dragging = false, startX = 0, startY = 0, yaw = -.28, pitch = .12, aimYaw = -.28, aimPitch = .12, velocityX = 0, velocityY = 0, lastX = 0, lastY = 0, pointerX = 0, pointerY = 0;
    const metrics = { frames: 0, geometries: 0, textures: 0, reducedQuality: false, coreX: innerWidth / 2, coreY: innerHeight / 2 };
    const corePosition = new THREE.Vector3();
    Object.assign(el, { reactorMetrics: metrics });
    let rect = anchor.getBoundingClientRect(), heroVisible = true, dirty = true, oldQuality = '';
    const resize = () => { rect = anchor.getBoundingClientRect(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); dirty = true; start(); };
    function start() { if (!frame && visible && !lost) { last = 0; frame = requestAnimationFrame(draw); } }
    wake.current = () => { dirty = true; start(); };
    function draw(now: number) {
      frame = 0;
      if (!visible || lost) return;
      const dt = last ? Math.min((now - last) / 1000, .06) : .016; last = now;
      const p = state.current, animate = p.mode === 'full' && !p.paused;
      if (p.quality !== oldQuality) { oldQuality = p.quality; reducedQuality = p.quality === 'low'; const ratio = reducedQuality ? 1 : Math.min(devicePixelRatio, p.quality === 'high' ? 2 : 1.5); renderer.setPixelRatio(ratio); composer.setPixelRatio(ratio); dirty = true; }
      if (p.boot && p.run !== run) { bootTime = 0; run = p.run; bootActive = true; phase = -1; }
      if (!p.boot) bootActive = false;
      if (animate || bootActive) time += dt;
      if (bootActive) bootTime += dt;
      if (p.reset !== lastReset) { lastReset = p.reset; lastRotation = p.rotation; aimYaw = -.28; aimPitch = .12; velocityX = velocityY = 0; }
      if (p.rotation !== lastRotation) { aimYaw += p.rotation - lastRotation; lastRotation = p.rotation; }
      if (p.pulse !== lastPulse) { lastPulse = p.pulse; pulseAt = time; }
      const targetIntensity = p.power === 'standby' ? .2 : p.power === 'overdrive' ? 4 : 1.7;
      const targetExplosion = p.exploded ? 1 : 0;
      const interpolation = animate ? 1 - Math.exp(-dt * 7) : 1;
      intensity += (targetIntensity - intensity) * interpolation; explosion += (targetExplosion - explosion) * interpolation;
      if (!dragging && animate) { aimYaw += velocityX; aimPitch = THREE.MathUtils.clamp(aimPitch + velocityY, -.75, .75); velocityX *= .89; velocityY *= .89; }
      yaw += (aimYaw - yaw) * (dragging || !animate ? 1 : .13); pitch += (aimPitch - pitch) * (dragging || !animate ? 1 : .13);
      const worldH = 2 * Math.tan(THREE.MathUtils.degToRad(35 / 2)) * camera.position.z;
      const worldW = worldH * camera.aspect;
      const scroll = Math.max(0, window.scrollY), background = clamp((scroll - 250) / 650);
      const mobile = innerWidth < 700;
      const heroX = rect.left + rect.width / 2, heroY = rect.top + rect.height / 2;
      const backgroundX = innerWidth * (.83 + Math.sin(scroll * .0007) * .08), backgroundY = innerHeight * .5;
      const px = THREE.MathUtils.lerp(heroX, backgroundX, background), py = THREE.MathUtils.lerp(heroY, backgroundY, background);
      const targetX = (px / innerWidth - .5) * worldW, targetY = (.5 - py / innerHeight) * worldH;
      const size = Math.min(rect.width * .7, rect.height * .82) / innerHeight * worldH / 3.7;
      const transition = bootActive ? ease((bootTime - 4.15) / 2.25) : 1;
      reactor.root.position.set(targetX * transition, targetY * transition, 0);
      const initialScale = Math.min(worldW, worldH) / 5.8;
      reactor.root.scale.setScalar(THREE.MathUtils.lerp(initialScale, size * (1 + background * .55), transition));
      reactor.root.rotation.set((pitch + (animate && !dragging ? pointerY : 0)) * transition, (yaw - explosion * .52 + (animate && !dragging ? pointerX : 0)) * transition, (animate && !dragging ? Math.sin(time * .18) * .025 : 0) + background * -.18);
      if (!bootActive) reactor.parts.forEach(part => { part.object.position.copy(part.home); part.object.rotation.copy(part.turn); });
      reactor.layers[0].position.z = -.25 * explosion;
      reactor.layers[1].position.z = .12 + .55 * explosion;
      reactor.layers[2].position.z = 1.15 * explosion;
      reactor.layers[3].position.z = 1.9 * explosion;
      if (animate && !dragging) { reactor.layers[1].rotation.z = time * (p.power === 'overdrive' ? .24 : p.power === 'standby' ? .015 : .045); reactor.layers[2].rotation.z = -time * .07; }
      let ignition = 1;
      if (bootActive) {
        const nextPhase = bootTime < 1.1 ? 0 : bootTime < 3 ? 1 : bootTime < 3.8 ? 2 : bootTime < 5.7 ? 3 : 4;
        if (phase !== nextPhase) { phase = nextPhase; state.current.onPhase(phase); }
        reactor.parts.forEach((part, i) => { const assembled = ease((bootTime - part.delay) / 1.4); part.object.position.copy(part.home).addScaledVector(part.offset, 1 - assembled); part.object.rotation.set(part.turn.x + (1 - assembled) * (i % 2 ? 2 : -2), part.turn.y + (1 - assembled) * 2, part.turn.z + (1 - assembled) * 1.6); });
        ignition = .02 + ease((bootTime - 2.9) / .85);
        const wave = clamp((bootTime - 3.25) / .95); reactor.pulse.scale.setScalar(.5 + wave * 3.4); reactor.pulseMaterial.opacity = wave > 0 && wave < 1 ? Math.sin(wave * Math.PI) * .65 : 0;
        if (bootTime >= 6.5) { bootActive = false; state.current.onComplete(); }
      } else {
        // Restore part-local poses after a skipped assembly without resetting exploded layer positions.
        reactor.parts.forEach(part => { if (!reactor.layers.includes(part.object as THREE.Group)) { part.object.position.copy(part.home); part.object.rotation.copy(part.turn); } });
        const age = time - pulseAt; reactor.pulse.scale.setScalar(.75 + Math.min(age, 1) * 2.6); reactor.pulseMaterial.opacity = animate && age < 1 ? (1 - age) * .7 : 0;
      }
      const pulseBoost = animate ? Math.max(0, 1 - (time - pulseAt) * 1.5) : 0;
      reactor.cyan.emissiveIntensity = intensity * ignition + pulseBoost;
      reactor.white.color.setRGB(.12 + ignition * .55, .15 + ignition * .7, .18 + ignition * .8);
      reactor.white.emissiveIntensity = intensity * ignition * .8 + (animate ? Math.sin(time * 1.4) * .08 : 0) + pulseBoost;
      reactor.haloMaterial.uniforms.strength.value = intensity * ignition * .7;
      for (let i = 0; i < count; i++) { const a = i * 2.39996 + time * (p.power === 'overdrive' ? .5 : .1), r = 1.9 + (i % 13) * .035; positions.set([Math.cos(a) * r, Math.sin(a) * r, Math.sin(i * 1.2 + time) * .25], i * 3); }
      geometry.attributes.position.needsUpdate = true; geometry.setDrawRange(0, reducedQuality ? Math.floor(count / 2) : count); dustMaterial.opacity = p.power === 'standby' ? .08 : p.power === 'overdrive' ? .9 : .35;
      el.style.opacity = bootActive ? '1' : String(mobile && !heroVisible ? 0 : 1 - background * .88);
      if (animate && dt > .035) slowFrames++; else slowFrames = Math.max(0, slowFrames - 1);
      if (p.quality === 'auto' && slowFrames > 90 && !reducedQuality) { reducedQuality = true; renderer.setPixelRatio(1); }
      if (reducedQuality) renderer.render(scene, camera); else composer.render(); dirty = false;
      corePosition.set(0, 0, .3); reactor.layers[3].localToWorld(corePosition); corePosition.project(camera);
      metrics.coreX = (corePosition.x * .5 + .5) * innerWidth; metrics.coreY = (-corePosition.y * .5 + .5) * innerHeight;
      if (coreHit && background < .1 && !bootActive) coreHit.style.transform = `translate(-50%, -50%) translate(${metrics.coreX - rect.left - rect.width / 2}px, ${metrics.coreY - rect.top - rect.height / 2}px)`;
      metrics.frames++; metrics.geometries = renderer.info.memory.geometries; metrics.textures = renderer.info.memory.textures; metrics.reducedQuality = reducedQuality;
      el.dataset.ready = 'true'; el.dataset.power = p.power; el.dataset.exploded = String(explosion > .95); el.dataset.phase = String(phase); el.dataset.yaw = yaw.toFixed(2);
      if (bootActive || dragging || (animate && (!mobile || heroVisible)) || Math.abs(explosion - targetExplosion) > .005 || Math.abs(intensity - targetIntensity) > .01 || dirty) frame = requestAnimationFrame(draw);
    }
    const down = (e: PointerEvent) => { if (e.pointerType === 'touch' || (e.target as HTMLElement).closest('button')) return; dragging = true; startX = lastX = e.clientX; startY = lastY = e.clientY; velocityX = velocityY = 0; anchor.setPointerCapture(e.pointerId); anchor.dataset.dragging = 'true'; start(); };
    const move = (e: PointerEvent) => { if (!dragging) return; const dx = e.clientX - lastX, dy = e.clientY - lastY; aimYaw += dx * .009; aimPitch = THREE.MathUtils.clamp(aimPitch + dy * .007, -.75, .75); velocityX = dx * .0008; velocityY = dy * .0006; lastX = e.clientX; lastY = e.clientY; start(); };
    const up = (e: PointerEvent) => { if (!dragging) return; dragging = false; anchor.dataset.dragging = 'false'; if (anchor.hasPointerCapture(e.pointerId)) anchor.releasePointerCapture(e.pointerId); if (Math.hypot(e.clientX - startX, e.clientY - startY) < 5) { pulseAt = time; } start(); };
    const pointer = (e: PointerEvent) => { if (dragging || state.current.mode !== 'full' || state.current.paused || !heroVisible || !matchMedia('(pointer:fine)').matches) return; const r = anchor.getBoundingClientRect(); pointerX = ((e.clientX - r.left) / r.width - .5) * .12; pointerY = ((e.clientY - r.top) / r.height - .5) * .08; };
    const keyboard = (e: KeyboardEvent) => { if ((e.target as HTMLElement).closest('button')) return; if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) { e.preventDefault(); if(e.key==='ArrowLeft')aimYaw-=.2; if(e.key==='ArrowRight')aimYaw+=.2; if(e.key==='ArrowUp')aimPitch-=.15; if(e.key==='ArrowDown')aimPitch+=.15; start(); } };
    const scroll = () => { rect = anchor.getBoundingClientRect(); dirty = true; start(); };
    const visibility = () => { visible = !document.hidden; if (!visible) { cancelAnimationFrame(frame); frame = 0; } else start(); };
    const contextLost = (e: Event) => { e.preventDefault(); lost = true; cancelAnimationFrame(frame); frame = 0; setFailed(true); state.current.onFailure(); };
    const io = new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; start(); }); io.observe(anchor);
    const ro = new ResizeObserver(resize); ro.observe(anchor);
    anchor.addEventListener('pointerdown', down); anchor.addEventListener('pointermove', move); anchor.addEventListener('pointerup', up); anchor.addEventListener('pointercancel', up); anchor.addEventListener('pointermove', pointer); anchor.addEventListener('keydown', keyboard);
    window.addEventListener('resize', resize); window.addEventListener('scroll', scroll, { passive: true }); document.addEventListener('visibilitychange', visibility); renderer.domElement.addEventListener('webglcontextlost', contextLost); resize();
    return () => {
      wake.current = () => {}; cancelAnimationFrame(frame); io.disconnect(); ro.disconnect();
      anchor.removeEventListener('pointerdown', down); anchor.removeEventListener('pointermove', move); anchor.removeEventListener('pointerup', up); anchor.removeEventListener('pointercancel', up); anchor.removeEventListener('pointermove', pointer); anchor.removeEventListener('keydown', keyboard);
      window.removeEventListener('resize', resize); window.removeEventListener('scroll', scroll); document.removeEventListener('visibilitychange', visibility); renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(); scene.traverse(o => { const m = o as THREE.Mesh; if (m.geometry) geometries.add(m.geometry); if(m.material)(Array.isArray(m.material)?m.material:[m.material]).forEach(x=>materials.add(x)); }); geometries.forEach(g=>g.dispose()); materials.forEach(m=>m.dispose()); bloom.dispose(); output.dispose(); composer.dispose(); env.dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  }, []);
  return <div ref={host} className={`reactor-layer ${props.boot ? 'booting' : ''} ${failed ? 'failed' : ''}`} aria-hidden="true" data-failed={failed || undefined}/>;
}
