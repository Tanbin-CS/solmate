"""Shrink Natural Earth 1:110m admin-0 countries to names + rounded polygons for the web app.

Input: geojson/ne_110m_admin_0_countries.geojson from github.com/nvkelso/natural-earth-vector
(commit ca96624, sha256 6866c877d39cba9c357620878839b336d569f8c662d3cfab4cb1dbe2d39c977f), public domain.
Output: frontend/public/data/countries.v1.json (names, bounding boxes, rings rounded to 0.01 degrees).

usage: python -I scripts/shrink_countries.py <in.geojson> frontend/public/data/countries.v1.json [--peek]
"""
import json
import sys

src, dst = sys.argv[1], sys.argv[2]
with open(src, encoding='utf-8') as f:
    fc = json.load(f)

if '--peek' in sys.argv:
    for ft in fc['features'][:400]:
        p = ft['properties']
        print(p.get('ADMIN'), '|', p.get('NAME'), '|', p.get('NAME_EN'), '|', ft['geometry']['type'])
    sys.exit()


def ring(r):
    flat = []
    for lon, lat in r:
        flat += [round(lon, 2), round(lat, 2)]
    return flat


SHORT = {"People's Republic of China": 'China', 'Turkish Republic of Northern Cyprus': 'Northern Cyprus'}

out = []
for ft in fc['features']:
    p = ft['properties']
    name = p.get('NAME_EN') or p.get('ADMIN') or p.get('NAME')
    name = SHORT.get(name, name)
    g = ft['geometry']
    polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    rings = [[ring(r) for r in poly] for poly in polys]
    xs = [v for poly in rings for r in poly for v in r[0::2]]
    ys = [v for poly in rings for r in poly for v in r[1::2]]
    out.append({'n': name, 'b': [min(xs), min(ys), max(xs), max(ys)], 'p': rings})

doc = {
    'version': 1,
    'source': 'Natural Earth 1:110m Cultural Vectors, Admin 0 - Countries (public domain), naturalearthdata.com; nvkelso/natural-earth-vector@ca96624',
    'countries': sorted(out, key=lambda c: c['n']),
}
with open(dst, 'w', encoding='utf-8') as f:
    json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))
print(len(out), 'countries')
