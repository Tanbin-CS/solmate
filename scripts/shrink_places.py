"""Shrink Natural Earth 1:50m populated places to what the Explorer place search needs.

Input: geojson/ne_50m_populated_places_simple.geojson from github.com/nvkelso/natural-earth-vector
(commit ca96624, sha256 8e70756b39fae9bcdc1e332bfc510c024c5edd3a13203ffd20092ee37b61d978), public domain.
Output: frontend/public/data/places.v1.json, rows of [name, ascii name or "", country, lat, lon, population].

usage: python -I scripts/shrink_places.py <in.geojson> frontend/public/data/places.v1.json
"""
import json
import sys

src, dst = sys.argv[1], sys.argv[2]
with open(src, encoding='utf-8') as f:
    fc = json.load(f)

rows = []
for ft in fc['features']:
    p = ft['properties']
    name = p['name']
    ascii_name = p.get('nameascii') or ''
    rows.append([
        name,
        ascii_name if ascii_name and ascii_name != name else '',
        p.get('adm0name') or '',
        round(float(p['latitude']), 2),
        round(float(p['longitude']), 2),
        int(p.get('pop_max') or 0),
    ])
rows.sort(key=lambda r: -r[5])

doc = {
    'version': 1,
    'source': 'Natural Earth 1:50m Cultural Vectors, Populated Places (public domain), naturalearthdata.com; nvkelso/natural-earth-vector@ca96624',
    'places': rows,
}
with open(dst, 'w', encoding='utf-8') as f:
    json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))
print(len(rows), 'places')
