import bpy, os, sys, math, random
from mathutils import Vector
HERE=os.path.dirname(os.path.abspath(__file__))
args=dict(a.split('=') for a in sys.argv[sys.argv.index('--')+1:])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=args['src'])
def mat(name, tex=None, rgb=(0.05,0.05,0.05), rough=0.9, metal=0.0):
  m=bpy.data.materials.new(name); m.use_nodes=True; nt=m.node_tree; b=nt.nodes['Principled BSDF']
  b.inputs['Base Color'].default_value=(*rgb,1); b.inputs['Roughness'].default_value=rough; b.inputs['Metallic'].default_value=metal
  if tex:
    t=nt.nodes.new('ShaderNodeTexImage'); t.image=bpy.data.images.load(f'{HERE}/char/car_{tex}.jpg'); nt.links.new(t.outputs['Color'],b.inputs['Base Color'])
    n=nt.nodes.new('ShaderNodeTexImage'); n.image=bpy.data.images.load(f'{HERE}/char/car_normal.jpg'); n.image.colorspace_settings.name='Non-Color'
    nm=nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(n.outputs['Color'],nm.inputs['Color']); nt.links.new(nm.outputs['Normal'],b.inputs['Normal'])
    o=nt.nodes.new('ShaderNodeTexImage'); o.image=bpy.data.images.load(f'{HERE}/char/car_arm.jpg'); o.image.colorspace_settings.name='Non-Color'
    s=nt.nodes.new('ShaderNodeSeparateColor'); nt.links.new(o.outputs['Color'],s.inputs['Color']); (nt.links.new(s.outputs['Green'],b.inputs['Roughness']) if tex!='burnt' else None)
  return m
body=mat('WreckBody',args['tex'],rough=0.8,metal=0.2)
soot=mat('WreckSoot',None,(0.018,0.017,0.016),0.95)
tyre=mat('WreckTyre',None,(0.025,0.024,0.023),0.95)
metalm=mat('WreckMetal',None,(0.12,0.11,0.1),0.6,0.7)
burnt=args['tex']=='burnt'
meshes=[o for o in bpy.data.objects if o.type=='MESH']
for o in meshes:
  for s in o.material_slots:
    n=s.material.name.lower() if s.material else ''
    if 'window' in n or n in ('headlights','taillights','brakelight') or n=='black': s.material=soot if n!='black' else tyre
    elif n=='grey' and 'wheel' in o.name.lower(): s.material=metalm
    else: s.material=body
  bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active=o
  if len(o.data.uv_layers)==0: o.data.uv_layers.new(name='UVMap')
  bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
  bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.01, scale_to_bounds=False)
  bpy.ops.object.mode_set(mode='OBJECT')
  if burnt and 'wheel' in o.name.lower():
    o.scale*=0.92
# burnt wrecks sit low on their rims
if burnt:
  for o in meshes:
    if o.parent is None and 'wheel' not in o.name.lower(): o.location.z-=0.08
pts=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
size=[round(max(p[i] for p in pts)-min(p[i] for p in pts),2) for i in range(3)]
out=f"{HERE}/props_out/{args['name']}.glb"
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',export_image_format='JPEG',export_animations=False,export_yup=True)
print('CAR',args['name'],size,os.path.getsize(out))
