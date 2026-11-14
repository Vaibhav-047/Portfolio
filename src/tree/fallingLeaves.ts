import * as THREE from 'three';
import { leafGeometry } from './tree';
import type { Tree } from './tree';

const FREE = 0, FALLING = 1, SETTLED = 2, FADING = 3;
const WIND_DIR = new THREE.Vector3(1, 0, 0.45).normalize();

/**
 * Leaves that break off the canopy and fall with cheap hand-rolled physics:
 * pendulum flutter, drag toward the wind, spin, landing on the ground and thick limbs,
 * then settling, and either fading or being blown away. The canopy slot regrows later.
 */
export function createFallingLeaves(tree: Tree, max: number) {
  const geo = leafGeometry();
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.7, side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(geo, mat, max);
  mesh.frustumCulled = false; mesh.castShadow = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const color = new THREE.Color();
  for (let i = 0; i < max; i++) mesh.setColorAt(i, color.set('#7fb24a'));

  const P = new Float32Array(max * 3), V = new Float32Array(max * 3), mode = new Uint8Array(max), canLand = new Uint8Array(max);
  const timer = new Float32Array(max), age = new Float32Array(max), ph = new Float32Array(max), freq = new Float32Array(max), spin = new Float32Array(max);
  const yaw = new Float32Array(max), size = new Float32Array(max), fade = new Float32Array(max), flatTilt = new Float32Array(max);

  // Canopy bookkeeping: original matrices so detached slots can regrow.
  const canopy = tree.leaves, base = Float32Array.from(canopy.instanceMatrix.array), canopyCount = canopy.count;
  const detachedUntil = new Float32Array(canopyCount), regrow: number[] = [];
  const bySection: number[][] = [[], [], [], [], [], []];
  for (let i = 0; i < canopyCount; i++) bySection[tree.leafSection[i] + 1].push(i);

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pos = new THREE.Vector3(), sc = new THREE.Vector3(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3();
  let cursor = 0, now = 0;
  const lands: THREE.Vector3[] = [];

  function freeSlot() { for (let k = 0; k < max; k++) { const i = (cursor + k) % max; if (mode[i] === FREE) { cursor = i + 1; return i; } } return -1; }

  /** Detach one canopy leaf (from a section, or anywhere with section = -2) and start it falling. */
  function detach(section: number, impulse = 0) {
    const list = section >= -1 ? bySection[section + 1] : null;
    let idx = -1;
    for (let tries = 0; tries < 8 && idx < 0; tries++) {
      const pick = list && list.length ? list[(Math.random() * list.length) | 0] : (Math.random() * canopyCount) | 0;
      if (detachedUntil[pick] === 0) idx = pick;
    }
    const i = freeSlot(); if (idx < 0 || i < 0) return;
    m.fromArray(base, idx * 16); m.decompose(pos, q, sc);
    canopy.setMatrixAt(idx, zero); canopy.instanceMatrix.addUpdateRange(idx * 16, 16); canopy.instanceMatrix.needsUpdate = true;
    detachedUntil[idx] = now + 9 + Math.random() * 10; regrow.push(idx);
    if (canopy.instanceColor) { color.fromArray(canopy.instanceColor.array, idx * 3); mesh.setColorAt(i, color); mesh.instanceColor!.needsUpdate = true; }
    P[i * 3] = pos.x; P[i * 3 + 1] = pos.y; P[i * 3 + 2] = pos.z;
    const out = tmpA.set(pos.x, 0, pos.z).normalize();
    V[i * 3] = out.x * impulse + (Math.random() - 0.5) * impulse; V[i * 3 + 1] = impulse * (0.4 + Math.random() * 0.6); V[i * 3 + 2] = out.z * impulse + (Math.random() - 0.5) * impulse;
    mode[i] = FALLING; canLand[i] = 1; age[i] = 0; fade[i] = 1;
    ph[i] = Math.random() * 6.28; freq[i] = 2 + Math.random() * 1.4; spin[i] = (Math.random() - 0.5) * 3; yaw[i] = Math.random() * 6.28;
    size[i] = sc.x * (0.9 + Math.random() * 0.2); flatTilt[i] = (Math.random() - 0.5) * 0.5;
  }

  function settle(i: number, seconds: number) { mode[i] = SETTLED; timer[i] = seconds; V[i * 3] = V[i * 3 + 1] = V[i * 3 + 2] = 0; lands.push(new THREE.Vector3(P[i * 3], P[i * 3 + 1], P[i * 3 + 2])); }

  function update(dt: number, time: number, wind: number, pointer: THREE.Vector3, pointerOn: boolean) {
    now = time; lands.length = 0;
    const gust = 0.6 + 0.4 * Math.sin(time * 0.37) * Math.sin(time * 0.21 + 1.3);
    const wx = WIND_DIR.x * wind * gust * 0.9, wz = WIND_DIR.z * wind * gust * 0.9;
    for (let i = 0; i < max; i++) {
      const md = mode[i];
      if (md === FREE) { mesh.setMatrixAt(i, zero); continue; }
      const o = i * 3;
      age[i] += dt;
      if (md === FALLING) {
        const sw = Math.sin(time * freq[i] + ph[i]);
        V[o] += (wx + Math.cos(time * freq[i] + ph[i]) * 1.15 - V[o]) * 1.3 * dt;
        V[o + 2] += (wz + Math.sin(time * freq[i] * 0.7 + ph[i]) * 0.8 - V[o + 2]) * 1.3 * dt;
        V[o + 1] += (-(0.5 + 0.55 * Math.abs(sw)) - V[o + 1]) * 2.2 * dt; // drag: slower at the top of each swing
        if (pointerOn) {
          const dx = P[o] - pointer.x, dy = P[o + 1] - pointer.y, dz = P[o + 2] - pointer.z, d = Math.hypot(dx, dy, dz);
          if (d < 1.6 && d > 1e-3) { const f = (1.6 - d) * 5 * dt / d; V[o] += dx * f; V[o + 1] += dy * f; V[o + 2] += dz * f; }
        }
        P[o] += V[o] * dt; P[o + 1] += V[o + 1] * dt; P[o + 2] += V[o + 2] * dt;
        yaw[i] += spin[i] * dt;
        if (canLand[i] && age[i] > 0.35) {
          if (P[o + 1] <= 0.04) { P[o + 1] = 0.04; settle(i, 2.5 + Math.random() * 3.5); }
          else if (V[o + 1] < 0) for (const s of tree.segments) {
            tmpA.set(P[o], P[o + 1], P[o + 2]);
            tmpB.subVectors(s.b, s.a); const t = THREE.MathUtils.clamp(tmpC.subVectors(tmpA, s.a).dot(tmpB) / tmpB.lengthSq(), 0, 1);
            tmpC.copy(s.a).addScaledVector(tmpB, t); tmpA.sub(tmpC);
            const d = tmpA.length();
            if (d < s.r + 0.05 && tmpA.y > 0) { tmpA.multiplyScalar((s.r + 0.03) / Math.max(d, 1e-3)).add(tmpC); P[o] = tmpA.x; P[o + 1] = tmpA.y; P[o + 2] = tmpA.z; settle(i, 1.4 + Math.random() * 2.2); break; }
          }
        }
        if (P[o + 1] < -2 || age[i] > 30 || Math.abs(P[o]) > 60 || Math.abs(P[o + 2]) > 60) mode[i] = FREE;
        e.set(Math.cos(time * freq[i] * 0.5 + ph[i]) * 0.7, yaw[i], sw * 0.95);
      } else if (md === SETTLED) {
        timer[i] -= dt;
        // a breeze lifts the edge of a resting leaf
        e.set(-Math.PI / 2 + flatTilt[i] + Math.sin(time * 3 + ph[i]) * 0.06 * wind, yaw[i], flatTilt[i] * 0.5);
        if (timer[i] <= 0) {
          if (Math.random() < 0.4) { mode[i] = FALLING; canLand[i] = 0; age[i] = 20; V[o] = wx * 2.2; V[o + 1] = 0.9; V[o + 2] = wz * 2.2; }
          else mode[i] = FADING;
        }
      } else {
        fade[i] -= dt * 1.4; e.set(-Math.PI / 2 + flatTilt[i], yaw[i], 0);
        if (fade[i] <= 0) { mode[i] = FREE; mesh.setMatrixAt(i, zero); continue; }
      }
      q.setFromEuler(e); pos.set(P[o], P[o + 1], P[o + 2]); const s = size[i] * fade[i]; sc.set(s, s, s);
      mesh.setMatrixAt(i, m.compose(pos, q, sc));
    }
    mesh.instanceMatrix.needsUpdate = true;

    // Regrow: detached canopy slots grow back in over ~1.2s.
    let dirty = false;
    for (let k = regrow.length - 1; k >= 0; k--) {
      const idx = regrow[k], t = now - detachedUntil[idx];
      if (t < 0) continue;
      const g = Math.min(1, t / 1.2), eased = 1 - Math.pow(1 - g, 3);
      m.fromArray(base, idx * 16).decompose(pos, q, sc); sc.multiplyScalar(Math.max(0.001, eased));
      canopy.setMatrixAt(idx, m.compose(pos, q, sc)); canopy.instanceMatrix.addUpdateRange(idx * 16, 16); dirty = true;
      if (g >= 1) { detachedUntil[idx] = 0; regrow.splice(k, 1); }
    }
    if (dirty) canopy.instanceMatrix.needsUpdate = true;
    return lands;
  }

  function reset() { mode.fill(FREE); for (const idx of regrow) canopy.setMatrixAt(idx, m.fromArray(base, idx * 16)); regrow.length = 0; detachedUntil.fill(0); canopy.instanceMatrix.needsUpdate = true; }

  return { mesh, detach, update, reset, dispose() { geo.dispose(); mat.dispose(); mesh.dispose(); } };
}

/** Tiny additive sparkles where a leaf lands. */
export function createSparkles(max: number) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 3), life = new Float32Array(max), seed = new Float32Array(max);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aLife', new THREE.BufferAttribute(life, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  for (let i = 0; i < max; i++) seed[i] = Math.random();
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uScale: { value: innerHeight * 0.5 } },
    vertexShader: /* glsl */`attribute float aLife; attribute float aSeed; varying float vLife; uniform float uScale;
      void main(){ vLife = aLife; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = (aLife > 0.0 ? (0.05 + 0.07 * aSeed) * sin(aLife * 3.14159) : 0.0) * uScale / -mv.z; }`,
    fragmentShader: /* glsl */`varying float vLife;
      void main(){ vec2 p = gl_PointCoord - 0.5; float d = length(p);
        float star = max(0.0, 1.0 - abs(p.x) * 9.0) * max(0.0, 1.0 - abs(p.y) * 2.2) + max(0.0, 1.0 - abs(p.y) * 9.0) * max(0.0, 1.0 - abs(p.x) * 2.2);
        float a = (smoothstep(0.5, 0.0, d) * 0.6 + star) * vLife;
        gl_FragColor = vec4(vec3(1.0, 0.92, 0.6) * a * 2.0, a); }`,
  });
  const points = new THREE.Points(geo, mat); points.frustumCulled = false;
  const vel = new Float32Array(max * 3); let cursor = 0;
  return {
    points,
    spawn(at: THREE.Vector3, n = 5) {
      for (let k = 0; k < n; k++) {
        const i = cursor++ % max; pos[i * 3] = at.x; pos[i * 3 + 1] = at.y + 0.05; pos[i * 3 + 2] = at.z; life[i] = 1;
        vel[i * 3] = (Math.random() - 0.5) * 0.8; vel[i * 3 + 1] = 0.4 + Math.random() * 0.7; vel[i * 3 + 2] = (Math.random() - 0.5) * 0.8;
      }
    },
    /** pxPerUnit = drawing-buffer height / (2·tan(fov/2)), so sizes are in world units. */
    update(dt: number, pxPerUnit: number) {
      for (let i = 0; i < max; i++) if (life[i] > 0) { life[i] = Math.max(0, life[i] - dt * 1.3); pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt; }
      geo.attributes.position.needsUpdate = true; geo.attributes.aLife.needsUpdate = true;
      mat.uniforms.uScale.value = pxPerUnit;
    },
    dispose() { geo.dispose(); mat.dispose(); },
  };
}
