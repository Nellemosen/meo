#!/usr/bin/env python3
"""Convert a .gltf (with .bin + external textures) or .glb into ONE self-contained .glb
with embedded, down-scaled textures. Optionally keep only some animations, or drop all
geometry and keep just the skeleton + animations (an "animation library" file).

Usage:
  build_glb.py IN.gltf OUT.glb [--tex 512] [--anims A,B,C] [--skeleton-only]
"""
import json, os, struct, io, sys, argparse, base64, urllib.parse
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('out')
ap.add_argument('--tex', type=int, default=512)
ap.add_argument('--anims', default='')
ap.add_argument('--skeleton-only', action='store_true')
a = ap.parse_args()

d = os.path.dirname(a.src)

def load_uri(uri):
    if uri.startswith('data:'):
        return base64.b64decode(uri.split(',', 1)[1])
    return open(os.path.join(d, urllib.parse.unquote(uri)), 'rb').read()

def read_src(path):
    if path.lower().endswith('.glb'):
        raw = open(path, 'rb').read()
        jl = struct.unpack('<I', raw[12:16])[0]
        g = json.loads(raw[20:20 + jl])
        off = 20 + jl
        bins = []
        while off < len(raw):
            cl, ct = struct.unpack('<II', raw[off:off + 8])
            if ct == 0x004E4942: bins.append(raw[off + 8:off + 8 + cl])
            off += 8 + cl + ((4 - cl % 4) % 4)
        return g, {0: bins[0] if bins else b''}
    g = json.load(open(path))
    bins = {}
    for bi, b in enumerate(g.get('buffers', [])):
        bins[bi] = load_uri(b['uri']) if 'uri' in b else b''
    return g, bins

g, bins = read_src(a.src)
keep = [s for s in a.anims.split(',') if s]

out = {'asset': {'version': '2.0', 'generator': 'build_glb.py'}, 'scene': 0, 'scenes': [{'nodes': []}],
       'nodes': [], 'meshes': [], 'materials': [], 'textures': [], 'images': [],
       'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}],
       'accessors': [], 'bufferViews': [], 'buffers': [{'byteLength': 0}], 'skins': [], 'animations': []}
blob = bytearray()

def add_bytes(data):
    while len(blob) % 4: blob.append(0)
    off = len(blob); blob.extend(data); return off

def view_bytes(vi):
    v = g['bufferViews'][vi]
    o = v.get('byteOffset', 0)
    return bins[v['buffer']][o:o + v['byteLength']]

# ---- copy bufferViews / accessors (only those the output needs) ----
bvmap = {}
def copy_view(vi):
    if vi in bvmap: return bvmap[vi]
    v = g['bufferViews'][vi]
    off = add_bytes(view_bytes(vi))
    nv = {'buffer': 0, 'byteOffset': off, 'byteLength': v['byteLength']}
    for k in ('byteStride', 'target'):
        if k in v: nv[k] = v[k]
    out['bufferViews'].append(nv); bvmap[vi] = len(out['bufferViews']) - 1
    return bvmap[vi]

amap = {}
def copy_acc(ai):
    if ai in amap: return amap[ai]
    ac = dict(g['accessors'][ai])
    if 'bufferView' in ac: ac['bufferView'] = copy_view(ac['bufferView'])
    out['accessors'].append(ac); amap[ai] = len(out['accessors']) - 1
    return amap[ai]

# ---- images / materials ----
def find_tex(uri):
    """Some kits reference names that don't exist on disk (e.g. 'X_png.png'): fall back sensibly."""
    cands = [os.path.join(d, uri), os.path.join(d, os.path.basename(uri))]
    base = os.path.basename(uri)
    stem, ext = os.path.splitext(base)
    if stem.endswith('_png'): cands.append(os.path.join(d, stem[:-4] + ext))
    for extra in ('Textures', os.path.join('..', 'Textures'), os.path.join('..', '..', 'Textures')):
        cands.append(os.path.join(d, extra, base))
        if stem.endswith('_png'): cands.append(os.path.join(d, extra, stem[:-4] + ext))
    for c in cands:
        if os.path.isfile(c): return c
    raise FileNotFoundError('texture not found: ' + uri)

imap = {}
def copy_img(ii):
    if ii in imap: return imap[ii]
    im_src = g['images'][ii]
    if 'uri' in im_src and im_src['uri']:
        u = im_src['uri']
        im = Image.open(io.BytesIO(load_uri(u))) if u.startswith('data:') else Image.open(find_tex(u))
    else:
        im = Image.open(io.BytesIO(view_bytes(im_src['bufferView'])))
    im.thumbnail((a.tex, a.tex), Image.LANCZOS)
    buf = io.BytesIO()
    if im.mode in ('RGBA', 'LA') and im.getextrema()[-1][0] < 250:
        im.save(buf, 'PNG', optimize=True); mime = 'image/png'
    else:
        im.convert('RGB').save(buf, 'JPEG', quality=86, optimize=True); mime = 'image/jpeg'
    off = add_bytes(buf.getvalue())
    out['bufferViews'].append({'buffer': 0, 'byteOffset': off, 'byteLength': len(buf.getvalue())})
    out['images'].append({'bufferView': len(out['bufferViews']) - 1, 'mimeType': mime,
                          'name': im_src.get('name', 'img%d' % ii)})
    imap[ii] = len(out['images']) - 1
    return imap[ii]

tmap = {}
def copy_tex(ti):
    if ti in tmap: return tmap[ti]
    out['textures'].append({'source': copy_img(g['textures'][ti]['source']), 'sampler': 0})
    tmap[ti] = len(out['textures']) - 1
    return tmap[ti]

mmap = {}
def copy_mat(mi):
    if mi in mmap: return mmap[mi]
    m = json.loads(json.dumps(g['materials'][mi]))
    pbr = m.get('pbrMetallicRoughness', {})
    for k in ('baseColorTexture', 'metallicRoughnessTexture'):
        if k in pbr: pbr[k] = {'index': copy_tex(pbr[k]['index'])}
    for k in ('normalTexture', 'occlusionTexture', 'emissiveTexture'):
        if k in m: m[k] = dict(m[k], index=copy_tex(m[k]['index']))
    m['pbrMetallicRoughness'] = pbr
    out['materials'].append(m); mmap[mi] = len(out['materials']) - 1
    return mmap[mi]

# ---- meshes / skins / nodes ----
meshmap = {}
if not a.skeleton_only:
    for mi, m in enumerate(g.get('meshes', [])):
        nm = json.loads(json.dumps(m))
        for p in nm['primitives']:
            p['attributes'] = {k: copy_acc(v) for k, v in p['attributes'].items()}
            if 'indices' in p: p['indices'] = copy_acc(p['indices'])
            if 'material' in p: p['material'] = copy_mat(p['material'])
            if 'targets' in p: p['targets'] = [{k: copy_acc(v) for k, v in t.items()} for t in p['targets']]
        out['meshes'].append(nm); meshmap[mi] = len(out['meshes']) - 1

skmap = {}
if not a.skeleton_only:
    for si, s in enumerate(g.get('skins', [])):
        ns = dict(s)
        if 'inverseBindMatrices' in ns: ns['inverseBindMatrices'] = copy_acc(ns['inverseBindMatrices'])
        out['skins'].append(ns); skmap[si] = len(out['skins']) - 1

for n in g['nodes']:
    nn = dict(n)
    if 'mesh' in nn:
        if a.skeleton_only or nn['mesh'] not in meshmap: nn.pop('mesh', None)
        else: nn['mesh'] = meshmap[nn['mesh']]
    if 'skin' in nn:
        if nn['skin'] in skmap: nn['skin'] = skmap[nn['skin']]
        else: nn.pop('skin', None)
    out['nodes'].append(nn)
out['scenes'][0]['nodes'] = list(g['scenes'][g.get('scene', 0)]['nodes'])

# ---- animations ----
for an in g.get('animations', []):
    if keep and an.get('name') not in keep: continue
    na = {'name': an.get('name', 'clip'), 'samplers': [], 'channels': []}
    for s in an['samplers']:
        na['samplers'].append({'input': copy_acc(s['input']), 'output': copy_acc(s['output']),
                               'interpolation': s.get('interpolation', 'LINEAR')})
    na['channels'] = [dict(c) for c in an['channels']]
    out['animations'].append(na)

for k in ('skins', 'animations', 'textures', 'images', 'materials', 'meshes'):
    if not out[k]: del out[k]
out['buffers'][0]['byteLength'] = len(blob)
js = json.dumps(out, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
while len(blob) % 4: blob.append(0)
glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blob)) \
    + struct.pack('<II', len(js), 0x4E4F534A) + js \
    + struct.pack('<II', len(blob), 0x004E4942) + bytes(blob)
open(a.out, 'wb').write(glb)
print('%s: %.2f MB, %d nodes, %d anims, %d images' % (a.out, len(glb) / 1e6, len(out['nodes']),
      len(out.get('animations', [])), len(out.get('images', []))))
