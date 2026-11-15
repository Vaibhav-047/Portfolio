// The tree: Blender-built trunk/roots/branches (public/tree/tree.glb, see scripts/build_tree.py)
// plus leaves, vines and gems built here from src/tree-data.json.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import data from './tree-data.json';

export type Tier = 'high' | 'mid' | 'low';
export const SECTION_IDS = ['about', 'projects', 'skills', 'journey', 'contact'] as const;
export type SectionId = typeof SECTION_IDS[number];

const col = (hex: string) => new THREE.Color(hex);
export const PAL = {
  barkMid: col('#6B5545'), barkLight: col('#9A8070'), barkDark: col('#2E2219'),
  leafMid: col('#4A9A34'), leafLight: col('#8CCB55'), leafDark: col('#25561D'),
  moss: col('#5C8A2E'), teal: col('#35E0C0'), gemBlue: col('#3E9BFF'), gemCyan: col('#4FE8E8'),
  fog: col('#1F4A4A'), moon: col('#CFE8FF'),
};
export const MOON_DIR = new THREE.Vector3(-0.40, 0.335, -0.85).normalize();   // behind the tree, upper left

/** Uniforms shared by every custom shader. */
export const U = {
  uTime: { value: 0 },
  uFogColor: { value: PAL.fog.clone() },
  uFogDensity: { value: 0.011 },
  uMoonDir: { value: MOON_DIR },
  uTeal: { value: PAL.teal },
  uRipple: { value: -1 },   // radius of the light ring spreading over the roots, -1 = off
};

/** Wind: the trunk stays still (weight 0 below the crown), branches sway, same maths for bark, leaves and vines. */
export const SWAY = /* glsl */`
uniform float uTime;
float windW(vec3 p){ return p.y > 6.5 ? clamp((p.y - 7.2) / 7. + max(0., length(p.xz) - 3.5) / 12., 0., 1.) : 0.; }
vec3 sway(vec3 p, float w){ return vec3(sin(uTime*.8 + p.y*.3 + p.x*.2)*.12, sin(uTime*.5 + p.z*.3)*.03, cos(uTime*.6 + p.x*.25)*.09) * w; }
`;
export const FOG_PARS = /* glsl */`uniform vec3 uFogColor; uniform float uFogDensity;
vec3 applyFog(vec3 c, float depth){ float f = 1. - exp(-uFogDensity*uFogDensity*depth*depth); return mix(c, uFogColor, f); }`;
const OUT = /* glsl */`
#include <tonemapping_fragment>
#include <colorspace_fragment>`;

const loader = new THREE.TextureLoader();
export function tex(name: string, srgb = true) {
  const t = loader.load(`/tree/tex/${name}.jpg`);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export interface Vine {
  id: SectionId | null;
  curve: THREE.CatmullRomCurve3;
  length: number;
  marks: number[];                       // curve fractions where the root ends and the trunk ends
  mat: THREE.ShaderMaterial;
  mesh: THREE.Mesh;
  tip: THREE.Vector3;
  gem?: Gem;
}
export interface Gem { group: THREE.Group; shards: THREE.Mesh[]; core: THREE.Mesh; open: { value: number }; glow: { value: number } }

function barkMaterial() {
  const m = new THREE.MeshStandardMaterial({ map: tex('bark_color'), normalMap: tex('bark_normal', false), roughness: 0.92, metalness: 0, vertexColors: true });
  m.normalScale.set(1.6, 1.6);
  m.onBeforeCompile = s => {
    Object.assign(s.uniforms, { uTime: U.uTime, uTeal: U.uTeal, uRipple: U.uRipple, uMoss: { value: tex('moss_color') },
      cDark: { value: PAL.barkDark }, cMid: { value: PAL.barkMid }, cLight: { value: PAL.barkLight }, cMoss: { value: PAL.moss } });
    s.vertexShader = 'varying vec3 vWPos;\n' + SWAY + s.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n transformed += sway(position, windW(position)); vWPos = position;');
    s.fragmentShader = 'varying vec3 vWPos; uniform sampler2D uMoss; uniform vec3 cDark, cMid, cLight, cMoss, uTeal; uniform float uTime, uRipple;\n' + s.fragmentShader
      .replace('#include <color_fragment>', /* glsl */`
        float ao = vColor.r, mossW = vColor.b;
        float l = dot(diffuseColor.rgb, vec3(.333));
        vec3 bark = mix(cDark, cMid, smoothstep(.1, .42, l)); bark = mix(bark, cLight, smoothstep(.42, .8, l));
        float mt = texture2D(uMoss, vWPos.xz * .3 + vWPos.y * .17).g;
        float mm = smoothstep(.3, .62, mossW + (mt - .35) * .7);
        diffuseColor.rgb = mix(bark, cMoss * (.35 + mt * 1.9), mm) * mix(.34, 1., ao);`)
      .replace('#include <emissivemap_fragment>', /* glsl */`
        // light pooled in the grooves, like the reference's glowing seams
        float seam = pow(clamp(1. - vColor.r, 0., 1.), 2.);
        totalEmissiveRadiance += uTeal * seam * (.035 + .02 * sin(uTime * .7 + vWPos.y * 1.3));
        float rr = length(vWPos.xz);
        totalEmissiveRadiance += uTeal * step(0., uRipple) * exp(-pow((rr - uRipple) * 1.8, 2.)) * smoothstep(3.5, .5, vWPos.y) * (.3 + 1.6 * seam);`);
  };
  return m;
}

function buildLeaves(group: THREE.Group, tier: Tier) {
  const per = tier === 'high' ? 150 : tier === 'mid' ? 85 : 34;
  const size = tier === 'low' ? 1.05 : tier === 'mid' ? 0.76 : 0.62;
  const clumps = data.clumps as number[][];
  const count = clumps.length * per;
  const geo = new THREE.PlaneGeometry(1, 1.15, 2, 1);
  geo.translate(0, 0.45, 0);                       // pivot at the stem
  const aClump = new Float32Array(count * 4), aRnd = new Float32Array(count * 4);
  const uniforms = {
    ...U, uMap: { value: tex('leaf_color') }, uAlpha: { value: tex('leaf_alpha', false) },
    uDark: { value: PAL.leafDark }, uMid: { value: PAL.leafMid }, uLight: { value: PAL.leafLight }, uMoonCol: { value: PAL.moon },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      attribute vec4 aClump; attribute vec4 aRnd;
      varying vec2 vUv; varying vec3 vN; varying float vShade; varying float vDepth; varying float vAo; varying vec3 vW;
      ${SWAY}
      void main(){
        vUv = (uv + aRnd.xy) / 3.;
        vec3 p = position; p.z -= (uv.x - .5) * (uv.x - .5) * .7;      // cupped, not a flat card
        vec4 wp = instanceMatrix * vec4(p, 1.);
        vec3 ip = instanceMatrix[3].xyz; float w = windW(ip);
        vec3 cn = normalize(mat3(instanceMatrix) * vec3(0., 0., 1.));
        wp.xyz += sway(ip, w) + cn * sin(uTime * 2.7 + aRnd.z * 6.28 + ip.x) * .06 * uv.y * (.35 + w);
        vec3 out_ = normalize(ip - aClump.xyz);
        vN = normalize(mix(out_, cn * sign(dot(cn, out_) + .001), .28));    // puffy: lit like the clump, not the card
        vAo = clamp(length(ip - aClump.xyz) / aClump.w, 0., 1.2);
        vShade = aRnd.w * .5 + fract(aClump.x * 3.7 + aClump.z * 1.3) * .5; vW = wp.xyz;
        vec4 mv = viewMatrix * wp; vDepth = -mv.z; gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap, uAlpha; uniform vec3 uDark, uMid, uLight, uTeal, uMoonDir, uMoonCol;
      varying vec2 vUv; varying vec3 vN; varying float vShade; varying float vDepth; varying float vAo; varying vec3 vW;
      ${FOG_PARS}
      void main(){
        if (texture2D(uAlpha, vUv).r < .5) discard;
        float tx = texture2D(uMap, vUv).g;
        vec3 n = normalize(vN);
        float up = n.y * .5 + .5, moon = max(0., dot(n, uMoonDir)), front = max(0., n.z) * .5;
        vec3 c = mix(uDark * .45, uMid * .85, smoothstep(.3, .9, up + front * .3));
        c = mix(c, uLight, clamp(smoothstep(.78, 1., up) * .45 + moon * .5, 0., 1.));
        c *= (.5 + tx * 1.25) * (.6 + .7 * vShade) * mix(.4, 1.05, smoothstep(.6, 1.05, vAo));
        float under = smoothstep(.15, -.75, n.y);                       // undersides catch the vine light
        c += uTeal * under * .16 * smoothstep(16., 8., vW.y) + uMoonCol * moon * .1;
        gl_FragColor = vec4(applyFog(c, vDepth), 1.);
        ${OUT}
      }`,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const o = new THREE.Object3D(), dir = new THREE.Vector3(), n = new THREE.Vector3();
  let i = 0;
  for (const [cx, cy, cz, r] of clumps) {
    for (let k = 0, tries = 0; k < per && tries < per * 5; tries++) {
      dir.randomDirection(); if (dir.y < -0.6) dir.y *= -0.6;       // few leaves underneath: branches show
      const d = r * (0.8 + Math.random() * 0.28);
      o.position.set(cx + dir.x * d, cy + dir.y * d * 0.78, cz + dir.z * d);
      // leaves buried inside a neighbouring clump are never seen: spend them on the visible shell instead
      if (clumps.some(c => c[3] !== r && (c[0] - o.position.x) ** 2 + ((c[1] - o.position.y) / 0.78) ** 2 + (c[2] - o.position.z) ** 2 < (c[3] * 0.72) ** 2)) continue;
      n.randomDirection().multiplyScalar(0.9).add(dir).normalize();
      o.lookAt(o.position.x + n.x, o.position.y + n.y, o.position.z + n.z);
      o.rotateZ(Math.PI + (Math.random() - 0.5) * 2.2);              // mostly hanging tip-down
      o.scale.setScalar(size * (0.7 + Math.random() * 0.6));
      o.updateMatrix(); mesh.setMatrixAt(i, o.matrix);
      aClump.set([cx, cy, cz, r], i * 4);
      aRnd.set([Math.floor(Math.random() * 3), Math.floor(Math.random() * 3), Math.random(), Math.random()], i * 4);
      k++; i++;
    }
  }
  geo.setAttribute('aClump', new THREE.InstancedBufferAttribute(aClump, 4));
  geo.setAttribute('aRnd', new THREE.InstancedBufferAttribute(aRnd, 4));
  mesh.count = i; mesh.frustumCulled = false;
  group.add(mesh);

  // dark cores stop the sky showing through the clumps and give them volume
  const cores = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`varying vec3 vN; varying float vDepth; ${SWAY}
      void main(){ vec4 wp = instanceMatrix * vec4(position, 1.); vec3 ip = instanceMatrix[3].xyz; wp.xyz += sway(ip, windW(ip));
        vN = normal; vec4 mv = viewMatrix * wp; vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */`uniform vec3 uDark, uTeal; varying vec3 vN; varying float vDepth; ${FOG_PARS}
      void main(){ vec3 c = uDark * (.22 + .3 * (vN.y * .5 + .5)) + uTeal * .035 * smoothstep(.2, -.8, vN.y);
        gl_FragColor = vec4(applyFog(c, vDepth), 1.); ${OUT} }`,
  }), clumps.length);
  clumps.forEach(([cx, cy, cz, r], k) => {
    o.position.set(cx, cy, cz); o.rotation.set(0, 0, 0); o.scale.set(r * 0.66, r * 0.5, r * 0.66); o.updateMatrix(); cores.setMatrixAt(k, o.matrix);
  });
  cores.frustumCulled = false;
  group.add(cores);
  return i;
}

function vineMaterial(length: number, radius: number, strong: boolean) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...U, uLen: { value: length }, uRadius: { value: radius },
      uGlow: { value: strong ? 0.8 : 0.16 },      // resting brightness
      uHover: { value: 0 },
      uPulse: { value: -1 },                    // 0..1 position of the energy pulse, -1 = none
      uLit: { value: 0 },                       // 0..1 how far the vine stays charged behind the pulse
    },
    vertexShader: /* glsl */`
      uniform float uRadius; varying vec2 vUv; varying float vDepth; varying vec3 vN;
      ${SWAY}
      void main(){
        vUv = uv;
        float r = uRadius * mix(1.3, .6, smoothstep(0., 1., uv.x)) * (1. + .12 * sin(uv.x * 90.));
        vec3 p = position + normal * (r - uRadius);
        p += sway(p, windW(p));
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(p, 1.); vDepth = -mv.z; gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uLen, uGlow, uHover, uPulse, uLit; uniform vec3 uTeal;
      varying vec2 vUv; varying float vDepth; varying vec3 vN;
      ${FOG_PARS}
      void main(){
        float s = vUv.x * uLen;
        float flow = pow(.5 + .5 * sin(s * 1.1 - uTime * 2.2), 14.);            // light travelling root -> tip
        float breathe = .75 + .25 * sin(uTime * 1.3 + s * .2);
        float nz = clamp(abs(normalize(vN).z), 0., 1.); float rim = pow(1. - nz, 1.5);   // clamped: MSAA can extrapolate varyings and pow(<0) is NaN
        vec3 body = vec3(.012, .075, .06) * (.4 + .6 * nz);
        float glow = uGlow * breathe * (.22 + 2.6 * flow) + uHover * (1.2 + 2.5 * flow);
        glow += smoothstep(uLit + .02, uLit - .05, vUv.x) * step(.001, uLit) * .8;
        float pulse = uPulse < 0. ? 0. : exp(-pow((vUv.x - uPulse) * uLen / 1.1, 2.)) * 5.;
        vec3 c = body + uTeal * glow * (.3 + .9 * nz * nz + .25 * rim) + mix(uTeal, vec3(1.), .55) * pulse;
        gl_FragColor = vec4(applyFog(c, vDepth), 1.);
        ${OUT}
      }`,
  });
}

/** A faceted gem that can bloom open: six crystal shards around a bright core. */
function buildGem(color: THREE.Color): Gem {
  const group = new THREE.Group(), open = { value: 0 }, glow = { value: 1 };
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.5, roughness: 0.15, metalness: 0.1, flatShading: true });
  const shardGeo = new THREE.OctahedronGeometry(0.2, 0); shardGeo.scale(0.55, 1.55, 0.55); shardGeo.translate(0, -0.3, 0);
  const shards: THREE.Mesh[] = [];
  for (let k = 0; k < 6; k++) {
    const pivot = new THREE.Group(); pivot.rotation.y = k * Math.PI / 3;
    const s = new THREE.Mesh(shardGeo, mat); s.position.x = 0.09; pivot.add(s); group.add(pivot); shards.push(s);
  }
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), new THREE.MeshBasicMaterial({ color: col('#DFFFFA') }));
  group.add(core);
  return { group, shards, core, open, glow };
}
export function updateGem(g: Gem, t: number) {
  const o = g.open.value;
  g.shards.forEach((s, k) => { s.rotation.z = -o * 1.05; s.position.x = 0.09 + o * 0.2; s.position.y = o * 0.1 + Math.sin(t * 1.4 + k) * 0.008; });
  g.core.scale.setScalar(0.5 + o * 0.9 + Math.sin(t * 3) * 0.06);
  (g.core.material as THREE.MeshBasicMaterial).color.setScalar(0.8 + o * 1.1 + g.glow.value * 0.25);
  (g.shards[0].material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + g.glow.value * 0.4 + o * 0.5;
  g.group.rotation.y = t * 0.25;
}

function buildVines(group: THREE.Group, tier: Tier) {
  const vines: Vine[] = [];
  const gemPts: THREE.Vector3[] = [];
  data.vines.forEach((v, n) => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < v.pts.length; i += 3) pts.push(new THREE.Vector3(v.pts[i], v.pts[i + 1], v.pts[i + 2]));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const length = curve.getLength();
    const strong = v.id !== null, radius = strong ? 0.034 : 0.022;
    const mat = vineMaterial(length, radius, strong);
    const segs = Math.round(length * (tier === 'low' ? 3 : 6));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, radius, tier === 'low' ? 5 : 7), mat);
    mesh.frustumCulled = false;
    group.add(mesh);
    const vine: Vine = { id: v.id as SectionId | null, curve, length, marks: v.marks, mat, mesh, tip: pts[pts.length - 1].clone() };
    if (strong) {
      const gem = buildGem(n % 2 ? PAL.gemCyan : PAL.gemBlue);
      gem.group.position.copy(vine.tip).add(new THREE.Vector3(0, -0.42, 0));
      group.add(gem.group); vine.gem = gem;
    }
    // small gems strung along the vine
    const step = strong ? 1.5 : 2.6;
    for (let s = 2 + (n % 3) * 0.4; s < length - 1; s += step) gemPts.push(curve.getPointAt(s / length));
    vines.push(vine);
  });
  const small = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.085, 0),
    new THREE.MeshStandardMaterial({ color: '#46587a', roughness: 0.25, metalness: 0.35, flatShading: true }), gemPts.length);
  const o = new THREE.Object3D();
  gemPts.forEach((p, i) => {
    o.position.copy(p); o.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3); o.scale.set(1, 1.5, 1).multiplyScalar(0.7 + Math.random() * 0.8);
    o.updateMatrix(); small.setMatrixAt(i, o.matrix); small.setColorAt(i, i % 2 ? PAL.gemBlue : PAL.gemCyan);
  });
  // emissive follows the instance colour so each gem glows in its own blue
  small.material.onBeforeCompile = s => { s.fragmentShader = s.fragmentShader.replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance = vColor.rgb * 0.75;'); };
  small.frustumCulled = false;
  group.add(small);
  return vines;
}

export async function buildTree(scene: THREE.Scene, tier: Tier) {
  const group = new THREE.Group();
  const draco = new DRACOLoader().setDecoderPath('/draco/');
  const gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync('/tree/tree.glb');
  draco.dispose();
  gltf.scene.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = barkMaterial(); });
  group.add(gltf.scene);
  const leaves = buildLeaves(group, tier);
  const vines = buildVines(group, tier);
  scene.add(group);
  return { group, vines, leaves };
}
