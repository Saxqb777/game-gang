"""Timberfall Circuit: original ~3.3 km club circuit, temperate pine forest, clockwise.

Closure free variables: L1 = 'Lookout climb' (runs ~south), L2 = 'back straight' (runs ~west),
A = 'Lantern' arc (heading). Elevations are absolute (m); START_Z is the start/finish line.
"""
NAME = 'Timberfall Circuit'
START_Z = 14.0

def build(S, C, side):
    # side(kerb, kerbHeight, runoffStart, runoffEnd, surface, barrier)
    apron = lambda bar: side(0, 0, 10, 10, 'asphalt', bar)
    grass = lambda r0=8, r1=None: side(0, 0, r0, r1, 'grass', 'armco')
    apex = lambda r0=6, r1=None, kh=0.06: side(1.2, kh, r0, r1, 'grass', 'armco')
    exitk = lambda r0=10, r1=None, surf='grass', bar='armco': side(1.2, 0.04, r0, r1, surf, bar)
    trap = lambda r0, r1, kerb=1.2: side(kerb, 0.04, r0, r1, 'gravel', 'tyres')

    # Sector 1: commit and brake
    S('main straight', 380, 8.0, w=14, b0=0.0, b1=-0.02, left=apron('fence'), right=apron('wall'))
    C('T1 Sawmill', 'R', 42, 42, 100, 7.5, w=14, b0=-0.02, b1=-0.03,
      left=trap(14, 26), right=apex(6))
    S('Sawmill exit', 70, 8.0, w=13, b0=-0.03, b1=0.02, left=trap(22, 10), right=grass(8))
    C('Resin esses left', 'L', 120, 120, 55, 11.0, w=12, b0=0.02, b1=0.0,
      left=apex(6), right=exitk(12))
    C('Resin esses right', 'R', 120, 120, 55, 14.5, w=12, b0=0.0, b1=-0.02,
      left=exitk(12), right=apex(6))
    S('Lookout climb', 160, 19.5, w=12, b0=-0.02, b1=0.0, left=grass(8), right=grass(8), free='L1')
    C('Lookout crest', 'L', 300, 300, 20, 22.5, w=12, b0=0.0, b1=0.0, left=grass(8), right=grass(10))
    # Sector 2: the signature drop
    S('the Plunge', 60, 18.5, w=12.5, b0=0.0, b1=-0.05, left=grass(12), right=grass(8))
    C('Cathedral entry', 'R', 170, 95, 60, 14.0, w=13, b0=-0.05, b1=-0.08,
      left=grass(16, 20), right=apex(6, kh=0.05))
    C('Cathedral exit', 'R', 95, 65, 55, 10.5, w=13, b0=-0.08, b1=-0.05,
      left=trap(20, 26), right=apex(6))
    S('back straight', 400, 1.0, w=13, b0=-0.05, b1=0.0, left=exitk(14, 8), right=grass(8), free='L2')
    S('Creek rise', 266, 4.0, w=13, b0=0.0, b1=-0.03, left=grass(8), right=grass(8, 10))
    C('Creek hairpin', 'R', 30, 30, 160, 4.5, w=14, b0=-0.03, b1=-0.03,
      left=trap(22, 28), right=apex(5))
    # Sector 3: the switchback and the run home
    S('Kingfisher drag', 280, 7.0, w=13, b0=-0.03, b1=0.03, left=trap(18, 8), right=grass(8))
    C('Twin Pines one', 'L', 60, 60, 70, 9.0, w=12.5, b0=0.03, b1=0.03,
      left=apex(6), right=trap(14, 18))
    S('Twin Pines link', 90, 10.0, w=12.5, b0=0.03, b1=0.03, left=grass(8), right=exitk(10))
    C('Twin Pines two', 'L', 50, 50, 80, 12.0, w=12.5, b0=0.03, b1=0.03,
      left=apex(6), right=trap(16, 20))
    S('Ridge road', 250, 20.5, w=12, b0=0.03, b1=0.0, left=grass(8), right=exitk(12, 8))
    S('Ridge brow', 130, 19.5, w=12, b0=0.0, b1=-0.04, left=grass(8), right=grass(8))
    C('Lantern', 'R', 55, 150, 155, 16.5, w=13, b0=-0.04, b1=-0.02,
      left=trap(18, 12), right=apex(6), free='A')
    S('grid straight', 220, START_Z, w=14, b0=-0.02, b1=0.0, left=apron('fence'), right=apron('wall'))
