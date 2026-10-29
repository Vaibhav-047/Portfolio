import * as THREE from 'three';

export function createReactor() {
  const root = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x7e8993, metalness: .92, roughness: .27 });
  const graphite = new THREE.MeshStandardMaterial({ color: 0x131923, metalness: .85, roughness: .3 });
  const red = new THREE.MeshStandardMaterial({ color: 0x8e1420, metalness: .8, roughness: .26 });
  const copper = new THREE.MeshStandardMaterial({ color: 0xb78b4e, metalness: .88, roughness: .3 });
  const cyan = new THREE.MeshStandardMaterial({ color: 0x78ebff, emissive: 0x36cfff, emissiveIntensity: 2, metalness: .2, roughness: .25, toneMapped: false });
  const white = new THREE.MeshPhysicalMaterial({ color: 0xb0f6ff, emissive: 0x70dfff, emissiveIntensity: 2, metalness: .1, roughness: .17, clearcoat: 1, clearcoatRoughness: .12, toneMapped: false });
  const layers = Array.from({ length: 4 }, () => new THREE.Group()); layers.forEach(l => root.add(l));
  const parts: { object: THREE.Object3D; home: THREE.Vector3; turn: THREE.Euler; offset: THREE.Vector3; delay: number }[] = [];
  function record(object: THREE.Object3D, index: number, delay: number) {
    const a = index * 2.3999;
    parts.push({ object, home: object.position.clone(), turn: object.rotation.clone(), offset: new THREE.Vector3(Math.cos(a) * (4 + index % 3), Math.sin(a) * (3 + index % 4), -4 - index % 7), delay });
  }
  function torus(layer: THREE.Group, radius: number, tube: number, z: number, material: THREE.Material, segments = 96) {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 12, segments), material); mesh.position.z = z; layer.add(mesh); return mesh;
  }
  const back = new THREE.Mesh(new THREE.CylinderGeometry(1.63, 1.72, .28, 96), graphite); back.rotation.x = Math.PI / 2; back.position.z = -.27; layers[0].add(back);
  torus(layers[0], 1.73, .11, -.08, steel);
  torus(layers[0], 1.59, .045, .12, copper);
  torus(layers[0], 1.51, .035, .14, graphite);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 + .06, b = a + .88;
    const shape = new THREE.Shape(); shape.absarc(0, 0, 1.85, a, b, false); shape.absarc(0, 0, 1.72, b, a, true); shape.closePath();
    const plate = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: .15, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .025, bevelThickness: .025 }), red);
    plate.position.z = -.09; layers[0].add(plate);
  }
  for (let i = 0; i < 24; i++) {
    const a = i * Math.PI / 12;
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(.032, .032, .05, 6), steel); bolt.rotation.x = Math.PI / 2; bolt.position.set(Math.cos(a) * 1.67, Math.sin(a) * 1.67, .13); layers[0].add(bolt);
    const slit = new THREE.Mesh(new THREE.BoxGeometry(.045, .13, .04), graphite); slit.position.set(Math.cos(a) * 1.48, Math.sin(a) * 1.48, .18); slit.rotation.z = a - Math.PI / 2; layers[0].add(slit);
  }
  record(layers[0], 1, .15);
  for (let i = 0; i < 12; i++) {
    const segment = new THREE.Group(); segment.rotation.z = i * Math.PI / 6; layers[1].add(segment);
    const coil = new THREE.Mesh(new THREE.TorusGeometry(1.22, .17, 12, 12, .38), copper); segment.add(coil);
    for (let j = 0; j < 7; j++) {
      const wrap = new THREE.Mesh(new THREE.TorusGeometry(.176, .014, 6, 16), graphite);
      const a = j * .055 + .025; wrap.position.set(Math.cos(a) * 1.22, Math.sin(a) * 1.22, 0); wrap.rotation.set(Math.PI / 2, a, 0); segment.add(wrap);
    }
    const light = new THREE.Mesh(new THREE.BoxGeometry(.055, .48, .065), cyan); light.position.set(Math.cos(.45) * 1.22, Math.sin(.45) * 1.22, .09); light.rotation.z = .45 - Math.PI / 2; segment.add(light);
    record(segment, i + 2, .65 + i * .055);
  }
  layers[1].position.z = .12;
  torus(layers[2], .93, .09, .22, steel);
  torus(layers[2], .82, .028, .31, cyan);
  torus(layers[2], 1.02, .022, .25, cyan);
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3 + Math.PI / 2;
    const support = new THREE.Mesh(new THREE.BoxGeometry(.13, .37, .16), graphite); support.position.set(Math.cos(a) * .86, Math.sin(a) * .86, .34); support.rotation.z = a - Math.PI / 2; layers[2].add(support);
  }
  record(layers[2], 16, 1.2);
  const core = new THREE.Mesh(new THREE.SphereGeometry(.67, 48, 24), white); core.scale.z = .22; core.position.z = .3; layers[3].add(core);
  torus(layers[3], .67, .025, .34, copper);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(.73, 64), new THREE.MeshPhysicalMaterial({ color: 0xb9f1ff, transparent: true, opacity: .1, roughness: .05, metalness: .45, side: THREE.DoubleSide })); glass.position.z = .49; layers[3].add(glass);
  const hub = new THREE.Mesh(new THREE.TorusGeometry(.49, .015, 8, 64), cyan); hub.position.z = .47; layers[3].add(hub);
  record(layers[3], 19, 1.55);
  const haloMaterial = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { strength: { value: .7 } }, vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'varying vec2 vUv;uniform float strength;void main(){float d=length(vUv-.5)*2.;float a=pow(max(0.,1.-d),3.)*.35;gl_FragColor=vec4(.1,.7,1.,a*strength);}' });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 5.5), haloMaterial); halo.position.z = .6; root.add(halo);
  const pulseMaterial = new THREE.MeshBasicMaterial({ color: 0x83efff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const pulse = new THREE.Mesh(new THREE.TorusGeometry(1, .012, 8, 100), pulseMaterial); pulse.position.z = .65; root.add(pulse);
  return { root, layers, parts, cyan, white, haloMaterial, pulse, pulseMaterial };
}
