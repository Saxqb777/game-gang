"""Build the final Track 1 layout, 'Kestrel Pines' (base.layout.json + overrides.json).

Starts from candidate d (Kestrel Ridge) and keeps its identity: a hooked '?' circuit that climbs a
forested hillside, runs along a ridge and spirals down off the end of it around a summit knoll (the
Kestrel), then dives through a fern valley and climbs back to the line. Changes from d:
  * Kestrel: tightens only to R68, then holds R68 for 85 deg, banked 0.10 rad, 13.5 m wide (two lines).
  * Windhover: a near-flat R340 right-left flick (12 deg each way) along the ridge top (from c's flick
    idea, own design); it also sets the car up on the right of the road for the Kestrel turn-in.
  * Beck bridge: the compression moves to a flat-out left kink over the beck at the valley floor (from
    b's brook kink); the Hollow is now braked on level ground, not downhill into a dip.
  * Switchback: R30 for 85 deg, then opens R30 -> R110 over 60 deg (from a's Lantern) and slingshots
    onto the grid straight; the back straight into it is 403 m. T1, Hollow and Switchback braking
    zones are 14 m wide.
  * The Hollow is R48 (only T1 R40 and the Switchback R30 are under 45 m).
  * Esses rebuilt as one quicker right-left (Sawpit R125 / Woodcutter R130).
  * The Drop tightened to R75 with gravel (slows the lap; exit speed decides the dive to the Hollow).
  * Grid straight 235 m; no 12 m road anywhere; kerbHeight 0 wherever kerbWidth is 0; startZ 0.

Originality fix (the final review found the outline too close to Brands Hatch Indy driven backwards: the
narrow Switchback 'finger' between the back straight and the grid straight matched Druids):
  * Switchback opened from 163 to 140 deg (apex R30 for 62 deg instead of 85; the 18 deg entry and the
    60 deg R30 -> R110 opening exit are unchanged). The back straight now meets the grid straight at
    about 40 deg instead of 17 deg, so the finger becomes an open V.
  * The old 403 m back straight is now 'Meadow run' 100 m, the 'Larch kink' (a flat-out 10 deg right,
    spirals R1200 -> R400 -> R1200, flat, no bank) and a 265 m 'back straight' into the Switchback, which
    keeps a full-length heavy braking zone there.
  * Closure is solved on the Ladder and the Hollow straight with the Hollow apex, so the Ladder grows to
    about 280 m (the climb now starts lower, at the Woodcutter exit, about 5% all the way up), the Hollow
    straight is about 125 m and the Hollow is about 70 deg instead of 102.
  * Every real circuit in the 196-outline reference set now scores >= 0.2 (Procrustes); Brands Indy moved
    from 0.132 to about 0.21 (python3 -I tools/originality.py SCRATCH compare.png).

Usage: python3 -I build.py      (writes base.layout.json and overrides.json next to this file)
       python3 -I build.py --open   (no closure solve, nothing written)
"""
import json, math, sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from geom import integrate, close_loop, lap_sim, seg_len

D = math.radians
OUT = os.path.join(HERE, 'base.layout.json')
OUT_OVR = os.path.join(HERE, 'overrides.json')
START_Z = 0.0
SEGS = []
LICENCE = "Proprietary - (C) 2026 Gamer Gang project. All rights reserved."
CREDITS = ["Original layout by the Gamer Gang project, 2026"]


def side(kerb=0.0, kh=0.0, r0=8, r1=None, surf='grass', bar='armco'):
    return {"kerbWidth": kerb, "kerbHeight": kh if kerb else 0.0, "runoffStart": r0,
            "runoffEnd": r0 if r1 is None else r1, "runoffSurface": surf, "barrier": bar}


def S(name, length, z, width=13.0, left=None, right=None):
    SEGS.append({"name": name, "type": "straight", "length": float(length), "radiusStart": 0,
                 "radiusEnd": 0, "arc": 0, "zEnd": float(z), "tangentStart": None, "tangentEnd": None,
                 "bankStart": 0.0, "bankEnd": 0.0, "roadWidth": width,
                 "left": left or side(r0=10), "right": right or side(r0=10)})


OUT_RUN = {
    'slow':   {'entry': (18, 26), 'crest': (18, 26), 'tighten': (26, 26), 'apex': (26, 26), 'hold': (26, 26),
               'exit': (26, 18), 'flick': (20, 20), 'in': (20, 20), 'out': (20, 20)},
    'medium': {'entry': (14, 16), 'crest': (16, 18), 'tighten': (16, 16), 'apex': (16, 16), 'hold': (16, 16),
               'exit': (16, 14), 'flick': (14, 14), 'in': (14, 14), 'out': (14, 14)},
    'fast':   {'entry': (14, 14), 'crest': (16, 18), 'tighten': (14, 14), 'apex': (14, 14), 'hold': (14, 14),
               'exit': (14, 14), 'flick': (12, 12), 'in': (12, 12), 'out': (12, 12)},
}


def C(name, d, pieces, width=13.0, cls='medium', out_run=None, in_run=8, widths=None, entry_kerb=None,
      out_surface=None):
    """One corner from consecutive pieces.
    pieces: (role, r0, r1, deg, zEnd, bank0, bank1); bank magnitudes in rad, outside edge higher.
      role: entry | crest | tighten | apex | hold | exit | flick | in | out
    cls: 'slow' (gravel + tyres outside, exit kerb backed by gravel), 'medium'/'fast' (grass + armco).
    Kerbs: inside on apex, hold, tighten, exit, flick/in/out (and the late entry of slow corners);
    outside on the exit piece. kerbHeight is 0 wherever kerbWidth is 0 (trackgen raises the edge
    by kerbHeight even when there is no kerb)."""
    sgn = 1 if d == 'left' else -1
    kh = {'slow': 0.06, 'medium': 0.05, 'fast': 0.04}[cls]
    if entry_kerb is None:
        entry_kerb = cls == 'slow'
    n = len(pieces)
    for i, (role, r0, r1, deg, z, b0, b1) in enumerate(pieces):
        kerb_in = role in ('apex', 'hold', 'tighten', 'exit', 'flick', 'in', 'out') or (role == 'entry' and entry_kerb)
        kerb_out = role in ('exit', 'flick', 'out')
        ro = OUT_RUN[cls][role]
        if out_run and role in out_run:
            ro = out_run[role]
        surf_o, bar_o = ('gravel', 'tyres') if cls == 'slow' else ('grass', 'armco')
        if out_surface:
            surf_o, bar_o = out_surface
        out = side(1.2 if kerb_out else 0, kh, ro[0], ro[1], surf_o, bar_o)
        ir = in_run[role] if isinstance(in_run, dict) else in_run
        ins = side(1.2 if kerb_in else 0, kh, ir, ir, 'grass', 'armco')
        L, R = (ins, out) if d == 'left' else (out, ins)
        w = widths[i] if widths else width
        SEGS.append({"name": f"{name} {role}" if n > 1 else name, "type": d, "length": 0,
                     "radiusStart": float(r0), "radiusEnd": float(r1), "arc": D(deg), "zEnd": float(z),
                     "tangentStart": None, "tangentEnd": None,
                     "bankStart": round(sgn * b0, 4), "bankEnd": round(sgn * b1, 4), "roadWidth": w,
                     "left": L, "right": R})


def idx(name):
    for i, s in enumerate(SEGS):
        if s['name'] == name:
            return i
    raise KeyError(name)


# ------------------------------------------------------------------------------- the lap (CCW)
PIT = side(0, 0, 16, 16, 'asphalt', 'wall')       # infield (left on this CCW lap): paved apron + pit wall
STANDS = side(0, 0, 14, 14, 'asphalt', 'fence')   # outside: paved apron, catch fence, main grandstand

P = dict(
    main=275, t1=71, brook=70, saw=20, link=46, wood=24, brow=24, ridge=34, wh=6.0, wr=340, appr=104, k_tight=70,
    k_hold=84, k_exit=30, talon=17, fern=49, drop=27, dive=94, beck=6.0, hstr=254, meadow=100, kink=10.0,
    kink_in=1200, kink_r=400, back=265, sw=62, sw_exit=60, sw_exit_r=110, grid=235, ladder=200, hol=70, hol_r=48,
)

# elevations (m, absolute; the start line is z = 0)
Z = dict(
    t1=-3.4,          # main straight falls to the Millrace (T1)
    brook=-3.0, saw=-1.8, link=-1.2, wood=0.6,   # the esses rise only gently ...
    ladder_top=14.9, brow=15.5,             # ... so the Ladder does the climbing: about 5% to the blind Brow
    ridge=15.0, kest_in=14.3,               # ridge plateau
    kest_tight=9.9, kest_hold=5.4, kest_out=3.7,   # the Kestrel spiral: about 11 m down
    talon=3.0, fern=2.0, drop=0.2,
    dive=-5.2, beck_mid=-6.5, beck_out=-6.3,       # Fernside dive to the Beck bridge (low point)
    hollow_in=-5.1, hollow_out=-4.6,               # Hollow straight: level-to-rising braking zone
    meadow=-4.0, kink=-3.3, back=-1.6, sw_out=-0.2,  # Meadow run, Larch kink, back straight: gently uphill
)


def lap(P):
    """Fill SEGS from the parameter dict."""
    SEGS.clear()
    # ---- Sector 1: drag to T1, the Millrace brook, the esses
    S("main straight", P['main'], Z['t1'] + 0.2, width=14.0, left=dict(PIT), right=dict(STANDS))
    C("T1 Millrace", 'left', [("entry", 400, 40, 16, Z['t1'], 0.0, 0.04),
                              ("apex", 40, 40, P['t1'], Z['t1'] - 0.1, 0.04, 0.04),
                              ("exit", 40, 300, 18, Z['t1'], 0.04, 0.0)],
      width=14.0, cls='slow', out_run={'entry': (20, 28), 'apex': (28, 28), 'exit': (28, 20)})
    S("Brook run", P['brook'], Z['brook'], width=13.5)
    C("Sawpit", 'right', [("entry", 450, 125, 12, Z['brook'] + 0.5, 0.0, 0.03),
                          ("apex", 125, 125, P['saw'], Z['saw'] - 0.4, 0.03, 0.03),
                          ("exit", 125, 450, 12, Z['saw'], 0.03, 0.0)], width=13.0)
    S("esses link", P['link'], Z['link'])
    C("Woodcutter", 'left', [("entry", 450, 130, 10, Z['link'] + 0.5, 0.0, 0.03),
                             ("apex", 130, 130, P['wood'], Z['wood'] - 0.5, 0.03, 0.03),
                             ("exit", 130, 450, 10, Z['wood'], 0.03, 0.0)], width=13.0)
    # ---- Sector 2: the Ladder climb, the blind Brow, the ridge top and the Windhover flick
    S("the Ladder", P['ladder'], Z['ladder_top'])
    C("the Brow", 'left', [("crest", 450, 180, 13, Z['brow'], 0.0, 0.03),
                           ("apex", 180, 180, P['brow'], Z['brow'] - 0.2, 0.03, 0.03),
                           ("exit", 180, 450, 13, Z['brow'] - 0.5, 0.03, 0.0)],
      cls='fast', out_run={'crest': (20, 24), 'apex': (24, 24), 'exit': (24, 18)})
    S("Ridge top", P['ridge'], Z['ridge'] + 0.1)
    wh, wr = P['wh'], P['wr']
    C("Windhover right", 'right', [("in", 1200, wr, wh, Z['ridge'] + 0.2, 0.0, 0.0),
                                   ("out", wr, 1200, wh, Z['ridge'] + 0.25, 0.0, 0.0)], cls='fast')
    C("Windhover left", 'left', [("in", 1200, wr, wh, Z['ridge'] + 0.2, 0.0, 0.0),
                                 ("out", wr, 1200, wh, Z['ridge'], 0.0, 0.0)], cls='fast')
    S("Kestrel approach", P['appr'], Z['kest_in'])
    # ---- Sector 3: the Kestrel spiral, Talon, the Drop, the fern valley and the Beck bridge
    C("Kestrel", 'left', [("entry", 450, 140, 20, Z['kest_in'] - 0.5, 0.0, 0.05),
                          ("tighten", 140, 68, P['k_tight'], Z['kest_tight'], 0.05, 0.10),
                          ("hold", 68, 68, P['k_hold'], Z['kest_hold'], 0.10, 0.10),
                          ("exit", 68, 240, P['k_exit'], Z['kest_out'], 0.10, 0.0)],
      width=13.5, cls='slow', entry_kerb=False,
      out_run={'entry': (18, 24), 'tighten': (26, 28), 'hold': (28, 28), 'exit': (28, 20)})
    C("Talon", 'right', [("flick", 240, 240, P['talon'], Z['talon'], 0.0, 0.0)], width=13.0, cls='fast')
    S("Fernside", P['fern'], Z['fern'])
    C("the Drop", 'right', [("entry", 400, 70, 14, Z['fern'] - 0.4, 0.0, 0.035),
                            ("apex", 70, 70, P['drop'], Z['drop'] + 0.6, 0.035, 0.035),
                            ("exit", 70, 400, 14, Z['drop'], 0.035, 0.0)], width=13.0, cls='slow',
      out_run={'entry': (16, 22), 'apex': (22, 22), 'exit': (22, 16)})
    S("Fernside dive", P['dive'], Z['dive'])
    b = P['beck']
    C("Beck bridge", 'left', [("in", 1500, 420, b, Z['beck_mid'], 0.0, 0.0),
                              ("out", 420, 1500, b, Z['beck_out'], 0.0, 0.0)],
      cls='fast', widths=[13.0, 13.5], out_run={'in': (6, 6), 'out': (6, 8)}, in_run=6)
    S("Hollow straight", P["hstr"], Z["hollow_in"], width=14.0)
    hr = P['hol_r']
    C("the Hollow", 'right', [("entry", 350, hr, 16, Z['hollow_in'], 0.0, 0.04),
                              ("apex", hr, hr, P['hol'], Z['hollow_in'] + 0.2, 0.04, 0.04),
                              ("exit", hr, 350, 16, Z['hollow_out'], 0.04, 0.0)], width=14.0, cls='slow')
    # ---- Sector 4: the Meadow run, the flat-out Larch kink, the uphill back straight, the opening Switchback, the grid
    S("Meadow run", P['meadow'], Z['meadow'], width=14.0)
    k, ki, kr = P['kink'] / 2, P['kink_in'], P['kink_r']
    C("Larch kink", 'right', [("in", ki, kr, k, (Z['meadow'] + Z['kink']) / 2, 0.0, 0.0),
                              ("out", kr, ki, k, Z['kink'], 0.0, 0.0)], width=14.0, cls='fast')
    S("back straight", P['back'], Z['back'], width=14.0)
    C("Switchback", 'left', [("entry", 300, 30, 18, Z['back'] + 0.3, 0.0, 0.05),
                             ("apex", 30, 30, P['sw'], Z['sw_out'] - 0.5, 0.05, 0.05),
                             ("exit", 30, P['sw_exit_r'], P['sw_exit'], Z['sw_out'], 0.05, 0.0)],
      width=14.0, cls='slow', in_run=10, out_run={'entry': (20, 28), 'apex': (28, 28), 'exit': (28, 18)})
    S("grid straight", P['grid'], START_Z, width=14.0, left=dict(PIT), right=dict(STANDS))


# closure solve in this builder (exact): heading from one arc, position from two straights
ADJ_STRAIGHTS = ("the Ladder", "Hollow straight")
ADJ_ARC = "the Hollow apex"
# closure handles for trackgen (absorbs tiny residuals only): straights 115 deg apart (105 vs 220), mid-size arc
OVR_CLOSURE = {"straights": ["the Ladder", "back straight"], "arc": "the Drop apex"}

lap(P)


def taper_runoff(segs):
    """Make the barrier line continuous: every segment starts its run-off (per side) where the
    previous one ended, so widths taper linearly inside segments instead of stepping at joins."""
    for i, s in enumerate(segs):
        prev = segs[i - 1]
        for side_name in ('left', 'right'):
            s[side_name]['runoffStart'] = prev[side_name]['runoffEnd']


def build(close=True):
    taper_runoff(SEGS)
    if close:
        close_loop(SEGS, START_Z, (idx(ADJ_STRAIGHTS[0]), idx(ADJ_STRAIGHTS[1])), idx(ADJ_ARC), target_turns=1)
    for s in SEGS:
        if s['type'] == 'straight':
            s['length'] = round(s['length'], 4)
        s['arc'] = round(s['arc'], 8) if s['arc'] else 0
    return {
        "format": "splitways-layout@1",
        "name": "Kestrel Pines",
        "licence": LICENCE,
        "credits": CREDITS,
        "source": {"package": "original", "file": "", "readme": "", "readmeLicence": "",
                   "notes": "Original design, not derived from any existing track"},
        "startZ": START_Z,
        "segments": SEGS,
    }


def overrides():
    return {"format": "splitways-overrides@1", "id": "kestrel-pines", "name": "Kestrel Pines",
            "laps": 3, "checkpointCount": 18, "licence": LICENCE, "credits": CREDITS,
            "closure": OVR_CLOSURE}


if __name__ == '__main__':
    layout = build(close='--open' not in sys.argv)
    if '--open' not in sys.argv:
        json.dump(layout, open(OUT, 'w'), indent=1)
        json.dump(overrides(), open(OUT_OVR, 'w'), indent=1)
    t, v, pts = lap_sim(SEGS, START_Z)
    print('lap time est (d model, 1.0 g): %.1f s   gap %.2f m' % (t, math.hypot(pts[-1][0], pts[-1][1])))
    s0 = 0.0
    z0 = START_Z
    for s in SEGS:
        L = seg_len(s)
        print('%-22s %-8s s=%6.0f L=%6.1f r=%6s-%-6s arc=%6.1f z=%5.1f g=%5.1f%% w=%4.1f b=%+.3f>%+.3f' % (
            s['name'], s['type'], s0, L, s['radiusStart'] or '', s['radiusEnd'] or '',
            math.degrees(s['arc']) if s['arc'] else 0, s['zEnd'], 100 * (s['zEnd'] - z0) / L,
            s['roadWidth'], s['bankStart'], s['bankEnd']))
        s0 += L
        z0 = s['zEnd']
