import * as THREE from 'three';
import { scrollProgress } from './sections';
import { TIERS, detectTier } from './quality';
import type { Tier } from './quality';
import { buildTree } from './tree';
import { buildObjects } from './objects';
import { windUniforms } from './wind';

export type TreeOptions = { reduced: boolean; onReady: () => void; onHover: (label: string | null) => void; onSelect: (id: string) => void };
export type TreeHandle = { setStops: (stops: number[]) => void; setPaused: (paused: boolean) => void; burst: () => void; dispose: () => void };

export function createTreeScene(canvas: HTMLCanvasElement, opts: TreeOptions): TreeHandle {
  const tier: Tier = opts.reduced ? 'medium' : detectTier();
  const q = TIERS[tier];
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, q.dpr));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = q.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#f0c9a4', 30, 140);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);

  const hemi = new THREE.HemisphereLight('#ffe6c4', '#3d4a26', 1.2);
  const sun = new THREE.DirectionalLight('#ffd49a', 3.2);
  sun.position.set(-18, 22, 12);
  sun.castShadow = q.shadows;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 22, bottom: -6, near: 1, far: 70 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  sun.target.position.set(0, 6, 0);
  scene.add(hemi, sun, sun.target);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'varying vec3 vDir; void main(){ float h = vDir.y; gl_FragColor = vec4(mix(vec3(1.,.8,.62), vec3(.45,.64,.86), smoothstep(-.05,.55,h)), 1.); }',
  }));
  scene.add(sky);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(160, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#56702f', roughness: 1 }));
  ground.receiveShadow = true;
  scene.add(ground);

  const tree = buildTree(q.leaves, q.shadows);
  scene.add(tree.bark, tree.leaves);
  const objects = buildObjects(tree);
  scene.add(objects.root);

  // Pointer → hover/select on content objects, and a world point that pushes leaves aside.
  const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2(9, 9);
  let pointerActive = false, hovered: THREE.Object3D | null = null;
  const onMove = (e: PointerEvent) => { ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); pointerActive = true; };
  const onLeave = () => { pointerActive = false; };
  const onClick = (e: MouseEvent) => {
    if (!hovered || (e.target as HTMLElement).closest('a,button,input,dialog,.branch-card,.site-header')) return;
    objects.pulse(hovered); opts.onSelect(hovered.userData.id);
  };
  addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerleave', onLeave);
  addEventListener('click', onClick);

  let stops = [0, 1], paused = false;
  function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  resize(); addEventListener('resize', resize);
  const clock = new THREE.Clock();
  let time = 0;
  const focusPoint = new THREE.Vector3();
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!paused && !opts.reduced) time += dt;
    const p = scrollProgress();
    const a = 0.6 + p * 5.2, r = 15 - p * 2;
    camera.position.set(Math.cos(a) * r, 2 + p * 13, Math.sin(a) * r);
    focusPoint.set(0, 3.5 + p * 10, 0);
    camera.lookAt(focusPoint);

    windUniforms.uTime.value = time;
    windUniforms.uWind.value = opts.reduced ? 0 : 1;
    windUniforms.uSunDirView.value.copy(sun.position).sub(sun.target.position).normalize().transformDirection(camera.matrixWorldInverse);

    let hit: THREE.Object3D | null = null;
    if (pointerActive) {
      raycaster.setFromCamera(ndc, camera);
      hit = raycaster.intersectObjects(objects.pickables, false)[0]?.object ?? null;
      const ray = raycaster.ray, dist = camera.position.distanceTo(focusPoint);
      windUniforms.uPointer.value.copy(ray.origin).addScaledVector(ray.direction, dist);
      windUniforms.uPointerStrength.value += (1 - windUniforms.uPointerStrength.value) * 0.1;
    } else windUniforms.uPointerStrength.value *= 0.9;
    if (hit !== hovered) { hovered = hit; objects.setHovered(hit); opts.onHover(hit ? hit.userData.label : null); canvas.style.cursor = hit ? 'pointer' : ''; document.body.classList.toggle('over-object', !!hit); }
    objects.update(time, dt, opts.reduced ? 0 : 1, 0);
    void stops;
    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(frame);
  requestAnimationFrame(() => opts.onReady());

  return {
    setStops: s => { stops = s; },
    setPaused: v => { paused = v; },
    burst: () => {},
    dispose: () => {
      renderer.setAnimationLoop(null);
      removeEventListener('resize', resize); removeEventListener('pointermove', onMove); document.removeEventListener('pointerleave', onLeave); removeEventListener('click', onClick);
      document.body.classList.remove('over-object');
      scene.traverse(o => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); const mat = m.material as THREE.Material | THREE.Material[] | undefined; if (Array.isArray(mat)) mat.forEach(x => x.dispose()); else mat?.dispose(); });
      objects.dispose(); renderer.dispose();
    },
  };
}
