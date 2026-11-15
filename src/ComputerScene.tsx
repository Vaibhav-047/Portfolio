import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

type ScreenApp = 'about' | 'projects' | 'contact';
type Props = { reduced: boolean; paused: boolean; onReady: () => void; onFail: () => void; onEnter: (app: ScreenApp, isFolder: boolean) => void };
export default function ComputerScene({ reduced, paused, onReady, onFail, onEnter }: Props) {
 const host = useRef<HTMLDivElement>(null);
 const current = useRef({ reduced, paused, onReady, onFail, onEnter });
 current.current = { reduced, paused, onReady, onFail, onEnter };
 useEffect(() => {
  const element = host.current!;
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); } catch { current.current.onFail(); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 700 ? 1 : 1.5));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.3;
  element.appendChild(renderer.domElement); renderer.domElement.setAttribute('aria-hidden', 'true');
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#bcc9ef'); scene.fog = new THREE.Fog('#bcc9ef', 19, 42);
  const camera = new THREE.PerspectiveCamera(35, 1, .04, 70);
  const ambient = new THREE.HemisphereLight('#ffffff', '#6670a3', 2.5); scene.add(ambient);
  const key = new THREE.DirectionalLight('#fff3df', 4); key.position.set(-4, 10, 6); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -10; key.shadow.camera.right = 10; key.shadow.camera.top = 10; key.shadow.camera.bottom = -10; key.shadow.normalBias = .04; key.shadow.bias = -.0003; scene.add(key);
  const fill = new THREE.DirectionalLight('#9eb6ff', 2); fill.position.set(7, 4, -3); scene.add(fill);
  const materials: THREE.Material[] = [], geometries: THREE.BufferGeometry[] = [], textures: THREE.Texture[] = [];
  const mat = (color: string, roughness = .65, metalness = 0) => { const material = new THREE.MeshStandardMaterial({ color, roughness, metalness }); materials.push(material); return material; };
  const ivory = mat('#ece6d5'), edge = mat('#b3b0a5'), dark = mat('#26384d'), blue = mat('#4c6cca'), orange = mat('#f39155'), cream = mat('#d7c9ae'), green = mat('#668d67');
  const desk = new THREE.Group(); scene.add(desk);
  function box(parent: THREE.Object3D, size: number[], position: number[], material: THREE.Material, radius = .04) {
   const geometry = new RoundedBoxGeometry(size[0], size[1], size[2], 2, radius); geometries.push(geometry);
   const mesh = new THREE.Mesh(geometry, material); mesh.position.set(position[0], position[1], position[2]); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  function cylinder(parent: THREE.Object3D, radius: number, height: number, position: number[], material: THREE.Material, top = radius) {
   const geometry = new THREE.CylinderGeometry(top, radius, height, 24); geometries.push(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position as [number, number, number]); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  function label(parent: THREE.Object3D, text: string, width: number, height: number, position: number[], color = '#30445c', bg = '#eae3cf') {
   const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128; const context = canvas.getContext('2d')!;
   context.fillStyle = bg; context.fillRect(0, 0, 512, 128); context.fillStyle = color; context.font = 'bold 55px monospace'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(text, 256, 65);
   const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.push(texture);
   const material = new THREE.MeshBasicMaterial({ map: texture }); materials.push(material); const geometry = new THREE.PlaneGeometry(width, height); geometries.push(geometry);
   const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position as [number, number, number]); parent.add(mesh); return mesh;
  }
  const floor = box(scene, [50, .12, 50], [0, -.65, 0], mat('#bbc9ec')); floor.receiveShadow = true;
  const grid = new THREE.GridHelper(35, 35, '#95a7d3', '#a6b6dd'); grid.position.y = -.58; scene.add(grid);
  box(desk, [7.4, .24, 3.8], [.4, .4, 0], cream, .09);
  box(desk, [7.2, .08, 3.6], [.4, .55, 0], ivory, .06);
  for (const x of [-2.7, 3.5]) for (const z of [-1.35, 1.35]) box(desk, [.18, 1, .18], [x, -.1, z], blue);
  const computer = new THREE.Group(); computer.position.set(.5, .7, -.45); desk.add(computer);
  box(computer, [2.9, .4, 2.15], [0, .1, .1], ivory, .12);
  box(computer, [2.4, .07, .12], [0, .1, 1.19], edge);
  box(computer, [.68, .05, .02], [.65, .1, 1.26], dark, .01);
  box(computer, [.6, .28, .6], [0, .48, 0], edge, .08);
  const monitor = new THREE.Group(); monitor.position.set(0, 1.78, 0); computer.add(monitor);
  box(monitor, [3.25, 2.65, 1.6], [0, 0, -.12], ivory, .18);
  box(monitor, [2.95, 2.26, .2], [0, .06, .73], edge, .13);
  box(monitor, [2.75, 2.08, .12], [0, .08, .86], dark, .12);
  const screenCanvas = document.createElement('canvas'); screenCanvas.width = 1024; screenCanvas.height = 768;
  const ctx = screenCanvas.getContext('2d')!;
  const screenTexture = new THREE.CanvasTexture(screenCanvas); screenTexture.colorSpace = THREE.SRGBColorSpace; textures.push(screenTexture);
  const screenMaterial = new THREE.MeshBasicMaterial({ map: screenTexture }); materials.push(screenMaterial);
  const screenGeometry = new THREE.PlaneGeometry(2.58, 1.91); geometries.push(screenGeometry);
  const screen = new THREE.Mesh(screenGeometry, screenMaterial); screen.position.set(0, .08, .935); monitor.add(screen);
  const screenCenter = screen.getWorldPosition(new THREE.Vector3());
  const viewSlope = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  label(monitor, 'VAIBHAV / 047', 1.05, .17, [-.55, -1.13, .705]);
  const power = cylinder(monitor, .07, .025, [1.1, -1.1, .72], green); power.rotation.x = Math.PI / 2;
  for (let i = 0; i < 10; i++) box(monitor, [.035, .6, .012], [1.64, .1, -.5 + i * .08], edge, .005).rotation.y = Math.PI / 2;
  const keyboard = new THREE.Group(); keyboard.position.set(.4, .7, 1.3); keyboard.rotation.x = .13; desk.add(keyboard);
  box(keyboard, [3.3, .16, 1.05], [0, 0, 0], ivory, .08);
  const keyGeometry = new RoundedBoxGeometry(.19, .08, .18, 1, .025); geometries.push(keyGeometry);
  const keys = new THREE.InstancedMesh(keyGeometry, edge, 56); const matrix = new THREE.Matrix4();
  for (let i = 0; i < 56; i++) { matrix.makeTranslation(-1.42 + (i % 14) * .218, .11, -.35 + Math.floor(i / 14) * .22); keys.setMatrixAt(i, matrix); } keys.castShadow = true; keyboard.add(keys);
  box(keyboard, [.9, .08, .16], [0, .12, .38], ivory, .025);
  box(keyboard, [.19, .08, .18], [-1.42, .12, -.35], orange, .025);
  const mouse = box(desk, [.4, .23, .64], [2.55, .76, 1.25], ivory, .14); box(desk, [.48, .015, .85], [2.55, .59, 1.25], blue, .08);
  const cableCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(2.55, .66, .95), new THREE.Vector3(2.65, .64, .4), new THREE.Vector3(2.3, .64, -.1), new THREE.Vector3(1.8, .64, -.2)]);
  const cableGeo = new THREE.TubeGeometry(cableCurve, 16, .014, 6, false); geometries.push(cableGeo); desk.add(new THREE.Mesh(cableGeo, dark));
  // A tiny listening corner makes this desk personal without borrowed characters.
  const speaker = new THREE.Group(); speaker.position.set(-2.2, 1.15, -.5); desk.add(speaker);
  box(speaker, [.65, 1.1, .65], [0, 0, 0], blue, .09);
  const cone = cylinder(speaker, .22, .04, [0, -.12, .34], dark); cone.rotation.x = Math.PI / 2;
  const tweeter = cylinder(speaker, .09, .04, [0, .3, .34], ivory); tweeter.rotation.x = Math.PI / 2;
  cylinder(desk, .24, .5, [2.65, .85, -.65], orange); cylinder(desk, .2, .015, [2.65, 1.105, -.65], dark);
  const handleGeo = new THREE.TorusGeometry(.16, .045, 8, 16); geometries.push(handleGeo); const handle = new THREE.Mesh(handleGeo, orange); handle.position.set(2.92, .9, -.65); desk.add(handle);
  for (let i = 0; i < 3; i++) { const book = box(desk, [1.2, .13, .8], [-2.35, .68 + i * .14, .85], i === 1 ? orange : blue, .015); book.rotation.y = i * .13 - .2; }
  const note = label(desk, 'MAKE IT YOURS.', .75, .3, [-.9, .58, 1.5], '#32485f', '#ffdf87'); note.rotation.x = -Math.PI / 2; note.rotation.z = -.12;
  const pot = cylinder(scene, .42, .65, [4.75, -.24, -.6], ivory, .34);
  const plant = new THREE.Group(); plant.position.set(4.75, .1, -.6); scene.add(plant);
  for (let i = 0; i < 7; i++) { const stem = cylinder(plant, .017, 1.15 + i * .07, [Math.sin(i) * .15, .55, Math.cos(i) * .15], green); stem.rotation.z = Math.sin(i * 2) * .4; const leafGeo = new THREE.SphereGeometry(.29, 12, 8); geometries.push(leafGeo); const leaf = new THREE.Mesh(leafGeo, green); leaf.scale.set(.55, 1.8, .17); leaf.position.set(Math.sin(i * 1.8) * .4, 1.12 + Math.cos(i) * .2, Math.cos(i * 2) * .3); leaf.rotation.z = Math.sin(i * 2) * .9; plant.add(leaf); }
  const tunnel = new THREE.Group(); scene.add(tunnel); tunnel.visible = false;
  const tunnelMat = new THREE.MeshBasicMaterial({ color: '#859fff', transparent: true, opacity: .45 }); materials.push(tunnelMat);
  for (let i = 0; i < 18; i++) { const frame = new THREE.Group(); const z = -3 - i * 3; box(frame, [5, .025, .025], [0, 2.1, z], tunnelMat, .001); box(frame, [5, .025, .025], [0, -2.1, z], tunnelMat, .001); box(frame, [.025, 4.2, .025], [-2.5, 0, z], tunnelMat, .001); box(frame, [.025, 4.2, .025], [2.5, 0, z], tunnelMat, .001); frame.rotation.z = i * .09; tunnel.add(frame); }
  let hovered = false, frame = 0, last = 0, elapsed = 0, visible = true, disposed = false, lowFrames = 0, measured = 0;
  const pointer = new THREE.Vector2(), raycaster = new THREE.Raycaster();
  const icons = [
   ['about', 'ABOUT', 58, 105],
   ['projects', 'PROJECTS', 58, 255],
   ['contact', 'CONTACT', 58, 405],
  ] as const;
  function paintScreen() {
   ctx.fillStyle = '#4261b2'; ctx.fillRect(0, 0, 1024, 768);
   ctx.strokeStyle = '#7894d366'; ctx.lineWidth = 1; for (let i = 0; i < 1024; i += 40) { ctx.beginPath();ctx.moveTo(i, 0);ctx.lineTo(i, 768);ctx.stroke(); } for (let i = 0; i < 768; i += 40) {ctx.beginPath();ctx.moveTo(0, i);ctx.lineTo(1024, i);ctx.stroke();}
   ctx.fillStyle = '#e8ebf5'; ctx.fillRect(0, 0, 1024, 55); ctx.fillStyle = '#213358'; ctx.font = 'bold 22px monospace'; ctx.fillText('VT / PERSONAL COMPUTER', 22, 36); ctx.font = '18px monospace'; ctx.fillText('SYSTEM READY', 835, 35);
   icons.forEach(([, name, x, y]) => { ctx.fillStyle = '#ffe49d';ctx.fillRect(x, y, 64, 47);ctx.fillRect(x, y - 9, 30, 10);ctx.fillStyle = '#eaf1ff';ctx.font = '17px monospace';ctx.fillText(name, x - 5, y + 80); });
   ctx.fillStyle = '#172b57'; ctx.fillRect(254, 166, 686, 399);ctx.fillStyle = '#f4f1e5'; ctx.fillRect(240, 150, 686, 399);ctx.fillStyle = '#d2dcf5';ctx.fillRect(240, 150, 686, 40);ctx.fillStyle = '#23335a';ctx.font = '18px monospace';ctx.fillText('welcome.txt', 260, 177);ctx.fillText('−  □  ×', 824, 177);
   ctx.fillStyle = '#26365b';ctx.font = 'bold 62px sans-serif';ctx.fillText('Hello, world.', 282, 290);ctx.font = '26px sans-serif';ctx.fillText('I’m Vaibhav Tripathi.', 284, 345);ctx.font = '23px monospace';ctx.fillText('FRONTEND DEVELOPER', 284, 389);
   ctx.fillStyle = hovered ? '#f2b575' : '#233c70';ctx.fillRect(283, 437, 490, 67);ctx.fillStyle = hovered ? '#26365b' : '#fff';ctx.font = 'bold 21px monospace';ctx.fillText('CLICK TO EXPLORE  →', 330, 480);
   ctx.fillStyle = '#e1e6ef';ctx.fillRect(0, 712, 1024, 56);ctx.fillStyle = '#23335a';ctx.font = 'bold 22px monospace';ctx.fillText('↗ START', 23, 750);ctx.font = '18px monospace';ctx.fillText('PUNE, INDIA', 820, 750);
   ctx.fillStyle = '#111c3110'; for (let y = 0; y < 768; y += 4) ctx.fillRect(0, y, 1024, 1);
   screenTexture.needsUpdate = true;
  }
  paintScreen();
  function progress() { const story = document.getElementById('portal-story'); if (!story) return 0; const rect = story.getBoundingClientRect(); return THREE.MathUtils.clamp(-rect.top / Math.max(1, rect.height - innerHeight), 0, 1); }
  function render(now: number) {
   if (disposed) return; const delta = last ? Math.min((now - last) / 1000, .08) : 0; last = now;
   if (!current.current.paused && !current.current.reduced) elapsed += delta;
   const p = current.current.reduced ? 0 : progress(); const mobile = innerWidth < 700;
   const home = new THREE.Vector3(mobile ? 8.5 : 8, mobile ? 6.2 : 5.2, mobile ? 14 : 11);
   const homeTarget = new THREE.Vector3(mobile ? .5 : -1.25, mobile ? 1.15 : 1.3, 0);
   const approach = THREE.MathUtils.smoothstep(p, .04, .38);
   const { width, height } = screenGeometry.parameters;
   const screenDistance = Math.max(width / camera.aspect, height) / (2 * viewSlope * .92);
   camera.position.copy(home).lerp(new THREE.Vector3(screenCenter.x, screenCenter.y, screenCenter.z + screenDistance), approach);
   const target = homeTarget.clone().lerp(screenCenter, approach);
   if (!current.current.reduced && !current.current.paused && p < .12) { camera.position.x += pointer.x * .28; camera.position.y += pointer.y * .12; }
   if (p > .5) { const into = (p - .5) / .5; desk.visible = false; plant.visible = false; pot.visible = false; floor.visible = false; grid.visible = false; tunnel.visible = true; scene.background = new THREE.Color('#152c71'); scene.fog = new THREE.Fog('#152c71', 6, 45); camera.position.set(Math.sin(into * 4) * .2, Math.cos(into * 3) * .2, -into * 43);target.set(0, 0, camera.position.z - 8); camera.rotation.z = into * .3; tunnel.rotation.z = into * .4; }
   else { desk.visible = true; plant.visible = true; pot.visible = true; floor.visible = true; grid.visible = true; tunnel.visible = false; scene.background = new THREE.Color('#bcc9ef'); scene.fog = new THREE.Fog('#bcc9ef', 19, 42); }
   camera.lookAt(target); if (p > .5) camera.rotateZ(Math.sin(p * 5) * .13);
   plant.rotation.z = current.current.reduced ? 0 : Math.sin(elapsed * .6) * .025;
   renderer.render(scene, camera); element.dataset.sceneProgress = p.toFixed(3);
   if (delta > .035) lowFrames++; measured++; if (measured === 180 && lowFrames > 75) renderer.setPixelRatio(1);
   if (visible && !document.hidden && !current.current.paused && !current.current.reduced) frame = requestAnimationFrame(render);
  }
  function requestRender() { cancelAnimationFrame(frame); last = 0; if (visible && !document.hidden) frame = requestAnimationFrame(render); }
  function resize() { renderer.setSize(element.clientWidth, element.clientHeight); camera.aspect = element.clientWidth / Math.max(1, element.clientHeight); camera.updateProjectionMatrix(); requestRender(); }
  function screenUV(event: MouseEvent) {
   const rect = element.getBoundingClientRect();
   pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
   if (!desk.visible) return;
   raycaster.setFromCamera(pointer, camera);
   return raycaster.intersectObject(screen)[0]?.uv;
  }
  function move(event: PointerEvent) {
   const hit = Boolean(screenUV(event));
   if (hit !== hovered) { hovered = hit; paintScreen(); element.style.cursor = hit ? 'pointer' : 'default'; }
   requestRender();
  }
  function click(event: MouseEvent) {
   const uv = screenUV(event);
   if (!uv) return;
   // UV coordinates start at the bottom of the texture, unlike the canvas.
   const x = uv.x * screenCanvas.width;
   const y = (1 - uv.y) * screenCanvas.height;
   const icon = icons.find(([, , left, top]) => x >= left - 32 && x <= left + 118 && y >= top - 18 && y <= top + 96);
   current.current.onEnter(icon?.[0] ?? 'about', Boolean(icon));
  }
  function lost(event: Event) { event.preventDefault(); cancelAnimationFrame(frame); current.current.onFail(); }
  const observer = new IntersectionObserver(entries => {visible = entries[0].isIntersecting; requestRender();});observer.observe(element);
  window.addEventListener('resize', resize);window.addEventListener('scroll', requestRender, { passive: true });document.addEventListener('visibilitychange', requestRender);window.addEventListener('pc-motion-change', requestRender);
  element.addEventListener('pointermove', move);element.addEventListener('click', click);renderer.domElement.addEventListener('webglcontextlost', lost);
  resize(); current.current.onReady();
  return () => {disposed = true;cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('resize', resize);window.removeEventListener('scroll', requestRender);document.removeEventListener('visibilitychange', requestRender);window.removeEventListener('pc-motion-change', requestRender);element.removeEventListener('pointermove', move);element.removeEventListener('click', click);renderer.domElement.removeEventListener('webglcontextlost', lost);geometries.forEach(g => g.dispose());materials.forEach(m => m.dispose());textures.forEach(t => t.dispose());renderer.dispose();renderer.domElement.remove();};
 }, []);
 useEffect(() => { window.dispatchEvent(new Event('pc-motion-change')); }, [reduced, paused]);
 return <div className="computer-canvas" ref={host}/>;
}
