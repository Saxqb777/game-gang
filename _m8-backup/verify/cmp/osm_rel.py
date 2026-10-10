"""Extract a loop from a type=circuit relation (or ways with given names) in an OSM extract.
Usage: python3 -I osm_rel.py RAW.osm OUT.xy.json TARGET_M [relation_id]"""
import json, math, sys, os
import xml.etree.ElementTree as ET
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import osm_fetch

raw, out, target = sys.argv[1], sys.argv[2], float(sys.argv[3])
rid = sys.argv[4] if len(sys.argv) > 4 else None
root = ET.parse(raw).getroot()
ways = set()
for rel in root.iter('relation'):
    t = {x.get('k'): x.get('v') for x in rel.iter('tag')}
    if (rid and rel.get('id') == rid) or (not rid and t.get('type') == 'circuit'):
        for m in rel.iter('member'):
            if m.get('type') == 'way':
                ways.add(m.get('ref'))
print('member ways', len(ways))
# rewrite: mark member ways as raceway in a temp copy, drop other raceways
for w in root.iter('way'):
    tags = {t.get('k'): t for t in w.iter('tag')}
    if w.get('id') in ways:
        if 'highway' in tags:
            tags['highway'].set('v', 'raceway')
        else:
            ET.SubElement(w, 'tag', k='highway', v='raceway')
        if 'area' in tags:
            tags['area'].set('v', 'no')
    elif 'highway' in tags and tags['highway'].get('v') == 'raceway':
        tags['highway'].set('v', 'x_raceway')
tmp = out + '.tmp.osm'
ET.ElementTree(root).write(tmp)
r = osm_fetch.loops(tmp, target)
os.remove(tmp)
pts, tot = r
json.dump(pts, open(out, 'w'))
print('loop', round(tot), 'm, pts', len(pts))
