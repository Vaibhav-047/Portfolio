import * as THREE from 'three';
import { NOISE_GLSL, windify, windUniforms } from './wind';
import type { TierSettings } from './quality';

/** One palette per scroll stop: dawn at the roots → day → golden hour → dusk at Contact → night in the canopy. */
const PALETTES = [
  { top: '#8a93c9', horizon: '#ffc29a', bottom: '#e7b394', fog: '#efc4a4', sun: '#ffb987', sunI: 2.4, el: 0.1, sky: '#ffd8bd', ground: '#4b4532', hemi: 1.0, night: 0, exposure: 1.0 },
  { top: '#6f9ad8', horizon: '#f6dcc0', bottom: '#d9d2c0', fog: '#e6d9c4', sun: '#ffe2b8', sunI: 3.0, el: 0.35, sky: '#ffeedd', ground: '#4a5530', hemi: 1.15, night: 0, exposure: 1.0 },
  { top: '#4f86d1', horizon: '#cfe6f2', bottom: '#b9cdd6', fog: '#cfe0e6', sun: '#fff4e0', sunI: 3.4, el: 0.72, sky: '#e3f1ff', ground: '#4d5c30', hemi: 1.3, night: 0, exposure: 0.98 },
  { top: '#5e86c8', horizon: '#ffd9a6', bottom: '#e6c39e', fog: '#f2d2a8', sun: '#ffd08a', sunI: 3.2, el: 0.36, sky: '#fff0d8', ground: '#55552f', hemi: 1.15, night: 0, exposure: 1.0 },
  { top: '#55609f', horizon: '#ffae6e', bottom: '#d98e6a', fog: '#f0a77a', sun: '#ffa45c', sunI: 2.7, el: 0.12, sky: '#ffd0a8', ground: '#4f4030', hemi: 1.0, night: 0.1, exposure: 1.05 },
  { top: '#1d2258', horizon: '#e5765e', bottom: '#4a3050', fog: '#5b3a5a', sun: '#ff7a4a', sunI: 1.1, el: 0.02, sky: '#8a7bc4', ground: '#2a2530', hemi: 0.6, night: 0.75, exposure: 1.18 },
  { top: '#0a1035', horizon: '#2b2a62', bottom: '#141a36', fog: '#1a2042', sun: '#9db3ff', sunI: 0.55, el: 0.5, sky: '#5a6bb0', ground: '#151828', hemi: 0.42, night: 1, exposure: 1.38 },
  { top: '#050a24', horizon: '#1e2556', bottom: '#0d1230', fog: '#131a38', sun: '#8ea6ff', sunI: 0.5, el: 0.55, sky: '#4e5fa6', ground: '#11141f', hemi: 0.38, night: 1, exposure: 1.42 },
].map(p => ({ ...p, c: Object.fromEntries((['top', 'horizon', 'bottom', 'fog', 'sun', 'sky', 'ground'] as const).map(k => [k, new THREE.Color(p[k])])) as Record<'top' | 'horizon' | 'bottom' | 'fog' | 'sun' | 'sky' | 'ground', THREE.Color> }));

export type Daylight = { sunDir: THREE.Vector3; sunColor: THREE.Color; night: number; exposure: number; fog: THREE.Color };

export function createAtmosphere(scene: THREE.Scene, q: TierSettings, reduced: boolean) {
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => { disposables.push(x); return x; };
  const fog = new THREE.Fog('#efc4a4', 28, 230); scene.fog = fog;

  // Sky dome: gradient, sun and moon, drifting clouds, twinkling stars.
  const skyU = {
    uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uBottom: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunColor: { value: new THREE.Color() }, uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
    uNight: { value: 0 }, uTime: { value: 0 },
  };
  const sky = new THREE.Mesh(keep(new THREE.SphereGeometry(320, 48, 24)), keep(new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: /* glsl */`varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uTop, uHorizon, uBottom, uSunDir, uSunColor, uMoonDir; uniform float uNight, uTime; varying vec3 vDir;
      ${NOISE_GLSL}
      float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }
      void main(){
        vec3 d = normalize(vDir); float h = d.y;
        vec3 col = mix(uHorizon, uTop, pow(smoothstep(-0.02, 0.62, h), 0.75));
        col = mix(col, uBottom, smoothstep(0.0, -0.3, h));
        float sd = max(dot(d, uSunDir), 0.0), day = 1.0 - uNight;
        col += uSunColor * (pow(sd, 1400.0) * 30.0 + pow(sd, 18.0) * 0.45 + pow(sd, 3.0) * 0.18) * day;
        vec2 uv = d.xz / (max(h, 0.0) + 0.22);
        float c = fbm(vec3(uv * 0.9 + vec2(uTime * 0.012, 0.0), uTime * 0.01));
        float cl = smoothstep(0.52, 0.82, c) * smoothstep(0.0, 0.22, h);
        vec3 cloud = mix(mix(uHorizon, vec3(1.0), 0.35) + uSunColor * 0.25 * pow(sd, 4.0), uTop * 0.6 + vec3(0.03, 0.03, 0.06), uNight * 0.8);
        col = mix(col, cloud, cl * 0.8);
        vec3 sp = d * 260.0, cell = floor(sp); float r = hash1(cell);
        float star = step(0.9972, r) * smoothstep(0.42, 0.0, length(fract(sp) - 0.5)) * (0.55 + 0.45 * sin(uTime * 1.7 + r * 90.0));
        col += vec3(0.9, 0.95, 1.0) * star * 2.2 * uNight * smoothstep(0.02, 0.25, h) * (1.0 - cl);
        float md = max(dot(d, uMoonDir), 0.0);
        col += vec3(0.85, 0.9, 1.0) * (smoothstep(0.99935, 0.99965, md) * 2.5 + pow(md, 80.0) * 0.25) * uNight;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })));
  sky.frustumCulled = false; sky.renderOrder = -1;
  scene.add(sky);

  // Ground: flat where leaves land, rolling further out, painted with soft patches.
  const groundGeo = keep(new THREE.CircleGeometry(240, 160, 0, Math.PI * 2).rotateX(-Math.PI / 2));
  {
    const p = groundGeo.attributes.position as THREE.BufferAttribute, col: number[] = [], c = new THREE.Color(), a = new THREE.Color('#3f5a23'), b = new THREE.Color('#6d8a35'), dirt = new THREE.Color('#4a3a25');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z);
      const n = Math.sin(x * 0.13) * Math.cos(z * 0.11) + Math.sin(x * 0.041 + z * 0.057) * 1.4;
      p.setY(i, r > 26 ? (r - 26) * 0.02 * (1.4 + n) : 0);
      c.copy(a).lerp(b, 0.5 + n * 0.25).lerp(dirt, Math.max(0, 1 - r / 3.5) * 0.8);
      col.push(c.r, c.g, c.b);
    }
    groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); groundGeo.computeVertexNormals();
  }
  const ground = new THREE.Mesh(groundGeo, keep(new THREE.MeshLambertMaterial({ vertexColors: true })));
  ground.receiveShadow = true; scene.add(ground);

  // Distant hills and a forest silhouette, tinted by the fog each frame.
  const hillMats: { mat: THREE.MeshBasicMaterial; k: number }[] = [];
  [[78, 7, 0.55], [118, 13, 0.38], [165, 24, 0.22]].forEach(([R, H, k], layer) => {
    const N = 220, pos: number[] = [], idx: number[] = [];
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2, hgt = H * (0.55 + 0.25 * Math.sin(a * 3 + layer) + 0.15 * Math.sin(a * 7.3 + layer * 2) + 0.08 * Math.sin(a * 17 + layer));
      pos.push(Math.cos(a) * R, -3, Math.sin(a) * R, Math.cos(a) * R, hgt, Math.sin(a) * R);
      if (i < N) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const g = keep(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    const mat = keep(new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, fog: false }));
    hillMats.push({ mat, k }); scene.add(new THREE.Mesh(g, mat));
  });
  {
    const cone = keep(new THREE.ConeGeometry(1.6, 7, 6).translate(0, 3.5, 0)), mat = keep(new THREE.MeshBasicMaterial({ fog: false }));
    const n = 260, forest = new THREE.InstancedMesh(cone, mat, n), m = new THREE.Matrix4(), s = new THREE.Vector3(), qq = new THREE.Quaternion(), p = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, R = 66 + Math.random() * 10, sc = 0.7 + Math.random() * 1.1;
      p.set(Math.cos(a) * R, -0.5, Math.sin(a) * R); s.set(sc, sc * (0.8 + Math.random() * 0.6), sc);
      forest.setMatrixAt(i, m.compose(p, qq, s));
    }
    hillMats.push({ mat, k: 0.72 }); scene.add(forest);
  }

  // Grass: instanced curved blades with wind and a cursor bow-wave.
  const blade = new THREE.BufferGeometry();
  {
    const seg = 4, pos: number[] = [], flex: number[] = [], col: number[] = [], idx: number[] = [];
    for (let i = 0; i <= seg; i++) {
      const t = i / seg, w = 0.055 * (1 - t * 0.92), bend = t * t * 0.25;
      pos.push(-w, t, bend, w, t, bend); flex.push(t * t * 1.4, t * t * 1.4);
      const g = 0.35 + t * 0.65; col.push(0.22 * g, 0.36 * g, 0.12 * g, 0.24 * g, 0.38 * g, 0.12 * g);
      if (i < seg) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    blade.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); blade.setAttribute('gflex', new THREE.Float32BufferAttribute(flex, 1));
    blade.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); blade.setIndex(idx); blade.computeVertexNormals();
    keep(blade);
  }
  const grassMat = keep(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  windify(grassMat, 'gflex', /* glsl */`
    vec3 gd = wp.xyz - uGroundPointer; gd.y = 0.0; float gl = length(gd);
    wp.xz += gd.xz / (gl + 1e-3) * smoothstep(1.4, 0.0, gl) * fl * 0.55 * uGroundPointerOn;`, shader => {
    shader.uniforms.uGroundPointer = groundPointer; shader.uniforms.uGroundPointerOn = groundPointerOn;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform vec3 uGroundPointer; uniform float uGroundPointerOn;');
  });
  const groundPointer = { value: new THREE.Vector3(0, -50, 0) }, groundPointerOn = { value: 0 };
  const grass = new THREE.InstancedMesh(blade, grassMat, q.grass);
  {
    const m = new THREE.Matrix4(), p = new THREE.Vector3(), qq = new THREE.Quaternion(), s = new THREE.Vector3(), c = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < q.grass; i++) {
      const a = Math.random() * Math.PI * 2, r = 1.6 + Math.pow(Math.random(), 0.7) * 24;
      p.set(Math.cos(a) * r, 0, Math.sin(a) * r); qq.setFromAxisAngle(up, Math.random() * Math.PI * 2);
      const hgt = 0.35 + Math.random() * 0.55 * (r < 6 ? 0.6 : 1); s.set(1, hgt, 1);
      grass.setMatrixAt(i, m.compose(p, qq, s));
      grass.setColorAt(i, c.setHSL(0.22 + Math.random() * 0.06, 0.55, 0.45 + Math.random() * 0.25 + (Math.random() < 0.04 ? 0.25 : 0)));
    }
  }
  grass.receiveShadow = true; scene.add(grass);

  // Fireflies (bright at night, a few by day) and pollen motes drifting in the light.
  const ff = q.fireflies, ffPos = new Float32Array(ff * 3), ffHome = new Float32Array(ff * 3), ffSeed = new Float32Array(ff);
  for (let i = 0; i < ff; i++) {
    const a = Math.random() * Math.PI * 2, r = 1.5 + Math.random() * 9, y = 0.4 + Math.pow(Math.random(), 1.3) * 14;
    ffHome[i * 3] = Math.cos(a) * r; ffHome[i * 3 + 1] = y; ffHome[i * 3 + 2] = Math.sin(a) * r; ffSeed[i] = Math.random();
  }
  ffPos.set(ffHome);
  const ffGeo = keep(new THREE.BufferGeometry());
  ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3).setUsage(THREE.DynamicDrawUsage)); ffGeo.setAttribute('aSeed', new THREE.BufferAttribute(ffSeed, 1));
  const ffU = { uTime: { value: 0 }, uNight: { value: 0 }, uScale: { value: 500 } };
  const fireflies = new THREE.Points(ffGeo, keep(new THREE.ShaderMaterial({
    uniforms: ffU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`attribute float aSeed; uniform float uTime, uNight, uScale; varying float vA;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        float blink = pow(0.5 + 0.5 * sin(uTime * (1.2 + aSeed * 1.8) + aSeed * 40.0), 3.0);
        vA = blink * mix(aSeed < 0.25 ? 0.5 : 0.0, 1.0, uNight);
        gl_PointSize = (0.07 + 0.06 * aSeed) * uScale / -mv.z * (0.6 + 0.4 * blink); }`,
    fragmentShader: /* glsl */`varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = (smoothstep(0.5, 0.0, d) * 0.5 + smoothstep(0.16, 0.0, d)) * vA; gl_FragColor = vec4(vec3(1.0, 0.95, 0.45) * a * 2.5, a); }`,
  })));
  fireflies.frustumCulled = false; scene.add(fireflies);

  const pn = q.pollen, pPos = new Float32Array(pn * 3), pSeed = new Float32Array(pn);
  for (let i = 0; i < pn; i++) { pPos[i * 3] = Math.random() * 16; pPos[i * 3 + 1] = Math.random() * 10; pPos[i * 3 + 2] = Math.random() * 16; pSeed[i] = Math.random(); }
  const pGeo = keep(new THREE.BufferGeometry()); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('aSeed', new THREE.BufferAttribute(pSeed, 1));
  const pU = { uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uScale: { value: 500 }, uDay: { value: 1 }, uColor: { value: new THREE.Color('#fff1c8') } };
  const pollen = new THREE.Points(pGeo, keep(new THREE.ShaderMaterial({
    uniforms: pU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`attribute float aSeed; uniform float uTime, uScale, uDay; uniform vec3 uCenter; varying float vA;
      void main(){ vec3 box = vec3(16.0, 10.0, 16.0);
        vec3 p = position + vec3(sin(uTime * 0.3 + aSeed * 20.0) * 0.6 + uTime * 0.25, sin(uTime * 0.21 + aSeed * 11.0) * 0.5 + uTime * 0.06, cos(uTime * 0.27 + aSeed * 7.0) * 0.6);
        p = mod(p - uCenter + box * 0.5, box) + uCenter - box * 0.5;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        vA = (0.25 + 0.75 * aSeed) * mix(0.25, 1.0, uDay) * smoothstep(0.5, 2.5, -mv.z);
        gl_PointSize = (0.025 + 0.03 * aSeed) * uScale / -mv.z; }`,
    fragmentShader: /* glsl */`uniform vec3 uColor; varying float vA; void main(){ float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5)) * vA * 0.7; gl_FragColor = vec4(uColor * a, a); }`,
  })));
  pollen.frustumCulled = false; scene.add(pollen);

  // Butterflies: two flapping wings on looping paths. Birds: a small flock crossing the sky now and then.
  const wingShape = new THREE.Shape(); wingShape.moveTo(0, 0); wingShape.bezierCurveTo(0.12, 0.18, 0.36, 0.2, 0.32, 0.02); wingShape.bezierCurveTo(0.34, -0.14, 0.12, -0.16, 0, 0);
  const wingGeo = keep(new THREE.ShapeGeometry(wingShape, 6));
  const butterflies = ['#f6b54d', '#8fc0ff', '#f5a3c4'].map((color, i) => {
    const mat = keep(new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.25, side: THREE.DoubleSide, roughness: 0.6 }));
    const g = new THREE.Group(), l = new THREE.Mesh(wingGeo, mat), r = new THREE.Mesh(wingGeo, mat); r.scale.x = -1;
    g.add(l, r); g.scale.setScalar(0.7); scene.add(g);
    return { g, l, r, seed: i * 2.1, h: 3 + i * 3.5, rad: 4.5 + i * 1.6 };
  });
  const birdGeo = keep(new THREE.BufferGeometry());
  birdGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -1, 0.25, -0.35, 0, 0, -0.25, 0, 0, 0, 1, 0.25, -0.35, 0, 0, -0.25], 3));
  const birdMat = keep(new THREE.MeshBasicMaterial({ color: '#2a2633', side: THREE.DoubleSide, fog: false }));
  const birds = new THREE.Group(); scene.add(birds);
  const birdList = Array.from({ length: 7 }, (_, i) => { const b = new THREE.Mesh(birdGeo, birdMat); b.position.set((i % 2 ? 1 : -1) * Math.ceil(i / 2) * 1.6, Math.ceil(i / 2) * -0.4, Math.ceil(i / 2) * -1.8); birds.add(b); return b; });
  birds.visible = false;
  let birdT = 6;

  const sunDir = new THREE.Vector3(), moonDir = new THREE.Vector3(), keyDir = new THREE.Vector3(), tmpC = new THREE.Color();
  const day: Daylight = { sunDir, sunColor: new THREE.Color(), night: 0, exposure: 1, fog: fog.color };
  const pick = (k: 'top' | 'horizon' | 'bottom' | 'fog' | 'sun' | 'sky' | 'ground', a: number, b: number, f: number, out: THREE.Color) => out.copy(PALETTES[a].c[k]).lerp(PALETTES[b].c[k], f);

  return {
    sky, ground, grass, groundPointer, groundPointerOn, day,
    /** tod: stop index + eased progress (0..7). */
    update(tod: number, dt: number, time: number, sun: THREE.DirectionalLight, hemi: THREE.HemisphereLight, center: THREE.Vector3, pointer: THREE.Vector3 | null, pxPerUnit: number) {
      const a = Math.min(Math.floor(tod), PALETTES.length - 1), b = Math.min(a + 1, PALETTES.length - 1), f = THREE.MathUtils.smoothstep(tod - a, 0, 1);
      const A = PALETTES[a], B = PALETTES[b], L = (x: number, y: number) => x + (y - x) * f;
      pick('top', a, b, f, skyU.uTop.value); pick('horizon', a, b, f, skyU.uHorizon.value); pick('bottom', a, b, f, skyU.uBottom.value);
      pick('fog', a, b, f, fog.color); pick('sun', a, b, f, day.sunColor);
      day.night = L(A.night, B.night); day.exposure = L(A.exposure, B.exposure);
      const el = L(A.el, B.el), az = 4.05 + tod * 0.32;
      sunDir.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
      moonDir.set(Math.cos(az + 0.9) * 0.8, 0.55, Math.sin(az + 0.9) * 0.8).normalize();
      skyU.uSunDir.value.copy(sunDir); skyU.uMoonDir.value.copy(moonDir); skyU.uSunColor.value.copy(day.sunColor); skyU.uNight.value = day.night; skyU.uTime.value = time;
      // Key light follows the sun by day and the moon by night.
      const lightDir = keyDir.copy(sunDir).lerp(moonDir, THREE.MathUtils.smoothstep(day.night, 0.5, 1)).normalize();
      sun.position.copy(sun.target.position).addScaledVector(lightDir, 40); sun.color.copy(day.sunColor); sun.intensity = L(A.sunI, B.sunI);
      pick('sky', a, b, f, hemi.color); pick('ground', a, b, f, hemi.groundColor); hemi.intensity = L(A.hemi, B.hemi);
      fog.near = THREE.MathUtils.lerp(28, 18, day.night); fog.far = THREE.MathUtils.lerp(230, 140, day.night);
      // silhouettes are always a step darker than the air in front of them, faintly green by day
      hillMats.forEach(h => h.mat.color.copy(fog.color).multiplyScalar(1 - h.k * 0.62).add(tmpC.setRGB(0.012, 0.03, 0.006).multiplyScalar(h.k * (1 - day.night))));
      windUniforms.uSunColor.value.copy(day.sunColor).multiplyScalar(1 - day.night * 0.7);

      ffU.uTime.value = time; ffU.uNight.value = day.night; ffU.uScale.value = pxPerUnit;
      for (let i = 0; i < ff; i++) {
        const o = i * 3, s = ffSeed[i];
        let x = ffHome[o] + Math.sin(time * 0.3 + s * 30) * 1.2, y = ffHome[o + 1] + Math.sin(time * 0.45 + s * 17) * 0.6, z = ffHome[o + 2] + Math.cos(time * 0.27 + s * 23) * 1.2;
        if (pointer && i < ff * 0.18) { const k = 0.65 + 0.3 * Math.sin(time + s * 9); x += (pointer.x + Math.sin(time * 2 + s * 40) * 0.8 - x) * k; y += (pointer.y + Math.cos(time * 1.7 + s * 30) * 0.6 - y) * k; z += (pointer.z + Math.cos(time * 2.3 + s * 20) * 0.8 - z) * k; }
        ffPos[o] += (x - ffPos[o]) * Math.min(1, dt * 2); ffPos[o + 1] += (y - ffPos[o + 1]) * Math.min(1, dt * 2); ffPos[o + 2] += (z - ffPos[o + 2]) * Math.min(1, dt * 2);
      }
      ffGeo.attributes.position.needsUpdate = true;
      pU.uTime.value = reduced ? 0 : time; pU.uCenter.value.copy(center); pU.uScale.value = pxPerUnit; pU.uDay.value = 1 - day.night;

      const dayVis = 1 - THREE.MathUtils.smoothstep(day.night, 0.3, 0.8);
      butterflies.forEach(bf => {
        const t = time * 0.35 + bf.seed;
        bf.g.position.set(Math.cos(t) * bf.rad + Math.sin(t * 2.3) * 1.2, bf.h + Math.sin(t * 1.7) * 1.2, Math.sin(t) * bf.rad + Math.cos(t * 1.9));
        bf.g.rotation.y = -t + Math.PI; const flap = Math.sin(time * 16 + bf.seed) * 0.9;
        bf.l.rotation.y = flap; bf.r.rotation.y = -flap; bf.g.visible = dayVis > 0.05; bf.g.scale.setScalar(0.7 * dayVis);
      });
      birdT -= dt;
      if (birdT < 0 && !birds.visible && dayVis > 0.5 && !reduced) { birds.visible = true; birds.userData.t = 0; birds.userData.a = Math.random() * Math.PI * 2; birdT = 26 + Math.random() * 20; }
      if (birds.visible) {
        const t = (birds.userData.t += dt) / 22, a = birds.userData.a;
        birds.position.set(Math.cos(a) * 90 * (1 - t * 2), 30 + Math.sin(t * 3) * 3, Math.sin(a) * 90 * (1 - t * 2) + 40 * (t - 0.5));
        birds.lookAt(birds.position.x - Math.cos(a), birds.position.y, birds.position.z - Math.sin(a) + 0.44);
        birdList.forEach((b, i) => { b.scale.set(1.6, 1.6 * (0.6 + 0.4 * Math.sin(time * 9 + i)), 1.6); });
        if (t > 1) birds.visible = false;
      }
    },
    dispose() { disposables.forEach(d => d.dispose()); grass.dispose(); },
  };
}
