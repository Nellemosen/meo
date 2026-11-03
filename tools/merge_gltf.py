#!/usr/bin/env python3
"""Merge several .gltf files (with .bin and external textures) into ONE .glb that shares materials/textures.
Each source file becomes a top-level node named after the file (so the game can fetch pieces by name).
Textures are resized (max --tex px) and re-encoded as JPEG (or PNG if they have transparency).
Usage: merge_gltf.py OUT.glb --tex 1024 --ntex 512 FILE.gltf [FILE.gltf ...]"""
import json, sys, os, struct, io, argparse
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('out'); ap.add_argument('files', nargs='+')
ap.add_argument('--tex', type=int, default=1024); ap.add_argument('--ntex', type=int, default=512)
a = ap.parse_args()

out = {'asset': {'version': '2.0', 'generator': 'merge_gltf.py'}, 'scene': 0, 'scenes': [{'nodes': []}], 'nodes': [], 'meshes': [],
       'materials': [], 'textures': [], 'images': [], 'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}],
       'accessors': [], 'bufferViews': [], 'buffers': [{'byteLength': 0}], 'skins': [], 'animations': []}
blob = bytearray()
mat_by_name = {}; img_by_key = {}

def add_bytes(data):
    while len(blob) % 4: blob.append(0)
    off = len(blob); blob.extend(data); return off

def add_image(path, kind):
    key = (os.path.basename(path), kind)
    if key in img_by_key: return img_by_key[key]
    im = Image.open(path)
    lim = a.ntex if kind == 'normal' or kind == 'orm' else a.tex
    im.thumbnail((lim, lim), Image.LANCZOS)
    buf = io.BytesIO()
    if im.mode in ('RGBA', 'LA') and im.getextrema()[-1][0] < 250:
        im.save(buf, 'PNG', optimize=True); mime = 'image/png'
    else:
        im.convert('RGB').save(buf, 'JPEG', quality=84, optimize=True); mime = 'image/jpeg'
    off = add_bytes(buf.getvalue())
    out['bufferViews'].append({'buffer': 0, 'byteOffset': off, 'byteLength': len(buf.getvalue())})
    out['images'].append({'bufferView': len(out['bufferViews']) - 1, 'mimeType': mime, 'name': os.path.splitext(os.path.basename(path))[0]})
    img_by_key[key] = len(out['images']) - 1
    return img_by_key[key]

def add_tex(src_g, ti, d, kind, srgb_unused=None):
    t = src_g['textures'][ti]
    img = src_g['images'][t['source']]
    idx = add_image(os.path.join(d, img['uri']), kind)
    for i, tt in enumerate(out['textures']):
        if tt['source'] == idx: return i
    out['textures'].append({'source': idx, 'sampler': 0})
    return len(out['textures']) - 1

for fpath in a.files:
    g = json.load(open(fpath)); d = os.path.dirname(fpath)
    name = os.path.splitext(os.path.basename(fpath))[0]
    bins = {}
    for bi, b in enumerate(g['buffers']): bins[bi] = open(os.path.join(d, b['uri']), 'rb').read()
    # materials
    mmap = {}
    for mi, m in enumerate(g.get('materials', [])):
        key = m.get('name', 'mat%d' % mi)
        if key not in mat_by_name:
            nm = json.loads(json.dumps(m)); nm['doubleSided'] = m.get('doubleSided', False)
            pbr = nm.get('pbrMetallicRoughness', {})
            if 'baseColorTexture' in pbr: pbr['baseColorTexture'] = {'index': add_tex(g, pbr['baseColorTexture']['index'], d, 'color')}
            if 'metallicRoughnessTexture' in pbr: pbr['metallicRoughnessTexture'] = {'index': add_tex(g, pbr['metallicRoughnessTexture']['index'], d, 'orm')}
            if 'normalTexture' in nm: nm['normalTexture'] = {'index': add_tex(g, nm['normalTexture']['index'], d, 'normal')}
            if 'occlusionTexture' in nm: nm['occlusionTexture'] = {'index': add_tex(g, nm['occlusionTexture']['index'], d, 'orm')}
            nm['pbrMetallicRoughness'] = pbr
            out['materials'].append(nm); mat_by_name[key] = len(out['materials']) - 1
        mmap[mi] = mat_by_name[key]
    # buffer views / accessors (copy every view used by this file)
    bvmap = {}
    for vi, v in enumerate(g.get('bufferViews', [])):
        data = bins[v['buffer']][v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]
        off = add_bytes(data)
        nv = {'buffer': 0, 'byteOffset': off, 'byteLength': v['byteLength']}
        if 'byteStride' in v: nv['byteStride'] = v['byteStride']
        if 'target' in v: nv['target'] = v['target']
        out['bufferViews'].append(nv); bvmap[vi] = len(out['bufferViews']) - 1
    amap = {}
    for ai, ac in enumerate(g.get('accessors', [])):
        na = dict(ac)
        if 'bufferView' in na: na['bufferView'] = bvmap[na['bufferView']]
        out['accessors'].append(na); amap[ai] = len(out['accessors']) - 1
    # meshes
    meshmap = {}
    for mi, m in enumerate(g.get('meshes', [])):
        nm = json.loads(json.dumps(m))
        for p in nm['primitives']:
            p['attributes'] = {k: amap[v] for k, v in p['attributes'].items()}
            if 'indices' in p: p['indices'] = amap[p['indices']]
            if 'material' in p: p['material'] = mmap[p['material']]
        out['meshes'].append(nm); meshmap[mi] = len(out['meshes']) - 1
    # skins
    skmap = {}
    base_n = len(out['nodes']) + 1   # +1: the wrapper node comes first
    for si, s in enumerate(g.get('skins', [])):
        ns = dict(s)
        if 'inverseBindMatrices' in ns: ns['inverseBindMatrices'] = amap[ns['inverseBindMatrices']]
        ns['joints'] = [j + base_n for j in ns['joints']]
        if 'skeleton' in ns: ns['skeleton'] += base_n
        out['skins'].append(ns); skmap[si] = len(out['skins']) - 1
    # nodes: wrapper first, then the file's nodes (indices shifted)
    scene_roots = g['scenes'][g.get('scene', 0)]['nodes']
    wrapper = {'name': name, 'children': [r + base_n for r in scene_roots]}
    out['nodes'].append(wrapper)
    out['scenes'][0]['nodes'].append(len(out['nodes']) - 1)
    for n in g['nodes']:
        nn = dict(n)
        if 'children' in nn: nn['children'] = [c + base_n for c in nn['children']]
        if 'mesh' in nn: nn['mesh'] = meshmap[nn['mesh']]
        if 'skin' in nn: nn['skin'] = skmap[nn['skin']]
        out['nodes'].append(nn)

for k in ('skins', 'animations', 'textures', 'images', 'materials'):
    if not out[k]: del out[k]
out['buffers'][0]['byteLength'] = len(blob)
js = json.dumps(out, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
while len(blob) % 4: blob.append(0)
glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blob)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(blob), 0x004E4942) + bytes(blob)
open(a.out, 'wb').write(glb)
print('%s: %d pieces, %d materials, %d images, %.1f MB' % (a.out, len(a.files), len(out['materials']), len(out.get('images', [])), len(glb) / 1e6))
