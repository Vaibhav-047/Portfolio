import * as THREE from 'three';
import { scrollProgress } from './sections';
import { TIERS, detectTier } from './quality';
import type { Tier } from './quality';

export type TreeOptions = { reduced: boolean; onReady: () => void; onHover: (label: string | null) => void; onSelect: (id: string) => void };
export type TreeHandle = { setStops: (stops: number[]) => void; setPaused: (paused: boolean) => void; burst: () => void; dispose: () => void };

export function createTreeScene(canvas: HTMLCanvasElement, opts: TreeOptions): TreeHandle {
  let tier: Tier = opts.reduced ? 'low' : detectTier();
  const q = TIERS[tier];
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, q.dpr));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
  scene.add(new THREE.HemisphereLight('#ffe9c7', '#3c4a2a', 1.4));
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'varying vec3 vDir; void main(){ float h = vDir.y; gl_FragColor = vec4(mix(vec3(1.,.78,.62), vec3(.42,.62,.86), smoothstep(-.05,.6,h)), 1.); }',
  }));
  scene.add(sky);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(120, 48).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#5d7a3a' }));
  scene.add(ground);

  let stops = [0, 1], paused = false, raf = 0;
  function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  resize(); addEventListener('resize', resize);
  const clock = new THREE.Clock();
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05), p = scrollProgress();
    camera.position.set(Math.sin(p * 4) * 14, 1.5 + p * 14, Math.cos(p * 4) * 14);
    camera.lookAt(0, 2 + p * 12, 0);
    void dt; void stops;
    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(() => { if (!paused || opts.reduced) frame(); });
  requestAnimationFrame(() => opts.onReady());
  return {
    setStops: s => { stops = s; },
    setPaused: v => { paused = v; },
    burst: () => {},
    dispose: () => { cancelAnimationFrame(raf); renderer.setAnimationLoop(null); removeEventListener('resize', resize); renderer.dispose(); },
  };
}
