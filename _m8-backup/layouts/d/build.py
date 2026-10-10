"""Build base.layout.json for 'Kestrel Ridge' (working name), Track 1 of the split-screen party racer.

Concept: a hooked, question-mark-shaped club circuit in a temperate pine forest. The lap climbs a
long hillside (the Ladder), crests blind into a fast left (the Brow), runs along the ridge top with
views over the forest, then winds down a 200+ degree descending, tightening left around the summit
knoll (the Kestrel, signature corner), drops through the fern valley into a compression (the Hollow)
and climbs out through an uphill hairpin (the Switchback) onto the main straight.

Corners are written as compound pieces (entry spiral / apex / exit spiral). Closure is solved by
adjusting two straights (position) and one arc (heading). Side specs (kerbs, runoff, barrier) are
derived from the corner's speed class, with per-corner overrides.

Usage: python3 build.py   (writes base.layout.json next to this file and prints a lap-time estimate)
"""
import json, math, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from geom import integrate, close_loop, lap_sim, seg_len

D = math.radians
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'base.layout.json')

START_Z = 16.0
SEGS = []


def side(kerb=0.0, kh=0.0, r0=8, r1=8, surf='grass', bar='armco'):
    return {"kerbWidth": kerb, "kerbHeight": kh, "runoffStart": r0, "runoffEnd": r1,
            "runoffSurface": surf, "barrier": bar}


def S(name, length, z, width=12.0, left=None, right=None):
    SEGS.append({"name": name, "type": "straight", "length": float(length), "radiusStart": 0,
                 "radiusEnd": 0, "arc": 0, "zEnd": float(z), "tangentStart": None, "tangentEnd": None,
                 "bankStart": 0.0, "bankEnd": 0.0, "roadWidth": width,
                 "left": left or side(r0=8, r1=8), "right": right or side(r0=8, r1=8)})


def C(name, d, pieces, width=12.0, bank=0.0, cls=None, outside=None, entry_kerb=None):
    """pieces: list of (role, r0, r1, deg, zEnd); role in entry|apex|exit|crest.
    d: 'left'|'right'. cls: 'slow' (gravel + tyres outside) | 'medium' | 'fast' (grass + armco).
    bank: peak banking (rad), ramped in over the entry and out over the exit, signed so the
    outside edge is higher (+ = right edge higher, i.e. positive for lefts).
    outside: per-role dict overriding the outside side spec.
    entry_kerb: inside kerb on the entry piece (default: only for slow corners)."""
    rmin = min(min(p[1], p[2]) for p in pieces)
    if cls is None:
        cls = 'slow' if rmin < 60 else ('medium' if rmin < 130 else 'fast')
    sgn = 1 if d == 'left' else -1
    n = len(pieces)
    for role, r0, r1, deg, z in pieces:
        if role in ('entry', 'crest'):
            b0, b1 = 0.0, bank
        elif role == 'exit':
            b0, b1 = bank, 0.0
        else:
            b0 = b1 = bank
        # kerbs: inside on the apex and exit (and the late entry of slow corners), outside on the exit
        if entry_kerb is None:
            entry_kerb = cls == 'slow'
        kerb_in = role in ('apex', 'exit') or (role == 'entry' and entry_kerb)
        kerb_out = role == 'exit'
        kh = {'slow': 0.06, 'medium': 0.05, 'fast': 0.04}[cls]
        if cls == 'slow':
            out = side(1.2 if kerb_out else 0, kh if kerb_out else 0,
                       18 if role == 'entry' else 26, 26 if role != 'exit' else 18, 'gravel', 'tyres')
            ins = side(1.2 if kerb_in else 0, kh if kerb_in else 0, 8, 8, 'grass', 'armco')
        elif cls == 'medium':
            out = side(1.2 if kerb_out else 0, kh if kerb_out else 0, 14, 16 if role != 'exit' else 14,
                       'grass', 'armco')
            ins = side(1.2 if kerb_in else 0, kh if kerb_in else 0, 8, 8, 'grass', 'armco')
        else:
            out = side(1.2 if kerb_out else 0, kh if kerb_out else 0, 14, 14, 'grass', 'armco')
            ins = side(1.2 if kerb_in else 0, kh if kerb_in else 0, 7, 7, 'grass', 'armco')
        if outside and role in outside:
            out.update(outside[role])
        L, R = (ins, out) if d == 'left' else (out, ins)
        SEGS.append({"name": f"{name} {role}" if n > 1 else name, "type": d, "length": 0,
                     "radiusStart": float(r0), "radiusEnd": float(r1), "arc": D(deg), "zEnd": float(z),
                     "tangentStart": None, "tangentEnd": None,
                     "bankStart": round(sgn * b0, 4), "bankEnd": round(sgn * b1, 4), "roadWidth": width,
                     "left": L, "right": R})


def idx(name):
    for i, s in enumerate(SEGS):
        if s['name'] == name:
            return i
    raise KeyError(name)


# ---------------------------------------------------------------- the lap (counter-clockwise)
PIT = side(0, 0, 16, 14, 'asphalt', 'wall')       # infield (left on this CCW lap): paved apron, pit wall
STANDS = side(0, 0, 14, 12, 'asphalt', 'fence')   # outside: paved apron, catch fence, grandstand

# Act 1: the drag down to T1 and the esses at the foot of the hill
S("main straight", 280, 12.5, width=14.0, left=dict(PIT), right=dict(STANDS))
C("T1 Millrace", 'left', [("entry", 400, 42, 15, 12.3), ("apex", 42, 42, 90, 12.2), ("exit", 42, 400, 15, 12.4)],
  width=13.0, bank=0.04)
S("Brook run", 130, 13.0)
C("Sawpit", 'right', [("entry", 400, 90, 12, 13.6), ("apex", 90, 90, 36, 14.6), ("exit", 90, 400, 12, 15.2)],
  bank=0.03)
S("esses link", 60, 15.8)
C("Woodcutter", 'left', [("entry", 400, 110, 8, 16.4), ("apex", 110, 110, 14, 17.0), ("exit", 110, 400, 8, 17.6)],
  bank=0.02)
# Act 2: climb, blind crest, ridge top
S("the Ladder", 170, 28.0)
S("Ladder top", 90, 33.5)
C("the Brow", 'left', [("crest", 400, 180, 15, 33.9), ("apex", 180, 180, 25, 33.7), ("exit", 180, 400, 15, 33.3)],
  bank=0.03, outside={"crest": {"runoffStart": 18, "runoffEnd": 22},
                      "apex": {"runoffStart": 22, "runoffEnd": 22},
                      "exit": {"runoffStart": 22, "runoffEnd": 16}})
S("Ridge straight", 250, 32.0)
# Act 3: the Kestrel spiral and the fern valley
C("Kestrel", 'left', [("entry", 400, 130, 25, 31.2), ("apex", 130, 55, 140, 21.0), ("exit", 55, 200, 40, 19.5)],
  bank=0.06, entry_kerb=False)
C("Talon", 'right', [("apex", 200, 200, 25, 18.8)])
S("Fernside", 110, 17.6)
C("Drop", 'right', [("entry", 400, 100, 12, 17.2), ("apex", 100, 100, 31, 16.9), ("exit", 100, 400, 12, 16.6)],
  bank=0.03)
S("Fernside descent", 330, 12.0)
S("Hollow drop", 130, 6.2, width=13.0)
C("Hollow", 'right', [("entry", 300, 50, 15, 6.0), ("apex", 50, 50, 40, 5.9), ("exit", 50, 300, 15, 6.2)],
  width=13.0, bank=0.04)
# Act 4: back straight, uphill hairpin, grid
S("back straight", 380, 10.4, width=13.0)
C("Switchback", 'left', [("entry", 300, 30, 20, 10.9), ("apex", 30, 30, 120, 14.2), ("exit", 30, 300, 20, 15.0)],
  width=13.0, bank=0.05)
S("grid straight", 210, START_Z, width=14.0, left=dict(PIT), right=dict(STANDS))

ADJ_STRAIGHTS = ("Fernside descent", "back straight")
ADJ_ARC = "Kestrel apex"


def build():
    close_loop(SEGS, START_Z, (idx(ADJ_STRAIGHTS[0]), idx(ADJ_STRAIGHTS[1])), idx(ADJ_ARC), target_turns=1)
    for s in SEGS:
        if s['type'] == 'straight':
            s['length'] = round(s['length'], 4)
        s['arc'] = round(s['arc'], 8) if s['arc'] else 0
    return {
        "format": "splitways-layout@1",
        "name": "Kestrel Ridge",
        "licence": "Proprietary - (C) 2026 Gamer Gang project. All rights reserved.",
        "credits": ["Original layout by the Gamer Gang project, 2026"],
        "source": {"package": "original", "file": "", "readme": "", "readmeLicence": "",
                   "notes": "Original design, not derived from any existing track"},
        "startZ": START_Z,
        "segments": SEGS,
    }


if __name__ == '__main__':
    layout = build()
    json.dump(layout, open(OUT, 'w'), indent=1)
    t, v, pts = lap_sim(SEGS, START_Z)
    print('lap time est (ideal point-mass): %.1f s  (%d:%04.1f)' % (t, t // 60, t % 60))
    s0 = 0.0
    for s in SEGS:
        L = seg_len(s)
        print('%-24s %-8s L=%6.1f  r=%5s-%-5s arc=%6.1f  zEnd=%5.1f  w=%4.1f' % (
            s['name'], s['type'], L, s['radiusStart'] or '', s['radiusEnd'] or '',
            math.degrees(s['arc']) if s['arc'] else 0, s['zEnd'], s['roadWidth']))
