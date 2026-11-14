import * as THREE from 'three';
import { scrollProgress } from './sections';
import { TIERS, detectTier } from './quality';
import type { Tier } from './quality';
import { buildTree, leafGeometry } from './tree';
import { buildObjects } from './objects';
import { windUniforms } from './wind';
import { createCameraPath } from './camera';
import { createFallingLeaves, createSparkles } from './fallingLeaves';
import { createAtmosphere } from './atmosphere';
import { createPost } from './post';

export type TreeOptions = { reduced: boolean; onReady: () => void; onHover: (label: string | null) => void; onSelect: (id: string) => void; onBurst?: () => void; onTier?: (tier: Tier) => void };
export type TreeHandle = { setStops: (stops: number[]) => void; setPaused: (paused: boolean) => void; burst: () => void; dispose: () => void };

const ZERO2 = new THREE.Vector2();

export function createTreeScene(canvas: HTMLCanvasElement, opts: TreeOptions): TreeHandle {
  let tier: Tier = detectTier();
  const q = TIERS[tier];
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !q.post, powerPreference: 'high-performance' });
  let dpr = Math.min(devicePixelRatio, q.dpr);
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = q.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
  const hemi = new THREE.HemisphereLight('#ffe6c4', '#3d4a26', 1.2);
  const sun = new THREE.DirectionalLight('#ffd49a', 3.2);
  sun.castShadow = q.shadows;
  sun.shadow.mapSize.set(tier === 'high' ? 2048 : 1024, tier === 'high' ? 2048 : 1024);
  Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 24, bottom: -8, near: 1, far: 90 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
  sun.target.position.set(0, 7, 0);
  scene.add(hemi, sun, sun.target);

  const atmosphere = createAtmosphere(scene, q, opts.reduced);
  const tree = buildTree(q.leaves, q.shadows);
  scene.add(tree.bark, tree.leaves);
  const objects = buildObjects(tree);
  scene.add(objects.root);
  const falling = createFallingLeaves(tree, opts.reduced ? 1 : q.falling), sparkles = createSparkles(180);
  scene.add(falling.mesh, sparkles.points);
  // The leaf the camera follows between branches.
  const heroLeaf = new THREE.Mesh(leafGeometry(), new THREE.MeshStandardMaterial({ color: '#f0b54a', emissive: '#ff9a2e', emissiveIntensity: 0.35, roughness: 0.6, side: THREE.DoubleSide }));
  heroLeaf.visible = false; scene.add(heroLeaf);
  let post = q.post ? createPost(renderer, { dof: q.dof, godrays: q.godrays }) : null;

  // Pointer → hover/select on content objects, a world point that pushes leaves and pulls fireflies, and a ground point for grass.
  const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2(9, 9), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  let pointerActive = false, hovered: THREE.Object3D | null = null;
  const onMove = (e: PointerEvent) => { ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); pointerActive = e.pointerType === 'mouse' || e.pressure > 0; };
  const onLeave = () => { pointerActive = false; };
  const onClick = (e: MouseEvent) => {
    if (!hovered || (e.target as HTMLElement).closest('a,button,input,dialog,.branch-card,.site-header')) return;
    objects.pulse(hovered); opts.onSelect(hovered.userData.id);
  };
  addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerleave', onLeave);
  addEventListener('click', onClick);

  const path = createCameraPath(tree, objects.resumeFocus);
  let stops = Array.from({ length: 8 }, (_, i) => i / 7), paused = false;
  const buf = new THREE.Vector2();
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.fov = w / h < 0.85 ? 55 : 42; camera.updateProjectionMatrix(); path.build(w / h);
    renderer.getDrawingBufferSize(buf); post?.setSize(buf.x, buf.y);
  }
  resize(); addEventListener('resize', resize);

  const clock = new THREE.Clock();
  let time = 0, progress = scrollProgress(), velocity = 0, wind = 1, detachBudget = 0, prevSeg = -1, prevS = 0, frames = 0;
  const focusPoint = new THREE.Vector3(), shot = { pos: new THREE.Vector3(), target: new THREE.Vector3(), shift: new THREE.Vector2(), seg: 0, s: 0 };
  const shift = new THREE.Vector2(), look = new THREE.Vector3(), parallax = new THREE.Vector2(), right = new THREE.Vector3(), heroPos = new THREE.Vector3(), upV = new THREE.Vector3(0, 1, 0), groundHit = new THREE.Vector3();
  /** Stop index → section whose leaves fall there (roots catch About's leaves; the hollow sits in the crown). */
  const stopSection = (k: number) => (k <= 0 ? 0 : k <= 5 ? k - 1 : -1);
  function burst(k: number) {
    if (opts.reduced) return;
    const n = Math.round(q.falling * 0.16);
    for (let i = 0; i < n; i++) falling.detach(stopSection(k), 1.4 + Math.random());
    opts.onBurst?.();
  }

  // Adaptive quality: step down while frames stay slow (ignores the first second while shaders compile).
  let slowTime = 0;
  function adapt(dt: number) {
    if (opts.reduced || frames < 60) return;
    slowTime = dt > 1 / 42 ? slowTime + dt : Math.max(0, slowTime - dt * 0.5);
    if (slowTime < 2.5) return;
    slowTime = 0;
    if (post && tier === 'high') { tier = 'medium'; post.setEffects({ dof: false, godrays: true }); }
    else if (dpr > 1) { dpr = Math.max(1, dpr - 0.25); resize(); }
    else if (post) { tier = 'low'; post.dispose(); post = null; renderer.shadowMap.enabled = false; sun.castShadow = false; }
    else return;
    opts.onTier?.(tier);
  }

  let idle = false, lastScroll = -1;
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05); frames++;
    const animate = !paused && !opts.reduced;
    if (animate) time += dt;
    // Camera: scroll → spline, softened once more so wheel ticks never jolt it.
    const raw = scrollProgress(), prev = progress;
    progress += (raw - progress) * (opts.reduced ? 1 : 1 - Math.exp(-dt * 5));
    velocity += ((progress - prev) / Math.max(dt, 1e-3) - velocity) * 0.15;
    path.sample(progress, stops, shot);
    parallax.lerp(pointerActive && !opts.reduced ? ndc : ZERO2, 0.04);
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    camera.position.copy(shot.pos).addScaledVector(right, parallax.x * 0.35);
    camera.position.y += parallax.y * 0.2 + Math.sin(time * 0.35) * 0.08;
    if (opts.reduced) look.copy(shot.target); else look.lerp(shot.target, look.lengthSq() ? 0.2 : 1);

    // Leaf burst as the camera leaves a branch (either direction).
    if (prevSeg === shot.seg && !opts.reduced) {
      if (prevS < 0.02 && shot.s >= 0.02) burst(shot.seg);
      else if (prevS > 0.98 && shot.s <= 0.98) burst(shot.seg + 1);
    }
    prevSeg = shot.seg; prevS = shot.s;
    // Hero leaf: drifts down across the line of sight mid-transition; the camera's gaze follows it.
    const bell = opts.reduced || shot.seg >= stops.length - 2 ? 0 : Math.sin(Math.PI * shot.s);
    heroLeaf.visible = bell > 0.02;
    if (heroLeaf.visible) {
      heroPos.copy(camera.position).lerp(shot.target, 0.5).addScaledVector(right, Math.sin(time * 1.6) * 0.45 + (shot.s - 0.5) * 1.2).addScaledVector(upV, (0.5 - shot.s) * 1.4 + Math.cos(time * 2.1) * 0.2);
      heroLeaf.position.copy(heroPos);
      heroLeaf.rotation.set(Math.cos(time * 1.3) * 0.8, time * 0.9, Math.sin(time * 2.2) * 0.9);
      heroLeaf.scale.setScalar(bell * 1.5);
      look.lerp(heroPos, bell * 0.3);
    }
    focusPoint.copy(look);
    windUniforms.uFocus.value.copy(look);
    const tunnelAt = (k: number) => (k === 0 || k === stops.length - 1 ? 0 : 1); // only while visiting a branch
    windUniforms.uTunnel.value = THREE.MathUtils.lerp(tunnelAt(shot.seg), tunnelAt(shot.seg + 1), shot.s);
    camera.lookAt(focusPoint);
    shift.lerp(shot.shift, opts.reduced ? 1 : 0.12);
    camera.setViewOffset(innerWidth, innerHeight, -shift.x * innerWidth, shift.y * innerHeight, innerWidth, innerHeight);
    camera.updateMatrixWorld();

    const pxPerUnit = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    let pointerWorld: THREE.Vector3 | null = null;
    if (pointerActive) {
      raycaster.setFromCamera(ndc, camera);
      windUniforms.uPointer.value.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, camera.position.distanceTo(focusPoint) * 0.85);
      windUniforms.uPointerStrength.value += (1 - windUniforms.uPointerStrength.value) * 0.1;
      pointerWorld = windUniforms.uPointer.value;
      const g = raycaster.ray.intersectPlane(groundPlane, groundHit);
      atmosphere.groundPointerOn.value += ((g ? 1 : 0) - atmosphere.groundPointerOn.value) * 0.1;
      if (g) atmosphere.groundPointer.value.copy(g);
    } else { windUniforms.uPointerStrength.value *= 0.9; atmosphere.groundPointerOn.value *= 0.9; }
    // Time of day follows the climb: dawn at the roots, night in the canopy.
    atmosphere.update(shot.seg + shot.s, dt, time, sun, hemi, focusPoint, opts.reduced ? null : pointerWorld, pxPerUnit);
    const day = atmosphere.day;

    wind += ((opts.reduced ? 0 : 1 + Math.min(Math.abs(velocity) * 7, 2.2)) - wind) * (1 - Math.exp(-dt * 2));
    windUniforms.uTime.value = time;
    windUniforms.uWind.value = wind;
    windUniforms.uSunDirView.value.copy(day.sunDir).transformDirection(camera.matrixWorldInverse);

    const hit = pointerActive ? raycaster.intersectObjects(objects.pickables, false)[0]?.object ?? null : null;
    if (hit !== hovered) { hovered = hit; objects.setHovered(hit); opts.onHover(hit ? hit.userData.label : null); document.body.classList.toggle('over-object', !!hit); }
    objects.update(time, dt, wind, day.night);
    if (animate) {
      // More leaves let go when the visitor scrolls fast.
      detachBudget += dt * (0.9 + Math.min(Math.abs(velocity) * 90, 26));
      const near = stopSection(shot.s < 0.5 ? shot.seg : shot.seg + 1);
      while (detachBudget > 1) { detachBudget -= 1; falling.detach(Math.random() < 0.7 ? near : -2); }
      for (const at of falling.update(dt, time, wind, windUniforms.uPointer.value, pointerActive)) sparkles.spawn(at, 4);
      sparkles.update(dt, pxPerUnit);
    }

    if (post) post.render(scene, camera, dt, day.sunDir, day.sunColor, day.night, day.exposure, camera.position.distanceTo(focusPoint), time);
    else { renderer.toneMappingExposure = day.exposure; renderer.render(scene, camera); }
    adapt(dt);
    // Calm mode renders once per scroll position instead of every frame.
    if (opts.reduced) idle = true;
  }

  renderer.setAnimationLoop(() => {
    if (opts.reduced) { if (idle && scrollY === lastScroll) return; lastScroll = scrollY; }
    frame();
  });
  const wake = () => { idle = false; lastScroll = -1; };
  addEventListener('resize', wake);
  if (import.meta.env.DEV) Object.assign(window, { __tree: { camera, scene, objects, tree, windUniforms, falling, renderer, get tier() { return tier; } } });
  requestAnimationFrame(() => opts.onReady());

  return {
    setStops: s => { stops = s; wake(); },
    setPaused: v => { paused = v; },
    burst: () => burst(prevSeg + (prevS > 0.5 ? 1 : 0)),
    dispose: () => {
      renderer.setAnimationLoop(null);
      removeEventListener('resize', resize); removeEventListener('resize', wake); removeEventListener('pointermove', onMove); document.removeEventListener('pointerleave', onLeave); removeEventListener('click', onClick);
      document.body.classList.remove('over-object');
      scene.traverse(o => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); const mat = m.material as THREE.Material | THREE.Material[] | undefined; if (Array.isArray(mat)) mat.forEach(x => x.dispose()); else mat?.dispose(); });
      objects.dispose(); falling.dispose(); sparkles.dispose(); atmosphere.dispose(); post?.dispose(); renderer.dispose();
    },
  };
}
