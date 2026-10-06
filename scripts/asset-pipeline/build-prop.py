import bpy, os, sys, math
from mathutils import Vector
HERE=os.path.dirname(os.path.abspath(__file__))
spec=dict(a.split('=') for a in sys.argv[sys.argv.index('--')+1:])
name=spec['name']; src=spec['src']; tex=int(spec.get('tex','512')); maxtris=int(spec.get('maxtris','8000'))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes=[o for o in bpy.data.objects if o.type=='MESH']
tris=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes)
if tris>maxtris:
  ratio=maxtris/tris
  for o in meshes:
    if o.data.users>1: o.data=o.data.copy()
    if o.data.shape_keys:
      bpy.context.view_layer.objects.active=o; bpy.ops.object.shape_key_remove(all=True)
    m=o.modifiers.new('dec','DECIMATE'); m.ratio=ratio
    bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier='dec')
tris2=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes)
for img in bpy.data.images:
  if img.size[0]>tex: img.scale(tex,tex)
pts=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
size=[round(max(p[i] for p in pts)-min(p[i] for p in pts),3) for i in range(3)]
out=f'{HERE}/props_out/{name}.glb'
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',export_image_format='JPEG',export_animations=False,export_yup=True)
print('PROP',name,'tris',tris,'->',tris2,'size(xyz blender)',size,'bytes',os.path.getsize(out))
