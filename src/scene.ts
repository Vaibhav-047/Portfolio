// Renderer, camera, post-processing, picking and the vine journey (GSAP).
import * as THREE from 'three';
import gsap from 'gsap';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildTree, updateGem, U, PAL, type Tier, type SectionId, type Vine } from './tree';
import { buildWorld } from './world';

export function pickTier(): Tier {
  const forced = new URLSearchParams(location.search).get('tier');
  if (forced === 'high' || forced === 'mid' || forced === 'low') return forced;
  const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
  const cores = navigator.hardwareConcurrency || 4, mem = (navigator as { deviceMemory?: number }).deviceMemory ?? 8;
  if (mobile || cores <= 4 || mem <= 4) return 'low';
  return cores >= 8 && mem >= 8 ? 'high' : 'mid';
}

/** Vignette + film grain; runs before tone mapping. */
const FinishShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: 0.035 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
  fragmentShader: /* glsl */`uniform sampler2D tDiffuse; uniform float uTime, uGrain; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 q = vUv - .5;
      c.rgb *= mix(1., .38, smoothstep(.28, .85, length(q * vec2(1., 1.15))));
      float n = fract(sin(dot(vUv * 913. + uTime * 7., vec2(12.9898, 78.233))) * 43758.5453) - .5;
      c.rgb += n * uGrain * (.4 + c.rgb);
      gl_FragColor = c; }`,
};

export interface SceneApi {
  /** Roots ripple, a pulse races up the section's vine with the camera behind it, the gem blooms. Resolves on arrival. */
  open(id: SectionId, instant?: boolean): Promise<void>;
  /** Plays the journey in reverse back to the wide view. */
  close(instant?: boolean): Promise<void>;
  hover(id: SectionId | null): void;
  /** Elements to keep pinned to each section's gem (the floating labels). */
  setLabels(els: Partial<Record<SectionId, HTMLElement>>): void;
  onPick: ((id: SectionId) => void) | null;
  onHover: ((id: SectionId | null) => void) | null;
  tier: Tier;
  dispose(): void;
}

const smooth = (a: number, b: number, x: number) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

gsap.ticker.lagSmoothing(0);   // a dropped frame must not stretch the journey: keep it on wall-clock time

export async function createScene(canvas: HTMLCanvasElement, tier: Tier): Promise<SceneApi> {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: tier !== 'low', powerPreference: 'high-performance' });
  let dpr = Math.min(devicePixelRatio, tier === 'high' ? 1.5 : tier === 'mid' ? 1.25 : 1);
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.3, 600);

  buildWorld(scene, tier);
  const tree = await buildTree(scene, tier);
  const sections = tree.vines.filter(v => v.id) as (Vine & { id: SectionId })[];

  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: tier === 'high' ? 4 : 0 }));
  composer.addPass(new RenderPass(scene, camera));
  // depth of field only on the high tier, and only while flying / at a gem
  const bokeh = tier === 'high' ? new BokehPass(scene, camera, { focus: 10, aperture: 0, maxblur: 0.006 }) : null;
  if (bokeh) { bokeh.enabled = false; composer.addPass(bokeh); }
  // selective bloom: only materials that write HDR values above 1 (vines, gems, moon, mushrooms) cross the threshold
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), tier === 'low' ? 0.5 : 0.65, 0.55, 1.0));
  const finish = new ShaderPass(FinishShader); composer.addPass(finish);
  composer.addPass(new OutputPass());

  // ---- wide view: a gentle, limited orbit with slow automatic drift ----
  const view = { az: 0, el: 0, tAz: 0, tEl: 0, dist: 30, target: new THREE.Vector3(0, 7.3, 0) };
  let portrait = false;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); composer.setSize(w, h); composer.setPixelRatio(dpr);
    camera.aspect = w / h; camera.updateProjectionMatrix(); portrait = w < 760;
    // keep the whole crown (about 24 units wide, 19 tall) in frame at any aspect
    const t = Math.tan(THREE.MathUtils.degToRad(20));
    view.dist = Math.max(11.6 / t, 13.4 / (t * camera.aspect));
  }
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();

  // ---- picking: fat invisible tubes round each section vine, never added to the scene ----
  const picks = sections.flatMap(v => {
    const tube = new THREE.Mesh(new THREE.TubeGeometry(v.curve, 70, 0.38, 5)); tube.userData.id = v.id;
    const gem = new THREE.Mesh(new THREE.SphereGeometry(0.75, 8, 6)); gem.position.copy(v.gem!.group.position); gem.updateMatrixWorld(); gem.userData.id = v.id;
    return [tube, gem];
  });
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const pickAt = (e: PointerEvent): SectionId | null => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return (ray.intersectObjects(picks, false)[0]?.object.userData.id as SectionId) ?? null;
  };

  const api: SceneApi = { open, close, hover, setLabels, onPick: null, onHover: null, tier, dispose };
  let drag: { x: number; y: number; az: number; el: number; moved: boolean } | null = null;
  const down = (e: PointerEvent) => { drag = { x: e.clientX, y: e.clientY, az: view.tAz, el: view.tEl, moved: false }; };
  const move = (e: PointerEvent) => {
    if (drag) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 5) drag.moved = true;
      view.tAz = THREE.MathUtils.clamp(drag.az - (e.clientX - drag.x) * 0.004, -0.6, 0.6);
      view.tEl = THREE.MathUtils.clamp(drag.el + (e.clientY - drag.y) * 0.003, -0.08, 0.28);
    } else if (e.target === canvas && st.k < 0.02) {
      const id = pickAt(e); canvas.style.cursor = id ? 'pointer' : 'grab'; api.onHover?.(id);
    }
  };
  const up = (e: PointerEvent) => {
    const wasClick = drag && !drag.moved; drag = null;
    if (wasClick && e.target === canvas && st.k < 0.02) { const id = pickAt(e); if (id) api.onPick?.(id); }
  };
  canvas.addEventListener('pointerdown', down); addEventListener('pointermove', move); addEventListener('pointerup', up);

  // ---- sparks: thrown off a hovered vine, and a burst when a gem opens ----
  const SP = 220, spPos = new Float32Array(SP * 3), spVel = new Float32Array(SP * 3), spLife = new Float32Array(SP);
  const spGeo = new THREE.BufferGeometry();
  spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3)); spGeo.setAttribute('aLife', new THREE.BufferAttribute(spLife, 1));
  const sparks = new THREE.Points(spGeo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uCol: { value: PAL.teal } },
    vertexShader: `attribute float aLife; varying float vL; void main(){ vL = aLife; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = 90. * aLife / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uCol; varying float vL; void main(){ float d = length(gl_PointCoord - .5) * 2.; gl_FragColor = vec4(mix(uCol, vec3(1.), .5) * 3. * vL * pow(max(0., 1. - d), 2.), 1.); }`,
  }));
  sparks.frustumCulled = false; scene.add(sparks);
  let spNext = 0; const tmp = new THREE.Vector3();
  function spark(p: THREE.Vector3, speed: number) {
    const i = spNext = (spNext + 1) % SP;
    spPos.set([p.x, p.y, p.z], i * 3); tmp.randomDirection().multiplyScalar(speed * (0.4 + Math.random()));
    spVel.set([tmp.x, tmp.y + speed * 0.5, tmp.z], i * 3); spLife[i] = 1;
  }

  // ---- hover ----
  let hovered: SectionId | null = null;
  function hover(id: SectionId | null) {
    if (id === hovered) return; hovered = id;
    for (const v of sections) {
      gsap.to(v.mat.uniforms.uHover, { value: v.id === id ? 1 : 0, duration: 0.35, overwrite: true });
      gsap.to(v.gem!.glow, { value: v.id === id ? 2.2 : 1, duration: 0.35, overwrite: true });
    }
  }

  // ---- the journey ----
  const st = { k: 0, dof: 0 };                       // k: 0 wide view .. 1 flying with the pulse
  let current: (Vine & { id: SectionId }) | null = null, tl: gsap.core.Timeline | null = null, follow = 0, snap = false;
  const F = new THREE.Vector3(), camDir = new THREE.Vector3(0, 0.1, 1), wantDir = new THREE.Vector3(), flyPos = new THREE.Vector3(), widePos = new THREE.Vector3(), look = new THREE.Vector3();

  function open(id: SectionId, instant = false) {
    return new Promise<void>(res => {
      const vine = sections.find(v => v.id === id)!; current = vine; follow = 0; snap = true; hover(null);
      const u = vine.mat.uniforms;
      tl?.kill();
      tl = gsap.timeline({ onComplete: () => { for (let n = 0; n < 60; n++) spark(vine.gem!.group.position, 2.2); res(); } });
      tl.fromTo(U.uRipple, { value: 0 }, { value: 15, duration: 1.3, ease: 'power1.out' }, 0)      // roots ripple with light
        .to(st, { k: 1, duration: 1.9, ease: 'power2.inOut' }, 0.35)
        .fromTo(u.uPulse, { value: 0 }, { value: 1, duration: 3.3, ease: 'power1.inOut' }, 0.6)    // pulse races root -> tip
        .fromTo(u.uLit, { value: 0 }, { value: 1, duration: 3.3, ease: 'power1.inOut' }, 0.6)
        .to(st, { dof: 1, duration: 1.3, ease: 'power2.out' }, '-=1.3')                            // focus pulls to the gem
        .to(vine.gem!.open, { value: 1, duration: 0.9, ease: 'back.out(2.2)' }, '-=0.3');          // gem blooms open
      if (instant) { follow = 1; tl.progress(1); }
    });
  }
  function close(instant = false) {
    return new Promise<void>(res => {
      if (!tl || !current) return res();
      const vine = current;
      const done = () => { U.uRipple.value = -1; vine.mat.uniforms.uPulse.value = -1; vine.mat.uniforms.uLit.value = 0; current = null; tl = null; res(); };
      if (instant) { tl.pause(0); follow = 0; st.k = 0; st.dof = 0; vine.gem!.open.value = 0; done(); }
      else { tl.eventCallback('onReverseComplete', done); tl.timeScale(1.5).reverse(); }
    });
  }

  let labels: Partial<Record<SectionId, HTMLElement>> = {};
  function setLabels(els: Partial<Record<SectionId, HTMLElement>>) { labels = els; }
  const proj = new THREE.Vector3();

  const clock = new THREE.Clock();
  let raf = 0, slow = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    const real = Math.min(clock.getDelta(), 1), dt = Math.min(real, 0.05), t = clock.elapsedTime;
    const ease = (rate: number) => 1 - Math.exp(-real * rate);      // frame-rate independent smoothing
    U.uTime.value = t; finish.uniforms.uTime.value = t;

    view.az += (view.tAz + Math.sin(t * 0.11) * 0.1 - view.az) * ease(3);
    view.el += (view.tEl + Math.sin(t * 0.07) * 0.015 - view.el) * ease(3);
    const el = 0.02 + view.el;
    widePos.set(Math.sin(view.az) * Math.cos(el) * view.dist, view.target.y - 1.6 + Math.sin(el) * view.dist, Math.cos(view.az) * Math.cos(el) * view.dist);

    if (current && st.k > 0) {
      // the camera trails the pulse: it chases a point that lags the pulse along the same spline
      const pulse = Math.max(0, current.mat.uniforms.uPulse.value as number);
      follow = snap && tl && tl.progress() === 1 ? 1 : follow + (pulse - follow) * ease(2.6);
      current.curve.getPointAt(THREE.MathUtils.clamp(follow, 0, 1), F);
      const front = smooth(current.marks[1] - 0.12, current.marks[1] + 0.2, follow);     // past the trunk, come round to the front
      wantDir.set(F.x, 0, F.z).normalize().multiplyScalar(1 - front).add(tmp.set(0, 0, 1).multiplyScalar(front * 1.2));
      wantDir.y = THREE.MathUtils.lerp(0.42, -0.06, smooth(0, 0.9, follow)); wantDir.normalize();
      if (snap) { camDir.copy(wantDir); snap = false; } else camDir.lerp(wantDir, ease(1.7)).normalize();
      const dist = THREE.MathUtils.lerp(9, 5.4, smooth(0.15, 1, follow));
      flyPos.copy(F).addScaledVector(camDir, dist);
      camera.position.lerpVectors(widePos, flyPos, st.k);
      look.lerpVectors(view.target, F, st.k); camera.lookAt(look);
      // at the gem, slide it aside so the panel has room (up on phones, where the panel is a bottom sheet)
      const aside = smooth(0.82, 1, follow) * st.k * dist * Math.tan(THREE.MathUtils.degToRad(20));
      if (portrait) camera.translateY(-aside * 0.5); else camera.translateX(aside * camera.aspect * 0.42);
      if (bokeh) {
        bokeh.enabled = st.dof > 0.01;
        const bu = bokeh.uniforms as Record<string, { value: number }>;
        bu.focus.value = camera.position.distanceTo(F); bu.aperture.value = st.dof * 0.0035;
      }
    } else {
      camera.position.copy(widePos); camera.lookAt(view.target);
      if (bokeh) bokeh.enabled = false;
    }

    for (const v of sections) {
      updateGem(v.gem!, t);
      if (v.id === hovered && Math.random() < 0.6) spark(v.curve.getPointAt(Math.random(), tmp), 0.7);
      const elx = labels[v.id];
      if (elx) {
        proj.copy(v.gem!.group.position).project(camera);
        elx.style.transform = `translate3d(${((proj.x * 0.5 + 0.5) * canvas.clientWidth).toFixed(1)}px, ${((-proj.y * 0.5 + 0.5) * canvas.clientHeight).toFixed(1)}px, 0)`;
        elx.style.opacity = String(Math.max(0, 1 - st.k * 4));
      }
    }
    for (let i = 0; i < SP; i++) {
      if (spLife[i] <= 0) continue;
      spLife[i] = Math.max(0, spLife[i] - dt * 1.3); spVel[i * 3 + 1] -= dt * 1.2;
      for (let a = 0; a < 3; a++) spPos[i * 3 + a] += spVel[i * 3 + a] * dt;
    }
    spGeo.attributes.position.needsUpdate = true; spGeo.attributes.aLife.needsUpdate = true;

    composer.render(dt);
    // quality adapts: if frames stay slow, shed resolution rather than stutter
    slow = dt > 0.024 ? slow + 1 : Math.max(0, slow - 2);
    if (slow > 90 && dpr > 0.7) { dpr = Math.max(0.7, dpr - 0.2); renderer.setPixelRatio(dpr); resize(); slow = 0; }
  }
  frame();

  function dispose() {
    cancelAnimationFrame(raf); ro.disconnect(); tl?.kill();
    canvas.removeEventListener('pointerdown', down); removeEventListener('pointermove', move); removeEventListener('pointerup', up);
    scene.traverse(o => { const m = o as THREE.Mesh; m.geometry?.dispose(); (Array.isArray(m.material) ? m.material : [m.material]).forEach(x => x?.dispose()); });
    renderer.dispose();
  }
  return api;
}
