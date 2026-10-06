"""Builds the enemy fighter GLB from CC0 Quaternius assets (Universal Base Characters,
Modular Character Outfits, Universal Animation Library 1+2, Ultimate Gun Pack) plus
CC-BY RPG launcher (austincford / Poly Pizza). Run with Blender 4.x in background mode."""
import bpy, bmesh, math, sys, os
from mathutils import Vector, Matrix, Quaternion

HERE = os.path.dirname(os.path.abspath(__file__))
D = HERE + '/dl/'
B = D + 'ubc/Universal Base Characters[Standard]/Base Characters/Godot - UE/Superhero_Male_FullBody.gltf'
HAIR = D + 'ubc/Universal Base Characters[Standard]/Hairstyles/Origin at 0/glTF (Godot)/Hair_Buzzed.gltf'
O = D + 'outfits/Modular Character Outfits - Fantasy[Standard]/Exports/glTF (Godot-Unreal)/Outfits/Male_Ranger.gltf'
UAL1 = D + 'ual/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb'
UAL2 = D + 'ual2/Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb'
GUNS = D + 'guns/OBJ/'
RPG = HERE + '/pp/2qqg9SbrsZ.glb'
OUT = HERE + '/char/fighter.glb'
RENDER = '--render' in sys.argv

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


# ---------------------------------------------------------------- base + outfit
base = imp(B)
arm = [o for o in base if o.type == 'ARMATURE'][0]
arm.name = 'Fighter'
body = [o for o in base if o.name == 'SuperHero_Male'][0]
delete([o for o in base if o.type == 'MESH' and o.name.startswith('Icosphere')])

outfit = imp(O)
oarm = [o for o in outfit if o.type == 'ARMATURE'][0]
keep = ['Male_Ranger_Body', 'Male_Ranger_Body_Belt_1', 'Male_Ranger_Body_Belt_2', 'Male_Ranger_Legs', 'Male_Ranger_Feet_Boots', 'Male_Ranger_Arms']
for o in outfit:
    if o.type == 'MESH' and o.name in keep:
        mw = o.matrix_world.copy()
        o.parent = arm
        o.matrix_world = mw
        for m in o.modifiers:
            if m.type == 'ARMATURE':
                m.object = arm
delete([o for o in outfit if not (o.type == 'MESH' and o.name in keep)])

# ---------------------------------------------------------------- cut body to head/neck
bpy.context.view_layer.objects.active = body
gi = {g.name: g.index for g in body.vertex_groups}
bm = bmesh.new(); bm.from_mesh(body.data)
deform = bm.verts.layers.deform.active
kill = []
for v in bm.verts:
    w = v[deform]
    headw = w.get(gi['Head'], 0) + w.get(gi['neck_01'], 0)
    if headw < 0.35:
        kill.append(v)
bmesh.ops.delete(bm, geom=kill, context='VERTS')
bm.to_mesh(body.data); bm.free()
body.name = 'Head'


def world_verts(o):
    return [o.matrix_world @ v.co for v in o.data.vertices]


def derive(src, name, face_test, push, material, solid=0.0):
    """Duplicate faces of src that pass face_test(center, normal) and push them out."""
    me = src.data.copy(); ob = src.copy(); ob.data = me; ob.name = name
    scene.collection.objects.link(ob)
    ob.parent = src.parent; ob.matrix_world = src.matrix_world.copy()
    bm = bmesh.new(); bm.from_mesh(me)
    bm.normal_update()
    mw = src.matrix_world
    kill = [f for f in bm.faces if not face_test(mw @ f.calc_center_median(), (mw.to_3x3() @ f.normal).normalized())]
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * push
    if solid:
        res = bmesh.ops.extrude_face_region(bm, geom=bm.faces[:])
        for e in res['geom']:
            if isinstance(e, bmesh.types.BMVert):
                e.co += e.normal * solid
    bm.to_mesh(me); bm.free()
    me.materials.clear(); me.materials.append(material)
    return ob


def mat(name, rgb, rough=0.9, metal=0.0, tex=None, normal=None, orm=None):
    m = bpy.data.materials.new(name); m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    nt = m.node_tree
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


EYE_Z = 1.699
black_knit = mat('M_Balaclava', (0.022, 0.022, 0.022), 0.97)
green_band = mat('M_Headband', (0.05, 0.30, 0.07), 0.85)
scarf_mat = mat('M_Scarf', (0.10, 0.10, 0.075), 0.95)


def eye_hole(c, n):
    return abs(c.z - EYE_Z) < 0.024 and abs(c.x) < 0.082 and c.y < -0.02


balaclava = derive(body, 'Balaclava', lambda c, n: not eye_hole(c, n) and c.z > 1.50, 0.0045, black_knit)
scarf = derive(body, 'FaceScarf', lambda c, n: c.z < EYE_Z - 0.03 and c.z > 1.50 and (c.y < 0.04 or c.z < 1.6), 0.008, scarf_mat)
hair_mat = mat('M_Hair', (0.025, 0.02, 0.016), 0.75)
hair = derive(body, 'Hair', lambda c, n: (c.z > 1.738 and (c.y > -0.075 or c.z > 1.775)) or (c.y > 0.02 and c.z > 1.62), 0.0035, hair_mat)

from mathutils.bvhtree import BVHTree
dg = bpy.context.evaluated_depsgraph_get()
bvh = BVHTree.FromObject(balaclava, dg)
N = 56
rows = (0.0175, -0.0175)
bm = bmesh.new()
ring = []
for i in range(N):
    a = 2 * math.pi * i / N
    d = Vector((math.sin(a), -math.cos(a), 0))
    col = []
    for dz in rows:
        zc = 1.756 - 0.012 * (1 - math.cos(a)) / 2 + dz  # a little lower at the back
        origin = Vector((0, 0.012, zc)) + d * 0.35
        loc, nrm, idx, dist = bvh.ray_cast(origin, -d)
        p = (loc if loc else Vector((0, 0.012, zc)) + d * 0.1) + d * 0.0075
        col.append(bm.verts.new(p))
        col.append(bm.verts.new(p - d * 0.0045))
    ring.append(col)
for i in range(N):
    a, b = ring[i], ring[(i + 1) % N]
    bm.faces.new((a[0], b[0], b[2], a[2]))      # outer
    bm.faces.new((a[3], b[3], b[1], a[1]))      # inner
    bm.faces.new((a[1], b[1], b[0], a[0]))      # top edge
    bm.faces.new((a[2], b[2], b[3], a[3]))      # bottom edge
# knot and two hanging tails at the back
back = ring[N // 2]
kc = (back[0].co + back[2].co) / 2 + Vector((0, 0.006, 0))
for side in (-1, 1):
    pts = [kc + Vector((side * 0.006 + side * k * 0.012, 0.004 + k * 0.012, -k * 0.045)) for k in range(4)]
    prev = None
    for k, p in enumerate(pts):
        w = 0.016 - k * 0.002
        l = bm.verts.new(p + Vector((-w, 0, 0))); r = bm.verts.new(p + Vector((w, 0, 0)))
        if prev: bm.faces.new((prev[0], prev[1], r, l))
        prev = (l, r)
knot = [bm.verts.new(kc + Vector((x, 0.012, z))) for x, z in ((-0.018, 0.012), (0.018, 0.012), (0.018, -0.012), (-0.018, -0.012))]
bm.faces.new(knot)
bm.normal_update()
me = bpy.data.meshes.new('Headband'); bm.to_mesh(me); bm.free()
headband = bpy.data.objects.new('Headband', me); scene.collection.objects.link(headband)
me.materials.append(green_band)
for p in me.polygons: p.use_smooth = True
headband.parent = arm
vg = headband.vertex_groups.new(name='Head'); vg.add(range(len(me.vertices)), 1.0, 'REPLACE')
mod = headband.modifiers.new('Armature', 'ARMATURE'); mod.object = arm

# dark eyebrows
for o in [o for o in bpy.data.objects if o.name.startswith("Eyebrows")]:
    if o.name.startswith('Eyebrows'):
        for s_ in o.material_slots:
            m_ = s_.material; nt = m_.node_tree; bsdf = nt.nodes.get('Principled BSDF')
            link = [l for l in nt.links if l.to_socket == bsdf.inputs['Base Color']]
            if link:
                mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 1.0
                mix.inputs[7].default_value = (0.12, 0.09, 0.07, 1)
                nt.links.new(link[0].from_socket, mix.inputs[6]); nt.links.new(mix.outputs[2], bsdf.inputs['Base Color'])

# ---------------------------------------------------------------- outfit material
outfit_mat = mat('M_Outfit', (1, 1, 1), 0.9, 0, HERE + '/char/outfit_camo.jpg', HERE + '/char/outfit_normal.jpg', HERE + '/char/outfit_orm.jpg')
for o in arm.children:
    if o.name.startswith('Male_Ranger'):
        for i, s in enumerate(o.material_slots):
            if s.material and s.material.name.startswith('MI_Ranger'):
                s.material = outfit_mat

# ---------------------------------------------------------------- rigid gear helpers
def bone_world(name):
    return arm.matrix_world @ arm.pose.bones[name].matrix


def parent_to_bone(ob, bone):
    mw = ob.matrix_world.copy()
    ob.parent = arm; ob.parent_type = 'BONE'; ob.parent_bone = bone
    bpy.context.view_layer.update()
    ob.matrix_world = mw


def box(name, size, loc, material, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    ob = bpy.context.active_object; ob.name = name; ob.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.ops.object.shade_flat()
    ob.data.materials.append(material); return ob


def cyl(name, r, depth, loc, material, rot=(0, 0, 0), verts=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    ob = bpy.context.active_object; ob.name = name
    bpy.ops.object.shade_smooth(); ob.data.materials.append(material); return ob


def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join(); objs[0].name = name; return objs[0]


pouch_mat = mat('M_Pouch', (0.05, 0.05, 0.045), 0.92)
torso = bpy.data.objects['Male_Ranger_Body']
tbvh = BVHTree.FromObject(torso, bpy.context.evaluated_depsgraph_get())
def front_y(x, z):
    loc, n, i, d = tbvh.ray_cast(Vector((x, -0.6, z)), Vector((0, 1, 0)))
    return loc.y if loc else -0.15
pouches = []
for i, x in enumerate((-0.085, 0, 0.085)):
    y = min(front_y(x, 1.16), front_y(x, 1.24)) - 0.022
    pouches.append(box(f'pouch{i}', (0.075, 0.05, 0.13), (x, y, 1.20), pouch_mat))
    pouches.append(box(f'flap{i}', (0.08, 0.056, 0.03), (x, y - 0.003, 1.267), pouch_mat))
chest = join(pouches, 'ChestPouches'); parent_to_bone(chest, 'spine_03')
VEST_Y = min(front_y(0, 1.17), front_y(0.1, 1.17))
print('VEST front y', VEST_Y)

# suicide vest: pipes, wires and a detonator light
pipe_mat = mat('M_Pipe', (0.22, 0.22, 0.20), 0.55, 0.6)
tape_mat = mat('M_Tape', (0.55, 0.42, 0.05), 0.7)
wire_mat = mat('M_Wire', (0.55, 0.05, 0.04), 0.6)
light_mat = mat('M_BomberLight', (1.0, 0.05, 0.02), 0.4)
parts = []
for i in range(9):
    a = math.radians(-70 + i * 17.5)
    x, y = math.sin(a) * 0.18, -math.cos(a) * (abs(VEST_Y) + 0.012) + 0.0
    parts.append(cyl(f'pipe{i}', 0.026, 0.2, (x, y - 0.012, 1.17), pipe_mat))
    parts.append(cyl(f'tape{i}', 0.028, 0.03, (x, y - 0.012, 1.22), tape_mat))
for i in range(2):
    parts.append(cyl(f'wire{i}', 0.004, 0.36, (0, -0.19 - i * 0.006, 1.27 - i * 0.07), wire_mat, rot=(0, math.radians(90), 0), verts=6))
parts.append(box('vest-strap', (0.42, 0.012, 0.045), (0, -0.17, 1.30), tape_mat))
parts.append(box('detonator', (0.07, 0.035, 0.05), (0.0, -0.205, 1.12), pipe_mat))
light = box('BomberLight', (0.022, 0.012, 0.022), (0.0, -0.225, 1.125), light_mat)
vest = join(parts, 'BomberVest'); parent_to_bone(vest, 'spine_03'); parent_to_bone(light, 'spine_03')

# ---------------------------------------------------------------- weapons
gun_metal = mat('M_GunMetal', (0.045, 0.047, 0.05), 0.42, 0.85)
gun_wood = mat('M_GunWood', (0.27, 0.13, 0.06), 0.6)
gun_poly = mat('M_GunPolymer', (0.035, 0.035, 0.035), 0.65)


def import_gun(path, name, length):
    objs = [o for o in imp(path) if o.type == 'MESH']
    for o in objs:
        for s in o.material_slots:
            n = (s.material.name if s.material else '').lower()
            s.material = gun_wood if ('wood' in n or 'brown' in n) else gun_metal
    g = join(objs, name) if len(objs) > 1 else objs[0]
    g.name = name
    bpy.ops.object.select_all(action='DESELECT'); g.select_set(True); bpy.context.view_layer.objects.active = g
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bbox = [g.matrix_world @ Vector(c) for c in g.bound_box]
    size_x = max(v.x for v in bbox) - min(v.x for v in bbox)
    s = length / size_x
    g.scale = (s, s, s); bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    # recentre so origin sits at the grip/bore reference supplied later
    return g


ak = import_gun(GUNS + 'AssaultRifle_2.obj', 'AK47', 0.88)
pistol = import_gun(GUNS + 'Pistol_1.obj', 'EnemyPistol', 0.2)
rpg_objs = [o for o in imp(RPG) if o.type == 'MESH']
rpg = join(rpg_objs, 'RPG7') if len(rpg_objs) > 1 else rpg_objs[0]
for o in [rpg]:
    mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bb = [Vector(c) for c in rpg.bound_box]
ext = Vector((max(v.x for v in bb) - min(v.x for v in bb), max(v.y for v in bb) - min(v.y for v in bb), max(v.z for v in bb) - min(v.z for v in bb)))
print('RPG extents', ext)

rs = 1.25 / ext.y
rpg.scale = (rs, rs, rs); bpy.context.view_layer.objects.active = rpg
bpy.ops.object.select_all(action='DESELECT'); rpg.select_set(True)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
for s_ in rpg.material_slots:
    pass


def verts_world(o):
    return [o.matrix_world @ v.co for v in o.data.vertices]


def centre(pts):
    return sum(pts, Vector()) / max(1, len(pts))


# key points of each weapon in its own space (+X muzzle, +Z up for the guns)
akv = verts_world(ak)
AK_BUTT = Vector((min(v.x for v in akv), 0, 0))
grip_pts = [v for v in akv if -0.09 < v.x < 0.03 and v.z < -0.035]
AK_GRIP = centre(grip_pts)
hg = [v for v in akv if 0.17 < v.x < 0.23 and v.z > 0.035]
AK_GUARD = Vector((0.20, 0, min(v.z for v in hg) + 0.004))
AK_BORE_Z = centre([v for v in akv if v.x > 0.55]).z
AK_BUTT.z = AK_BORE_Z - 0.03
print('AK butt', AK_BUTT, 'grip', AK_GRIP, 'guard', AK_GUARD, 'bore', AK_BORE_Z)
pv = verts_world(pistol)
P_GRIP = centre([v for v in pv if v.x < 0.06 and v.z < -0.0])
print('PISTOL grip', P_GRIP)
rv = verts_world(rpg)
ymin, ymax = min(v.y for v in rv), max(v.y for v in rv)
rad = lambda pts: max((Vector((v.x, 0, v.z)) - Vector((0, 0, 0.0))).length for v in pts) if pts else 0
endA = [v for v in rv if v.y > ymax - 0.15]; endB = [v for v in rv if v.y < ymin + 0.15]
# warhead end is the one with the larger cone
WARHEAD_SIGN = 1 if (max(v.x for v in endA) - min(v.x for v in endA)) > (max(v.x for v in endB) - min(v.x for v in endB)) else -1
below = [v for v in rv if v.z < min(v.z for v in rv) + 0.06]
print('RPG y', ymin, ymax, 'warhead sign', WARHEAD_SIGN, 'grips', centre(below))
RPG_TUBE_Z = centre([v for v in rv if abs(v.y) < 0.1]).z

# ---------------------------------------------------------------- animations
def import_actions(path):
    objs = imp(path)
    a = [o for o in objs if o.type == 'ARMATURE'][0]
    suffix = '_' + a.name
    for act in bpy.data.actions:
        if act.name.endswith(suffix):
            act.name = act.name[:-len(suffix)]
    delete(objs)


import_actions(UAL1)
import_actions(UAL2)
for pb in arm.pose.bones:
    pb.rotation_mode = 'QUATERNION'


def pose_world(name):
    return arm.matrix_world @ arm.pose.bones[name].matrix


def set_world(name, M):
    arm.pose.bones[name].matrix = arm.matrix_world.inverted() @ M
    bpy.context.view_layer.update()


def freeze(act_name, frame):
    arm.animation_data_create(); arm.animation_data.action = bpy.data.actions[act_name]
    scene.frame_set(frame); bpy.context.view_layer.update()
    basis = {pb.name: pb.matrix_basis.copy() for pb in arm.pose.bones}
    arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.matrix_basis = basis[pb.name]
    bpy.context.view_layer.update()


def capture():
    return {pb.name: pb.matrix_basis.copy() for pb in arm.pose.bones}


def restore(pose):
    for pb in arm.pose.bones:
        pb.matrix_basis = pose[pb.name]
    bpy.context.view_layer.update()


def solve_arm(side, wrist, hand_rot, pole):
    up, lo, hd = f'upperarm_{side}', f'lowerarm_{side}', f'hand_{side}'
    S = pose_world(up).translation.copy()
    l1 = arm.pose.bones[up].length; l2 = arm.pose.bones[lo].length
    dv = wrist - S; d = min(dv.length, (l1 + l2) * 0.995); dr = dv.normalized()
    T = S + dr * d
    a = (l1 * l1 - l2 * l2 + d * d) / (2 * d); h = math.sqrt(max(0.0, l1 * l1 - a * a))
    pv = pole - S; pv = pv - dr * pv.dot(dr); pv.normalize()
    E = S + dr * a + pv * h

    def aim(name, head, tip):
        M = pose_world(name)
        oldY = M.col[1].xyz.normalized(); newY = (tip - head).normalized()
        R = oldY.rotation_difference(newY).to_matrix() @ M.to_3x3().normalized()
        set_world(name, Matrix.Translation(head) @ R.to_4x4())
    aim(up, S, E); aim(lo, E, T)
    set_world(hd, Matrix.Translation(T) @ hand_rot.to_4x4())
    return (T - wrist).length


def frame_from(y_axis, n_axis):
    y = y_axis.normalized(); n = (n_axis - y * n_axis.dot(y)).normalized(); x = y.cross(n)
    return Matrix((y, n, x)).transposed()


# palm normal and palm centre in each hand's local space (rest pose has palms down)
PALM = {}
for side in ('l', 'r'):
    hb = arm.data.bones[f'hand_{side}']; rest = arm.matrix_world @ hb.matrix_local
    n_local = rest.to_3x3().inverted() @ Vector((0, 0, -1))
    mid = arm.matrix_world @ arm.data.bones[f'middle_01_{side}'].head_local
    m_local = rest.inverted() @ mid
    PALM[side] = (n_local.normalized(), m_local * 0.6 + n_local.normalized() * 0.028)
    print('PALM', side, PALM[side])


def hand_rot(side, finger_dir, palm_dir):
    n_local, _ = PALM[side]
    Y = Vector((0, 1, 0))
    return frame_from(finger_dir, palm_dir) @ frame_from(Y, n_local).inverted()


def wrist_for(side, rot, palm_point):
    return palm_point - rot @ PALM[side][1]


UPPER = set()
def collect(b):
    UPPER.add(b.name)
    for c in b.children: collect(c)
collect(arm.data.bones['spine_03'])

# ---- rifle aim / low ready (rifle +X forward -> world -Y; character faces -Y)
RIFLE_ROT = Matrix.Rotation(-math.pi / 2, 4, 'Z')


def rifle_world(butt_pos, pitch=0.0, yaw=0.0):
    R = Matrix.Rotation(yaw, 4, 'Z') @ Matrix.Rotation(pitch, 4, 'X') @ RIFLE_ROT
    return Matrix.Translation(butt_pos) @ R @ Matrix.Translation(-AK_BUTT)


R_FINGER = Vector((0.0, -0.55, -0.85))   # wrist -> knuckles for a pistol grip
R_PALM = Vector((1.0, 0.0, 0.0))         # palm faces the grip (character's left)
L_FINGER = Vector((-0.55, -0.8, 0.05))
L_PALM = Vector((-0.35, 0.0, 1.0))


def curl(side, palm_world, amount=math.radians(55)):
    for f in ('index', 'middle', 'ring', 'pinky'):
        for j in ('01', '02', '03'):
            amount_j = amount * (0.8 if j == '01' else 1.35)
            name = f'{f}_{j}_{side}'
            M = pose_world(name); p = M.translation.copy()
            axis = M.col[0].xyz.normalized()
            tail = M @ Vector((0, arm.pose.bones[name].length, 0))
            best = None
            for sgn in (1, -1):
                R = Matrix.Translation(p) @ Matrix.Rotation(sgn * amount_j, 4, axis) @ Matrix.Translation(-p)
                score = ((R @ tail) - tail).dot(palm_world)
                if best is None or score > best[0]: best = (score, R)
            set_world(name, best[1] @ M)


def hold(M, grip_local, guard_local, pole_r=Vector((-0.55, 0.15, 1.05)), pole_l=Vector((0.45, -0.05, 0.95))):
    R3 = M.to_3x3().normalized() @ RIFLE_ROT.to_3x3().inverted()
    rr = hand_rot('r', R3 @ R_FINGER, R3 @ R_PALM)
    err_r = solve_arm('r', wrist_for('r', rr, M @ grip_local), rr, pole_r)
    rl = hand_rot('l', R3 @ L_FINGER, R3 @ L_PALM)
    err_l = solve_arm('l', wrist_for('l', rl, M @ guard_local), rl, pole_l)
    curl('l', (rl @ PALM['l'][0]).normalized(), math.radians(48))
    return err_r, err_l


poses = {}
freeze('Pistol_Aim_Neutral', 4)
base_aim = capture()


def rot_about(bone, angle, axis='Z'):
    M = pose_world(bone); p = M.translation.copy()
    set_world(bone, Matrix.Translation(p) @ Matrix.Rotation(angle, 4, axis) @ Matrix.Translation(-p) @ M)


# blade the torso: right shoulder back, left shoulder forward, head kept on target
for b, a in (('spine_02', -14), ('spine_03', -14)):
    rot_about(b, math.radians(a))
for b, a in (('neck_01', 18), ('Head', 8)):
    rot_about(b, math.radians(a))
bladed = capture()
restore(bladed)
M_aim = rifle_world(Vector((-0.13, 0.0, 1.55)))
print('aim reach error', hold(M_aim, AK_GRIP, AK_GUARD))
poses['rifle_aim'] = capture()
ak.matrix_world = M_aim
bpy.context.view_layer.update()


def muzzle(gun, local_point, name):
    e = bpy.data.objects.new(name, None); scene.collection.objects.link(e)
    e.matrix_world = Matrix.Translation(gun.matrix_world @ local_point)
    mw = e.matrix_world.copy(); e.parent = gun; e.matrix_world = mw
    return e


muzzle(ak, Vector((max(v.x for v in akv), 0, AK_BORE_Z)), 'AK47_Muzzle')
parent_to_bone(ak, 'hand_r')
restore(bladed)
M_low = rifle_world(Vector((-0.12, -0.02, 1.43)), pitch=math.radians(28), yaw=math.radians(22))
print('low reach error', hold(M_low, AK_GRIP, AK_GUARD))
poses['rifle_low'] = capture()

# ---- RPG on the right shoulder
restore(base_aim)
tube_dir = Vector((0, -1, 0))
RPG_ROT = Matrix.Rotation(math.pi if WARHEAD_SIGN < 0 else 0, 4, 'Z')  # warhead -> -Y
rpg_centre_local = Vector((0, (ymin + ymax) / 2, RPG_TUBE_Z))
M_rpg = Matrix.Translation(Vector((-0.15, 0.02, 1.565))) @ RPG_ROT @ Matrix.Translation(-rpg_centre_local)
rgrip = Vector((0, 0, 0)); rguard = Vector((0, 0, 0))
# grips relative to the tube centre in world space after placement
grip_r_world = Vector((-0.15, -0.16, 1.47)); grip_l_world = Vector((-0.12, -0.42, 1.505))
Mi = M_rpg.inverted()
rr = hand_rot('r', R_FINGER, R_PALM); solve_arm('r', wrist_for('r', rr, grip_r_world), rr, Vector((-0.6, 0.1, 1.1)))
rl = hand_rot('l', Vector((-0.4, -0.85, 0.0)), Vector((-0.3, 0.0, 1.0))); solve_arm('l', wrist_for('l', rl, grip_l_world), rl, Vector((0.4, -0.1, 0.95))); curl('l', (rl @ PALM['l'][0]).normalized(), math.radians(48))
poses['rpg'] = capture()
rpg.matrix_world = M_rpg
bpy.context.view_layer.update()
wv = verts_world(rpg)
front = min(v.y for v in wv)
tube_c = centre([v for v in wv if v.y < front + 0.12])
war_mat = mat('M_Warhead', (0.20, 0.23, 0.15), 0.6, 0.3)
w1 = cyl('wh_body', 0.042, 0.13, (tube_c.x, front - 0.065, tube_c.z), war_mat, rot=(math.radians(90), 0, 0), verts=14)
bpy.ops.mesh.primitive_cone_add(vertices=14, radius1=0.042, radius2=0.012, depth=0.16, location=(tube_c.x, front - 0.21, tube_c.z), rotation=(math.radians(90), 0, 0))
w2 = bpy.context.active_object; w2.data.materials.append(war_mat); bpy.ops.object.shade_smooth()
w3 = cyl('wh_tip', 0.012, 0.05, (tube_c.x, front - 0.31, tube_c.z), pipe_mat, rot=(math.radians(90), 0, 0), verts=8)
w4 = cyl('wh_neck', 0.02, 0.05, (tube_c.x, front + 0.005, tube_c.z), war_mat, rot=(math.radians(90), 0, 0), verts=10)
rpg = join([rpg, w1, w2, w3, w4], 'RPG7')
e = bpy.data.objects.new('RPG7_Muzzle', None); scene.collection.objects.link(e)
e.location = (tube_c.x, front - 0.33, tube_c.z); bpy.context.view_layer.update()
mw = e.matrix_world.copy(); e.parent = rpg; e.matrix_world = mw
parent_to_bone(rpg, 'hand_r')

# ---- pistol in the right palm of the pistol aim pose
restore(base_aim)
hr = pose_world('hand_r')
palm_w = hr @ PALM['r'][1]
fwd = (pose_world('hand_r').to_3x3() @ Vector((0, 1, 0))).normalized()
M_p = Matrix.Translation(palm_w + Vector((0, -0.005, 0.01))) @ Matrix.Rotation(math.radians(-8), 4, 'X') @ RIFLE_ROT @ Matrix.Translation(-P_GRIP)
pistol.matrix_world = M_p
bpy.context.view_layer.update()
muzzle(pistol, Vector((max(v.x for v in pv), 0, centre([v for v in pv if v.x > max(w.x for w in pv) - 0.01]).z)), 'Pistol_Muzzle')
parent_to_bone(pistol, 'hand_r')

# ---------------------------------------------------------------- build actions
def key_pose(act, bone, M, frames):
    loc, rot, sc = M.decompose()
    base_path = f'pose.bones["{bone}"]'
    for prop, vals in (('location', loc), ('rotation_quaternion', rot), ('scale', sc)):
        for i, v in enumerate(vals):
            fc = act.fcurves.find(f'{base_path}.{prop}', index=i) or act.fcurves.new(f'{base_path}.{prop}', index=i, action_group=bone)
            for f in frames:
                fc.keyframe_points.insert(f, v, options={'FAST'})


def combine(name, loco, pose, bones=UPPER):
    src = bpy.data.actions[loco]
    act = src.copy(); act.name = name
    for fc in list(act.fcurves):
        if '"' in fc.data_path and fc.data_path.split('"')[1] in bones:
            act.fcurves.remove(fc)
    f0, f1 = src.frame_range
    for b in bones:
        key_pose(act, b, pose[b], (f0, f1))
    return act


def static(name, pose):
    act = bpy.data.actions.new(name)
    for b in pose:
        key_pose(act, b, pose[b], (1, 2))
    return act


final = []
final.append(combine('Rifle_Idle', 'Idle_Loop', poses['rifle_low']))
final.append(combine('Rifle_AimIdle', 'Idle_Loop', poses['rifle_aim']))
final.append(combine('Rifle_Walk', 'Walk_Loop', poses['rifle_low']))
final.append(combine('Rifle_AimWalk', 'Walk_Loop', poses['rifle_aim']))
final.append(combine('Rifle_Run', 'Jog_Fwd_Loop', poses['rifle_low']))
final.append(combine('RPG_Idle', 'Idle_Loop', poses['rpg']))
final.append(combine('RPG_Walk', 'Walk_Loop', poses['rpg']))
final.append(combine('Pistol_Walk', 'Walk_Loop', base_aim))
final.append(combine('Pistol_Run', 'Jog_Fwd_Loop', base_aim))
for n in ('Pistol_Idle_Loop', 'Pistol_Aim_Neutral', 'Pistol_Shoot', 'Pistol_Reload', 'Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop',
          'Death01', 'Hit_Chest', 'Hit_Head', 'Hit_Knockback', 'OverhandThrow'):
    final.append(bpy.data.actions[n])
restore(base_aim)
for pb in arm.pose.bones:
    pb.matrix_basis = Matrix.Identity(4)
bpy.context.view_layer.update()

keep_names = {a.name for a in final}
for a in list(bpy.data.actions):
    if a.name not in keep_names:
        bpy.data.actions.remove(a)
arm.animation_data_create()
for a in final:
    tr = arm.animation_data.nla_tracks.new(); tr.name = a.name
    st = tr.strips.new(a.name, int(a.frame_range[0]), a); tr.mute = True
arm.animation_data.action = None

# ---------------------------------------------------------------- texture budget
for img in bpy.data.images:
    if img.size[0] > 1024:
        img.scale(1024, 1024)

bpy.ops.wm.save_as_mainfile(filepath=HERE + '/char/stage2.blend')
if '--export' in sys.argv:
    bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_animations=True, export_animation_mode='NLA_TRACKS',
                              export_image_format='JPEG', export_skins=True, export_morph=False, export_def_bones=False,
                              export_optimize_animation_size=True, export_apply=False, export_yup=True, export_cameras=False, export_lights=False)
    print('EXPORTED', OUT, os.path.getsize(OUT))
