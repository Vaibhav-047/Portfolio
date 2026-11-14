import * as THREE from 'three';
import content from '../content.json';
import { leafGeometry, rng } from './tree';
import type { Tree } from './tree';

type Pickable = { label: string; id: string };
type Item = { pivot: THREE.Object3D; body: THREE.Object3D; phase: number; swing: number; hover: number; spring: number; vel: number; section: number };

/** Glowing content objects hung or perched on each section's branch. */
export function buildObjects(tree: Tree) {
  const R = rng(5), root = new THREE.Group();
  const pickables: THREE.Mesh[] = [], items: Item[] = [], glow: { mat: THREE.MeshStandardMaterial; base: number }[] = [];
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => { disposables.push(x); return x; };
  const glowMat = (color: string, emissive: string, base: number, extra: THREE.MeshStandardMaterialParameters = {}) => {
    const mat = keep(new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: base, roughness: 0.55, ...extra }));
    glow.push({ mat, base }); return mat;
  };
  const stringMat = keep(new THREE.MeshStandardMaterial({ color: '#3a2a1c', roughness: 1 }));
  const darkMat = keep(new THREE.MeshStandardMaterial({ color: '#2a1c12', roughness: 0.9 }));
  const leafGeo = keep(leafGeometry());
  const leafMat = keep(new THREE.MeshStandardMaterial({ color: '#6ea544', roughness: 0.7, side: THREE.DoubleSide }));

  function tag(obj: THREE.Object3D, data: Pickable) { obj.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.userData = data; pickables.push(o as THREE.Mesh); } }); }
  function surface(section: number, t: number) { const s = tree.sections[section]; return { p: s.curve.getPointAt(t), r: s.radius(t) }; }
  function hang(section: number, t: number, len: number, body: THREE.Object3D, data: Pickable) {
    const { p, r } = surface(section, t), pivot = new THREE.Group();
    pivot.position.copy(p).add(new THREE.Vector3(0, -r * 0.8, 0));
    const string = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.009, 0.009, len, 4)), stringMat);
    string.position.y = -len / 2; body.position.y = -len;
    pivot.add(string, body); root.add(pivot); tag(body, data);
    items.push({ pivot, body, phase: R() * 6, swing: 1, hover: 0, spring: 1, vel: 0, section });
  }
  function perch(section: number, t: number, body: THREE.Object3D, data: Pickable) {
    const { p, r } = surface(section, t), pivot = new THREE.Group();
    pivot.position.copy(p).add(new THREE.Vector3(0, r * 0.85, 0)); pivot.add(body); root.add(pivot); tag(body, data);
    items.push({ pivot, body, phase: R() * 6, swing: 0.25, hover: 0, spring: 1, vel: 0, section });
  }

  // About: paper lanterns
  const lanternGeo = keep(new THREE.LatheGeometry([[0, -0.34], [0.14, -0.32], [0.25, -0.22], [0.3, 0], [0.25, 0.22], [0.14, 0.32], [0, 0.34]].map(([x, y]) => new THREE.Vector2(x, y)), 18));
  const capGeo = keep(new THREE.CylinderGeometry(0.1, 0.12, 0.07, 12));
  [0.52, 0.8].forEach((t, i) => {
    const g = new THREE.Group();
    const paper = new THREE.Mesh(lanternGeo, glowMat(i ? '#ffd9a1' : '#ffc78a', i ? '#ffae5a' : '#ff9440', 1.6, { roughness: 0.9 }));
    const top = new THREE.Mesh(capGeo, darkMat); top.position.y = 0.35;
    const bottom = top.clone(); bottom.position.y = -0.35;
    g.add(paper, top, bottom); g.scale.setScalar(i ? 0.85 : 1);
    hang(0, t, 0.75 + i * 0.35, g, { label: 'About me', id: 'about' });
  });

  // Skills: one glowing fruit per skill
  const fruitGeo = keep(new THREE.SphereGeometry(0.27, 24, 16));
  const stemGeo = keep(new THREE.CylinderGeometry(0.015, 0.02, 0.14, 5));
  const fruitColors = [['#ff9a58', '#ff6a1f'], ['#8cbcff', '#3f7dff'], ['#ffe07a', '#f5b82a']];
  content.skills.forEach((skill, i) => {
    const g = new THREE.Group(), [c, e] = fruitColors[i % fruitColors.length];
    const fruit = new THREE.Mesh(fruitGeo, glowMat(c, e, 1.3, { roughness: 0.35 })); fruit.scale.set(1, 0.92, 1);
    const stem = new THREE.Mesh(stemGeo, stringMat); stem.position.y = 0.3;
    const leaf = new THREE.Mesh(leafGeo, leafMat); leaf.position.set(0.02, 0.3, 0); leaf.rotation.set(0.3, 0, -1.0); leaf.scale.setScalar(0.45);
    g.add(fruit, stem, leaf);
    hang(1, 0.42 + i * 0.2, 0.45 + (i % 2) * 0.3, g, { label: `${skill.name} · ${skill.note}`, id: 'skills' });
  });

  // Projects: blossoms perched on the branch
  const petalMat = glowMat('#f8bfd3', '#f27aa6', 0.35, { side: THREE.DoubleSide, roughness: 0.6 });
  const coreGeo = keep(new THREE.IcosahedronGeometry(0.16, 2));
  content.projects.forEach((project, i) => {
    const g = new THREE.Group();
    for (let ring = 0; ring < 2; ring++) for (let k = 0; k < (ring ? 5 : 7); k++) {
      const petal = new THREE.Mesh(leafGeo, petalMat), a = (k / (ring ? 5 : 7)) * Math.PI * 2 + ring * 0.4;
      petal.scale.set(ring ? 0.8 : 1.05, ring ? 0.75 : 1, 1);
      petal.rotation.set(0, -a, 0); petal.rotateX(ring ? -0.55 : -1.05);
      g.add(petal);
    }
    const core = new THREE.Mesh(coreGeo, glowMat('#fff1b8', '#ffc65a', 2.2)); core.position.y = 0.06; g.add(core);
    g.scale.setScalar(1.15);
    perch(2, 0.5 + i * 0.3, g, { label: `${project.name} · open project`, id: `project:${project.id}` });
  });

  // Experience: a nest with one egg per year
  {
    const g = new THREE.Group(), nestGeo = keep(new THREE.TorusGeometry(0.42, 0.17, 10, 42));
    const p = nestGeo.attributes.position as THREE.BufferAttribute, colors: number[] = [];
    for (let i = 0; i < p.count; i++) {
      const n = Math.sin(i * 12.989) * 43758.5453 % 1;
      p.setXYZ(i, p.getX(i) * (1 + n * 0.08), p.getY(i) * (1 + n * 0.12), p.getZ(i) * (0.75 + n * 0.1));
      const c = 0.12 + Math.abs(n) * 0.12; colors.push(c * 1.6, c * 1.1, c * 0.6);
    }
    nestGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); nestGeo.computeVertexNormals();
    const nest = new THREE.Mesh(nestGeo, keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }))); nest.rotation.x = Math.PI / 2;
    const eggGeo = keep(new THREE.SphereGeometry(0.12, 16, 12)), eggMat = glowMat('#fff6dc', '#ffd27a', 0.9);
    const years = parseInt(content.experience.duration, 10) || 3;
    for (let k = 0; k < years; k++) { const egg = new THREE.Mesh(eggGeo, eggMat); egg.scale.set(1, 1.3, 1); egg.position.set(Math.cos(k * 2.1) * 0.16, 0.06, Math.sin(k * 2.1) * 0.16); g.add(egg); }
    g.add(nest);
    perch(3, 0.66, g, { label: `${content.experience.role} · ${content.experience.duration}`, id: 'experience' });
  }

  // Contact: a jar of fireflies
  const jarBugs: THREE.Mesh[] = [];
  {
    const g = new THREE.Group();
    const glass = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.22, 0.2, 0.5, 20, 1, true)), glowMat('#cfe8ff', '#5a8cff', 0.25, { transparent: true, opacity: 0.28, side: THREE.DoubleSide, roughness: 0.1, depthWrite: false }));
    const lid = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.23, 0.23, 0.07, 20)), darkMat); lid.position.y = 0.28;
    const bugGeo = keep(new THREE.SphereGeometry(0.025, 6, 4)), bugMat = glowMat('#fbffc4', '#e8ff6a', 4);
    for (let k = 0; k < 7; k++) { const b = new THREE.Mesh(bugGeo, bugMat); jarBugs.push(b); g.add(b); }
    g.add(glass, lid);
    hang(4, 0.7, 0.6, g, { label: 'Contact · write to me', id: 'contact' });
  }

  // Resume: a glowing hollow in the upper trunk
  {
    const h = 13.3, t = tree.heightT(h), p = tree.trunkCurve.getPointAt(t), az = 0.85 + 5 * 2.4;
    const out = new THREE.Vector3(Math.cos(az), 0, Math.sin(az)), r = tree.trunkRadius(t);
    const g = new THREE.Group();
    const hole = new THREE.Mesh(keep(new THREE.CircleGeometry(0.2, 24)), keep(new THREE.MeshBasicMaterial({ color: '#0c0703' }))); hole.scale.set(1, 1.5, 1);
    const rim = new THREE.Mesh(keep(new THREE.TorusGeometry(0.2, 0.05, 8, 24)), darkMat); rim.scale.set(1, 1.5, 1);
    const scroll = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.05, 0.05, 0.26, 12)), glowMat('#fff3cf', '#ffc867', 2.4)); scroll.rotation.z = Math.PI / 2; scroll.position.z = 0.02;
    g.add(hole, rim, scroll);
    g.position.copy(p).addScaledVector(out, r * 0.92); g.lookAt(g.position.clone().add(out));
    root.add(g); tag(g, { label: 'Resume · open the hollow', id: 'resume' });
    items.push({ pivot: g, body: g, phase: 0, swing: 0, hover: 0, spring: 1, vel: 0, section: 5 });
  }

  // Each section's camera focus = centre of its objects.
  root.updateMatrixWorld(true);
  for (let s = 0; s < tree.sections.length; s++) {
    const own = items.filter(it => it.section === s);
    if (!own.length) continue;
    const c = new THREE.Vector3(), w = new THREE.Vector3();
    own.forEach(it => c.add(it.body.getWorldPosition(w)));
    tree.sections[s].focus.copy(c.divideScalar(own.length));
  }
  const resumeItem = items.find(it => it.section === 5)!;
  const resumeFocus = resumeItem.body.getWorldPosition(new THREE.Vector3());

  let hovered: THREE.Object3D | null = null;
  return {
    root, pickables, resumeFocus,
    setHovered(obj: THREE.Object3D | null) { hovered = obj; },
    /** Springs, sway, and night glow. */
    update(time: number, dt: number, wind: number, night: number) {
      items.forEach(it => {
        let isHover = false; if (hovered) it.body.traverse(o => { if (o === hovered) isHover = true; });
        const target = isHover ? 1.18 : 1;
        it.vel += ((target - it.spring) * 160 - it.vel * 14) * dt; it.spring += it.vel * dt;
        it.body.scale.setScalar(it.spring * (it.body.userData.baseScale ??= it.body.scale.x));
        if (it.swing) { it.pivot.rotation.z = Math.sin(time * 1.3 + it.phase) * 0.07 * wind * it.swing; it.pivot.rotation.x = Math.sin(time * 0.9 + it.phase * 2) * 0.05 * wind * it.swing; }
      });
      jarBugs.forEach((b, k) => b.position.set(Math.sin(time * 1.7 + k * 2.3) * 0.12, Math.sin(time * 2.3 + k) * 0.17, Math.cos(time * 1.3 + k * 1.7) * 0.12));
      glow.forEach(g => { g.mat.emissiveIntensity = g.base * (0.55 + night * 1.25); });
    },
    pulse(obj: THREE.Object3D) { items.forEach(it => { let hit = false; it.body.traverse(o => { if (o === obj) hit = true; }); if (hit) it.vel -= 6; }); },
    dispose() { disposables.forEach(d => d.dispose()); },
  };
}
export type Objects = ReturnType<typeof buildObjects>;
