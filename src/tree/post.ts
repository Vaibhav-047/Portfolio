import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

/**
 * Scene → HDR target (with depth) → bloom in place → one composite pass that does
 * god rays (radial scatter of visible sky), depth of field, ACES, vignette and grain.
 * One extra full-screen pass instead of a chain keeps it cheap.
 */
export function createPost(renderer: THREE.WebGLRenderer, opts: { dof: boolean; godrays: boolean }) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const depth = new THREE.DepthTexture(size.x, size.y);
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4, depthTexture: depth });
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.6, 0.55, 0.9);
  const uniforms = {
    tColor: { value: target.texture }, tDepth: { value: depth },
    uSun: { value: new THREE.Vector2(0.5, 0.5) }, uSunVis: { value: 0 }, uSunColor: { value: new THREE.Color() }, uRays: { value: opts.godrays ? 1 : 0 },
    uFocus: { value: 8 }, uAperture: { value: opts.dof ? 1 : 0 }, uNear: { value: 0.1 }, uFar: { value: 400 },
    uResolution: { value: size.clone() }, uTime: { value: 0 }, uExposure: { value: 1 }, uNight: { value: 0 },
  };
  const quad = new FullScreenQuad(new THREE.ShaderMaterial({
    uniforms, depthTest: false, depthWrite: false, toneMapped: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: /* glsl */`
      #include <packing>
      uniform sampler2D tColor, tDepth; uniform vec2 uSun, uResolution; uniform vec3 uSunColor;
      uniform float uSunVis, uRays, uFocus, uAperture, uNear, uFar, uTime, uExposure, uNight; varying vec2 vUv;
      float viewZ(vec2 uv){ return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar); }
      float coc(float z){ return clamp(abs(z - uFocus) / max(z, 0.5) * 2.2 - 0.12, 0.0, 1.0); }
      vec3 rrtOdtFit(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
      vec3 aces(vec3 c){
        const mat3 I = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
        const mat3 O = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
        c *= uExposure / 0.6; return clamp(O * rrtOdtFit(I * c), 0.0, 1.0); }
      vec3 srgb(vec3 c){ return mix(c * 12.92, pow(c, vec3(1.0 / 2.4)) * 1.055 - 0.055, step(0.0031308, c)); }
      void main(){
        vec3 col = texture2D(tColor, vUv).rgb;
        // Depth of field: golden-angle disc, each tap weighted by its own blur so sharp edges don't bleed.
        if (uAperture > 0.0) {
          float c0 = coc(viewZ(vUv));
          if (c0 > 0.02) {
            vec3 acc = col; float wsum = 1.0; float r = c0 * 7.0 / uResolution.y;
            for (int i = 1; i < 14; i++) {
              float fi = float(i), a = fi * 2.39996, rr = sqrt(fi / 13.0) * r;
              vec2 uv = vUv + vec2(cos(a) * uResolution.y / uResolution.x, sin(a)) * rr;
              float w = coc(viewZ(uv)) + 0.05; acc += texture2D(tColor, uv).rgb * w; wsum += w;
            }
            col = acc / wsum;
          }
        }
        // God rays: march toward the sun, gathering only sky that shows through the canopy.
        if (uRays > 0.0 && uSunVis > 0.0) {
          vec2 dir = (uSun - vUv) / 28.0 * 0.85, uv = vUv; vec3 rays = vec3(0.0); float decay = 1.0;
          float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
          uv += dir * jitter;
          for (int i = 0; i < 28; i++) {
            uv += dir; if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) break;
            float sky = step(0.99995, texture2D(tDepth, uv).x);
            rays += min(texture2D(tColor, uv).rgb, vec3(4.0)) * sky * decay; decay *= 0.955;
          }
          col += rays / 28.0 * uSunColor * 0.55 * uSunVis * uRays;
        }
        col = aces(col);
        // Grade: lift shadows toward warm by day, cool by night.
        col = mix(col, col * mix(vec3(1.04, 1.0, 0.92), vec3(0.88, 0.95, 1.12), uNight), 0.6);
        vec2 q = vUv - 0.5; col *= 1.0 - dot(q, q) * mix(0.85, 1.25, uNight);
        col = srgb(col);
        col += (fract(sin(dot(gl_FragCoord.xy + uTime * 61.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.035;
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  const sunNdc = new THREE.Vector3();
  return {
    uniforms,
    setSize(w: number, h: number) { target.setSize(w, h); bloom.setSize(w / 2, h / 2); uniforms.uResolution.value.set(w, h); },
    setEffects(e: { dof: boolean; godrays: boolean }) { uniforms.uAperture.value = e.dof ? 1 : 0; uniforms.uRays.value = e.godrays ? 1 : 0; },
    render(scene: THREE.Scene, camera: THREE.PerspectiveCamera, dt: number, sunDir: THREE.Vector3, sunColor: THREE.Color, night: number, exposure: number, focus: number, time: number) {
      renderer.setRenderTarget(target); renderer.render(scene, camera);
      bloom.strength = 0.42 + night * 0.38;
      bloom.render(renderer, target, target, dt, false);
      sunNdc.copy(camera.position).addScaledVector(sunDir, 300).project(camera);
      const facing = sunNdc.z < 1 ? 1 : 0, edge = Math.max(Math.abs(sunNdc.x), Math.abs(sunNdc.y));
      uniforms.uSun.value.set(sunNdc.x * 0.5 + 0.5, sunNdc.y * 0.5 + 0.5);
      uniforms.uSunVis.value = facing * THREE.MathUtils.clamp(1.6 - edge, 0, 1) * (1 - night) * THREE.MathUtils.smoothstep(sunDir.y, -0.05, 0.08);
      uniforms.uSunColor.value.copy(sunColor);
      uniforms.uNear.value = camera.near; uniforms.uFar.value = camera.far;
      uniforms.uFocus.value = focus; uniforms.uTime.value = time % 100; uniforms.uExposure.value = exposure; uniforms.uNight.value = night;
      renderer.setRenderTarget(null); quad.render(renderer);
    },
    dispose() { target.dispose(); depth.dispose(); bloom.dispose(); quad.dispose(); (quad.material as THREE.Material).dispose(); },
  };
}
