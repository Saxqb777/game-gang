"""Track 1 candidate C: build the segment list, close the lap numerically, write base.layout.json.

Usage: python3 -I build.py [--open] [--trace]
  --open   skip the closure solver (inspect the raw plan)
  --trace  print every segment's end position, heading, elevation and grade

Counter-clockwise lap (net +360 deg). Corners are built as entry spiral -> constant-radius apex ->
exit spiral. The solver uses the checker's own integrator: one apex arc closes the heading, two
straights close the position.
"""
import json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEG = math.pi / 180
BIG = 3000.0          # spiral radius at the straight end (curvature ~0)
STARTZ = 34.0
NAME = 'Kettle Hollow'

# ---------------------------------------------------------------- roadside presets
def side(kerb, kh, r0, r1, surf, bar):
    return {'kerbWidth': kerb, 'kerbHeight': kh if kerb else 0.0, 'runoffStart': r0,
            'runoffEnd': r0 if r1 is None else r1, 'runoffSurface': surf, 'barrier': bar}

def GRASS(r0=14, r1=None):            # plain verge
    return side(0.0, 0.0, r0, r1, 'grass', 'armco')

def APEX(r0=10, r1=None):             # inside apex kerb, grass behind
    return side(1.2, 0.05, r0, r1, 'grass', 'armco')

def EXIT(r0=16, r1=None):             # outside exit kerb, grass behind
    return side(1.5, 0.04, r0, r1, 'grass', 'armco')

def GRAVEL(r0=26, r1=None):           # gravel trap on the outside of a slow corner
    return side(0.0, 0.0, r0, r1, 'gravel', 'tyres')

def GRAVELX(r0=26, r1=None):          # exit kerb backed by gravel
    return side(1.5, 0.04, r0, r1, 'gravel', 'tyres')

def PIT(r0=14, r1=None):              # paved apron + pit wall (start straight only)
    return side(0.0, 0.0, r0, r1, 'asphalt', 'wall')

def APRON(r0=16, r1=None):            # paved apron (start straight only)
    return side(0.0, 0.0, r0, r1, 'asphalt', 'armco')

# ---------------------------------------------------------------- plan
# Free parameters (lengths in m, arcs in deg). Three are solved for closure.
P0 = dict(
    post=170.0,      # start line -> Hatchet braking
    rise=120.0,      # Hatchet rise (solved: position)
    lynx=50.0, lynxrun=90.0,
    pine=120.0,
    timber=80.0,
    crest=90.0,
    fire=300.0,      # the Firebreak (solved: position)
    plunge=150.0,
    climb=200.0,
    splrun=40.0, spl=36.0, chute=120.0,
    badger=120.0, bleft=60.0,   # T8 right / T9 left angles (deg)
    camp=85.0,       # T11 Campfire total arc (solved: heading)
    pit=130.0, grid=120.0,  # 250 m of straight behind the line, grid on the last 120 m
)
HEADING_KEY = 'camp'
POSITION_KEYS = ('fire', 'rise')

def corner(name, d, R, total, sin, sout, zs, sides_in, sides_apex, sides_out, w, bank=None,
           apex_name=None):
    """Three rows: entry spiral, apex arc, exit spiral.  zs = (z after entry, z after apex, z after exit),
    any may be None (interpolated).  bank = apex bank magnitude (rad), positive toward the outside."""
    apex = total - sin - sout
    assert apex > 0, name
    sg = 1 if d == 'L' else -1
    b = bank if bank is not None else min(0.05, 2.5 / R)
    b = sg * b          # left turn: outside is the right edge -> + ; right turn -> -
    return [
        (f'{name} entry', d, (BIG, R, sin), zs[0], sides_in, w, (0.0, b)),
        (apex_name or name, d, (R, R, apex), zs[1], sides_apex, w, (b, b)),
        (f'{name} exit', d, (R, BIG, sout), zs[2], sides_out, w, (b, 0.0)),
    ]

def S(name, L, z, sides, w):
    return [(name, 'S', L, z, sides, w, (0.0, 0.0))]

def build_plan(p):
    W = 12.0
    rows = []
    # ---- start line: short downhill run to T1 (the grid half of the main straight is the last rows)
    rows += S('main straight', p['post'], 32.0, (PIT(14, 12), APRON(18, 16)), 14.0)
    # ---- T1 Hatchet: heavy downhill braking from ~200 km/h into a square 105 deg left, 14 m wide,
    #      big gravel trap. The race-start chaos corner: room for a dive up the inside.
    rows += corner('T1 Hatchet', 'L', 30.0, 105, 24, 26, (31.2, 30.8, 31.4),
                   (APEX(8), GRAVEL(24, 30)), (APEX(8), GRAVEL(30)), (GRASS(10), GRAVELX(28, 18)), 14.0,
                   bank=0.04)
    # ---- Hatchet rise: uphill drag away from T1
    rows += S('Hatchet rise', p['rise'], None, (GRASS(14), GRASS(14)), 12.5)
    # ---- T2/T3 the Lynx dogleg: fast uphill right-left out towards the eastern ridge
    rows += corner('T2 Lynx right', 'R', 130.0, p['lynx'], 14, 14, (None, None, None),
                   (GRASS(14), APEX(10)), (GRASS(16), APEX(10)), (EXIT(16), GRASS(12)), W)
    rows += S('Lynx run', p['lynxrun'], None, (GRASS(14), GRASS(14)), W)
    rows += corner('T3 Lynx left', 'L', 110.0, p['lynx'], 14, 14, (None, None, 42.0),
                   (APEX(10), GRASS(14)), (APEX(10), GRASS(16)), (GRASS(12), EXIT(16)), W)
    rows += S('Pine run', p['pine'], 44.5, (GRASS(14), GRASS(14)), W)
    # ---- T4 Timberline: long uphill left sweeper onto the ridge, commit and keep the throttle in
    rows += corner('T4 Timberline', 'L', 85.0, p['timber'], 20, 22, (45.5, 47.5, 48.6),
                   (APEX(10), GRASS(16)), (APEX(10), GRASS(20, 22)), (GRASS(12), EXIT(18, 14)), 12.5)
    # ---- the crest (highest point), then T5/T6 Ranger's flick: a near-flat right-left wiggle
    rows += S('Timberline crest', p['crest'], 50.0, (GRASS(14), GRASS(14)), 12.5)
    rows += corner("T5 Ranger's flick", 'R', 300.0, 18, 5, 5, (None, None, None),
                   (GRASS(16), APEX(10)), (GRASS(16), APEX(10)), (EXIT(16), GRASS(14)), 13.0, bank=0.01)
    rows += corner("T6 Ranger's flick back", 'L', 300.0, 18, 5, 5, (None, None, 46.0),
                   (APEX(10), GRASS(16)), (APEX(10), GRASS(16)), (GRASS(14), EXIT(16)), 13.0, bank=0.01)
    # ---- the Firebreak: long straight down the cleared strip through the pines, ending in the
    #      Plunge, a 7% dive where the Kettle bowl opens up below you
    rows += S('the Firebreak', p['fire'], 41.0, (GRASS(14), GRASS(16)), 13.0)
    rows += S('the Plunge', p['plunge'], 30.5, (GRASS(14), GRASS(18)), 13.5)
    # ---- T7 THE KETTLE (signature): banked 180 deg downhill left carousel around a glacial kettle hole
    rows += corner('T7 the Kettle', 'L', 55.0, 180, 26, 26, (28.5, 24.5, 24.0),
                   (APEX(8), GRAVEL(24, 30)), (APEX(8), GRAVEL(30)), (GRASS(10), GRAVELX(26, 18)), 13.5,
                   bank=0.12, apex_name='T7 the Kettle bowl')
    # ---- Kettle climb: steep uphill slipstream run back alongside the Firebreak (you see the
    #      cars still coming down the other leg through the trees)
    rows += S('Kettle climb', p['climb'], 36.5, (GRASS(14), GRASS(14)), 13.0)
    # ---- T8/T9 Badger's Drop: corkscrew-style. Brake uphill, turn right over the blind crest,
    #      the road falls away 7%, flick left (Badger's tail) at the bottom
    rows += corner("T8 Badger's Drop", 'R', 50.0, p['badger'], 24, 24, (37.0, 35.6, 33.4),
                   (GRAVEL(22, 26), APEX(8)), (GRAVEL(26), APEX(8)), (GRAVELX(24, 16), GRASS(10)), 13.0,
                   apex_name="T8 Badger's Drop crest")
    rows += S('the drop', 22.0, 31.8, (GRASS(12), GRASS(12)), 13.0)
    rows += corner("T9 Badger's tail", 'L', 75.0, p['bleft'], 12, 12, (None, None, 30.0),
                   (APEX(8), GRASS(16)), (APEX(8), GRAVEL(22)), (GRASS(10), EXIT(16)), 13.0)
    # ---- T10 Splinters: fast downhill right sweep through the young pines, flat if you nail the apex
    rows += S('Splinter run', p['splrun'], None, (GRASS(14), GRASS(14)), 12.5)
    rows += corner('T10 Splinters', 'R', 170.0, p['spl'], 12, 12, (None, None, 29.0),
                   (GRASS(16), APEX(10)), (GRASS(16), APEX(10)), (EXIT(16), GRASS(12)), 12.5)
    # ---- the chute: short run, braking for Campfire at the bottom of the hill
    rows += S('the chute', p['chute'], 28.4, (GRASS(14), GRASS(14)), 12.5)
    # ---- T11 Campfire: medium-fast final left onto the main straight; exit speed = slipstream to the line
    rows += corner('T11 Campfire', 'L', 70.0, p['camp'], 18, 18, (28.5, 28.6, 28.8),
                   (APEX(8), GRAVEL(20, 24)), (APEX(8), GRAVEL(24)),
                   (GRASS(10), side(1.5, 0.04, 18, 14, 'asphalt', 'armco')), 13.0)
    # ---- main straight, rising to the line; the 4-car grid sits on the near-flat last part
    rows += S('pit straight', p['pit'], 33.4, (PIT(14), APRON(16)), 14.0)
    rows += S('main straight grid', p['grid'], STARTZ, (PIT(14), APRON(16)), 14.0)
    return rows

# ---------------------------------------------------------------- geometry (same integrator as the checker)
def seg_len(t, prm):
    if t == 'S':
        return prm
    r0, r1, a = prm
    return 2 * (a * DEG) / (1 / r0 + 1 / r1)

def walk(rows, step=0.5, trace=False):
    x = y = h = 0.0
    out = []
    for row in rows:
        t, prm = row[1], row[2]
        L = seg_len(t, prm)
        if t == 'S':
            k0 = k1 = 0.0
        else:
            sg = 1 if t == 'L' else -1
            k0, k1 = sg / prm[0], sg / prm[1]
        n = max(1, int(math.ceil(L / step)))
        ds = L / n
        for i in range(n):
            k = k0 + (k1 - k0) * (i + 0.5) / n
            hm = h + k * ds / 2
            x += math.cos(hm) * ds; y += math.sin(hm) * ds; h += k * ds
        if trace:
            out.append((row[0], L, x, y, math.degrees(h)))
    return (x, y, h, out) if trace else (x, y, h)

def total_turn(rows):
    return sum((r[2][2] if r[1] == 'L' else -r[2][2]) for r in rows if r[1] != 'S')

def close(p, iters=12):
    p = dict(p)
    s1, s2 = POSITION_KEYS
    for _ in range(iters):
        p[HEADING_KEY] += 360.0 - total_turn(build_plan(p))   # CCW lap: +360 deg
        x, y, _ = walk(build_plan(p))
        J = []
        for s in (s1, s2):
            q = dict(p); q[s] += 1.0
            xx, yy, _ = walk(build_plan(q))
            J.append((xx - x, yy - y))
        (a, c), (b, d) = J
        det = a * d - b * c
        p[s1] += (-x * d + y * b) / det
        p[s2] += (-y * a + x * c) / det
        if abs(x) < 1e-6 and abs(y) < 1e-6:
            break
    return p

# ---------------------------------------------------------------- layout JSON
def elevations(plan):
    lens = [seg_len(r[1], r[2]) for r in plan]
    cum = [0.0]
    for L in lens:
        cum.append(cum[-1] + L)
    known = [(0, STARTZ)] + [(i + 1, r[3]) for i, r in enumerate(plan) if r[3] is not None]
    z = [None] * (len(plan) + 1)
    for i, v in known:
        z[i] = v
    for (ia, za), (ib, zb) in zip(known, known[1:]):
        for k in range(ia + 1, ib):
            z[k] = za + (zb - za) * (cum[k] - cum[ia]) / (cum[ib] - cum[ia])
    return z, lens

def to_layout(p):
    plan = build_plan(p)
    z, _ = elevations(plan)
    segs = []
    for i, (nm, t, prm, _, (lft, rgt), width, (b0, b1)) in enumerate(plan):
        if t == 'S':
            seg = dict(name=nm, type='straight', length=round(prm, 4), radiusStart=0, radiusEnd=0, arc=0)
        else:
            r0, r1, a = prm
            seg = dict(name=nm, type='left' if t == 'L' else 'right', length=0,
                       radiusStart=r0, radiusEnd=r1, arc=round(a * DEG, 7))
        seg.update(zEnd=round(z[i + 1], 3), tangentStart=None, tangentEnd=None,
                   bankStart=round(b0, 4), bankEnd=round(b1, 4), roadWidth=width, left=lft, right=rgt)
        segs.append(seg)
    return {
        'format': 'splitways-layout@1', 'name': NAME,
        'licence': 'Proprietary - (C) 2026 Gamer Gang project. All rights reserved.',
        'credits': ['Original layout by the Gamer Gang project, 2026'],
        'source': {'package': 'original', 'file': '', 'readme': '', 'readmeLicence': '',
                   'notes': 'Original design, not derived from any existing track'},
        'startZ': STARTZ, 'segments': segs,
    }

if __name__ == '__main__':
    p = dict(P0) if '--open' in sys.argv else close(P0)
    for k in sorted(p):
        if abs(p[k] - P0[k]) > 1e-9:
            print(f'solved {k}: {P0[k]} -> {p[k]:.3f}')
    if '--trace' in sys.argv:
        plan = build_plan(p)
        z, lens = elevations(plan)
        s = 0.0
        for i, (nm, L, x, y, h) in enumerate(walk(plan, trace=True)[3]):
            s += L
            g = (z[i + 1] - z[i]) / L * 100
            print(f'{nm:24s} L={L:6.1f} s={s:7.1f} end=({x:7.1f},{y:7.1f}) hdg={h:7.1f} z={z[i+1]:5.1f} g={g:+5.1f}%')
    out = os.path.join(HERE, 'base.layout.json')
    json.dump(to_layout(p), open(out, 'w'), indent=1)
    print('wrote', out)
