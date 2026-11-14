import * as THREE from 'three';
import type { Tree } from './tree';

type Stop = { pos: THREE.Vector3; target: THREE.Vector3; shift: THREE.Vector2; angle: number; radius: number };
const SUB = 3; // spline points per gap between stops

/** Card side per stop (+1 = object right of centre because the card sits left). Mirrors data-side in the DOM. */
const SHIFT_X = [0.2, 0.2, -0.2, 0.2, -0.2, 0.2, -0.2, 0];

export function createCameraPath(tree: Tree, resumeFocus: THREE.Vector3) {
  let pos!: THREE.CatmullRomCurve3, target!: THREE.CatmullRomCurve3, stops: Stop[] = [];
  const tmp = new THREE.Vector3();
  const cyl = (angle: number, radius: number, y: number) => new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);

  function build(aspect: number) {
    const portrait = aspect < 0.85, back = portrait ? 3.4 : 0;
    const shift = (x: number) => portrait ? new THREE.Vector2(0, x === 0 ? 0 : 0.17) : new THREE.Vector2(x, 0);
    stops = [];
    const first = tree.sections[0];
    const a0 = first.az + 0.35;
    stops.push({ pos: cyl(a0, 12.5 + back, 0.75), target: new THREE.Vector3(0, 3.4, 0), shift: portrait ? new THREE.Vector2(0, -0.06) : new THREE.Vector2(0.17, 0), angle: a0, radius: 12.5 + back });
    tree.sections.forEach((s, i) => {
      const fr = Math.hypot(s.focus.x, s.focus.z), angle = s.az + 0.82, radius = fr + 5.8 + i * 0.55 + back;
      stops.push({ pos: cyl(angle, radius, s.focus.y + 0.6 + i * 0.25), target: s.focus.clone(), shift: shift(SHIFT_X[i + 1]), angle, radius });
    });
    const ra = Math.atan2(resumeFocus.z, resumeFocus.x) + 0.32, rr = Math.hypot(resumeFocus.x, resumeFocus.z) + 3.8 + back;
    stops.push({ pos: cyl(ra, rr, resumeFocus.y + 0.35), target: resumeFocus.clone(), shift: shift(SHIFT_X[6]), angle: ra, radius: rr });
    const ca = ra + 0.9;
    stops.push({ pos: cyl(ca, 31 + back * 2, 12.5), target: new THREE.Vector3(0, 9.2, 0), shift: new THREE.Vector2(0, portrait ? -0.05 : 0), angle: ca, radius: 31 + back * 2 });

    // Spiral the gaps around the trunk so the spline never cuts through the tree.
    const pp: THREE.Vector3[] = [], tp: THREE.Vector3[] = [];
    for (let k = 0; k < stops.length; k++) {
      const a = stops[k]; pp.push(a.pos); tp.push(a.target);
      const b = stops[k + 1]; if (!b) break;
      let d = b.angle - a.angle; d = ((d % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); if (d > 5) d -= Math.PI * 2;
      b.angle = a.angle + d; // keep the spiral monotonic
      for (let j = 1; j < SUB; j++) {
        const f = j / SUB, bulge = Math.sin(f * Math.PI) * 2.6;
        pp.push(cyl(a.angle + d * f, THREE.MathUtils.lerp(a.radius, b.radius, f) + bulge, THREE.MathUtils.lerp(a.pos.y, b.pos.y, f) + bulge * 0.35));
        tp.push(a.target.clone().lerp(b.target, f).add(new THREE.Vector3(0, Math.sin(f * Math.PI) * 0.6, 0)));
      }
    }
    pos = new THREE.CatmullRomCurve3(pp, false, 'centripetal');
    target = new THREE.CatmullRomCurve3(tp, false, 'centripetal');
  }

  /** Map scroll progress to the spline, dwelling near each stop so its card can be read. */
  function sample(p: number, stopProgress: number[], out: { pos: THREE.Vector3; target: THREE.Vector3; shift: THREE.Vector2; seg: number; s: number }) {
    const n = stops.length;
    let k = 0; while (k < n - 2 && p > stopProgress[k + 1]) k++;
    const span = Math.max(1e-4, stopProgress[k + 1] - stopProgress[k]);
    const s = THREE.MathUtils.clamp((p - stopProgress[k]) / span, 0, 1);
    const dwell = k === 0 ? 0.08 : 0.2, e = THREE.MathUtils.smootherstep(THREE.MathUtils.clamp((s - dwell) / (1 - dwell * 2), 0, 1), 0, 1);
    const u = (k * SUB + e * SUB) / ((n - 1) * SUB);
    pos.getPoint(u, out.pos); target.getPoint(u, out.target);
    out.shift.copy(stops[k].shift).lerp(stops[k + 1].shift, e);
    out.seg = k; out.s = e;
    return out;
  }
  function stopTarget(k: number) { return tmp.copy(stops[Math.min(k, stops.length - 1)].target); }
  return { build, sample, stopTarget, get count() { return stops.length; } };
}
