# Kestrel Pines: Track 1 design

Original layout by the Gamer Gang project, 2026. Proprietary - (C) 2026 Gamer Gang project. All rights reserved.

Files: `base.layout.json` (splitways-layout@1), `overrides.json` (splitways-overrides@1), `build.py` (regenerates both and solves closure), `plot.png` (checker plot), `design_map.png` (speed-coloured map with elevation and speed traces), `compare.png` (originality sheet: the layout overlaid on Brands Hatch Indy before and after the fix, on g-track-2 and on the nearest real circuits), `tools/originality.py` (prints the comparison against all 196 reference outlines; its last output is in `originality.log`). The pre-fix version is kept in `../final_prev_brands/`.

| Item | Value |
|---|---|
| Length | 3358.9 m, counter-clockwise, 3 laps |
| Closure | gap 0.0 m, heading error 0.0 deg, back to startZ (0 m) |
| Elevation | -6.5 m to +15.5 m (22 m range); steepest segment 5.7% (the Fernside dive); the Ladder climbs 14.3 m at 5.1% |
| Road width | 13 to 14 m (14 m on the grid and main straight, at T1, and from the Hollow straight all the way round to the line; 13.5 m through the Kestrel, on the Brook run and off the Beck bridge) |
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

## Corner by corner

Distances (s) are from the start line. Speeds are from the judges' shared point-mass model (`judge_t1/lap.py`). "Grippy" means 1.15 g cornering, 1.05 g braking and 230 km/h. "Party" means 0.85 g, 0.8 g braking and 200 km/h, roughly an assisted car on touch steering. Left and right are relative to the driving direction. On this counter-clockwise lap, left is always the infield.

| # | Name | s (m) | Type and geometry | Elevation | Min speed grippy / party | Run-off outside |
|---|---|---|---|---|---|---|
| - | Main straight | 0-275 | straight, 14 m, -1.2% | 0 to -3.2 m | peak 225 / 200 km/h | paved apron, pit wall left, catch fence right |
| 1 | **T1 Millrace** | 275-367 | left 105 deg, R40 (spirals R400-40-300), 14 m, bank 0.04 | -3.4 m, flat | 78 / 67 km/h | gravel 28 m, tyres |
| - | Brook run | 367-437 | straight 70 m | rising gently | | grass |
| 2 | **Sawpit** (esses, part 1) | 437-563 | right 44 deg, R125, spirals | -3.0 to -1.8 m, about +1% | 137 / 118 km/h | grass 16 m |
| 3 | **Woodcutter** (esses, part 2) | 609-734 | left 44 deg, R130, spirals, after a 46 m link | -1.2 to +0.6 m | 140 / 121 km/h | grass 16 m |
| - | The Ladder | 734-1014 | straight 281 m at +5.1% | +0.6 to +14.9 m | 156 to 217 km/h | grass |
| 4 | **The Brow** | 1014-1206 | left 50 deg, R180, blind crest at turn-in | summit, +15.5 m | 164 / 142 km/h | grass 24 m (no gravel at speed) |
| - | Ridge top | 1206-1240 | straight 34 m | +15 m plateau | | grass |
| 5 | **Windhover** | 1240-1462 | right 12 deg then left 12 deg, R340 peak, all spiral | +15 m | flat: 193 to 230 / 169 to 200 km/h | grass 12 m |
| - | Kestrel approach | 1462-1566 | straight 104 m | +15.0 to +14.3 m | braking from 230 / 200 km/h | grass |
| 6 | **THE KESTREL** | 1566-1908 | left 204 deg: entry R450 to 140 (20 deg), tightens R140 to 68 (70 deg), **holds R68 for 84 deg**, opens R68 to 240 (30 deg). 342 m long, 13.5 m wide, bank rising to 0.10 rad | +14.3 down to +3.7 m (-3.5% then -4.5%) | 104 / 91 km/h, held for about 100 m | gravel 24-28 m, tyres, the whole way round |
| 7 | **Talon** | 1908-1979 | right 17 deg, R240 flick | +3.7 to +3.0 m | flat, 139 to 171 km/h | grass |
| - | Fernside | 1979-2028 | straight 49 m | | | grass |
| 8 | **The Drop** | 2028-2119 | right 55 deg, R70, spirals, bank 0.035 | +2.0 to +0.2 m | 103 / 89 km/h | gravel 22 m, tyres |
| - | Fernside dive | 2119-2213 | straight 94 m at -5.7% | +0.2 to -5.2 m | 125 to 172 km/h | grass |
| 9 | **Beck bridge** | 2213-2351 | left kink 12 deg, R420, all spiral, over the beck | low point -6.5 m (compression) | flat, 172 to 208 km/h | grass 6-8 m (bridge parapets) |
| - | Hollow straight | 2351-2477 | straight 126 m, 14 m wide, +1.0% | -6.3 to -5.1 m | peak 211 / 188 km/h | grass |
| 10 | **The Hollow** | 2477-2555 | right 69 deg, R48 (spirals R350-48-350), 14 m, bank 0.04 | -5.1 m, level | 85 / 74 km/h | gravel 26 m, tyres |
| - | Meadow run | 2555-2655 | straight 100 m, 14 m, +0.6% | -4.6 to -4.0 m | accelerating, 106 to 158 km/h | grass |
| 11 | **Larch kink** | 2655-2760 | right 10 deg, all spiral (R1200 to R400 to R1200), flat, 14 m | -4.0 to -3.3 m | flat out, 158 to 192 km/h | grass 12 m |
| - | Back straight | 2760-3025 | straight 265 m, 14 m wide, +0.6% | -3.3 to -1.6 m | peak 218 / 194 km/h | grass |
| 12 | **Switchback** | 3025-3124 | left 140 deg hairpin: R30 for 62 deg, then **opens R30 to R110 over 60 deg**; 14 m, bank 0.05 | -1.6 to -0.2 m, uphill | 68 / 59 km/h | gravel 28 m, tyres |
| - | Grid straight | 3124-3359 | straight 235 m, 14 m | to 0 m at the line | 105 to 199 km/h | paved apron, pit wall, fence |

### What the driver does

1. **Main straight to T1 Millrace.** You get 510 m of straight from the Switchback exit to T1, gently downhill, flat out until the brake board. Brake hard and straight from about 225 km/h. Turn in late over the entry kerb and clip the long apex kerb; the 105 deg arc lets you square it off. The road is 14 m wide and the gravel outside catches lap-1 optimists. Overtaking: **the main pass of the lap** (zone 1).
2. **Brook run, Sawpit and Woodcutter (the esses).** This is a short squirt beside the brook, then one balanced right-left that only just starts to climb. Both halves are 44 deg at R125-130. A clean line takes them with a brief lift (about 140 km/h); a messy one costs drive up the Ladder. It is one smooth drag right and one drag left, not a technical chain. Overtaking: none to speak of. The esses sort out who has the better run up the hill.
3. **The Ladder.** 281 m of straight at 5.1%, in a cutting through the pines, climbing 14 m to the summit. Floor it. It is now the longest straight on the lap, so slipstreaming pays, but there is no braking zone at the top, so it is a drag race only.
4. **The Brow.** The road crests at the summit as you turn in. You cannot see the exit, so chevron boards and a marker gantry show the line. You arrive at about 215 km/h, so this is a lift and a dab of brake before the crest, then committed through it at about 165 km/h. The outside has 24 m of grass, not gravel, so a fast slide is slowed gently.
5. **Windhover.** A right-left flick along the ridge top, all spiral, with peak curvature at R340. It is flat out for a tidy line and asks for a lift if you are off line or side by side. The left half puts you on the right of the road, which is exactly where you want to be for the Kestrel turn-in. Overtaking: no pass here, but this is where you pick your slipstream line for the Kestrel.
6. **The Kestrel** (signature, see below). Brake as the road tips over the end of the ridge, ease off the brake while the radius closes and the banking builds, then hold one steady drag for about 100 m around the bottom. Feed the throttle as it opens. Overtaking: possible for the brave, either on the inside at the entry or around the outside on the banking with a cut-back at the exit (bonus zone).
7. **Talon.** A flat-out right flick that throws you out of the lobe. Exit kerbs on both sides let you use all the road.
8. **The Drop.** A medium right (about 105 km/h) that tips you into the valley. A good exit matters: it starts 363 m of full throttle to the Hollow brake board.
9. **Fernside dive and Beck bridge.** A 5.7% plunge through tall pines and ferns, then a flat-out left kink over the stone Beck bridge at the lowest point of the lap. The suspension loads up in the compression. This is the cheap thrill: no braking, just commitment.
10. **The Hollow.** 126 m of level-to-rising straight, 14 m wide, then a hard stop from about 210 km/h into a 69 deg right at R48. You brake on level ground, so stopping distances are predictable. Overtaking: **zone 3**. It is shorter than T1 and the Switchback, so the pass is on for whoever got the better Drop exit and the tow over the bridge.
11. **Meadow run and the Larch kink.** Hard on the throttle out of the Hollow, past the wet meadow, then a 10 deg right through a stand of larches. It is flat out in every car, but it moves the racing line from the left of the road to the right. A car that took the Hollow wide can use it to get back on line, and a car in the tow can use it to pull out alongside.
12. **Back straight to the Switchback.** 265 m gently uphill, 14 m wide, after the 205 m run from the Hollow exit through the kink, into the slowest corner on the lap. Braking is uphill from about 218 km/h, which shortens the stop and forgives a late lunge up the inside. Hold the tight R30 part, then the hairpin opens out to R110. Pick up the throttle early and let the opening radius slingshot you down the grid. Overtaking: **zone 2**, and its exit feeds zone 1.

## The signature corner: the Kestrel

The Kestrel is a 204 deg descending left that coils down around a rocky knoll at the end of the summit ridge, like a helter-skelter. You see it from the ridge top before you get there: the road ahead drops away and curls back underneath itself.

How it unfolds:

- **Entry (20 deg, R450 to R140).** You are braking from about 230 km/h. The road starts to fall away and the banking begins to build (0 to 0.05 rad).
- **Tighten (70 deg, R140 to R68).** You ease off the brakes as the radius closes. The car settles into the banking, which rises to 0.10 rad, and the grade steepens to about -3.5%. This is a light, progressive trail, not a stamp on the brakes in mid-corner. In the model the speed falls only from about 145 to 104 km/h over about 120 m.
- **Hold (84 deg, constant R68, bank 0.10, -4.5%).** One steady steering input for about 100 m at about 104 km/h. The banking catches the car. The corner is 13.5 m wide, so there is a real inside line and a real outside line, and two cars can go round side by side.
- **Exit (30 deg, R68 to R240) into Talon.** It opens, the banking unwinds, and you are back on the throttle down the hill.

It drops 10.6 m in all. There is a 24-28 m gravel trap with a tyre wall all the way round the outside, where the hillside falls away over the pines. On a phone drag the corner reads as "brake, squeeze, hold, release". It rewards commitment and a smooth hand, not twitchy corrections.

Why it is different from candidate d's version: d tightened all the way to R55 while dropping 5.4% with only 0.06 rad of bank, so you were trail-braking and adding lock for about 270 m. The final version tightens only to R68, then holds it on 0.10 rad of banking with a gentler grade. That is the Kettle's best trick from candidate c, used on Kestrel's own descending spiral.

## Overtaking zones

1. **T1 Millrace (primary).** 510 m of straight: the Switchback's opening exit, the 235 m grid straight and the 275 m main straight. The braking zone is 14 m wide on a slight downhill, from about 225 to 78 km/h over about 155 m (party car: 200 to 67 km/h). The long 105 deg arc allows a switchback on exit. This is where most lap-1 and last-lap moves happen.
2. **The Switchback.** 470 m of full throttle from the Hollow exit: the Meadow run, the flat-out Larch kink and the 265 m back straight. Braking is uphill, from about 218 to 68 km/h over about 150 m (party car: 194 to 59 km/h), 14 m wide, with 28 m of gravel outside. The opening exit is the slingshot, so a better exit here sets up a second pass into T1. Zones 2 and 1 chain together.
3. **The Hollow.** 363 m of full throttle from the Drop exit (the Fernside dive, the flat-out Beck bridge kink and the 126 m Hollow straight). The 14 m braking zone is on level-to-rising ground, from about 211 to 85 km/h over about 130 m (party car: 188 to 74 km/h), with 26 m of gravel outside. The Hollow (right) and the Switchback (left) turn opposite ways, so a lunge at one can be answered at the next.
4. **Bonus: the Kestrel entry.** A 104 m approach after the flat-out Windhover, braking from about 230 km/h. You can go up the inside at turn-in, or round the outside on the banking with a cut-back at the exit. It is high risk, but because the corner is wide and banked it is not a guaranteed crash.

The checker counts a heavy braking zone only after 250 m or more of unbroken straight, so it lists T1 and the Switchback. The Hollow's approach is broken by the Beck bridge kink, but the speed model shows a 126 km/h stop there.

## Elevation story

- **Valley start (0 m).** The grid and the line sit on a gentle rise out of the Switchback. The main straight falls 3.2 m to the millrace at T1 (-3.4 m).
- **The climb.** The esses only just start climbing (about +1%, to +0.6 m). The Ladder then does the real work: 14.3 m in 281 m at 5.1%.
- **The summit.** The Brow crests at +15.5 m, the highest point, and the ridge top stays at about 15 m through the Windhover. This plateau has the views.
- **The spiral down.** The Kestrel drops 10.6 m (to +3.7 m) around the knoll, getting steeper as it tightens (-3.5% then -4.5%).
- **The plunge.** Talon and the Drop ease down to 0 m, then the Fernside dive falls 5.7% to the valley floor. This is the steepest segment on the lap.
- **The low point.** The Beck bridge is at -6.5 m, with the compression just after the bridge.
- **The long way home.** It climbs gently back up: the Hollow straight at +1.0%, the Meadow run, Larch kink and back straight at +0.6%, and the Switchback climbing through the turn, until the line at 0 m. The last third of the lap is slightly uphill all the way, which makes both braking zones stable.

The total range is 22 m, inside the 12-30 m window with headroom if generator smoothing shifts it. The sharpest crest is the Brow (about 4% grade change) and the sharpest dips are the Beck bridge and the foot of the Ladder (about 4% each). All are mild enough for the generator's crest smoothing.

## Scenery moments for the forest dressing

Theme: a working pine forest with a beck running through it. The corner names come from birds of prey (Kestrel, Windhover, an old country name for the kestrel, Talon), the timber trade (Millrace, Sawpit, Woodcutter, Larch) and water and land (Brook, Beck, Hollow, Meadow). Keep the dressing in that world.

Names and signage to avoid:

- **No mountain-circuit cues.** Do not use "Skyline", "Conrod", "Dipper", "Chase", "Mountain Straight", "Corkscrew", "Rainey" or "Andretti" style names, signage or scenery. The lap's climb-ridge-descend shape is generic, and the dressing should not invite comparisons with Mount Panorama or Laguna Seca.
- **No Brands Hatch names**, because the old outline was close to Brands Indy. Do not use Paddock, Druids, Graham Hill, Cooper, Surtees, McLaren, Clearways, Clark, Brabham or Hailwood anywhere: not on corner boards, grandstands, bridges or the minimap. The pit and team area in the infield is signed **the team compound**, not "the paddock".

**Layout of the land.** The main straight runs east along the south edge. T1 is the south-east corner. The esses and the Ladder climb north up the east side. The ridge runs west-north-west along the top, and the Kestrel lobe is the north-west corner. The Fernside descent runs south-south-east down the middle to the Hollow. From there the Meadow run and the back straight slant south-west, with the Larch kink between them, to the Switchback at the south-west corner. The infield (always on the left) holds the team compound, the millpond and the beck valley. The open V west of the Hollow, between the Fernside descent and the run home, is the low wet meadow outside the circuit.

### Grandstands and spectator areas

1. **Main grandstand.** A covered timber stand on the outside (south) of the grid and main straight, centred on the line (s about 3230 to 100). It looks across the pit wall and sees the Switchback exit, the start and the run down to T1.
2. **T1 Millrace stand.** Outside the corner at the south-east, behind the gravel, angled up the main straight so it sees the whole braking zone. An old watermill with a turning wheel and the millpond sit on the inside of the corner. This is the landmark that names it.
3. **Switchback stand.** Outside the hairpin at the south-west, behind the gravel. It sees the Larch kink, the end of the back straight, the lunge and the slingshot onto the grid.
4. **Hollow bank.** A grassy spectator bank on the outside (infield side) of the Hollow, behind the gravel and a short walk from the team compound. It looks up the Hollow straight to the Beck bridge dive.
5. **Kestrel terrace.** A natural hillside terrace below the tyre wall on the outside of the lower half of the spiral, looking up the coil. Small and informal: picnic blankets, a few flags.
6. **Ladder bank.** A cleared hillside on the outside (east) of the Ladder, where people sit on the slope and watch cars climb.

### Viewpoints and sightlines (keep these clear of trees)

- **Ridge lookout.** A timber fire-lookout tower on the left of the Windhover (s about 1330), on the ridge edge. Thin the trees on the left of the ridge top so drivers on the Ridge and Windhover see the Kestrel coiling below and ahead (about 400 m away). A cleared firebreak running south-east should give a glimpse of the valley, the team compound and the main straight about 900 m away and 17 m lower.
- **Neck sightline.** Where the Kestrel approach and the Drop come within about 122 m of each other (s about 1450 and 2050), thin the trees on the left of the approach. Drivers on the ridge then glimpse rivals below them on Fernside. This is a party moment: "they're right there".
- **Kestrel knoll.** The rocky knoll inside the spiral carries a lone dead pine with a kestrel nest box, the circuit's logo moment. It is a camera position for replays and the attract-mode helicopter shot. No public access, because it is surrounded by track.
- **The Brow.** Seen from behind the crest, cars disappear over the summit. This is a good replay camera.
- **Beck bridge.** A low-angle photographers' spot on the meadow side, with mist on the water in the morning lighting preset.
- **Larch kink.** A stand of tall larches on the right of the kink (the meadow side), gold in the autumn lighting preset. They mark the kink from the Hollow exit and frame the view down the back straight to the Switchback stand. Keep them behind the armco, at least 12 m from the road edge.

### Bridges

The track never crosses itself, so there are no track-over-track bridges.

1. **Beck bridge** (s about 2240-2320). The track crosses the beck on a stone-and-timber bridge at the lowest point. The parapets sit on the barrier line, with 6-8 m of grass to the barrier, the narrowest run-off on the lap, at a flat-out kink. The beck runs out of the infield valley, under the bridge and into the wet meadow beside the Hollow.
2. **Spectator footbridge over the Meadow run** at s about 2610, joining the team compound to the meadow. It is a timber truss, before the Larch kink and well before the Switchback braking zone (which starts at about s 2890).
3. **Start gantry** over the line (s 0), carrying the start lights and the timing line.

### Marshal posts

Left and right are relative to the driving direction.

| Post | s (m) | Side | Covers |
|---|---|---|---|
| 1 | 200 | right | T1 braking zone, 100/200 m boards |
| 2 | 330 | right | T1 Millrace apex and exit (behind the tyre wall) |
| 3 | 540 | left | Sawpit exit and the esses |
| 4 | 980 | right | before the blind Brow crest, with flag-light repeaters on the crest |
| 5 | 1210 | left | Brow exit and the Windhover |
| 6 | 1500 | right | Kestrel braking zone |
| 7 | 1720 | right | Kestrel, the tightening section (on the tyre wall) |
| 8 | 1870 | right | Kestrel exit and Talon |
| 9 | 2070 | left | the Drop |
| 10 | 2330 | right | Beck bridge exit (meadow side) |
| 11 | 2510 | left | the Hollow (behind the gravel) |
| 12 | 2710 | right | Larch kink (meadow side) |
| 13 | 2930 | right | back straight, Switchback braking zone |
| 14 | 3060 | right | the Switchback |
| 15 | 3280 | left | grid and pit wall (race control in the pit building) |

### Gravel, grass, aprons and kerbs (as built in the layout)

- **Gravel traps with tyre walls, on the outside of the five slow corners only.** T1 Millrace (right, up to 28 m), the Kestrel (right, 24-28 m for the whole corner), the Drop (left, 22 m), the Hollow (left, 26 m) and the Switchback (right, 28 m). Each exit kerb in these corners is backed by gravel. On the dressing side, rake the gravel and leave a few tyre marks in it.
- **Grass with armco everywhere else.** That includes 24 m of grass outside the blind Brow, and grass outside the esses, the Windhover, Talon, the Beck bridge and the Larch kink.
- **Paved aprons only on the grid and main straight,** with the pit wall on the left and a catch fence and grandstand on the right.
- **Kerbs** are 1.2 m wide and sit on every apex and exit: inside on the apex, inside and outside on the exit, plus a late-entry inside kerb on slow corners. Heights are 0.06 m on slow corners, 0.05 on medium and 0.04 on fast, so they stay drivable for touch players. Wherever there is no kerb, kerbHeight is 0.
- Run-off widths taper continuously from one segment to the next (each segment starts where the previous one ended), so the barrier line never steps.

## Lap time

Ideal laps from the judges' shared model: **1:20.7 grippy** (1.15 g), **1:27.2 soft** (0.95 g, 210 km/h), **1:31.3 party** (0.85 g, 200 km/h). Candidate d's own model (1.0 g) gives 1:27.6. These are perfect-line laps for a point mass. Real players on a phone drag, with assists, traffic and four cars on one TV, typically run 8-15% off a perfect line. That puts likely race laps at about **1:39-1:45**, at the quick end of the 1:40-2:00 target. The originality fix made the lap 1.7 s quicker in the party model, mostly because the Switchback is more open and the Hollow is a shorter corner.

If playtesting shows laps are too quick, use these knobs in this order, none of which changes the character: shorten the Switchback's opening (R30 to R90 instead of R110), lower the Kestrel hold to R62, and tighten the Drop to R60. Each needs a rebuild with `build.py`, which re-solves closure. Then re-run `tools/originality.py`, because in this layout any change of geometry moves the closure straights and the outline, and the shape must stay at least 0.200 from every real circuit.

## Originality check

- **Reference set.** 196 outlines covering about 125 real circuits, from the reviewers' set: the bacinger/f1-circuits GeoJSON (40 F1 tracks), the TUMFTM racetrack-database centrelines (25), about 115 loops from OpenStreetMap (US, UK, Europe, Asia and Australia) and the 29 Speed Dreams tracks. Metrics are the reviewers' own (`verify/cmp/shapes.py`): silhouette distance (Procrustes, over shift, rotation, mirror and both directions) and turning-function distance (the corner sequence). Lower means more alike. Known copies score 0.02-0.08 (the Speed Dreams Corkscrew against Laguna Seca 0.026, forza against Monza 0.022).
- **Real circuits.** None is under 0.200. The nearest are Mexico City 0.203, Pembrey 0.206, Madring 0.208, Brainerd 0.209, Mallory Park 0.211 and Brands Hatch Indy 0.211. Among all pairs of unrelated circuits in the set, about 2% score under 0.200, so this is the near edge of the normal range, not a match. The mountain circuits are not close: Bathurst 0.260, Laguna Seca 0.324, Sonoma 0.558. The full Brands Hatch GP circuit is 0.452.
- **Brands Hatch Indy.** Silhouette 0.211, rank 9 of 196 (it was 0.132 and far ahead of everything else). Turning function 0.478 (it was 0.349). Brands Indy is still the nearest by turning function, because both laps have a long left-hand lobe and a left hairpin, but the margin to the next circuit is now small (g-track-2 0.547, Pembrey 0.568). The parts that made the match are gone. The Switchback end is an open V at 40 deg, with a kink in it, not a narrow parallel-sided finger. The Hollow is a 69 deg corner, not a long 100 deg turn. In the `compare.png` overlay the two outlines now agree only along the long east side and roughly around the top lobe; the bottom-left end is a different shape.
- **Speed Dreams g-track-2.** Silhouette 0.217 (rank 12), turning function 0.547, filled-shape overlap (IoU) about 0.69. It is closer than before (0.319), because opening the finger made the outline more compact. Unrelated compact circuits in the set overlap at about 0.45-0.65 IoU. It is still a different track by eye and by corner sequence. g-track-2 is a fat shield with 500 m and 450 m straights, two opening 30 deg rights and a sharp flick, with no spiral lobe and no inward V. Kestrel Pines has the 204 deg Kestrel lobe, the inward V at the Hollow and no straight longer than 281 m. Its heading trace puts the big steps in different places (`verify/rework/out/turn_g2_new.png`).
- **Concept.** The climb, ridge and descent arc is a generic hillside idea. The specific features are original: the helter-skelter spiral lobe off the end of the ridge, the flat-out bridge kink at the valley floor, the larch kink on the run home and the opening hairpin onto the grid. The names avoid any real-circuit corner names.

## What changed from Kestrel Ridge (candidate d), and where the ideas came from

| Change | Why / source |
|---|---|
| Switchback opened to 140 deg; back straight split into the Meadow run, the flat-out Larch kink (10 deg) and a 265 m back straight; closure moved to the Ladder and the Hollow straight (Ladder 281 m, Hollow straight 126 m, Hollow 69 deg) | Final review: the outline was too close to Brands Hatch Indy driven backwards. This follows the reviewer's tested candidate A, with the differences listed under "Originality fix". |
| Esses climb only gently (to +0.6 m) so the Ladder carries the climb | Keeps the Ladder a proper climb (14.3 m at 5.1%) now that it is 281 m long. |
| Kestrel tightens only to R68, then holds R68 for 84 deg; bank up to 0.10 rad; 13.5 m wide | Judges' top fix (all three). The constant-radius, banked hold comes from c's Kettle. |
| Windhover: right-left flick on the ridge top (R340, 12 deg each way, all spiral) | From c's Ranger's flick. It is our own geometry and also sets up the Kestrel turn-in. |
| Beck bridge: flat-out 12 deg kink over a beck at the valley floor, with the compression | From b's Fernbrook kink and a's creek bridge, merged. It breaks up the old 470 m straight Fernside descent. |
| The Hollow is braked on a level-to-rising straight (the compression moved to the bridge) | Fixes d's "downhill braking into a dip". |
| Switchback opens from R30 to R110 over 60 deg | From a's Lantern: the slingshot onto the grid and into the T1 slipstream. |
| T1, Hollow and Switchback braking zones 14 m wide; 14 m road from the Hollow straight to the line | From a: wider braking zones for four cars. |
| No road under 13 m (d was 12 m for 63% of the lap) | Judges' fix: room for four cars. |
| Grid straight 235 m (was 210 m) | Judges' fix: margin over the 180 m rule. |
| Esses rebuilt as one balanced right-left (44 deg at R125 and 44 deg at R130, about 140 km/h) | Fixes "Woodcutter is almost flat" and "esses slow and fiddly". |
| The Drop tightened from R100 to R70 with gravel; T1 R40 | Slows the lap toward the target. A good Drop exit matters for the Hollow pass. |
| Elevation range 22 m (was 28 m) | Headroom under the 30 m cap. |
| Talon has exit kerbs; slow-corner exit kerbs backed by gravel; kerbHeight 0 where there is no kerb; startZ 0 | From the judges' notes and b's trackgen notes. |
| The descent bends inward to the Hollow instead of running parallel to the climb; footprint 685 x 1016 m (d was 579 x 1036) | Fixes the long, narrow "out-and-back" neck. |
| Chevrons and a marker gantry at the blind Brow | From the judges' notes (a's "Lookout" lesson). |

## Notes for the track generator

- `overrides.json` closure handles: straights **"the Ladder"** (heading 105 deg) and **"back straight"** (heading 220 deg), 115 deg apart, plus arc **"the Drop apex"** (R70, 27 deg, a mid-size constant-radius corner). The layout already closes exactly (gap 0.0 m, heading 0.0 deg), so they only absorb rounding. (`build.py` itself solves closure on the Ladder, the Hollow straight and the Hollow apex.)
- startZ is 0 and the start line is at the start of "main straight". The grid sits on "grid straight", the last segment.
- Bank stays within plus or minus 0.10 rad and is continuous across every join. Width steps are at most 0.5 m between segments.
- Every corner is built from spiral entry and exit pieces. `build.py` writes the corner pieces as "<name> entry/apex/exit" (or "crest", "tighten", "hold", "in", "out", "flick"). The Larch kink is "Larch kink in" and "Larch kink out". Segment names are unique.
- Rebuild with `python3 -I build.py`, then check with `python3 -I ../../tools/layout_check.py base.layout.json plot.png` and `python3 -I tools/originality.py <scratch dir> compare.png`.

## Appendix: segment table

| # | Segment | Type | s start (m) | Length (m) | Radius (m) | Turn (deg) | z end (m) | Grade | Width (m) | Bank (rad) | Run-off (outside for corners) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | main straight | straight | 0 | 275.0 | - | - | -3.2 | -1.2% | 14 | 0 | L asphalt 16 m, wall / R asphalt 14 m, fence |
| 2 | T1 Millrace entry | left | 275 | 20.3 | 400 to 40 | 16 | -3.4 | -1.0% | 14 | 0 to +0.040 | gravel 14 to 28 m, tyres |
| 3 | T1 Millrace apex | left | 295 | 49.6 | 40 | 71 | -3.5 | -0.2% | 14 | +0.040 | gravel 28 to 28 m, tyres |
| 4 | T1 Millrace exit | left | 345 | 22.2 | 40 to 300 | 18 | -3.4 | +0.5% | 14 | +0.040 to 0 | gravel 28 to 20 m, tyres |
| 5 | Brook run | straight | 367 | 70.0 | - | - | -3.0 | +0.6% | 13.5 | 0 | L grass 10 m, armco / R grass 10 m, armco |
| 6 | Sawpit entry | right | 437 | 41.0 | 450 to 125 | 12 | -2.5 | +1.2% | 13 | 0 to -0.030 | grass 10 to 16 m, armco |
| 7 | Sawpit apex | right | 478 | 43.6 | 125 | 20 | -2.2 | +0.7% | 13 | -0.030 | grass 16 to 16 m, armco |
| 8 | Sawpit exit | right | 522 | 41.0 | 125 to 450 | 12 | -1.8 | +1.0% | 13 | -0.030 to 0 | grass 16 to 14 m, armco |
| 9 | esses link | straight | 563 | 46.0 | - | - | -1.2 | +1.3% | 13 | 0 | L grass 10 m, armco / R grass 10 m, armco |
| 10 | Woodcutter entry | left | 609 | 35.2 | 450 to 130 | 10 | -0.7 | +1.4% | 13 | 0 to +0.030 | grass 10 to 16 m, armco |
| 11 | Woodcutter apex | left | 644 | 54.5 | 130 | 24 | 0.1 | +1.5% | 13 | +0.030 | grass 16 to 16 m, armco |
| 12 | Woodcutter exit | left | 698 | 35.2 | 130 to 450 | 10 | 0.6 | +1.4% | 13 | +0.030 to 0 | grass 16 to 14 m, armco |
| 13 | the Ladder | straight | 734 | 280.8 | - | - | 14.9 | +5.1% | 13 | 0 | L grass 10 m, armco / R grass 10 m, armco |
| 14 | the Brow crest | left | 1014 | 58.3 | 450 to 180 | 13 | 15.5 | +1.0% | 13 | 0 to +0.030 | grass 10 to 24 m, armco |
| 15 | the Brow apex | left | 1073 | 75.4 | 180 | 24 | 15.3 | -0.3% | 13 | +0.030 | grass 24 to 24 m, armco |
| 16 | the Brow exit | left | 1148 | 58.3 | 180 to 450 | 13 | 15.0 | -0.5% | 13 | +0.030 to 0 | grass 24 to 18 m, armco |
| 17 | Ridge top | straight | 1206 | 34.0 | - | - | 15.1 | +0.3% | 13 | 0 | L grass 10 m, armco / R grass 10 m, armco |
| 18 | Windhover right in | right | 1240 | 55.5 | 1200 to 340 | 6 | 15.2 | +0.2% | 13 | 0 | grass 10 to 12 m, armco |
| 19 | Windhover right out | right | 1296 | 55.5 | 340 to 1200 | 6 | 15.2 | +0.1% | 13 | 0 | grass 12 to 12 m, armco |
| 20 | Windhover left in | left | 1351 | 55.5 | 1200 to 340 | 6 | 15.2 | -0.1% | 13 | 0 | grass 8 to 12 m, armco |
| 21 | Windhover left out | left | 1407 | 55.5 | 340 to 1200 | 6 | 15.0 | -0.4% | 13 | 0 | grass 12 to 12 m, armco |
| 22 | Kestrel approach | straight | 1462 | 104.0 | - | - | 14.3 | -0.7% | 13 | 0 | L grass 10 m, armco / R grass 10 m, armco |
| 23 | Kestrel entry | left | 1566 | 74.5 | 450 to 140 | 20 | 13.8 | -0.7% | 13.5 | 0 to +0.050 | gravel 10 to 24 m, tyres |
| 24 | Kestrel tighten | left | 1641 | 111.8 | 140 to 68 | 70 | 9.9 | -3.5% | 13.5 | +0.050 to +0.100 | gravel 24 to 28 m, tyres |
| 25 | Kestrel hold | left | 1753 | 99.7 | 68 | 84 | 5.4 | -4.5% | 13.5 | +0.100 | gravel 28 to 28 m, tyres |
| 26 | Kestrel exit | left | 1852 | 55.5 | 68 to 240 | 30 | 3.7 | -3.1% | 13.5 | +0.100 to 0 | gravel 28 to 20 m, tyres |
| 27 | Talon | right | 1908 | 71.2 | 240 | 17 | 3.0 | -1.0% | 13 | 0 | grass 8 to 12 m, armco |
| 28 | Fernside | straight | 1979 | 49.0 | - | - | 2.0 | -2.0% | 13 | 0 | L grass 10 m, armco / R grass 10 m, armco |
| 29 | the Drop entry | right | 2028 | 29.1 | 400 to 70 | 14 | 1.6 | -1.4% | 13 | 0 to -0.035 | gravel 10 to 22 m, tyres |
| 30 | the Drop apex | right | 2057 | 33.0 | 70 | 27 | 0.8 | -2.4% | 13 | -0.035 | gravel 22 to 22 m, tyres |
| 31 | the Drop exit | right | 2090 | 29.1 | 70 to 400 | 14 | 0.2 | -2.1% | 13 | -0.035 to 0 | gravel 22 to 16 m, tyres |
| 32 | Fernside dive | straight | 2119 | 94.0 | - | - | -5.2 | -5.7% | 13 | 0 | L grass 10 m, armco / R grass 10 m, armco |
| 33 | Beck bridge in | left | 2213 | 68.7 | 1500 to 420 | 6 | -6.5 | -1.9% | 13 | 0 | grass 10 to 6 m, armco |
| 34 | Beck bridge out | left | 2282 | 68.7 | 420 to 1500 | 6 | -6.3 | +0.3% | 13.5 | 0 | grass 6 to 8 m, armco |
| 35 | Hollow straight | straight | 2351 | 126.3 | - | - | -5.1 | +1.0% | 14 | 0 | L grass 10 m, armco / R grass 10 m, armco |
| 36 | the Hollow entry | right | 2477 | 23.6 | 350 to 48 | 16 | -5.1 | +0.0% | 14 | 0 to -0.040 | gravel 10 to 26 m, tyres |
| 37 | the Hollow apex | right | 2501 | 31.0 | 48 | 37 | -4.9 | +0.6% | 14 | -0.040 | gravel 26 to 26 m, tyres |
| 38 | the Hollow exit | right | 2532 | 23.6 | 48 to 350 | 16 | -4.6 | +1.3% | 14 | -0.040 to 0 | gravel 26 to 18 m, tyres |
| 39 | Meadow run | straight | 2555 | 100.0 | - | - | -4.0 | +0.6% | 14 | 0 | L grass 10 m, armco / R grass 10 m, armco |
| 40 | Larch kink in | right | 2655 | 52.4 | 1200 to 400 | 5 | -3.6 | +0.7% | 14 | 0 | grass 10 to 12 m, armco |
| 41 | Larch kink out | right | 2708 | 52.4 | 400 to 1200 | 5 | -3.3 | +0.7% | 14 | 0 | grass 12 to 12 m, armco |
| 42 | back straight | straight | 2760 | 265.0 | - | - | -1.6 | +0.6% | 14 | 0 | L grass 10 m, armco / R grass 10 m, armco |
| 43 | Switchback entry | left | 3025 | 17.1 | 300 to 30 | 18 | -1.3 | +1.8% | 14 | 0 to +0.050 | gravel 10 to 28 m, tyres |
| 44 | Switchback apex | left | 3042 | 32.5 | 30 | 62 | -0.7 | +1.8% | 14 | +0.050 | gravel 28 to 28 m, tyres |
| 45 | Switchback exit | left | 3075 | 49.4 | 30 to 110 | 60 | -0.2 | +1.0% | 14 | +0.050 to 0 | gravel 28 to 18 m, tyres |
| 46 | grid straight | straight | 3124 | 235.0 | - | - | 0.0 | +0.1% | 14 | 0 | L asphalt 16 m, wall / R asphalt 14 m, fence |
