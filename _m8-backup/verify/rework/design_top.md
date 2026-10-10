# Kestrel Pines: Track 1 design

Original layout by the Gamer Gang project, 2026. Proprietary - (C) 2026 Gamer Gang project. All rights reserved.

Files: `base.layout.json` (splitways-layout@1), `overrides.json` (splitways-overrides@1), `build.py` (regenerates both and solves closure), `plot.png` (checker plot), `design_map.png` (speed-coloured map with elevation and speed traces), `compare.png` (originality sheet: the layout overlaid on Brands Hatch Indy before and after the fix, on g-track-2 and on the nearest real circuits), `tools/originality.py` (prints the comparison against all 196 reference outlines; its last output is in `originality.log`). The pre-fix version is kept in `../final_prev_brands/`.

| Item | Value |
|---|---|
| Length | 3358.9 m, counter-clockwise, 3 laps |
| Closure | gap 0.0 m, heading error 0.0 deg, back to startZ (0 m) |
| Elevation | -6.5 m to +15.5 m (22 m range); steepest segment 5.7% (the Fernside dive); the Ladder climbs 14.3 m at 5.1% |
| Road width | 13 to 14 m (14 m on the grid and main straight, at T1, and from the Hollow straight all the way round to the line; 13.5 m through the Kestrel) |
| Tightest corners | Switchback R30 and T1 Millrace R40. No other corner is under 45 m (the Hollow is R48). |
| Separate parts of the track | at least 122 m apart (Windhover and Kestrel approach vs the Drop) |
| Grid | 235 m of straight before the line, 275 m after it |
| Footprint | 685 x 1016 m |
| Checker | `FAILS: []`; heavy braking zones T1 Millrace (after 275 m) and Switchback (after 265 m) |
| Originality | no real circuit closer than 0.200 (Procrustes) in a 196-outline reference set; Brands Hatch Indy is now 0.211 (was 0.132) |

## The idea

One hill, told as one story. You start in the valley. At T1 you cross the millrace, wind up through the esses, then charge up the Ladder to a blind brow on the summit ridge. You run along the ridge top through a near-flat flick, then spiral down off the end of the ridge around a rocky knoll: that spiral is the Kestrel. You dive through the fern valley, cross the beck on a bridge at the lowest point, stop hard for the Hollow, then run home past the meadow and through the flat-out Larch kink into the Switchback hairpin. From above, the outline is a tall boot: the spiral lobe hangs off the top left, the descent bends inward to an open V at the Hollow, and the run home slants down to the hairpin at the bottom left.

The rhythm is **brake, flow, climb, crest, flick, spiral, dive, splash, brake, kink, hairpin, slingshot**. There are four hard stops from over 200 km/h (T1, the Kestrel, the Hollow and the Switchback), one long held corner as the signature, and never more than two corners in a row without a straight between them.

## Originality fix (Brands Hatch Indy)

The final review compared the previous version against 196 outlines (about 125 real circuits) and found it too close to **Brands Hatch Indy driven backwards** (silhouette 0.132 against 0.229 for the next real circuit; turning function 0.349). The match came mostly from the Switchback end: a 163 deg hairpin joined a 403 m back straight to the grid straight at only 17 deg, which made a narrow "finger" like Druids. These changes in `build.py` break it:

1. **Switchback opened from 163 to 140 deg.** The R30 apex is held for 62 deg instead of 85. The 18 deg entry and the 60 deg opening exit (R30 to R110) stay, so the slingshot onto the grid is unchanged.
2. **The back straight is split by the Larch kink.** The old 403 m straight is now the 100 m **Meadow run**, the **Larch kink** (a flat-out 10 deg right built from two 5 deg spirals, R1200 to R400 to R1200, flat, no bank) and a 265 m **back straight** into the Switchback. The back straight now meets the grid straight at 40 deg, so the finger becomes an open V.
3. **Closure moved** to the Ladder and the Hollow straight, with the Hollow apex as the heading arc. The Ladder grows from 200 to 281 m, the Hollow straight shrinks from 254 to 126 m, and the Hollow becomes a 69 deg corner (it was 102 deg).

Result: Brands Indy moves from 0.132 to **0.211** (silhouette, now 9th nearest of 196) and from 0.349 to **0.478** (turning function). No real circuit is under 0.200; the nearest are Mexico City 0.203, Pembrey 0.206, Madring 0.208, Brainerd 0.209 and Mallory Park 0.211, all in the range of unrelated circuits. Brands Indy's own nearest real circuit in the set is Monza at 0.212, so Kestrel Pines is now as far from Brands Indy as Monza is. The overlays are in `compare.png`.

This follows the reviewer's tested candidate A (`verify/variants/A_open_switchback_kink.json`) with three deliberate differences:

- **The Switchback is 140 deg, not 143 deg** (apex 62 deg instead of 65). In a search of about 2,500 variants, this gave the best worst case against real circuits (0.203 against 0.202 for A).
- **The kink comes after a 100 m Meadow run instead of halfway down the straight.** That leaves a 265 m straight into the Switchback, so the checker still lists it as a heavy braking zone. With A's 200 m + 200 m split, the checker listed only T1.
- **The kink spirals peak at R400, not R200.** A centre-line R200 caps the grippy speed model at about 171 km/h, so A's kink was not flat-out on paper. At R400 it is flat-out in every model (the grippy limit is about 240 km/h).

Compared with A, the Brands Indy scores are the same within 0.004 (0.211/0.478 against 0.213/0.482), g-track-2 is the same (0.217 against 0.218), and the Hollow straight is 126 m instead of 115 m.

**What it costs.** The Hollow's approach is shorter. In the speed model it still brakes from 211 to 85 km/h over 130 m (it was 228 to 85 over 154 m), because the Fernside dive and the flat-out Beck bridge kink feed it 363 m of full throttle. The checker no longer lists it as a heavy braking zone, because the Beck bridge kink splits the approach. The Switchback zone gets stronger: 218 to 68 km/h, where it was 208. The Ladder is longer and slightly less steep (281 m at 5.1% instead of 200 m at 6.2%), but it climbs more in total (14.3 m instead of 12.5 m), because the esses now climb only gently. The lap is 20 m shorter and 1.7 s quicker in the party model.

**Why nothing smaller was used.** In this layout the closure couples everything. Any edit that lengthens the Hollow straight pulls the shape back toward Brands Indy, and any edit that shortens it more pulls it toward Pembrey. A sweep of single-parameter edits (Windhover, Beck bridge, Talon, Drop, Kestrel, Brow, kink angle and position, esses, Hollow radius) found no point better than this one on both at once (`verify/rework/tweak2.py`).
