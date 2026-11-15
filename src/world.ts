// The grove at blue hour: sky and moon, misty forest layers, mossy clearing, grass, mushrooms,
// ground fog, fireflies, pollen, falling leaves and god rays.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import data from './tree-data.json';
import { U, PAL, MOON_DIR, FOG_PARS, tex, type Tier } from './tree';

const OUT = `\n#include <tonemapping_fragment>\n#include <colorspace_fragment>`;
const NOISE = /* glsl */`
float hash2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(hash2(i), hash2(i+vec2(1,0)), f.x), mix(hash2(i+vec2(0,1)), hash2(i+vec2(1,1)), f.x), f.y); }`;
export const groundY = (r: number) => -data.mound.depth * (1 - Math.exp(-((r / data.mound.radius) ** 2)));
const bumps = (x: number, z: number) => (Math.sin(x * 0.31) * Math.cos(z * 0.27) * 0.22 + Math.sin(x * 0.9 + z * 0.7) * 0.05) * Math.min(1, Math.hypot(x, z) / 9);
const heightAt = (x: number, z: number) => groundY(Math.hypot(x, z)) + bumps(x, z);
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function sky() {
  const m = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { ...U, cTop: { value: new THREE.Color('#0E2A2E') }, cMid: { value: new THREE.Color('#1F4A4A') }, cHor: { value: new THREE.Color('#A8D8C8') } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: /* glsl */`
      uniform vec3 cTop, cMid, cHor, uMoonSky; uniform float uTime; varying vec3 vDir;
      float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      ${NOISE}
      void main(){
        vec3 d = normalize(vDir); float h = d.y;
        vec3 c = mix(cMid, cTop, smoothstep(.1, .55, h));
        c = mix(c, cHor, exp(-max(h, 0.) * 13.) * .8);                               // mint glow hugging the horizon
        c += vec3(1., .7, .48) * exp(-max(h, 0.) * 13.) * exp(-d.x * d.x * 6.) * step(d.z, 0.) * .16;   // last warmth behind the trunk
        // thin drifting cloud bands
        float cl = vnoise(vec2(atan(d.x, -d.z) * 3. + uTime * .004, h * 22.)) * vnoise(vec2(atan(d.x, -d.z) * 9., h * 60.));
        c = mix(c, cHor * .8, smoothstep(.25, .7, cl) * smoothstep(.02, .12, h) * smoothstep(.5, .15, h) * .35);
        vec3 g = floor(d * 190.); float s = hash(g);
        c += vec3(.8, .95, 1.) * step(.9965, s) * smoothstep(.14, .5, h) * (.6 + .4 * sin(uTime * (1. + s * 3.) + s * 40.)) * 1.2;
        float m = dot(d, uMoonSky);                                                   // crisp disc, soft halo (the halo blooms)
        c += vec3(.85, .97, 1.) * (smoothstep(.99978, .99986, m) * 1.5 + pow(max(m, 0.), 900.) * .35 + pow(max(m, 0.), 90.) * .12 + pow(max(m, 0.), 12.) * .05);
        gl_FragColor = vec4(c, 1.);
        ${OUT}
      }`,
  }));
  m.renderOrder = -10;
  return m;
}

/** Layers of tree-line silhouettes on arcs at real depth, so orbiting gives true parallax. */
function forest(group: THREE.Group) {
  const layers: [number, string, number, number, number][] = [   // radius, colour, trees round the arc, height scale, base y
    [150, '#6FA89B', 150, 1.9, -6], [112, '#4A857C', 120, 1.5, -5], [84, '#2E635E', 96, 1.2, -4], [62, '#1A4442', 74, 1.0, -3.2], [47, '#0E2C2D', 52, 0.9, -2.6],
  ];
  layers.forEach(([R, colour, trees, hs, y0], n) => {
    const H = 34 * hs;
    const geo = new THREE.CylinderGeometry(R, R, H, 96, 1, true, Math.PI - 2.3, 4.6); geo.translate(0, H / 2 + y0, 0);
    const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      side: THREE.BackSide, transparent: true, depthWrite: false,
      uniforms: { uCol: { value: new THREE.Color(colour) }, uMist: { value: new THREE.Color('#A8D8C8') }, uSeed: { value: n * 17.3 + 1 }, uTrees: { value: trees }, uH: { value: H / hs }, uMistAmt: { value: 0.35 + n * 0.08 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: /* glsl */`
        uniform vec3 uCol, uMist; uniform float uSeed, uTrees, uH, uMistAmt; varying vec2 vUv;
        float hash(float n){ return fract(sin(n * 127.1 + uSeed) * 43758.5453); }
        float crown(float x, float n, float H){
          float c = floor(x * n), f = fract(x * n);
          float h = (.4 + .6 * hash(c)) * H, w = .55 + .4 * hash(c + 7.);
          float d = abs(f - .5 + (hash(c + 5.) - .5) * .3) / (.5 * w);
          return hash(c + 3.) > .62 ? h * 1.3 * max(0., 1. - d * 1.25) : h * sqrt(max(0., 1. - d * d));   // conifer or round crown
        }
        void main(){
          float y = vUv.y * uH, x = vUv.x;
          float top = 9. + sin(x * uTrees * 2.3 + uSeed) * 1.5 + max(max(crown(x, uTrees, 6.), crown(x + .371, uTrees * .47, 9.)), crown(x + .13, uTrees * 1.7, 4.));   // undergrowth + three sizes of tree: no bare gaps
          top += sin(x * uTrees * 31.) * .22 + sin(x * uTrees * 77. + 2.) * .13;      // leafy edge
          float a = smoothstep(top, top - .5, y);
          vec3 c = mix(mix(uCol, uMist, uMistAmt), uCol, smoothstep(0., 7., y));    // mist pools between the layers
          gl_FragColor = vec4(c, a);
          ${OUT}
        }`,
    }));
    mesh.renderOrder = -9 + n;
    group.add(mesh);
  });
}

function ground() {
  const geo = new THREE.PlaneGeometry(320, 320, 256, 256); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i), p.getZ(i)));
  geo.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ map: tex('moss_color'), roughness: 1, color: '#6f8c58' });
  m.map!.repeat.set(52, 52);
  m.onBeforeCompile = s => {
    Object.assign(s.uniforms, { uRipple: U.uRipple, uTeal: U.uTeal, uGrass: { value: tex('grass_color') } });
    s.vertexShader = 'varying vec3 vWPos;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vWPos = position;');
    s.fragmentShader = 'varying vec3 vWPos; uniform float uRipple; uniform vec3 uTeal; uniform sampler2D uGrass;\n' + s.fragmentShader
      .replace('#include <map_fragment>', /* glsl */`#include <map_fragment>
        float rr = length(vWPos.xz);
        vec3 grass = texture2D(uGrass, vWPos.xz * .11).rgb * vec3(.5, .78, .42);
        float patchy = smoothstep(.35, .6, texture2D(uGrass, vWPos.xz * .017).g);
        diffuseColor.rgb = mix(diffuseColor.rgb, grass, smoothstep(5., 12., rr) * (.45 + .4 * patchy));
        diffuseColor.rgb *= mix(.5, 1., smoothstep(1.5, 8., rr));                     // contact shadow under the tree`)
      .replace('#include <emissivemap_fragment>', /* glsl */`
        totalEmissiveRadiance += uTeal * step(0., uRipple) * exp(-pow((rr - uRipple) * 1.5, 2.)) * .45 * smoothstep(13., 4., rr);`);
  };
  return new THREE.Mesh(geo, m);
}

function grass(group: THREE.Group, tier: Tier) {
  const count = tier === 'high' ? 30000 : tier === 'mid' ? 14000 : 4500;
  const blade = () => { const g = new THREE.PlaneGeometry(tier === 'low' ? 0.16 : 0.1, 1, 1, 2); g.translate(0, 0.5, 0); return g; };
  const geo = mergeGeometries([blade(), blade().rotateY(1.1).translate(0.07, 0, 0.04), blade().rotateY(-1.0).translate(-0.05, 0, 0.06)])!;
  const mesh = new THREE.InstancedMesh(geo, new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { ...U, cBase: { value: new THREE.Color('#0f2a1c') }, cTip: { value: new THREE.Color('#4f8f45') } },
    vertexShader: /* glsl */`uniform float uTime; varying float vH; varying float vDepth; varying float vR;
      void main(){
        vec3 p = position; p.x *= 1. - uv.y * .85;                                   // taper to a point
        vec4 wp = instanceMatrix * vec4(p, 1.); vec3 ip = instanceMatrix[3].xyz;
        float gust = sin(uTime * 1.5 + ip.x * .35 + ip.z * .28) * .5 + sin(uTime * .6 + ip.x * .08) * .5;
        wp.xz += vec2(.9, .45) * (gust * .16 + .06) * uv.y * uv.y;
        vH = uv.y; vR = fract(ip.x * 7.3 + ip.z * 3.1);
        vec4 mv = viewMatrix * wp; vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */`uniform vec3 cBase, cTip; varying float vH; varying float vDepth; varying float vR; ${FOG_PARS}
      void main(){ vec3 c = mix(cBase, cTip * (.65 + .5 * vR), vH * vH); gl_FragColor = vec4(applyFog(c, vDepth), 1.); ${OUT} }`,
  }), count);
  const o = new THREE.Object3D();
  for (let i = 0; i < count;) {
    const a = Math.random() * Math.PI * 2, r = 8.5 + Math.random() ** 0.7 * 34, x = Math.cos(a) * r, z = Math.sin(a) * r;
    // thick in front of the camera and on the mound's skirt, thinning into the trees
    if (Math.random() > Math.max(0.12, 1.15 - Math.hypot(x, z - 24) / 26) && !(r < 13 && Math.random() < 0.3)) continue;
    o.position.set(x, heightAt(x, z) - 0.03, z); o.rotation.y = Math.random() * 6.28; o.scale.set(1, rnd(0.4, 0.85) * Math.min(1, (r - 6) / 8), 1).multiplyScalar(rnd(0.8, 1.3));
    o.updateMatrix(); mesh.setMatrixAt(i++, o.matrix);
  }
  mesh.frustumCulled = false; group.add(mesh);
}

function mushrooms(group: THREE.Group, tier: Tier) {
  const spots: [number, number, number][] = [];
  const cluster = (x: number, z: number) => { for (let k = 0, n = 2 + Math.floor(Math.random() * 3); k < n; k++) spots.push([x + rnd(-0.5, 0.5), z + rnd(-0.5, 0.5), rnd(0.16, 0.42)]); };
  (data.rootTips as number[][]).forEach(([x, , z]) => { const f = rnd(0.55, 0.85); cluster(x * f + rnd(-0.6, 0.6), z * f + rnd(-0.6, 0.6)); });
  for (let k = 0; k < (tier === 'low' ? 8 : 22); k++) { const a = rnd(-0.3, Math.PI + 0.3), r = rnd(9, 26); cluster(Math.cos(a) * r, Math.sin(a) * r); }
  const n = spots.length, o = new THREE.Object3D();
  const emissive = (s: { fragmentShader: string }) => { s.fragmentShader = s.fragmentShader.replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance = vColor.rgb * 1.15;'); };
  const capGeo = new THREE.SphereGeometry(1, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2); capGeo.scale(1, 0.62, 1);
  const capMat = new THREE.MeshStandardMaterial({ roughness: 0.5 }); capMat.onBeforeCompile = emissive;
  const caps = new THREE.InstancedMesh(capGeo, capMat, n);
  const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.24, 1, 8).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: '#c9e6d8', emissive: '#2c8f7c', emissiveIntensity: 0.5, roughness: 0.8 }), n);
  // light pooling on the moss under each cap
  const pools = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { ...U },
    vertexShader: `varying vec2 vUv; varying vec3 vC; void main(){ vUv = uv; vC = instanceColor; gl_Position = projectionMatrix * viewMatrix * instanceMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform float uTime; varying vec2 vUv; varying vec3 vC; void main(){ float d = length(vUv - .5) * 2.; gl_FragColor = vec4(vC * pow(max(0., 1. - d), 2.2) * .3, 1.); ${OUT} }`,
  }), n);
  const c = new THREE.Color();
  spots.forEach(([x, z, s], i) => {
    const y = heightAt(x, z), h = s * rnd(1.4, 2.6);
    o.rotation.set(0, 0, 0); o.position.set(x, y - 0.02, z); o.scale.set(s * 0.5, h, s * 0.5); o.updateMatrix(); stems.setMatrixAt(i, o.matrix);
    o.position.y = y + h - 0.02; o.scale.setScalar(s); o.rotation.set(rnd(-0.2, 0.2), 0, rnd(-0.2, 0.2)); o.updateMatrix(); caps.setMatrixAt(i, o.matrix);
    o.rotation.set(0, 0, 0); o.position.y = y + 0.06; o.scale.setScalar(s * 5.5); o.updateMatrix(); pools.setMatrixAt(i, o.matrix);
    c.copy(i % 3 ? PAL.teal : PAL.gemBlue).multiplyScalar(rnd(0.7, 1.1)); caps.setColorAt(i, c); pools.setColorAt(i, c);
  });
  for (const m of [caps, stems, pools]) { m.frustumCulled = false; group.add(m); }
}

function groundFog(group: THREE.Group, tier: Tier) {
  const mat = (seed: number, amt: number) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { ...U, uSeed: { value: seed }, uAmt: { value: amt }, cFog: { value: new THREE.Color('#9ad0c4') } },
    vertexShader: `varying vec3 vW; void main(){ vW = (modelMatrix * vec4(position, 1.)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.); }`,
    fragmentShader: /* glsl */`uniform float uTime, uSeed, uAmt; uniform vec3 cFog; varying vec3 vW; ${NOISE}
      void main(){ float r = length(vW.xz);
        vec2 q = vW.xz * .045 + uSeed + vec2(uTime * .012, uTime * .007);
        float n = vnoise(q) * .65 + vnoise(q * 2.7 + 3.) * .35;
        float a = smoothstep(.32, .8, n) * smoothstep(4., 15., r) * smoothstep(90., 40., r) * uAmt;
        gl_FragColor = vec4(cFog * .4, a); ${OUT} }`,
  });
  const levels = tier === 'low' ? [[-1.05, 0.5]] : [[-1.2, 0.42], [-0.75, 0.32], [-0.2, 0.22]];
  levels.forEach(([y, amt], i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(190, 190).rotateX(-Math.PI / 2), mat(i * 13.7, amt)); m.position.y = y; m.renderOrder = 5 + i; group.add(m);
  });
}

/** Fireflies (bright, blinking, bloom) and pollen (dim, drifting) share one point shader. */
function motes(group: THREE.Group, count: number, firefly: boolean) {
  const pos = new Float32Array(count * 3), seed = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * 6.28, r = firefly ? rnd(4, 26) : rnd(0, 30);
    pos.set([Math.cos(a) * r, firefly ? rnd(-0.8, 6) : rnd(-1, 15), Math.sin(a) * r * 0.9 + 6], i * 3);
    seed.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const pts = new THREE.Points(geo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { ...U, uSize: { value: firefly ? 150 : 46 }, uCol: { value: new THREE.Color(firefly ? '#d9ff8a' : '#cfeedd') }, uFly: { value: firefly ? 1 : 0 } },
    vertexShader: /* glsl */`uniform float uTime, uSize, uFly; attribute vec4 aSeed; varying float vA;
      void main(){ vec3 p = position; float t = uTime;
        if (uFly > .5) { p += vec3(sin(t * (.3 + aSeed.x * .4) + aSeed.y * 6.3) * 2.2, sin(t * (.5 + aSeed.z * .5) + aSeed.x * 6.3) * .9, cos(t * (.25 + aSeed.y * .4) + aSeed.z * 6.3) * 2.2);
          vA = smoothstep(.1, .9, sin(t * (1.1 + aSeed.w * 1.6) + aSeed.w * 30.)) * 2.6; }
        else { p.y = mod(p.y + t * (.08 + aSeed.x * .12) + 1., 16.) - 1.; p.x += sin(t * .2 + aSeed.y * 6.3) * 1.5; p.z += cos(t * .17 + aSeed.z * 6.3) * 1.5;
          vA = .16 + .2 * sin(t * .8 + aSeed.w * 6.3); }
        vec4 mv = modelViewMatrix * vec4(p, 1.); gl_PointSize = uSize * (.5 + aSeed.w) / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uCol; varying float vA; void main(){ float d = length(gl_PointCoord - .5) * 2.; gl_FragColor = vec4(uCol * vA * pow(max(0., 1. - d), 2.5), 1.); ${OUT} }`,
  }));
  pts.frustumCulled = false; pts.renderOrder = 8; group.add(pts);
}

/** A leaf lets go of the canopy now and then: each of these waits most of its cycle, then tumbles down. */
function fallingLeaves(group: THREE.Group) {
  const n = 9, seed = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) seed.set([rnd(-9, 9), rnd(-3, 7), rnd(22, 46), Math.random()], i * 4);
  const geo = new THREE.PlaneGeometry(0.5, 0.58);
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4));
  const mesh = new THREE.InstancedMesh(geo, new THREE.ShaderMaterial({
    side: THREE.DoubleSide, alphaToCoverage: true, uniforms: { ...U, uMap: { value: tex('leaf_color') }, uAlpha: { value: tex('leaf_alpha', false) } },
    vertexShader: /* glsl */`uniform float uTime; attribute vec4 aSeed; varying vec2 vUv; varying float vDepth;
      void main(){ vUv = (uv + vec2(floor(aSeed.w * 3.), 1.)) / 3.;
        float t = mod(uTime + aSeed.w * aSeed.z, aSeed.z), f = t / 12.;             // 12 s fall, the rest of the period hidden
        float a = t * 1.7 + aSeed.w * 9., b = sin(t * 1.1) * 1.2;
        vec3 p = position * step(f, 1.) * smoothstep(0., .04, f);
        p = vec3(p.x * cos(a) - p.z * sin(a), p.y, p.x * sin(a) + p.z * cos(a));
        p = vec3(p.x, p.y * cos(b) - p.z * sin(b), p.y * sin(b) + p.z * cos(b));
        p += vec3(aSeed.x + sin(t * .8 + aSeed.w * 6.) * 1.3 + t * .22, 9.2 - f * 10.6, aSeed.y + cos(t * .6) * .9);
        vec4 mv = viewMatrix * vec4(p, 1.); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D uMap, uAlpha; varying vec2 vUv; varying float vDepth; ${FOG_PARS}
      void main(){ float a = texture2D(uAlpha, vUv).r, cov = clamp((a - .5) / max(fwidth(a), 1e-4) + .5, 0., 1.); if (cov < .01) discard; gl_FragColor = vec4(applyFog(texture2D(uMap, vUv).rgb * vec3(.55, .8, .45), vDepth), cov); ${OUT} }`,
  }), n);
  mesh.frustumCulled = false; group.add(mesh);
}

/** Moonlight shafts slanting through the crown: camera-facing ribbons along the light direction. */
function godRays(group: THREE.Group) {
  const n = 11, axis = MOON_DIR.clone().negate();
  const geo = new THREE.PlaneGeometry(1, 1, 1, 1);
  const a0 = new Float32Array(n * 4), a1 = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    a0.set([rnd(-9, 6), rnd(10, 14.5), rnd(-4, 5), rnd(1.0, 2.8)], i * 4);     // start point in the crown + width
    a1.set([rnd(17, 26), Math.random(), rnd(0.5, 1), 0], i * 4);                // length, phase, strength
  }
  geo.setAttribute('aStart', new THREE.InstancedBufferAttribute(a0, 4)); geo.setAttribute('aRay', new THREE.InstancedBufferAttribute(a1, 4));
  const mesh = new THREE.InstancedMesh(geo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { ...U, uAxis: { value: axis }, uCol: { value: new THREE.Color('#bfeee4') } },
    vertexShader: /* glsl */`uniform vec3 uAxis; uniform float uTime; attribute vec4 aStart; attribute vec4 aRay; varying vec2 vUv; varying float vS;
      void main(){ vUv = uv; vec3 c = aStart.xyz + uAxis * (uv.y * aRay.x);
        vec3 side = normalize(cross(uAxis, cameraPosition - c));
        vec3 p = c + side * (uv.x - .5) * aStart.w * (1. + uv.y * 1.4);
        vS = aRay.z * (.55 + .45 * sin(uTime * .35 + aRay.y * 6.3));
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.); }`,
    fragmentShader: `uniform vec3 uCol; varying vec2 vUv; varying float vS;
      void main(){ float a = pow(max(0., 1. - abs(vUv.x - .5) * 2.), 2.) * smoothstep(0., .12, vUv.y) * pow(clamp(1. - vUv.y, 0., 1.), 1.3);   // clamped: MSAA extrapolates varyings, pow(<0) is NaN
        gl_FragColor = vec4(uCol * a * vS * .13, 1.); ${OUT} }`,
  }), n);
  mesh.frustumCulled = false; mesh.renderOrder = 7; group.add(mesh);
}

export function buildWorld(scene: THREE.Scene, tier: Tier) {
  const group = new THREE.Group();
  scene.fog = new THREE.FogExp2(PAL.fog, U.uFogDensity.value);
  group.add(sky(), ground());
  forest(group); grass(group, tier); mushrooms(group, tier); groundFog(group, tier);
  motes(group, tier === 'high' ? 90 : tier === 'mid' ? 55 : 24, true);
  motes(group, tier === 'high' ? 520 : tier === 'mid' ? 280 : 90, false);
  fallingLeaves(group);
  if (tier !== 'low') godRays(group);
  scene.add(group);
  scene.add(new THREE.HemisphereLight('#9fc4c4', '#2a2a1c', 0.7));
  const moon = new THREE.DirectionalLight('#bfe0ff', 2.1); moon.position.copy(MOON_DIR).multiplyScalar(50); scene.add(moon);
  const key = new THREE.DirectionalLight('#ffdcb8', 2.6); key.position.set(9, 12, 22); scene.add(key);       // soft front fill so the bark reads
  const glow = new THREE.PointLight(PAL.teal, 14, 22, 1.6); glow.position.set(0, 8.5, 2.5); scene.add(glow);  // vine light inside the crown
}
