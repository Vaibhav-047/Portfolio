// Renderer, camera, post-processing and the frame loop.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildTree, updateGem, U, type Tier } from './tree';
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

export async function createScene(canvas: HTMLCanvasElement, tier: Tier) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: tier !== 'low', powerPreference: 'high-performance' });
  let dpr = Math.min(devicePixelRatio, tier === 'high' ? 1.5 : tier === 'mid' ? 1.25 : 1);
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.3, 600);

  buildWorld(scene, tier);
  const tree = await buildTree(scene, tier);

  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: tier === 'high' ? 4 : 0 }));
  composer.addPass(new RenderPass(scene, camera));
  // selective bloom: only materials that write HDR values above 1 (vines, gems, moon, mushrooms) cross the threshold
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), tier === 'low' ? 0.5 : 0.65, 0.55, 1.0);
  composer.addPass(bloom);
  const finish = new ShaderPass(FinishShader); composer.addPass(finish);
  composer.addPass(new OutputPass());

  // wide view: a gentle, limited orbit with slow automatic drift
  const view = { az: 0, el: 0, tAz: 0, tEl: 0, dist: 30, target: new THREE.Vector3(0, 7.3, 0) };
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false); composer.setSize(w, h); composer.setPixelRatio(dpr);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    // keep the whole crown (about 24 units wide, 19 tall) in frame at any aspect
    const t = Math.tan(THREE.MathUtils.degToRad(20));
    view.dist = Math.max(11.6 / t, 13.4 / (t * camera.aspect));
  }
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();

  let drag: { x: number; y: number; az: number; el: number } | null = null;
  const down = (e: PointerEvent) => { drag = { x: e.clientX, y: e.clientY, az: view.tAz, el: view.tEl }; };
  const move = (e: PointerEvent) => {
    if (!drag) return;
    view.tAz = THREE.MathUtils.clamp(drag.az - (e.clientX - drag.x) * 0.004, -0.6, 0.6);
    view.tEl = THREE.MathUtils.clamp(drag.el + (e.clientY - drag.y) * 0.003, -0.08, 0.28);
  };
  const up = () => { drag = null; };
  canvas.addEventListener('pointerdown', down); addEventListener('pointermove', move); addEventListener('pointerup', up);

  const clock = new THREE.Clock();
  let raf = 0, slow = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    U.uTime.value = t; finish.uniforms.uTime.value = t;
    view.az += (view.tAz + Math.sin(t * 0.11) * 0.1 - view.az) * Math.min(1, dt * 3);
    view.el += (view.tEl + Math.sin(t * 0.07) * 0.015 - view.el) * Math.min(1, dt * 3);
    const el = 0.02 + view.el;
    camera.position.set(Math.sin(view.az) * Math.cos(el) * view.dist, view.target.y - 1.6 + Math.sin(el) * view.dist, Math.cos(view.az) * Math.cos(el) * view.dist);
    camera.lookAt(view.target);
    for (const v of tree.vines) if (v.gem) updateGem(v.gem, t);
    composer.render(dt);
    // quality tiers adapt: if frames stay slow, shed resolution rather than stutter
    slow = dt > 0.024 ? slow + 1 : Math.max(0, slow - 2);
    if (slow > 90 && dpr > 0.7) { dpr = Math.max(0.7, dpr - 0.2); renderer.setPixelRatio(dpr); resize(); slow = 0; }
  }
  frame();

  return {
    renderer, scene, camera, tree, view,
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect();
      canvas.removeEventListener('pointerdown', down); removeEventListener('pointermove', move); removeEventListener('pointerup', up);
      renderer.dispose();
    },
  };
}
