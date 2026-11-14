import * as THREE from 'three';

/** Uniforms shared (by reference) across every swaying material. */
export const windUniforms = {
  uTime: { value: 0 },
  uWind: { value: 1 },
  uPointer: { value: new THREE.Vector3(0, -100, 0) },
  uPointerStrength: { value: 0 },
  uSunDirView: { value: new THREE.Vector3(0, 1, 0) },
  uSunColor: { value: new THREE.Color('#ffd9a0') },
};

export const NOISE_GLSL = /* glsl */`
float hash1(vec3 p){ p = fract(p*0.3183099+.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vnoise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
  return mix(mix(mix(hash1(i),hash1(i+vec3(1,0,0)),f.x),mix(hash1(i+vec3(0,1,0)),hash1(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash1(i+vec3(0,0,1)),hash1(i+vec3(1,0,1)),f.x),mix(hash1(i+vec3(0,1,1)),hash1(i+vec3(1,1,1)),f.x),f.y),f.z); }
`;

export const WIND_GLSL = /* glsl */`
uniform float uTime; uniform float uWind; uniform vec3 uPointer; uniform float uPointerStrength;
${NOISE_GLSL}
vec3 windOffset(vec3 p, float flex){
  float t = uTime;
  float gust = 0.55 + 0.45 * vnoise(vec3(p.x*0.04 + t*0.18, p.z*0.04, t*0.07));
  float sway = sin(t*1.05 + p.x*0.16 + p.z*0.11 + p.y*0.05)*0.65 + sin(t*2.2 + p.y*0.37 + p.x*0.27)*0.25 + (vnoise(p*0.35 + t*0.6)-0.5)*0.5;
  float a = flex*flex*uWind*gust;
  return vec3(sway*a, -abs(sway)*a*0.12, (sway*0.45 + sin(t*1.6 + p.y*0.55)*0.3)*a);
}
vec3 pointerPush(vec3 p, float flex){
  vec3 d = p - uPointer; float dist = length(d);
  return d/(dist+1e-3) * smoothstep(2.4, 0.0, dist) * uPointerStrength * (0.25 + flex) * 0.55;
}
`;

/** Re-route projection so wind and cursor push act in world space, after instancing. */
export function windify(material: THREE.Material, flexAttr: string, extraVertex = '', patch?: (shader: THREE.WebGLProgramParametersWithUniforms) => void) {
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, windUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${WIND_GLSL}\nattribute float ${flexAttr};`)
      .replace('#include <project_vertex>', /* glsl */`
        vec4 mvPosition = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif
        vec4 wp = modelMatrix * mvPosition;
        float fl = ${flexAttr};
        ${extraVertex}
        wp.xyz += windOffset(wp.xyz, fl) + pointerPush(wp.xyz, fl);
        mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;`);
    patch?.(shader);
  };
}
