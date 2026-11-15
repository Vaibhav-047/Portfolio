"""Builds the world tree: public/tree/tree.glb (trunk, roots, branches) + src/tree-data.json
(vine splines, leaf clumps, ground mound). Run:
  /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/build_tree.py
Blender is Z-up; the JSON is written Y-up (x, z, -y) to match the exported GLB.
"""
import bpy, bmesh, json, math, os, random
from mathutils import Vector, kdtree, noise
from mathutils.bvhtree import BVHTree

random.seed(11)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TAU = math.tau
H = 7.0                       # trunk height
DOME = (11.5, 9.8, 5.8)       # canopy ellipsoid: radius xy, centre z, radius z
SECTIONS = ['about', 'projects', 'skills', 'journey', 'contact']
# where each section's gem hangs (front of the tree is -Y)
GEM_TARGETS = [(-7.6, -3.4, 7.6), (-3.9, -6.0, 7.0), (0.6, -6.6, 8.3), (4.6, -5.6, 7.1), (8.0, -3.0, 7.9)]

def ground(r):                # mossy mound the tree sits on; mirrored in src/tree-data.json
    return -1.5 * (1 - math.exp(-(r / 5.5) ** 2))

def lerp(a, b, t): return a + (b - a) * t
def smooth(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)
def rv(s=1.0): return Vector((random.uniform(-s, s), random.uniform(-s, s), random.uniform(-s, s)))

def spline(ctrl, step=0.14):
    """Catmull-Rom through (Vector, radius) control points, resampled every ~step."""
    P = [ctrl[0]] + ctrl + [ctrl[-1]]
    out = []
    for i in range(1, len(P) - 2):
        (p0, _), (p1, r1), (p2, r2), (p3, _) = P[i - 1], P[i], P[i + 1], P[i + 2]
        n = max(2, int((p2 - p1).length / step))
        for k in range(n):
            t = k / n; t2 = t * t; t3 = t2 * t
            p = 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
            out.append((p, lerp(r1, r2, t)))
    out.append(ctrl[-1])
    return out

LIMBS = []
class Limb:
    def __init__(self, ctrl, level, parent=None, segs=10):
        self.s = spline(ctrl); self.level = level; self.parent = parent; self.segs = segs
        n = len(self.s)
        self.T = [(self.s[min(i + 1, n - 1)][0] - self.s[max(i - 1, 0)][0]).normalized() for i in range(n)]
        N = self.T[0].orthogonal().normalized(); self.N = []; self.B = []
        for t in self.T:                       # parallel transport frame
            N = (N - t * N.dot(t)).normalized(); self.N.append(N); self.B.append(t.cross(N))
        self.arc = [0.0]
        for i in range(1, n): self.arc.append(self.arc[-1] + (self.s[i][0] - self.s[i - 1][0]).length)
        mean_r = sum(r for _, r in self.s) / n
        self.ku = max(1, round(TAU * mean_r / 2.2)); self.voff = random.random() * 5; self.seed = random.random() * 50
        LIMBS.append(self)

def centre(z): return Vector((0.45 * math.sin(z * 0.45), 0.3 * math.sin(z * 0.3 + 1.0), z))

# ---------------- trunk strands: root -> rope helix -> primary branch ----------------
N_STR = 4
TWIST = 1.05 * TAU
strands = []
for i in range(N_STR):
    ph = i * TAU / N_STR + random.uniform(-0.25, 0.25) + 0.5
    size = random.uniform(0.88, 1.12)
    ctrl = []
    # root, far tip first
    a = ph - 0.55
    for rad, lift, rr in [(11.5, -1.3, 0.1), (9.0, -0.25, 0.3), (6.6, 0.15, 0.55), (4.8, 0.4, 0.9), (3.4, 0.7, 1.35)]:
        aa = a + (rad - 3.4) * 0.06 * (1 if i % 2 else -1) + random.uniform(-0.12, 0.12)
        ctrl.append((Vector((math.cos(aa) * rad, math.sin(aa) * rad, ground(rad) + lift)), rr * size))
    i_root = len(ctrl)
    z = 0.5
    while z <= H + 1e-3:
        t = z / H
        rh = lerp(lerp(2.3, 1.3, smooth(0, 0.5, t)), 1.5, smooth(0.6, 1.0, t))
        rs = lerp(lerp(1.75, 1.25, smooth(0, 0.45, t)), 0.95, smooth(0.5, 1.0, t)) * size
        aa = ph + TWIST * t
        ctrl.append((centre(z) + Vector((math.cos(aa) * rh, math.sin(aa) * rh, 0)), rs)); z += 0.5
    i_top = len(ctrl)
    a_top = ph + TWIST + 0.5
    d = Vector((math.cos(a_top), math.sin(a_top), 0)); perp = Vector((-d.y, d.x, 0))
    top = ctrl[-1][0]; L = random.uniform(8.0, 9.5); wob = random.uniform(0, TAU)
    for j in range(1, 8):
        s = j * L / 7
        p = top + d * s + perp * (0.7 * math.sin(s * 0.55 + wob)) + Vector((0, 0, 2.9 * (1 - math.exp(-s / 2.4)) + 0.07 * s))
        ctrl.append((p, lerp(0.85, 0.16, (j / 7) ** 0.7) * size))
    limb = Limb(ctrl, 0, segs=16)
    # sample indices of the three parts
    def idx_of(ci): return min(range(len(limb.s)), key=lambda k: (limb.s[k][0] - ctrl[ci][0]).length)
    limb.i_base, limb.i_top, limb.base_angle = idx_of(i_root - 1), idx_of(i_top - 1), a
    strands.append(limb)

# extra roots between the strand roots
roots = list(strands)
for i in range(8):
    a = i * TAU / 8 + random.uniform(-0.3, 0.3)
    L = random.uniform(6.0, 10.5); r0 = random.uniform(0.7, 1.05)
    ctrl = [(centre(1.6) + Vector((math.cos(a), math.sin(a), 0)) * 1.4, r0)]
    for j in range(1, 6):
        rad = 1.4 + j * L / 5; aa = a + 0.12 * math.sin(j * 1.3 + i)
        ctrl.append((Vector((math.cos(aa) * rad, math.sin(aa) * rad, ground(rad) + lerp(0.5, -1.1, (j / 5) ** 2))), lerp(r0, 0.07, j / 5)))
    ctrl.reverse()
    limb = Limb(ctrl, 0); limb.i_base = len(limb.s) - 1; limb.base_angle = a; limb.is_root = True
    roots.append(limb)

# ---------------- branches ----------------
clumps = []
def in_dome(p):
    return (p.x / DOME[0]) ** 2 + (p.y / DOME[0]) ** 2 + ((p.z - DOME[1]) / DOME[2]) ** 2

def grow(parent, idx, d, L, r0, depth):
    p = parent.s[idx][0].copy(); ctrl = [(p.copy(), r0)]; n = 5
    for j in range(1, n + 1):
        d = (d + rv(0.26) + Vector((0, 0, 0.16))).normalized()
        if in_dome(p + d * L / n) > 1.0:
            d = (d - Vector((p.x, p.y, (p.z - DOME[1]) * 2)).normalized() * 0.8).normalized()
        p = p + d * (L / n)
        ctrl.append((p.copy(), max(0.09, r0 * (1 - 0.72 * j / n))))
    limb = Limb(ctrl, depth, parent=(parent, idx))
    clumps.append((limb.s[-1][0], random.uniform(1.5, 2.1) + (0.4 if depth == 1 else 0)))
    if depth == 1:
        clumps.append((limb.s[len(limb.s) // 2][0] + Vector((0, 0, 0.6)), random.uniform(1.3, 1.8)))
        children(limb, int(len(limb.s) * 0.3), len(limb.s) - 2, 3, L * 0.55, 2)
    return limb

def children(limb, i0, i1, count, L, depth):
    for c in range(count):
        idx = int(lerp(i0, i1, (c + random.uniform(0.2, 0.8)) / count))
        t = limb.T[idx]; ang = random.uniform(0.7, 1.2) * (1 if c % 2 else -1)
        d = Vector((t.x * math.cos(ang) - t.y * math.sin(ang), t.x * math.sin(ang) + t.y * math.cos(ang), t.z * 0.4 + random.uniform(0.15, 0.5)))
        grow(limb, idx, d.normalized(), L * random.uniform(0.8, 1.15), limb.s[idx][1] * 0.72, depth)

for st in strands:
    children(st, st.i_top + 6, len(st.s) - 3, 5, 4.6, 1)
    clumps.append((st.s[-1][0], 2.2))
for k in range(3):                               # upright leaders fill the crown
    a = k * TAU / 3 + 0.9
    ctrl = [(centre(6.0), 0.7)]; p = centre(6.0); d = Vector((math.cos(a) * 0.45, math.sin(a) * 0.45, 1)).normalized()
    for j in range(1, 7):
        d = (d + rv(0.2) + Vector((math.cos(a), math.sin(a), 0)) * 0.08).normalized(); p = p + d * 1.05
        ctrl.append((p.copy(), lerp(0.7, 0.14, j / 6)))
    ld = Limb(ctrl, 0); ld.i_top = 0; ld.is_leader = True
    children(ld, len(ld.s) // 3, len(ld.s) - 2, 4, 3.6, 1)
    clumps.append((ld.s[-1][0], 2.3))

# dome fill so the silhouette reads as one wide round canopy
for k in range(34):
    u = random.random(); a = random.random() * TAU; el = math.acos(1 - u * 1.02) if u < 0.98 else 1.5
    f = random.uniform(0.72, 0.97)
    p = Vector((math.cos(a) * math.sin(el) * DOME[0] * f, math.sin(a) * math.sin(el) * DOME[0] * f, DOME[1] + 0.3 + math.cos(el) * DOME[2] * f))
    clumps.append((p, random.uniform(1.5, 3.0)))

# gem twigs: one per section, drooping below the canopy edge so the gem stays visible
gem_limbs = []
for tx, ty, tz in GEM_TARGETS:
    T = Vector((tx, ty, tz)); best = None
    for lb in LIMBS:
        if getattr(lb, 'is_root', False) or lb.level > 1: continue
        lo = getattr(lb, 'i_top', 0) + (5 if lb.level == 0 else 0)
        for i in range(lo, len(lb.s)):
            p, r = lb.s[i]; dist = (p - T).length
            if r > 0.16 and p.z > T.z + 0.3 and 1.6 < dist and (best is None or dist < best[0]): best = (dist, lb, i)
    _, lb, i = best; p0 = lb.s[i][0]
    ctrl = [(p0.copy(), 0.2), (p0.lerp(T, 0.45) + Vector((0, 0, 0.35)), 0.16), (T + Vector((0, 0, 0.75)) + (p0 - T).normalized() * 0.5, 0.12), (T, 0.09)]
    gem_limbs.append(Limb(ctrl, 2, parent=(lb, i)))
    clumps[:] = [c for c in clumps if (c[0] - T).length > c[1] + 0.9 or c[0].z > T.z + 2.2]

# ---------------- mesh: tubes -> voxel union -> smooth -> decimate ----------------
bm = bmesh.new()
for lb in LIMBS:
    rings = []
    for i, (p, r) in enumerate(lb.s):
        rings.append([bm.verts.new(p + (lb.N[i] * math.cos(k * TAU / lb.segs) + lb.B[i] * math.sin(k * TAU / lb.segs)) * r) for k in range(lb.segs)])
    for a, b in zip(rings, rings[1:]):
        for k in range(lb.segs):
            bm.faces.new((a[k], a[(k + 1) % lb.segs], b[(k + 1) % lb.segs], b[k]))
    bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
raw = bpy.data.meshes.new('raw'); bm.to_mesh(raw); bm.free()
obj = bpy.data.objects.new('Tree', raw); bpy.context.scene.collection.objects.link(obj)
m = obj.modifiers.new('rm', 'REMESH'); m.mode = 'VOXEL'; m.voxel_size = 0.06; m.adaptivity = 0
m = obj.modifiers.new('sm', 'SMOOTH'); m.factor = 0.6; m.iterations = 4
m = obj.modifiers.new('dc', 'DECIMATE'); m.ratio = 0.36
me = bpy.data.meshes.new_from_object(obj.evaluated_get(bpy.context.evaluated_depsgraph_get()))
obj.modifiers.clear(); obj.data = me

# ---------------- bark grooves (displacement), UVs along the limbs, vertex colour masks ----------------
samples = []
for lb in LIMBS:
    for i in range(len(lb.s)): samples.append((lb, i))
kd = kdtree.KDTree(len(samples))
for n, (lb, i) in enumerate(samples): kd.insert(lb.s[i][0], n)
kd.balance()

bm = bmesh.new(); bm.from_mesh(me); bm.normal_update()
col = bm.verts.layers.float_color.new('Col'); uvl = bm.loops.layers.uv.new('UVMap')
near = {}
for v in bm.verts:
    cands = kd.find_n(v.co, 6)                    # nearest *surface*, not nearest axis
    _, n, _ = min(cands, key=lambda c: abs(c[2] - samples[c[1]][0].s[samples[c[1]][1]][1]))
    lb, i = samples[n]; p, r = lb.s[i]; dv = v.co - p
    u = math.atan2(dv.dot(lb.B[i]), dv.dot(lb.N[i])); s = lb.arc[i] + dv.dot(lb.T[i])
    near[v.index] = n
    f = 1.6 + r * 2.6
    nz = noise.noise(Vector((math.cos(u) * f, math.sin(u) * f, s * 0.2 + lb.seed)))
    nz2 = noise.noise(Vector((math.cos(u) * f * 2.7, math.sin(u) * f * 2.7, s * 0.55 + lb.seed + 9)))
    groove = (1 - smooth(0.0, 0.3, abs(nz))) * 0.75 + (1 - smooth(0.0, 0.25, abs(nz2))) * 0.25
    depth = max(0.04, min(0.3, 0.24 * r))
    rr = math.hypot(v.co.x, v.co.y); axis_d = (v.co - centre(v.co.z)).length
    crease = smooth(0.45, 1.0, axis_d / 2.8) if (0.3 < v.co.z < H and lb.level == 0) else 1.0
    ao = (1 - 0.6 * groove) * lerp(0.45, 1.0, crease)
    wind = max(0.0, min(1.0, (v.co.z - 7.2) / 7 + max(0.0, rr - 3.5) / 12)) if v.co.z > 6.5 else 0.0
    hg = v.co.z - ground(rr)
    moss = max(0.0, min(1.0, (1 - smooth(0.2, 1.7, hg)) * (0.45 + 0.55 * max(0, v.normal.z)) + (0.35 * max(0, v.normal.z - 0.45) if v.co.z > 6 else 0)))
    v[col] = (ao, wind, moss, 1.0)
    v.co = v.co + v.normal * (-groove * depth + nz * 0.035 * min(1.0, r * 2))
for face in bm.faces:
    # every corner is measured against one limb sample so the bark never tears inside a face;
    # the sample is the lowest-numbered one in the face, so neighbouring faces mostly agree and share UVs
    lb, i = samples[min(near[v.index] for v in face.verts)]; p = lb.s[i][0]; us = []
    for loop in face.loops:
        dv = loop.vert.co - p; us.append((math.atan2(dv.dot(lb.B[i]), dv.dot(lb.N[i])), lb.arc[i] + dv.dot(lb.T[i])))
    wrap = max(u for u, _ in us) - min(u for u, _ in us) > math.pi
    for loop, (u, sv) in zip(face.loops, us):
        if wrap and u < 0: u += TAU
        loop[uvl].uv = (round(u / TAU * lb.ku, 3), round(sv / 2.4 + lb.voff, 3))
    face.smooth = True
bm.to_mesh(me); bm.free()
me.color_attributes.active_color = me.color_attributes['Col']
me.color_attributes.render_color_index = me.color_attributes.find('Col')

# ---------------- vines hugging the finished surface ----------------
bm = bmesh.new(); bm.from_mesh(me); bvh = BVHTree.FromBMesh(bm)
def hug(pts, lift=0.05):
    out = []
    for p in pts:
        loc, nrm, _, _ = bvh.find_nearest(p)
        out.append(loc + nrm * lift if loc else p)
    return out
def relax(pts, it=4):
    for _ in range(it):
        pts = [pts[0]] + [(pts[i - 1] + pts[i] * 2 + pts[i + 1]) / 4 for i in range(1, len(pts) - 1)] + [pts[-1]]
    return pts
def resample(pts, step=0.14):
    out = [pts[0]]; acc = 0.0
    for a, b in zip(pts, pts[1:]):
        d = (b - a).length; pos = step - acc
        while pos <= d and d > 1e-6:
            out.append(a.lerp(b, pos / d)); pos += step
        acc = (acc + d) % step
    out.append(pts[-1]); return out

def vine_path(root, target, turns_dir):
    """root tip -> up the root -> spiral round the trunk -> along the branch chain to target limb's tip."""
    chain = []; lb, end = target, len(target.s) - 1
    while lb:
        start = getattr(lb, 'i_top', 0)
        chain.append((lb, start, end))
        if lb.parent: lb, end = lb.parent
        else: break
    chain.reverse()
    top_limb, i0, _ = chain[0]; anchor = top_limb.s[i0][0]
    pts = [p + Vector((0, 0, r)) for p, r in root.s[:root.i_base + 1]]
    a0 = root.base_angle; c = centre(anchor.z); a1 = math.atan2(anchor.y - c.y, anchor.x - c.x)
    sweep = (a1 - a0) % TAU if turns_dir > 0 else -((a0 - a1) % TAU)
    if abs(sweep) < 0.85 * TAU: sweep += turns_dir * TAU
    z0 = root.s[root.i_base][0].z + 0.4; n = int(abs(sweep) * 2.4 / 0.14) + int((anchor.z - z0) / 0.14)
    for k in range(1, n):
        t = k / n; z = lerp(z0, anchor.z, t); a = a0 + sweep * t
        pts.append(centre(z) + Vector((math.cos(a), math.sin(a), 0)) * 4.2)
    marks = [len(pts)]
    phi = random.random() * TAU
    for lb, s, e in chain:
        for i in range(s, e + 1):
            p, r = lb.s[i]
            if i > s: phi += (lb.arc[i] - lb.arc[i - 1]) * 2.0
            pts.append(p + (lb.N[i] * math.cos(phi) + lb.B[i] * math.sin(phi)) * (r * 1.5 + 0.05))
    n_trunk = marks[0]
    pts = relax(hug(relax(hug(pts), 12), 0.06), 3)      # final light relax: the grooves would otherwise kink the vine
    arc = [0.0]
    for a, b in zip(pts, pts[1:]): arc.append(arc[-1] + (b - a).length)
    out = resample(pts, 0.3)
    return out, [arc[root.i_base] / arc[-1], arc[n_trunk] / arc[-1]]

vines = []
for k, name in enumerate(SECTIONS):
    # start from a root on the same side as the gem so the path reads from the front
    gx, gy, _ = GEM_TARGETS[k]; ga = math.atan2(gy, gx)
    free = [r for r in roots if not getattr(r, 'used', False)]
    root = min(free, key=lambda r: abs((math.atan2(r.s[0][0].y, r.s[0][0].x) - ga + math.pi) % TAU - math.pi) + (0.6 if r.s[0][0].y > 0 else 0))
    root.used = True
    pts, marks = vine_path(root, gem_limbs[k], 1 if k % 2 else -1)
    vines.append({'id': name, 'pts': pts, 'marks': marks})
faint_targets = [lb for lb in LIMBS if lb.level == 1 and lb not in gem_limbs]
random.shuffle(faint_targets)
for k, root in enumerate([r for r in roots if not getattr(r, 'used', False)][:4]):
    pts, marks = vine_path(root, faint_targets[k], -1 if k % 2 else 1)
    vines.append({'id': None, 'pts': pts, 'marks': marks})
bm.free()

# ---------------- export ----------------
def yup(p): return [round(p.x, 3), round(p.z, 3), round(-p.y, 3)]
data = {
    'mound': {'depth': 1.5, 'radius': 5.5},
    'trunkHeight': H, 'dome': DOME,
    'vines': [{'id': v['id'], 'marks': [round(x, 4) for x in v['marks']], 'pts': [c for p in v['pts'] for c in yup(p)]} for v in vines],
    'clumps': [yup(p) + [round(r, 2)] for p, r in clumps],
    'rootTips': [yup(r.s[0][0]) for r in roots],
}
with open(os.path.join(ROOT, 'src', 'tree-data.json'), 'w') as f: json.dump(data, f, separators=(',', ':'))

for o in bpy.data.objects: o.select_set(o == obj)
bpy.context.view_layer.objects.active = obj
out = os.path.join(ROOT, 'public', 'tree', 'tree.glb')
kw = dict(filepath=out, export_format='GLB', use_selection=True, export_apply=True, export_materials='NONE',
          export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
          export_draco_position_quantization=14, export_draco_normal_quantization=10, export_draco_texcoord_quantization=12)
try:
    bpy.ops.export_scene.gltf(**kw, export_vertex_color='ACTIVE', export_active_vertex_color_when_no_material=True)
except TypeError:
    bpy.ops.export_scene.gltf(**kw, export_colors=True)
print(f'TREE OK: {len(me.vertices)} verts, {len(me.polygons)} faces, {len(LIMBS)} limbs, {len(clumps)} clumps, {len(vines)} vines, {os.path.getsize(out) // 1024} KB')
