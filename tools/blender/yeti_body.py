# blender -b -P tools/blender/yeti_body.py -- out.glb   (Iceberg "Yeti" body parts; classic-space units)
import bpy, sys
out = sys.argv[sys.argv.index('--') + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
def mat(n, c, r=0.8):
    m = bpy.data.materials.new(n); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*c, 1); b.inputs['Roughness'].default_value = r; return m
def box(name, loc, size, m, bevel=0.08, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc); o = bpy.context.object; o.name = name; o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    mod = o.modifiers.new('b', 'BEVEL'); mod.width = bevel; mod.segments = 3
    bpy.ops.object.modifier_apply(modifier='b'); o.data.materials.append(m)
    if parent: o.parent = parent
    return o
def empty(n):
    bpy.ops.object.empty_add(location=(0, 0, 0)); e = bpy.context.object; e.name = n; return e
fur = mat('body_torso', (1, 1, 1)); belly = mat('yeti_belly', (0.86, 0.95, 1.0), 0.6)
horn = mat('yeti_horn', (0.55, 0.8, 0.95), 0.25); tuft = mat('yeti_fur', (0.97, 0.99, 1.0), 0.95)
# Blender Z-up; glTF exporter converts to Y-up (blender y -> -z). Torso centered at origin, 1x1x0.5 classic space.
T = empty('torso')
box('torso_shell', (0, 0, 0), (1.0, 0.5, 1.0), fur, 0.12, T)
box('belly', (0, -0.24, -0.05), (0.62, 0.06, 0.62), belly, 0.08, T)
for i, x in enumerate((-0.3, 0, 0.3)): box(f'scruff{i}', (x, 0.0, 0.5), (0.34, 0.56, 0.12), tuft, 0.05, T)
H = empty('head')   # head pivot at bottom of 0.62 cube (classic), cube spans z 0..0.62
for s in (-1, 1):
    h1 = box(f'horn{s}', (s * 0.36, 0, 0.5), (0.12, 0.14, 0.12), horn, 0.03, H)
    box(f'hornTip{s}', (s * 0.42, 0, 0.62), (0.09, 0.1, 0.16), horn, 0.03, H)
box('brow', (0, 0, 0.66), (0.5, 0.4, 0.1), tuft, 0.04, H)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=True)
