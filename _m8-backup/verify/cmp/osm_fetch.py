"""Download OSM map extracts around circuits and extract the main raceway loop.

Usage: python3 -I osm_fetch.py RAWDIR OUTDIR [names...]
"""
import json, math, os, sys, time, subprocess
import xml.etree.ElementTree as ET

# name: (lat, lon, half-size km, target length m)
CIRCUITS = {
    'LagunaSeca': (36.5843, -121.7535, 1.3, 3602),
    'Bathurst': (-33.4475, 149.5560, 2.0, 6213),
    'Sonoma': (38.1611, -122.4547, 1.5, 4060),
    'RoadAtlanta': (34.1470, -83.8150, 1.6, 4088),
    'LimeRock': (41.9283, -73.3833, 1.2, 2462),
    'MidOhio': (40.6886, -82.6364, 1.4, 3634),
    'RoadAmerica': (43.7977, -87.9897, 2.0, 6515),
    'VIR': (36.5683, -79.2066, 2.0, 5263),
    'Barber': (33.5325, -86.6194, 1.4, 3830),
    'CTMP': (44.0547, -78.6756, 1.6, 3957),
    'MontTremblant': (46.1886, -74.6108, 1.8, 4265),
    'PortlandIR': (45.5950, -122.6939, 1.4, 3170),
    'WillowSprings': (34.8711, -118.2639, 1.4, 4023),
    'BrandsHatch': (51.3569, 0.2631, 1.2, 3908),
    'Donington': (52.8306, -1.3792, 1.4, 4020),
    'OultonPark': (53.1786, -2.6130, 1.5, 4307),
    'Snetterton': (52.4636, 0.9456, 1.6, 4779),
    'Thruxton': (51.2105, -1.6082, 1.5, 3792),
    'Croft': (54.4553, -1.5560, 1.4, 3420),
    'CadwellPark': (53.3108, -0.0605, 1.5, 3486),
    'Knockhill': (56.1301, -3.5062, 1.0, 2092),
    'CastleCombe': (51.4919, -2.2153, 1.2, 2969),
    'MalloryPark': (52.5980, -1.3369, 1.0, 2172),
    'Anglesey': (53.1885, -4.4975, 1.3, 3400),
    'Pembrey': (51.7058, -4.3194, 1.2, 2370),
    'PhillipIsland': (-38.5000, 145.2336, 1.6, 4445),
    'Sandown': (-37.9497, 145.1675, 1.2, 3104),
    'Winton': (-36.5164, 146.0873, 1.4, 3000),
    'QueenslandRaceway': (-27.6906, 152.6544, 1.4, 3126),
    'HiddenValley': (-12.4472, 130.9083, 1.3, 2870),
    'Pukekohe': (-37.2167, 174.9167, 1.3, 2910),
    'Zolder': (50.9906, 5.2567, 1.6, 4011),
    'Assen': (52.9617, 6.5236, 1.8, 4542),
    'Brno': (49.2032, 16.4442, 1.8, 5403),
    'Sachsenring': (50.7917, 12.6878, 1.4, 3671),
    'Oschersleben': (52.0275, 11.2789, 1.4, 3696),
    'Lausitzring': (51.5336, 13.9253, 1.8, 4255),
    'Salzburgring': (47.8232, 13.1694, 1.8, 4241),
    'DijonPrenois': (47.3625, 4.8992, 1.4, 3801),
    'Nogaro': (43.7700, -0.0367, 1.4, 3636),
    'LeMansBugatti': (47.9561, 0.2081, 1.6, 4185),
    'Jarama': (40.6170, -3.5856, 1.4, 3850),
    'Jerez': (36.7083, -6.0342, 1.6, 4428),
    'Valencia': (39.4853, -0.6286, 1.4, 4005),
    'Aragon': (41.0784, -0.2050, 2.0, 5345),
    'Navarra': (42.5583, -2.1700, 1.6, 3933),
    'Misano': (43.9614, 12.6833, 1.4, 4226),
    'Vallelunga': (42.1590, 12.3700, 1.5, 4085),
    'SlovakiaRing': (48.0544, 17.5636, 2.0, 5922),
    'Most': (50.5196, 13.6058, 1.6, 4212),
    'Anderstorp': (57.2639, 13.6014, 1.6, 4025),
    'Rudskogen': (59.3689, 11.2611, 1.4, 3254),
    'Mantorp': (58.3683, 15.2858, 1.4, 3106),
    'Fuji': (35.3717, 138.9272, 1.8, 4563),
    'Motegi': (36.5328, 140.2275, 1.8, 4801),
    'Sugo': (38.1408, 140.7764, 1.5, 3586),
    'Okayama': (34.9147, 134.2211, 1.4, 3703),
    'Tsukuba': (36.1497, 139.9208, 1.0, 2045),
    'Autopolis': (33.0372, 130.9711, 1.8, 4674),
    'Zhuhai': (22.3683, 113.5592, 1.5, 4319),
    'Buriram': (15.2306, 103.0472, 1.6, 4554),
    'Mandalika': (-8.8950, 116.3044, 1.8, 4310),
    'DubaiAutodrome': (25.0497, 55.2386, 1.8, 5390),
    'Termas': (-27.4983, -64.8597, 1.8, 4806),
    'Yeongam': (34.7333, 126.4170, 2.0, 5615),
    'Buddh': (28.3487, 77.5331, 2.0, 5125),
    'Charade': (45.7475, 3.0367, 1.6, 3975),
    'Ledenon': (43.9236, 4.5044, 1.2, 3150),
    'Albi': (43.9183, 2.1167, 1.4, 3565),
    'Killarney': (-33.8800, 18.5383, 1.3, 3267),
    'NJMPThunderbolt': (39.3583, -75.0700, 1.6, 3600),
    'Hockenheim': (49.3278, 8.5656, 1.8, 4574),
    'NurburgringGP': (50.3356, 6.9475, 1.8, 5148),
    'Magione': (43.1350, 12.2130, 1.2, 2507),
    'Pannonia': (47.3044, 17.0653, 1.4, 3500),
    'Poznan': (52.4219, 16.8133, 1.4, 4083),
    'Estoril': (38.7506, -9.3942, 1.6, 4182),
    'Algarve': (37.2272, -8.6267, 1.8, 4653),
    'Kyalami': (-25.9894, 28.0697, 1.6, 4522),
    'Interlagos': (-23.7036, -46.6997, 1.6, 4309),
    'Imola': (44.3439, 11.7167, 1.8, 4909),
    'Mugello': (43.9975, 11.3719, 1.8, 5245),
    'Istanbul': (40.9517, 29.4050, 1.8, 5338),
    'Spielberg': (47.2197, 14.7647, 1.6, 4318),
    'Zandvoort': (52.3888, 4.5409, 1.5, 4259),
    'Hungaroring': (47.5789, 19.2486, 1.5, 4381),
    'Suzuka': (34.8431, 136.5410, 1.8, 5807),
    'Sepang': (2.7608, 101.7381, 1.8, 5543),
    'Shanghai': (31.3389, 121.2197, 1.8, 5451),
    'Losail': (25.4900, 51.4542, 1.8, 5380),
    'Sakhir': (26.0325, 50.5106, 1.8, 5412),
    'MagnyCours': (46.8642, 3.1636, 1.6, 4411),
    'PaulRicard': (43.2506, 5.7917, 2.0, 5842),
    'Silverstone': (52.0786, -1.0169, 2.0, 5891),
    'Spa': (50.4372, 5.9714, 2.6, 7004),
    'Monza': (45.6156, 9.2811, 2.0, 5793),
    'COTA': (30.1328, -97.6411, 1.8, 5513),
    'Montreal': (45.5000, -73.5228, 1.8, 4361),
    'Mexico': (19.4042, -99.0907, 1.6, 4304),
    'WatkinsGlen': (42.3369, -76.9272, 1.8, 5430),
    'Sebring': (27.4545, -81.3484, 2.2, 6019),
    'Daytona': (29.1850, -81.0705, 2.0, 5730),
    'Indianapolis': (39.7950, -86.2347, 1.8, 3925),
    'GingermanRaceway': (42.4083, -86.1408, 1.4, 3540),
    'Brainerd': (46.4167, -94.2750, 1.6, 4100),
    'HallettMotorRacing': (36.2283, -96.5917, 1.2, 2900),
    'Thunderhill': (39.5397, -122.3317, 1.6, 4800),
    'Buttonwillow': (35.4894, -119.5444, 1.6, 4200),
    'PacificRaceways': (47.3203, -122.1453, 1.3, 3700),
    'Calabogie': (45.2950, -76.6722, 1.8, 5050),
    'ShannonvilleMotorsport': (44.2253, -77.1586, 1.4, 4030),
}

def deg_box(lat, lon, km):
    dlat = km / 110.54
    dlon = km / (111.32 * math.cos(math.radians(lat)))
    return lon - dlon, lat - dlat, lon + dlon, lat + dlat

def fetch(raw, name, lat, lon, km):
    out = os.path.join(raw, name + '.osm')
    if os.path.exists(out) and os.path.getsize(out) > 1000:
        return out
    for k in (km, km * 0.8, km * 0.6):
        b = deg_box(lat, lon, k)
        url = 'https://api.openstreetmap.org/api/0.6/map?bbox=%.5f,%.5f,%.5f,%.5f' % b
        r = subprocess.run(['curl', '-sS', '-m', '120', '-o', out, '-w', '%{http_code}', url], capture_output=True, text=True)
        code = r.stdout.strip()
        if code == '200':
            return out
        print(name, 'http', code, r.stderr.strip()[:100], 'retry smaller')
        time.sleep(1)
    return None

def loops(osm, target):
    root = ET.parse(osm).getroot()
    nodes = {}
    for n in root.iter('node'):
        nodes[n.get('id')] = (float(n.get('lat')), float(n.get('lon')))
    ways = []
    for w in root.iter('way'):
        tags = {t.get('k'): t.get('v') for t in w.iter('tag')}
        if tags.get('highway') != 'raceway' or tags.get('area') == 'yes':
            continue
        nd = [x.get('ref') for x in w.iter('nd') if x.get('ref') in nodes]
        if len(nd) >= 2:
            ways.append(nd)
    if not ways:
        return None
    lat0 = sum(v[0] for v in nodes.values()) / len(nodes)
    def xy(i):
        la, lo = nodes[i]
        return (lo * 111320 * math.cos(math.radians(lat0)), la * 110540)
    count = {}
    for w in ways:
        for i, n in enumerate(w):
            count[n] = count.get(n, 0) + (2 if i in (0, len(w) - 1) else 1)
    # split into edges between junctions
    edges = []
    for w in ways:
        cur = [w[0]]
        for n in w[1:]:
            cur.append(n)
            if count[n] > 1 or n == w[-1]:
                edges.append(cur); cur = [n]
    def elen(e):
        s = 0
        for a, b in zip(e, e[1:]):
            (x1, y1), (x2, y2) = xy(a), xy(b)
            s += math.hypot(x2 - x1, y2 - y1)
        return s
    adj = {}
    for k, e in enumerate(edges):
        adj.setdefault(e[0], []).append((k, e[-1]))
        adj.setdefault(e[-1], []).append((k, e[0]))
    L = [elen(e) for e in edges]
    best = [None, 1e18]
    t0 = time.time()
    # enumerate simple cycles via DFS from each start junction (dedupe by min edge)
    sys.setrecursionlimit(10000)
    def dfs(start, node, used_e, used_n, path, length):
        if time.time() - t0 > 20:
            return
        for k, nxt in adj.get(node, []):
            if k in used_e:
                continue
            nl = length + L[k]
            if nl > target * 1.6:
                continue
            if nxt == start:
                cyc = path + [k]
                if min(cyc) == cyc[0] or True:
                    score = abs(nl - target)
                    if score < best[1]:
                        best[0], best[1] = list(cyc), score
                continue
            if nxt in used_n:
                continue
            used_e.add(k); used_n.add(nxt)
            dfs(start, nxt, used_e, used_n, path + [k], nl)
            used_e.discard(k); used_n.discard(nxt)
    starts = sorted(adj.keys(), key=lambda n: -len(adj[n]))
    for s in starts[:40]:
        dfs(s, s, set(), {s}, [], 0.0)
    if best[0] is None:
        return None
    # assemble polyline
    cyc = best[0]
    pts = []
    node = None
    # find start node: shared between first and last edge
    e0 = edges[cyc[0]]
    if len(cyc) == 1:
        seq = e0
        pts = [xy(n) for n in seq]
    else:
        e1 = edges[cyc[1]]
        node = e0[0] if e0[0] in (e1[0], e1[-1]) else e0[-1]
        node = e0[-1] if node == e0[0] else e0[0]
        for k in cyc:
            e = edges[k]
            seq = e if e[0] == node else e[::-1]
            pts.extend(xy(n) for n in seq[:-1])
            node = seq[-1]
    tot = sum(L[k] for k in cyc)
    return pts, tot

if __name__ == '__main__':
    raw, out = sys.argv[1], sys.argv[2]
    os.makedirs(raw, exist_ok=True); os.makedirs(out, exist_ok=True)
    names = sys.argv[3:] or list(CIRCUITS)
    for name in names:
        lat, lon, km, target = CIRCUITS[name]
        f = fetch(raw, name, lat, lon, km)
        if not f:
            print(name, 'FETCH FAILED'); continue
        try:
            r = loops(f, target)
        except Exception as ex:
            print(name, 'PARSE FAILED', ex); continue
        if not r:
            print(name, 'NO LOOP'); continue
        pts, tot = r
        json.dump(pts, open(os.path.join(out, name + '.xy.json'), 'w'))
        print(f'{name:22s} loop {tot:7.0f} m (target {target}) pts {len(pts)}')
