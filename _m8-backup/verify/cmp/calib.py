import os, sys, json
import numpy as np
SCR = sys.argv[1]
sys.argv = [sys.argv[0], SCR, '/tmp/unused']
sys.path.insert(0, os.path.join(SCR, 'verify/cmp'))
import shapes
S = shapes.load_all()
def prep(name):
    z, L = shapes.resample(S[name]); return shapes.ccw(shapes.norm(z))
pairs = [('SD:Corkscrew', 'OSM:LagunaSeca'), ('SD:ruudskogen', 'OSM:Rudskogen'), ('OSM:BrandsHatchIndy', 'OSM:BrandsHatch'),
         ('TUM:BrandsHatch', 'OSM:BrandsHatch'), ('OSM:BrandsHatchIndy', 'OSM:MalloryPark'), ('OSM:BrandsHatchIndy', 'OSM:Pembrey'),
         ('OSM:BrandsHatchIndy', 'OSM:OultonPark'), ('OSM:BrandsHatchIndy', 'SD:g-track-2'), ('OSM:BrandsHatchIndy', 'SD:dirt-1'),
         ('OSM:BrandsHatchIndy', 'OSM:Thruxton'), ('OSM:BrandsHatchIndy', 'OSM:Knockhill'), ('OSM:BrandsHatchIndy','OSM:LimeRock'),
         ('F1:Autodromo Nazionale Monza', 'SD:forza'), ('OSM:Sonoma','OSM:LagunaSeca'), ('F1:Red Bull Ring','TUM:Spielberg'),
         ('OSM:Bathurst','SD:Corkscrew')]
for a, b in pairs:
    if a not in S or b not in S: print('missing', a, b); continue
    A, B = prep(a), prep(b)
    d = shapes.shape_dist(A, B)
    print(f'{a:28s} vs {b:28s} procr {d[0]:.3f} turn {shapes.turn_dist(A, B):.3f}')
# rank all shapes by distance to Brands Indy, to see how unusual 0.132 is
A = prep('OSM:BrandsHatchIndy')
r = sorted((shapes.shape_dist(A, prep(n))[0], n) for n in S if n != 'OSM:BrandsHatchIndy')
print('nearest to Brands Indy among dataset:', [(round(d,3), n) for d, n in r[:8]])
