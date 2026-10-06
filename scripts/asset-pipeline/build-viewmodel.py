"""First-person viewmodels: IDF olive sleeves and hands (CC0 Quaternius base character
and outfit arms) posed around CC0 Quaternius guns. Exported in eye space: the eye is the
origin, Blender -Y is forward (glTF/Babylon +Z) and the rifle's front sight lies on the
view axis when the viewmodel root is at the origin."""
import bpy, bmesh, math, sys, os
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
D = HERE + '/dl/'
B = D + 'ubc/Universal Base Characters[Standard]/Base Characters/Godot - UE/Superhero_Male_FullBody.gltf'
O = D + 'outfits/Modular Character Outfits - Fantasy[Standard]/Exports/glTF (Godot-Unreal)/Outfits/Male_Ranger.gltf'
UAL1 = D + 'ual/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb'
GUNS = D + 'guns/OBJ/'
GRENADE = HERE + '/pp/YWhHlmKOtx.glb'
OUT = HERE + '/char/viewmodel.glb'

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def imp(p):
    before = set(bpy.data.objects)
    if p.endswith('.obj'):
        bpy.ops.wm.obj_import(filepath=p)
    else:
        bpy.ops.import_scene.gltf(filepath=p)
    return [o for o in bpy.data.objects if o not in before]


def delete(objs):
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)


def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1: bpy.ops.object.join()
    objs[0].name = name; return objs[0]


def mat(name, rgb, rough=0.9, metal=0.0, tex=None, normal=None, orm=None):
    m = bpy.data.materials.new(name); m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']; nt = m.node_tree
    bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if tex:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(tex)
        nt.links.new(t.outputs['Color'], bsdf.inputs['Base Color'])
    if normal:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(normal); t.image.colorspace_settings.name = 'Non-Color'
        n = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(t.outputs['Color'], n.inputs['Color']); nt.links.new(n.outputs['Normal'], bsdf.inputs['Normal'])
    if orm:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(orm); t.image.colorspace_settings.name = 'Non-Color'
        sep = nt.nodes.new('ShaderNodeSeparateColor'); nt.links.new(t.outputs['Color'], sep.inputs['Color'])
        nt.links.new(sep.outputs['Green'], bsdf.inputs['Roughness']); nt.links.new(sep.outputs['Blue'], bsdf.inputs['Metallic'])
    return m


base = imp(B)
arm = [o for o in base if o.type == 'ARMATURE'][0]
delete([o for o in base if o.type != 'ARMATURE'])
outfit = imp(O)
arms = [o for o in outfit if o.name == 'Male_Ranger_Arms'][0]
mw = arms.matrix_world.copy(); arms.parent = arm; arms.matrix_world = mw
for m in arms.modifiers:
    if m.type == 'ARMATURE': m.object = arm
delete([o for o in outfit if o is not arms])
sleeve = mat('M_IDFSleeve', (1, 1, 1), 0.9, 0, HERE + '/char/outfit_idf.jpg', HERE + '/char/outfit_normal.jpg', HERE + '/char/outfit_orm.jpg')
for s in arms.material_slots:
    if s.material and s.material.name.startswith('MI_Ranger'): s.material = sleeve

objs = imp(UAL1); ua = [o for o in objs if o.type == 'ARMATURE'][0]
suffix = '_' + ua.name
for a in bpy.data.actions:
    if a.name.endswith(suffix): a.name = a.name[:-len(suffix)]
delete(objs)
for pb in arm.pose.bones: pb.rotation_mode = 'QUATERNION'

gun_metal = mat('M_GunMetal', (0.04, 0.042, 0.045), 0.42, 0.85)
gun_poly = mat('M_GunPolymer', (0.03, 0.03, 0.03), 0.6, 0.1)
gun_tan = mat('M_GunTan', (0.42, 0.35, 0.24), 0.65)
blade = mat('M_Blade', (0.55, 0.56, 0.58), 0.28, 1.0)


def import_gun(path, name, length, colour=None):
    objs = [o for o in imp(path) if o.type == 'MESH']
    for o in objs:
        for s in o.material_slots:
            n = (s.material.name if s.material else '').lower()
            s.material = colour(n) if colour else gun_metal
    g = join(objs, name)
    bpy.ops.object.select_all(action='DESELECT'); g.select_set(True); bpy.context.view_layer.objects.active = g
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bbox = [g.matrix_world @ Vector(c) for c in g.bound_box]
    s = length / (max(v.x for v in bbox) - min(v.x for v in bbox))
    g.scale = (s, s, s)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return g


def verts(o):
    return [o.matrix_world @ v.co for v in o.data.vertices]


def centre(p):
    return sum(p, Vector()) / max(1, len(p))


m4 = import_gun(GUNS + 'AssaultRifle2_1.obj', 'VM_M4', 0.84, lambda n: gun_poly if ('black' in n or 'dark' in n) else gun_metal)
pistol = import_gun(GUNS + 'Pistol_1.obj', 'VM_Pistol', 0.19, lambda n: gun_poly if ('brown' in n or 'wood' in n) else gun_metal)
knife = import_gun(GUNS + 'Accessories/Bayonet.obj', 'VM_Knife', 0.30, lambda n: blade if ('grey' in n or 'gray' in n or 'metal' in n or 'light' in n) else gun_poly)
gobjs = [o for o in imp(GRENADE) if o.type == 'MESH']
for o in gobjs:
    mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
frag = join(gobjs, 'VM_Frag')
bpy.context.view_layer.objects.active = frag; frag.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
fb = verts(frag); fh = max(v.z for v in fb) - min(v.z for v in fb)
frag.scale = (0.105 / fh,) * 3; bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
fc = centre(verts(frag)); frag.location -= fc; bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
# smoke grenade: olive canister with a pale band
smoke_mat = mat('M_Smoke', (0.17, 0.2, 0.13), 0.7)
band_mat = mat('M_SmokeBand', (0.75, 0.72, 0.62), 0.7)
bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.031, depth=0.115, location=(0, 0, 0)); c1 = bpy.context.active_object; c1.data.materials.append(smoke_mat)
bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.0315, depth=0.022, location=(0, 0, 0.02)); c2 = bpy.context.active_object; c2.data.materials.append(band_mat)
bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.012, depth=0.03, location=(0, 0, 0.07)); c3 = bpy.context.active_object; c3.data.materials.append(gun_metal)
smoke = join([c1, c2, c3], 'VM_Smoke')

mv = verts(m4)
M4_BUTT_X = min(v.x for v in mv); M4_LEN = max(v.x for v in mv) - M4_BUTT_X
front = [v for v in mv if v.x > M4_BUTT_X + M4_LEN * 0.55 and v.x < M4_BUTT_X + M4_LEN * 0.85]
FS = max(front, key=lambda v: v.z)
M4_GRIP = centre([v for v in mv if M4_BUTT_X + 0.25 < v.x < M4_BUTT_X + 0.34 and v.z < min(v.z for v in mv) + 0.1])
gv = [v for v in mv if M4_BUTT_X + 0.47 < v.x < M4_BUTT_X + 0.53]
M4_GUARD = Vector((M4_BUTT_X + 0.50, 0, min(v.z for v in gv) + 0.006))
MUZZLE = Vector((max(v.x for v in mv), 0, centre([v for v in mv if v.x > max(w.x for w in mv) - 0.02]).z))
print('M4 FS', FS, 'grip', M4_GRIP, 'guard', M4_GUARD, 'muzzle', MUZZLE)
pv = verts(pistol)
P_GRIP = centre([v for v in pv if v.x < min(w.x for w in pv) + 0.06 and v.z < 0.0])
P_TOP = max(pv, key=lambda v: v.z if v.x > max(w.x for w in pv) - 0.03 else -9)
P_MUZZLE = Vector((max(v.x for v in pv), 0, centre([v for v in pv if v.x > max(w.x for w in pv) - 0.01]).z))
print('Pistol grip', P_GRIP, 'top', P_TOP, 'muzzle', P_MUZZLE)
kv = verts(knife)
K_HANDLE = centre([v for v in kv if v.x < min(w.x for w in kv) + 0.09])

# ------------------------------------------------------------------ posing helpers
def pose_world(n): return arm.matrix_world @ arm.pose.bones[n].matrix
def set_world(n, M):
    arm.pose.bones[n].matrix = arm.matrix_world.inverted() @ M; bpy.context.view_layer.update()
def capture(): return {pb.name: pb.matrix_basis.copy() for pb in arm.pose.bones}
def restore(p):
    for pb in arm.pose.bones: pb.matrix_basis = p[pb.name]
    bpy.context.view_layer.update()


def freeze(act, frame):
    arm.animation_data_create(); arm.animation_data.action = bpy.data.actions[act]
    scene.frame_set(frame); bpy.context.view_layer.update(); b = capture()
    arm.animation_data.action = None; restore(b)


def rot_about(bone, angle, axis='Z'):
    M = pose_world(bone); p = M.translation.copy()
    set_world(bone, Matrix.Translation(p) @ Matrix.Rotation(angle, 4, axis) @ Matrix.Translation(-p) @ M)


def solve_arm(side, wrist, hand_rot, pole):
    up, lo, hd = f'upperarm_{side}', f'lowerarm_{side}', f'hand_{side}'
    S = pose_world(up).translation.copy()
    l1 = arm.pose.bones[up].length; l2 = arm.pose.bones[lo].length
    dv = wrist - S; d = min(dv.length, (l1 + l2) * 0.995); dr = dv.normalized(); T = S + dr * d
    a = (l1 * l1 - l2 * l2 + d * d) / (2 * d); h = math.sqrt(max(0.0, l1 * l1 - a * a))
    pv = pole - S; pv = pv - dr * pv.dot(dr); pv.normalize(); E = S + dr * a + pv * h
    def aim(n, head, tip):
        M = pose_world(n); oy = M.col[1].xyz.normalized(); ny = (tip - head).normalized()
        set_world(n, Matrix.Translation(head) @ (oy.rotation_difference(ny).to_matrix() @ M.to_3x3().normalized()).to_4x4())
    aim(up, S, E); aim(lo, E, T)
    set_world(hd, Matrix.Translation(T) @ hand_rot.to_4x4())
    return (T - wrist).length


def frame_from(y, n):
    y = y.normalized(); n = (n - y * n.dot(y)).normalized(); return Matrix((y, n, y.cross(n))).transposed()


PALM = {}
for side in ('l', 'r'):
    rest = arm.matrix_world @ arm.data.bones[f'hand_{side}'].matrix_local
    nl = (rest.to_3x3().inverted() @ Vector((0, 0, -1))).normalized()
    ml = rest.inverted() @ (arm.matrix_world @ arm.data.bones[f'middle_01_{side}'].head_local)
    PALM[side] = (nl, ml * 0.6 + nl * 0.028)


def hand_rot(side, fdir, pdir):
    return frame_from(fdir, pdir) @ frame_from(Vector((0, 1, 0)), PALM[side][0]).inverted()


def wrist_for(side, rot, p): return p - rot @ PALM[side][1]


def curl(side, palm_world, amount):
    for f in ('index', 'middle', 'ring', 'pinky'):
        for j in ('01', '02', '03'):
            aj = amount * (0.8 if j == '01' else 1.35)
            n = f'{f}_{j}_{side}'; M = pose_world(n); p = M.translation.copy(); axis = M.col[0].xyz.normalized()
            tail = M @ Vector((0, arm.pose.bones[n].length, 0)); best = None
            for sg in (1, -1):
                R = Matrix.Translation(p) @ Matrix.Rotation(sg * aj, 4, axis) @ Matrix.Translation(-p)
                sc = ((R @ tail) - tail).dot(palm_world)
                if best is None or sc > best[0]: best = (sc, R)
            set_world(n, best[1] @ M)


freeze('Pistol_Aim_Neutral', 4)
for b, a in (('spine_02', -14), ('spine_03', -14)): rot_about(b, math.radians(a))
for b, a in (('neck_01', 18), ('Head', 8)): rot_about(b, math.radians(a))
bladed = capture()
EYE = Vector((0.0, -0.075, 1.70))  # eye-space origin
GUN_ROT = Matrix.Rotation(-math.pi / 2, 4, 'Z')  # +X muzzle -> -Y forward

R_FINGER = Vector((0.0, -0.55, -0.85)); R_PALM = Vector((1.0, 0.0, 0.0))
L_FINGER = Vector((-0.55, -0.8, 0.05)); L_PALM = Vector((-0.35, 0.0, 1.0))


def bake_arms(name, keep_left=True):
    dup = arms.copy(); dup.data = arms.data.copy(); scene.collection.objects.link(dup)
    dup.name = name
    if not keep_left:
        gi = {g.name: g.index for g in dup.vertex_groups}
        left = {gi[n] for n in gi if n.endswith('_l')}
        bm = bmesh.new(); bm.from_mesh(dup.data); dl = bm.verts.layers.deform.active
        kill = [v for v in bm.verts if sum(w for k, w in v[dl].items() if k in left) > 0.5]
        bmesh.ops.delete(bm, geom=kill, context='VERTS'); bm.to_mesh(dup.data); bm.free()
    bpy.ops.object.select_all(action='DESELECT'); dup.select_set(True); bpy.context.view_layer.objects.active = dup
    for m in list(dup.modifiers):
        if m.type == 'ARMATURE': bpy.ops.object.modifier_apply(modifier=m.name)
    mw = dup.matrix_world.copy(); dup.parent = None; dup.matrix_world = mw
    dup.vertex_groups.clear()
    return dup


groups = {}


def group(name, items):
    root = bpy.data.objects.new(name, None); scene.collection.objects.link(root)
    for o in items:
        mw = o.matrix_world.copy(); o.parent = root; o.matrix_world = Matrix.Translation(-EYE) @ mw
    groups[name] = root
    return root


def marker(name, world_point, parent):
    e = bpy.data.objects.new(name, None); scene.collection.objects.link(e)
    e.parent = parent; e.location = world_point - EYE
    return e


# ---- rifle: front sight top on the view axis, ~0.47 m ahead of the eye
restore(bladed)
fs_target = EYE + Vector((0, -0.47, -0.0035))
M_m4 = Matrix.Translation(fs_target) @ GUN_ROT @ Matrix.Translation(-Vector((FS.x, 0, FS.z)))
R3 = Matrix.Identity(3)
rr = hand_rot('r', R_FINGER, R_PALM); er = solve_arm('r', wrist_for('r', rr, M_m4 @ M4_GRIP), rr, EYE + Vector((-0.45, 0.25, -0.55)))
rl = hand_rot('l', L_FINGER, L_PALM); el = solve_arm('l', wrist_for('l', rl, M_m4 @ M4_GUARD), rl, EYE + Vector((0.35, 0.0, -0.6)))
curl('l', (rl @ PALM['l'][0]).normalized(), math.radians(50))
print('rifle reach', er, el)
m4.matrix_world = M_m4
ra = bake_arms('Arms_Rifle')
g = group('VM_RifleRoot', [ra, m4]); marker('Rifle_Muzzle', M_m4 @ MUZZLE, g)
marker('Rifle_Eject', M_m4 @ Vector((M4_BUTT_X + 0.40, 0, FS.z - 0.07)), g)

# ---- pistol: rear of slide on the view axis, both hands (from the pistol aim pose)
restore(bladed)
old_r = pose_world('hand_r'); old_l = pose_world('hand_l')
pt = EYE + Vector((0, -0.33, -0.012))
M_p = Matrix.Translation(pt) @ GUN_ROT @ Matrix.Translation(-Vector((P_TOP.x, 0, P_TOP.z)))
rr = hand_rot('r', R_FINGER, R_PALM)
er = solve_arm('r', wrist_for('r', rr, M_p @ P_GRIP), rr, EYE + Vector((-0.45, 0.2, -0.6)))
new_r = pose_world('hand_r')
L = new_r @ old_r.inverted() @ old_l
el = solve_arm('l', L.translation, L.to_3x3().normalized(), EYE + Vector((0.4, 0.1, -0.6)))
print('pistol reach', er, el)
pistol.matrix_world = M_p
pa = bake_arms('Arms_Pistol')
g = group('VM_PistolRoot', [pa, pistol]); marker('Pistol_Muzzle', M_p @ P_MUZZLE, g)

# ---- knife: right hand forward, blade pointing ahead
restore(bladed)
kt = EYE + Vector((-0.12, -0.36, -0.17))
M_k = Matrix.Translation(kt) @ Matrix.Rotation(math.radians(12), 4, 'X') @ GUN_ROT @ Matrix.Translation(-K_HANDLE)
rr = hand_rot('r', Vector((0.15, -0.75, -0.55)), Vector((1, 0, 0)))
solve_arm('r', wrist_for('r', rr, kt), rr, EYE + Vector((-0.5, 0.2, -0.6)))
curl('r', (rr @ PALM['r'][0]).normalized(), math.radians(30))
knife.matrix_world = M_k
ka = bake_arms('Arms_Knife', keep_left=False)
group('VM_KnifeRoot', [ka, knife])

# ---- grenades: right hand cupped forward holding the grenade
for gname, gob in (('Frag', frag), ('Smoke', smoke)):
    restore(bladed)
    gt = EYE + Vector((-0.14, -0.34, -0.2))
    rr = hand_rot('r', Vector((0.25, -0.7, 0.35)), Vector((0.35, -0.2, 1.0)))
    solve_arm('r', wrist_for('r', rr, gt) + Vector((0, 0, -0.02)), rr, EYE + Vector((-0.5, 0.2, -0.6)))
    curl('r', (rr @ PALM['r'][0]).normalized(), math.radians(35))
    gcopy = gob.copy(); gcopy.data = gob.data.copy(); scene.collection.objects.link(gcopy)
    gcopy.matrix_world = Matrix.Translation(gt + Vector((0, 0, 0.035)))
    ga = bake_arms(f'Arms_{gname}', keep_left=False)
    group(f'VM_{gname}Root', [ga, gcopy])

# projectiles at the origin for world use
for o in (frag, smoke):
    o.name = 'Proj_' + o.name.split('_')[1]; o.matrix_world = Matrix.Identity(4)

delete([arms, arm])
for img in bpy.data.images:
    if img.size[0] > 1024: img.scale(1024, 1024)
bpy.ops.wm.save_as_mainfile(filepath=HERE + '/char/viewmodel.blend')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_image_format='JPEG', export_animations=False,
                          export_skins=False, export_yup=True, export_apply=True)
print('EXPORTED', OUT, os.path.getsize(OUT))
