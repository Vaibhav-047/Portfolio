import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { windify, NOISE_GLSL } from './wind';

export function rng(seed: number) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

type Limb = { curve: THREE.CatmullRomCurve3; r0: number; r1: number; flex0: number; flex1: number; depth: number; section: number; length: number; flare?: number };
type Clump = { center: THREE.Vector3; radius: number; section: number; flex: number };
export type Segment = { a: THREE.Vector3; b: THREE.Vector3; r: number };
export type SectionBranch = { curve: THREE.CatmullRomCurve3; az: number; focus: THREE.Vector3; radius: (t: number) => number };

/** Foliage "seasons": each section's branch has its own palette, so the climb reads as a story. */
const SEASONS: string[][] = [
  ['#7fb24a', '#9cc95a', '#6aa13c', '#b6d877', '#88bd52'],           // About: spring
  ['#4f8a34', '#5f9a3b', '#3f7a2f', '#77a845', '#e0b648'],           // Skills: high summer, a few gold
  ['#5c9440', '#6fa548', '#f2a9c4', '#f7c6d6', '#4d8436'],           // Projects: in blossom
  ['#d98a3a', '#e7a94a', '#b85f2c', '#7c9a3f', '#efc25c'],           // Experience: autumn
  ['#3d6e4a', '#4b7f55', '#2f5d40', '#6b9c62', '#a5c77a'],           // Contact: deep evening green
];
const FILLER = ['#5a9a3e', '#6eaa46', '#4c8a36', '#88b950', '#d7b04a', '#e39a52'];

/** Dithered dissolve of geometry right in front of the lens, so the camera can fly through the canopy. */
const NEAR_DISSOLVE = (from: number, to: number, tunnel = false) => /* glsl */`#include <clipping_planes_fragment>
  { float keep = smoothstep(${from.toFixed(2)}, ${to.toFixed(2)}, length(vViewPosition));
    ${tunnel ? `// view tunnel: clear the line of sight from the lens to the focused object
    vec3 seg = uFocus - cameraPosition; float h = clamp(dot(vLeafWorld - cameraPosition, seg) / dot(seg, seg), 0.0, 1.0);
    float r = mix(0.6, 1.7, h) * smoothstep(1.0, 0.93, h);
    keep = min(keep, mix(1.0, smoothstep(r * 0.55, r, length(vLeafWorld - cameraPosition - seg * h)), uTunnel));` : ''}
    if (keep < 1.0 && fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) > keep) discard; }`;

function trunkRadius(t: number) { return THREE.MathUtils.lerp(1.08, 0.2, Math.pow(t, 0.75)); }

function tube(limb: Limb, radial: number, segs: number) {
  const frames = limb.curve.computeFrenetFrames(segs, false);
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], flex: number[] = [], idx: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, p = limb.curve.getPointAt(t), N = frames.normals[i], B = frames.binormals[i];
    let r = THREE.MathUtils.lerp(limb.r0, limb.r1, Math.pow(t, 0.85));
    if (limb.flare) r *= 1 + limb.flare * Math.exp(-t * 11);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      const nx = c * N.x + s * B.x, ny = c * N.y + s * B.y, nz = c * N.z + s * B.z;
      // gnarled silhouette: a few low-frequency bulges around the circumference
      const lump = limb.depth <= 1 ? 1 + 0.07 * Math.sin(a * 3 + t * 9 + limb.length) + 0.05 * Math.sin(a * 5 - t * 13) : 1;
      pos.push(p.x + nx * r * lump, p.y + ny * r * lump, p.z + nz * r * lump);
      nor.push(nx, ny, nz); uv.push(j / radial, t * limb.length * 0.42);
      flex.push(THREE.MathUtils.lerp(limb.flex0, limb.flex1, t));
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('barkUv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('flex', new THREE.Float32BufferAttribute(flex, 1));
  g.setIndex(idx);
  return g;
}

export function leafGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.bezierCurveTo(0.17, 0.07, 0.21, 0.33, 0, 0.6); s.bezierCurveTo(-0.21, 0.33, -0.17, 0.07, 0, 0);
  const g = new THREE.ShapeGeometry(s, 5);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, Math.abs(x) * 0.55 + y * y * 0.35); }
  g.computeVertexNormals();
  return g;
}

export function buildTree(leafBudget: number, castShadow: boolean) {
  const R = rng(11);
  const limbs: Limb[] = [], clumps: Clump[] = [], sections: SectionBranch[] = [];
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const trunkCurve = new THREE.CatmullRomCurve3([v(0, -0.8, 0), v(0.35, 2.6, 0.25), v(-0.3, 6.4, -0.3), v(0.3, 10.1, 0.18), v(-0.08, 13.4, -0.1), v(0.05, 15.4, 0.02)]);
  const trunk: Limb = { curve: trunkCurve, r0: 1.08, r1: 0.2, flex0: 0, flex1: 0.16, depth: 0, section: -1, length: 16, flare: 0.55 };
  limbs.push(trunk);
  const heightT = (h: number) => { let best = 0, bd = 1e9; for (let i = 0; i <= 200; i++) { const d = Math.abs(trunkCurve.getPointAt(i / 200).y - h); if (d < bd) { bd = d; best = i / 200; } } return best; };

  // Roots: arch out of the ground and dive back in.
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + R() * 0.35, len = 3.2 + R() * 2.6, w = (R() - 0.5) * 0.8;
    const dir = (k: number, y: number) => v(Math.cos(a + w * k) * k, y, Math.sin(a + w * k) * k);
    limbs.push({ curve: new THREE.CatmullRomCurve3([dir(0.35, 1.3), dir(1.25, 0.62), dir(len * 0.55, 0.18 + R() * 0.15), dir(len, -0.45)]), r0: 0.5, r1: 0.05, flex0: 0, flex1: 0, depth: 1, section: -1, length: len });
  }

  function grow(start: THREE.Vector3, dir: THREE.Vector3, len: number, r0: number, depth: number, section: number, flex0: number, maxDepth = 3) {
    const pts = [start.clone()], d = dir.clone().normalize(), p = start.clone();
    for (let k = 1; k <= 3; k++) {
      d.y += 0.12 + depth * 0.05; d.x += (R() - 0.5) * 0.35; d.z += (R() - 0.5) * 0.35; d.normalize();
      p.addScaledVector(d, len / 3); pts.push(p.clone());
    }
    const limb: Limb = { curve: new THREE.CatmullRomCurve3(pts), r0, r1: Math.max(0.025, r0 * 0.32), flex0, flex1: flex0 + 0.3 + depth * 0.16, depth, section, length: len };
    limbs.push(limb);
    const tip = limb.curve.getPointAt(1), tanTip = limb.curve.getTangentAt(1);
    if (depth >= 2) clumps.push({ center: tip.clone().addScaledVector(tanTip, 0.25), radius: (depth >= maxDepth ? 0.85 : 1.15) + R() * 0.35, section, flex: limb.flex1 });
    if (depth >= maxDepth) return limb;
    const kids = depth === 1 ? 4 : 3;
    for (let i = 0; i < kids; i++) {
      const t = 0.32 + 0.62 * ((i + R() * 0.7) / kids), at = limb.curve.getPointAt(t), tan = limb.curve.getTangentAt(t);
      const side = new THREE.Vector3().crossVectors(tan, v(0, 1, 0)).normalize().applyAxisAngle(tan, (i % 2 ? 1 : -1) * (0.6 + R() * 1.4));
      const childDir = tan.clone().multiplyScalar(0.55).add(side).add(v(0, 0.35, 0)).normalize();
      grow(at, childDir, len * (0.48 + R() * 0.14), THREE.MathUtils.lerp(r0, limb.r1, t) * 0.72, depth + 1, section, THREE.MathUtils.lerp(flex0, limb.flex1, t), maxDepth);
    }
    return limb;
  }

  // Five section branches spiralling up the trunk by the golden angle.
  const heights = [4.3, 6.4, 8.5, 10.5, 12.4];
  heights.forEach((h, i) => {
    const t = heightT(h), start = trunkCurve.getPointAt(t), az = 0.85 + i * 2.4;
    const limb = grow(start, v(Math.cos(az), 0.42, Math.sin(az)), 5.8 - i * 0.42, trunkRadius(t) * 0.62, 1, i, 0.04 + t * 0.14);
    const focus = limb.curve.getPointAt(0.78).add(v(0, -0.55, 0));
    sections.push({ curve: limb.curve, az, focus, radius: tt => THREE.MathUtils.lerp(limb.r0, limb.r1, Math.pow(tt, 0.85)) });
  });
  // Filler branches and the crown make the canopy full.
  for (let i = 0; i < 8; i++) {
    const h = 7.6 + i * 0.95 + R() * 0.4, t = heightT(h), az = 2.05 + i * 2.4 + (R() - 0.5) * 0.4;
    grow(trunkCurve.getPointAt(t), v(Math.cos(az), 0.75, Math.sin(az)), 3.6 - i * 0.12 + R() * 0.6, trunkRadius(t) * 0.55, 1, -1, 0.05 + t * 0.14, 3);
  }
  for (let i = 0; i < 4; i++) {
    const az = i * 1.57 + 0.4;
    grow(trunkCurve.getPointAt(0.97), v(Math.cos(az) * 0.6, 1, Math.sin(az) * 0.6), 2.8 + R() * 0.6, 0.18, 2, -1, 0.17, 3);
  }

  // Bark: merged tapered tubes, one draw call.
  const geo = mergeGeometries(limbs.map(l => tube(l, l.depth === 0 ? 18 : l.depth === 1 ? 11 : l.depth === 2 ? 7 : 5, l.depth === 0 ? 48 : l.depth === 1 ? 20 : 8)))!;
  const barkMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.92 });
  windify(barkMat, 'flex', 'vBarkUv = barkUv; vWorldN = normalize(mat3(modelMatrix) * objectNormal); vWorldY = wp.y;', shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 barkUv; varying vec2 vBarkUv; varying vec3 vWorldN; varying float vWorldY;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec2 vBarkUv; varying vec3 vWorldN; varying float vWorldY;\n${NOISE_GLSL}`)
      .replace('#include <clipping_planes_fragment>', NEAR_DISSOLVE(0.9, 2.2))
      .replace('#include <color_fragment>', /* glsl */`
        float n = vnoise(vec3(vBarkUv.x*9.0, vBarkUv.y*3.0, 0.0));
        float ridge = smoothstep(0.15, 0.85, abs(sin(vBarkUv.x*6.2831*6.0 + n*3.5 + vBarkUv.y*0.6)));
        vec3 bark = mix(vec3(0.075,0.045,0.028), vec3(0.24,0.15,0.09), ridge*0.75 + n*0.25);
        float moss = smoothstep(0.35, 0.95, vWorldN.y) * (0.55 + 0.45*vnoise(vec3(vBarkUv*4.0, 2.0)));
        bark = mix(bark, vec3(0.16,0.25,0.07), moss*0.75);
        bark *= mix(0.55, 1.0, smoothstep(-0.4, 2.0, vWorldY));
        diffuseColor.rgb = bark;`);
  });
  const bark = new THREE.Mesh(geo, barkMat);
  bark.castShadow = castShadow; bark.receiveShadow = true;

  // Leaves: instanced, one draw call. Distributed over clumps by area.
  const leafGeo = leafGeometry();
  const totalArea = clumps.reduce((s, c) => s + c.radius * c.radius, 0);
  const counts = clumps.map(c => Math.max(6, Math.round((leafBudget * c.radius * c.radius) / totalArea)));
  const count = counts.reduce((a, b) => a + b, 0);
  const leafMat = new THREE.MeshStandardMaterial({ roughness: 0.72, side: THREE.DoubleSide });
  windify(leafMat, 'aFlex', /* glsl */`
    float ph = dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719));
    wp.xyz += normalize(mat3(instanceMatrix) * vec3(0.0, 0.0, 1.0)) * sin(uTime*7.0 + ph) * 0.05 * position.y * uWind;
    vLeafWorld = wp.xyz;`, shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLeafWorld;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uSunDirView; uniform vec3 uSunColor; uniform vec3 uFocus; uniform float uTunnel; varying vec3 vLeafWorld;')
      .replace('#include <clipping_planes_fragment>', NEAR_DISSOLVE(1.8, 4.2, true))
      .replace('#include <emissivemap_fragment>', /* glsl */`#include <emissivemap_fragment>
        float backlit = pow(max(dot(-normalize(vViewPosition), uSunDirView), 0.0), 3.0);
        totalEmissiveRadiance += diffuseColor.rgb * uSunColor * (0.12 + backlit * 0.9);`);
  });
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, count);
  leaves.castShadow = castShadow; leaves.receiveShadow = true;
  const flexArr = new Float32Array(count), leafSection = new Int8Array(count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), twist = new THREE.Quaternion(), s = new THREE.Vector3(), col = new THREE.Color(), up = v(0, 1, 0), out = new THREE.Vector3(), pos = new THREE.Vector3();
  let k = 0;
  clumps.forEach((c, ci) => {
    const palette = c.section >= 0 ? SEASONS[c.section] : FILLER;
    for (let i = 0; i < counts[ci]; i++, k++) {
      out.set(R() * 2 - 1, R() * 2 - 1, R() * 2 - 1).normalize();
      const depth = 0.5 + 0.5 * Math.sqrt(R());
      pos.copy(c.center).addScaledVector(out, c.radius * depth); pos.y = c.center.y + (pos.y - c.center.y) * 0.72;
      out.y += 0.35; out.normalize();
      q.setFromUnitVectors(up, out); twist.setFromAxisAngle(up, R() * Math.PI * 2); q.multiply(twist);
      const sc = 0.75 + R() * 0.55 * depth; s.set(sc, sc, sc);
      m.compose(pos, q, s); leaves.setMatrixAt(k, m);
      // outer leaves catch more light; a pinch of each palette's accent
      col.set(palette[Math.floor(R() * palette.length)]).multiplyScalar(0.78 + depth * 0.32);
      leaves.setColorAt(k, col);
      flexArr[k] = c.flex + 0.18 * depth; leafSection[k] = c.section;
    }
  });
  leafGeo.setAttribute('aFlex', new THREE.InstancedBufferAttribute(flexArr, 1));
  leaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  // Thick limbs for falling-leaf collisions.
  const segments: Segment[] = [];
  limbs.filter(l => l.depth <= 1 && l.flex1 > 0).forEach(l => {
    for (let i = 0; i < 4; i++) {
      const t0 = i / 4, t1 = (i + 1) / 4;
      segments.push({ a: l.curve.getPointAt(t0), b: l.curve.getPointAt(t1), r: THREE.MathUtils.lerp(l.r0, l.r1, t0 + 0.125) });
    }
  });

  return { bark, leaves, leafSection, sections, segments, trunkCurve, heightT, trunkRadius, clumps };
}
export type Tree = ReturnType<typeof buildTree>;
