# Split Ways: M12 car line-up (proposal)

Status: proposal for the owner, 2026-10-10. Prep only: nothing in `/home/user/game-gang` was changed.
Contact sheet: `lineup-sheet.jpg` (same folder). The previews on it are the unreworked source models, so they still show the source shapes, plates and emblems.

Five prepared bodies become five cars under five invented makes, with class kits that turn them into eight to nine visible variants. Two gaps stay open: the hot hatch and the open-wheel (formula) car.

## 1. At a glance

| # | Source model (licence) | Proposed make and model | Body and layout | Stock class (PR) | Race classes it can enter |
|---|---|---|---|---|---|
| 1 | V12 Goblin, Olli Teittinen (CC BY 4.0) | **Briganti Zanna** | Supercar, mid V12, RWD | S1 (875) | A, S1, S2 (Track kit) |
| 2 | Generic Sport Coupe, MMC Works (CC BY 4.0) | **Dashwood Nightjar** | GT coupe, front-mid V8, RWD | A (770) | B, A, S1 (Endurance kit) |
| 3 | Muscle Car Concept, ViktorKom (CC BY 4.0) | **Brazen Haymaker** | Muscle restomod, front V8, RWD | A (735) | B, A, S1 (Knockout kit) |
| 4 | Futuristic Car 039, unityfan777 (CC0) | **Arvanta Sagitta** | Hypercar concept, tri-motor EV, AWD | S2 (945) | S1 (Road kit), S2 |
| 5 | Ariel_350-V2, orcha (CC BY 4.0); working name "Strix R4" | **Mudlark Scree** | Rally coupe, front turbo I4, AWD, cage | B (680) | C, B, A (Stage kit) |
| gap | not sourced | Hayaku Pipsqueak (hot hatch) | Hot hatch, FWD | C (590) | C, B |
| gap | not sourced | Slipwing SW-1 (open-wheel) | Single-seater, RWD | X (999) | X only (one-make) |

How the names were checked: every make and model above went through a web search (section 8). The search found no existing car brand, car model or notable automotive mark with these names. Four other candidates were rejected along the way: Nocturne, Halcyra, Kairon and Wrenfield. This is a sanity check, not legal clearance. The M14 clearance search (UAE, US, EU, UK) still has to cover them in Nice classes 9 and 41 (games), 28 (toys) and 12 (vehicles).

## 2. Classes and balance (so friends race fairly)

### 2.1 The ladder
The classes follow Forza's pattern. We use our own "PR" (performance rating, 100 to 999) rather than Forza's "PI" wording.

| Class | PR band | Target top speed | 0-100 km/h | Peak lateral g | Feel | Cars at launch |
|---|---|---|---|---|---|---|
| C "Hatch" | 501-600 | ~215 km/h | ~6.0 s | ~1.05 | Beginner, mountain road | Scree (detuned), hot hatch (gap) |
| B "Street" | 601-700 | ~245 km/h | ~4.6 s | ~1.15 | Party default | Scree, Haymaker, Nightjar |
| A "Sport" | 701-800 | ~285 km/h | ~3.8 s | ~1.25 | Main class | Nightjar, Haymaker, Scree + Stage kit, Zanna (detuned) |
| S1 "Super" | 801-900 | ~320 km/h | ~3.1 s | ~1.40 | Fast tracks | Zanna, Nightjar + Endurance, Haymaker + Knockout, Sagitta + Road kit |
| S2 "Hyper" | 901-998 | ~350 km/h | ~2.5 s | ~1.60 | Autodrome | Sagitta, Zanna + Track kit |
| X "Open-Wheel" | 999 | ~310 km/h | ~2.5 s | 2.5+ (aero) | Its own series | Formula car (gap) |

These are targets for the M11 per-wheel tyre model. The final say comes from lap times (2.3). Today's arcade car (top speed 187 km/h, grip 1.9) maps roughly to a C/B car.

### 2.2 Rules
1. **The host picks a class, not tunes.** In the lobby the host picks a class. Every car is then auto-set to that class's kit, which caps it at the class PR. Nobody has to visit a garage to race fairly.
2. **Class kits.** Each car stores one preset per eligible class: power (boost map or restrictor), ballast, tyre compound (street, sport, semi-slick, slick) and aero level. The kits double as visible variants (a wing, splitter or blower appears with the kit), which is how five bodies reach the 6-8 cars that M12 asks for.
3. **Mixed picks.** If friends pick cars with different stock classes, "Auto class" picks the highest class every chosen car is eligible for. If no class is shared, it suggests the nearest one.
4. **Equal lap time, different character.** Within a class, cars differ in how they are fast, not in how fast they are. For example, in A the Haymaker wins on straights, the Scree in hairpins, and the Nightjar is the all-rounder.
5. **Assists never change PR.** ABS, TC and Autopilot are handicaps or helpers on top of the class, as M11 already plans.

### 2.3 How to balance
- A fixed bot driver (the same line and inputs for every car) laps each track. Tune the kits until every car in a class is within **±0.3 s on Track 1** (about 0.4% of a ~75 s lap) and within ±0.6 s on every other track.
- Compute PR from the spec as a first guess: 35% acceleration (kW per tonne), 30% cornering (steady-state lateral g at 100 km/h), 20% top speed, 15% braking. Then correct it with the bot laps.
- Show five bars on the car picker, computed from the spec: Speed, Acceleration, Handling, Braking and **Ease**. Ease measures how forgiving the car is at the limit, which matters for first-time party players.
- Default class per track: club circuit (3.3 km) B/A, fast autodrome (5.9 km) S1/S2, mountain road (3.8 km) C/B.
- Launch with B, A and S1 (each has 3-4 cars). S2 arrives with the Sagitta, C with the hot hatch, and X with the formula car.

### 2.4 Physical fit today

| Car | Length | Width (body) | Height | Wheelbase | Tyre radius | Triangles | Meshes | GLB |
|---|---|---|---|---|---|---|---|---|
| Zanna | 4.79 m | 2.27 m (incl. mirrors) | 1.21 m | 2.74 m | 0.357 front / 0.376 rear | 65.7k | 19 | 3.5 MB |
| Nightjar | 4.73 m | 2.01 m | 1.35 m | 2.94 m | 0.378 (scale x0.935 gives 0.354) | 113.6k | 33 | 21.2 MB |
| Haymaker | 4.77 m | 2.17 m | 1.40 m | 3.05 m | 0.364 | 134.9k | 37 | 17.8 MB |
| Sagitta | 4.65 m | 2.00 m | 1.10 m | 2.51 m | 0.437 (too big) | 300.7k | 33 | 8.7 MB |
| Scree | 3.96 m | 2.20 m (too wide) | 1.31 m | 2.31 m | 0.349 | 279.2k | 39 | 8.2 MB |
| Game car now | 4.4 m box | - | - | 2.58 m | 0.354 | - | - | - |

- Every car needs its own WHEELS and collision box in `config.ts`, because the current single-car values do not fit any of them.
- `carVisual.ts` must keep the GLB's textured materials (today it swaps by name and falls back to `trim`). It also has to parent calipers/`brake_xx` to the steering pivots.
- Draw calls: M12's "about 160 car draw calls" for 4 cars in 4 viewports works out to about **10 per car per view**. All five are at 19-39 today, so every car needs a material merge or re-atlas for LOD1/LOD2.

## 3. The cars

### 3.1 Briganti Zanna (from V12 Goblin)
- **Make:** Briganti (Italian-flavoured; "brigands"). *Hill-country outlaws who hand-build loud, angular V12s. Tagline: "Steal the show."*
- **Model:** Zanna, Italian for "fang", after the fanged nose. Fallback if the owner finds it too close to Pagani's Zonda: "Morso" ("bite", not yet checked).
- **Class:** supercar. Stock **S1, PR 875**; it can also enter A (detuned) and S2 (Track kit: bigger wing, canards, diffuser).
- **Stock spec (fictional):** 6.5 L naturally aspirated V12, mid-mounted, 588 kW (800 PS), 1,430 kg, RWD, 0-100 in 2.9 s, 340 km/h.
- **Character:** Speed 9, Acceleration 8, Handling 7, Braking 8, Ease 4. Fastest on the straights and snappy at the limit.
- **Rework, legal (must do):**
  - Replace the licence plate, which copies the New York "Empire State" design with "G08-L1N" and the author's deviantart URL on the frame.
  - Repaint the tyre sidewall normal map to remove STREAMSIDE, 245/35 R22, the DOT and UTQG text and the max-load text.
  - Delete the 3D goblin emblems (grille and tail) and the "V12" wing scripts, and paint them out of the atlas and AO.
  - Paint out the yellow roundel and gold cog centre-cap art.
  - Never ship it as "Goblin". Credit the author in ASSETS.md and the credits.
- **Rework, distinctiveness** (it reads as Pagani, Lamborghini and Koenigsegg):
  - Swap the twin-stalk teardrop mirrors for door-mounted blades.
  - Replace the roof snorkel with a low NACA duct, and change the louvre pattern on the engine cover.
  - Replace the twin hexagonal exhausts with a centre trapezoid. Redraw the tail-light graphic.
  - Give the front its own light signature (split horizontal LED bars) and simplify the fang blades.
  - Replace the 10-blade turbine rims with Briganti's own rim.
- **Rework, tech:**
  - There is no body normal map, and the paint gets only 157 px/m.
  - The tyres are 750 triangles.
  - Livery needs a new UV1 on the paint mesh.
  - Calipers need steering-pivot parenting.
  - LOD0 target is about 110k.
- **Liveries:**
  - *Factory:* player colour, carbon lower third, one thin contrast pinstripe on the shoulder line, Briganti crest on the nose.
  - *Voltjaw Energy:* black with electric-yellow jagged "teeth" that sweep back from the front blades along the sills, and a yellow door number.
  - *Dentless Insurance:* white with player-colour "patch" panels that look stitched on, and "We'll cover the gap" on the rear wing.

### 3.2 Dashwood Nightjar (from Generic Sport Coupe)
- **Make:** Dashwood (British-flavoured; a dash of old money). *Grand tourers that cross a continent overnight in a three-piece suit. Tagline: "Arrive before breakfast."*
- **Model:** Nightjar, a nocturnal bird: the GT for night stages. It replaced "Nocturne", which is already a Bugatti Veyron special edition.
- **Class:** GT coupe, 2 seats, left-hand drive. Stock **A, PR 770**; it can also enter B (detuned) and S1 (Endurance kit: wing, splitter, wider arches, endurance number boards). **Recommended default car for new players.**
- **Stock spec (fictional):** 4.0 L twin-turbo V8, front-mid, 430 kW (585 PS), 1,640 kg, RWD, 0-100 in 3.6 s, 315 km/h.
- **Character:** Speed 7, Acceleration 6, Handling 7, Braking 7, Ease 8. The all-rounder: stable under braking and forgiving.
- **Rework, legal (must do):**
  - Replace the dashboard screen texture. It is an Apple CarPlay screenshot with the BMW roundel, Apple, Amazon Music, Audible, Spotify and Google Maps icons, plus a photo of a real instrument cluster. Make our own infotainment and cluster art.
  - Replace the tyre sidewall normal map. It carries Michelin Pilot Sport A/S 3+ ZP lettering, a size, a load index and a warning block.
  - Strip the author's local path from the FBX and material metadata.
  - Fill the empty plate recess with a Split Ways plate.
- **Rework, distinctiveness** (a GR Supra A90 front on an Aston Martin DB11/Vantage or Jaguar F-Type fastback):
  - Headlamps: give them a new outline and twin horizontal LED blades, replacing the three round projectors and the L-shaped DRL.
  - Front fascia: use horizontal slats or a split intake instead of the hex mesh, with new corner intakes.
  - Remove the fender blade behind the front wheel.
  - Change the side-window outline and the C-pillar kink.
  - Tail: replace the full-width bar with boomerang ends with a segmented or twin-C graphic. Reshape the ducktail, and change the diffuser and the exhaust layout.
  - Fit new mirror housings and a Dashwood rim.
- **Rework, tech:**
  - The tyres are 528-triangle, 24-sided outlines, and the brake discs are faceted.
  - The static hub stubs poke through the wheels when steering.
  - Body UVs are mirrored, with 68% texel overlap, so it needs a livery UV channel.
  - The GLB is 21.2 MB, mostly PNG normal maps, so ship KTX2.
  - There is no AO, and paint metallic = 1 reads as bare metal.
  - Scale x0.935 to the game wheel size.
- **Liveries:**
  - *Factory:* player colour, a contrast roof, a thin bright coachline, dark trim and no chrome.
  - *Tockwright Timing* (Endurance kit): deep navy with cream number roundels, a gold pinstripe and yellow-tinted headlamps. A generic endurance look, not any real team's.
  - *Slickstone Lubricants:* charcoal with a copper oil-drop motif that streams back from the front wheel.

### 3.3 Brazen Haymaker (from Muscle Car Concept)
- **Make:** Brazen (American-flavoured). *Blue-collar muscle: big blown V8s, bad manners, no apologies. Tagline: "Subtle is for other people."*
- **Model:** Haymaker, a wild knockout punch.
- **Class:** muscle restomod with 2+2 seats. Stock **A, PR 735**; it can also enter B (detuned) and S1 (Knockout kit: blower through the bonnet, wing, wider rear tyres).
- **Stock spec (fictional):** 6.2 L supercharged V8, 485 kW (660 PS), 1,720 kg, RWD, 0-100 in 4.0 s (traction-limited), 295 km/h.
- **Character:** Speed 7, Acceleration 7, Handling 4, Braking 5, Ease 5. A huge shove and lazy turn-in, and it loves to drift.
- **Rework, legal (must do):**
  - Paint the BREMBO wordmark off the calipers.
  - Replace the "V" crest on the rim centre caps.
  - Replace the New York "Empire State" plate (CVK-0667, embossed in the normal map) and the plate frame's dealer URL.
  - Delete the "2000 GTI" spoiler badge.
  - Clear the BRIDGESTONE strip behind the grille (colour and normal map) and the monogram label in the engine bay.
  - Re-check the atlases at 4096 afterwards.
- **Rework, distinctiveness:**
  - The quad round lamps in a black band, the oval lower grille and the rear lamp pods with the plate between them read as a **Ford Capri Mk1**. The front also echoes the 1970-71 Challenger/'Cuda, the shaker scoop is a Mopar/Mustang signature, and the fender stalk mirrors are 240Z/Celica.
  - New front: slim rectangular LED units or a light bar, a slatted grille and a trapezoid intake integrated with the splitter.
  - Replace the shaker with an offset scoop integrated into the bonnet, then delete the engine under it.
  - Move the mirrors to the doors.
  - Rear: a full-width bar or quad round lamps, a reprofiled ducktail and a deeper diffuser. Change the quarter-window outline.
  - Model the missing car-left inner headlamp lens.
- **Rework, tech:**
  - 61% of the triangles (interior, engine, chassis) are mostly hidden: cut to about 100-115k at LOD0.
  - It has 37 draw calls from two atlases: re-atlas it.
  - It uses about 220 MB of GPU textures: ship KTX2.
  - The paint UVs are stacked, so it needs a fresh livery unwrap.
- **Liveries:**
  - *Factory:* player colour with twin satin-black stripes over the top and a blacked-out bonnet panel.
  - *Munchwagon Burgers:* mustard yellow and ketchup red, a cartoon burger on the bonnet, and "Drive-thru? Drive THROUGH." on the boot.
  - *Spanner & Daughters Garage:* grey primer, hand-painted white numbers and masking-tape stripes, so it looks like a scruffy garage build.

### 3.4 Arvanta Sagitta (from Futuristic Car 039)
- **Make:** Arvanta (an invented tech-startup name). *Sells 1,200 PS electric hypercars by pre-order and over-the-air update. Tagline: "The future, pending update."*
- **Model:** Sagitta, Latin for "arrow", after the arrow nose and the V canopy.
- **Class:** hypercar concept. Stock **S2, PR 945**; it can also enter S1 (Road kit: wing retracted, narrower tyres).
- **Stock spec (fictional):** tri-motor electric, 880 kW (1,200 PS), 1,560 kg, AWD, 0-100 in 2.2 s, 360 km/h (limited), high downforce.
- **Character:** Speed 10, Acceleration 10, Handling 9, Braking 9, Ease 7. Brutal, but the AWD keeps it civil.
- **Rework, legal (must do):**
  - Ship only the debranded tyre build (`work/concept-car-039-generic-tyre.glb`). The main GLB still has the **Bridgestone Potenza RE050A** sidewall; delete those source files from any asset folder.
  - Drop the "body_color_supra" material name from metadata.
  - Turn the 5-point star hub cap into a centre-lock nut.
  - CC0 needs no credit, but credit unityfan777 anyway as a courtesy.
- **Rework, distinctiveness** (it copies no production car, but the slit headlights have a light Corvette C8/Lamborghini flavour and the overall feel is Vision-GT):
  - Give it its own headlight signature: one LED blade plus a vertical DRL "comma".
  - Finish the flat rear: a diffuser with 4-6 fins, a full-width light bar and an active wing.
  - Add a sculpted side intake.
  - Model a minimal cockpit (seat, yoke, helmeted driver) instead of black glass over a box.
  - Shrink the wheels from 0.874 m to about 0.75 m diameter and widen the rear track to match the front.
- **Rework, tech:**
  - 300.7k triangles need to come down to about 125k at LOD0. The chrome louvre trim alone is 23k and the calipers 12.6k.
  - There is no .mtl, so all materials are hand-set guesses.
  - The body UVs are a mirrored planar projection, so it needs a new UV1.
  - Use meshopt/Draco.
- **Liveries:**
  - *Factory "Ion":* pearl white, a dark gradient around the canopy, and the player colour on the nose arrow and mirror caps.
  - *Pingwave Mobile:* gloss black with cyan signal-wave lines radiating from the nose, and "Five bars, mostly." on the rear.
  - *Hexabyte prototype wrap:* black and white swirl camouflage like a pre-launch test mule, with "NOT YET RELEASED" across the doors.

### 3.5 Mudlark Scree (from Ariel_350-V2, working name "Strix R4")
- **Make:** Mudlark (English slang for a river scavenger). *A back-country rally workshop that turns forgotten 70s coupés into gravel weapons. Tagline: "Clean cars are slow cars."*
- **Model:** Scree, loose rock on mountain slopes.
- **Why not "Strix R4":** "Strix" is ASUS's ROG Strix gaming-hardware line, a notable mark in our own gaming space. "R4" is Renault 4's nickname and an FIA rally class. "Ariel" is a real marque. Rename the GLB root node and file at import.
- **Class:** rally coupe (touring/rally). Stock **B, PR 680**; it can also enter C (detuned) and A (Stage kit: wing, light pod, mudflaps). It is the hot-hatch stand-in until the hatch ships.
- **Stock spec (fictional):** 2.0 L turbo I4, 265 kW (360 PS), 1,190 kg, AWD, 0-100 in 3.9 s, 240 km/h (short gears).
- **Character:** Speed 4, Acceleration 7, Handling 8, Braking 7, Ease 8. Agile and planted in tight corners; runs out of breath on long straights.
- **Rework, legal (must do):** only the rename and the credit ("Based on 'Ariel 350 V2' by orcha, CC BY 4.0, modified"). The source has no textures, logos, plates or decals.
- **Rework, distinctiveness:**
  - Replace the BBS RS/LM-style basketweave rims, an iconic aftermarket design, with a flat-face 6-spoke.
  - Replace the full-width black front panel, LED outline and pill lamps with split blade DRLs, slim projectors and a real grille.
  - Replace the rear bar with square loops with a segmented bar with stepped ends.
  - Lower the ducktail, fit Mudlark's own single-element wing, and reshape the flying-buttress C-pillar and quarter glass. Add a roof vent.
  - Narrow the body 8-10% (2.20 m to about 2.0 m).
- **Keep it apart from the Haymaker.** Both are 1970s long-hood coupés today. Push the Haymaker low, long and wide-hipped on big rear tyres. Push the Scree tall, narrow and short-overhang, with raised ride height, mudflaps and a light pod.
- **Rework, tech:**
  - There are no textures and the UVs are junk, so it needs a new livery UV set and an AO bake.
  - 279k triangles need to come down to about 130k. The interior is 82k and the chassis 57k.
  - Fix the faceted rear quarter, the A-pillar gap and the octagonal exhaust tips.
- **Liveries:**
  - *Factory:* chalk white with a player-colour roof and red-orange tow hooks and mudflaps.
  - *Kerbwell Tyres works rally:* white with a red-and-white kerb-stripe band nose to tail, big door numbers and a windscreen banner.
  - *Lostway Navigation:* mud-brown and sand camo, a sat-nav pin on the roof, and "Recalculating..." across the rear window.

## 4. Fictional sponsors and livery rules

| Sponsor | Category | Line | Web-checked |
|---|---|---|---|
| Kerbwell Tyres | Tyres (the sidewall brand on every car) | "Grip you can hear." | yes, clean |
| Voltjaw Energy | Energy drink | "Bite back." | yes, clean ("Volt" energy drinks exist; the full name is distinct) |
| Dentless Insurance | Insurance | "We'll cover the gap." | yes, clean |
| Slickstone Lubricants | Oil | "Friction is fiction." | yes, clean (Slick 50 exists; low risk) |
| Tockwright Timing | Watches, timing | "Every tenth counts." | not yet |
| Munchwagon Burgers | Fast food | "Drive-thru? Drive THROUGH." | not yet |
| Spanner & Daughters | Garage, tools | "Est. last Tuesday." | not yet |
| Pingwave Mobile | Telecom | "Five bars, mostly." | not yet |
| Hexabyte | Tech | "Now with more hex." | not yet |
| Lostway Navigation | Sat-nav | "Recalculating..." | not yet |
| Fuelhorn Petroleum | Fuel | "Plenty more where that came from." | not yet |

Rules:
- **Player identity first.** In split screen, each player must spot their own car at a glance. Every livery keeps a player-colour zone (base paint, or roof plus mirror caps plus number board).
- **No real sponsors, tyre brands, plates or DOT codes.** Sidewalls carry Kerbwell plus an invented size code. Plates use a Split Ways design with no real state or country layout; the text is the player tag or "SW P1".
- **Don't copy iconic real liveries or brand colour combinations:** Gulf powder blue and orange, Martini stripes, Rothmans, JPS black and gold, the Marlboro chevron, Castrol, Red Bull, the Monster claw, Jägermeister orange, Alitalia, 555 blue and yellow.
- Liveries are SVG layers composited into each car's new livery UV set (the M12 compositor), with numbers per player and one shared sponsor pool.
- Clear the unchecked sponsors in the M14 search before launch.

## 5. Gaps and how to fill them

### 5.1 Hot hatch (class C, and the mountain road)
Proposed name: **Hayaku Pipsqueak** (both names web-checked, clean). *Hayaku: a Japanese-flavoured city-car maker whose tiny hatchbacks have suspiciously big turbos. Tagline: "Small car, big mouth."* Spec idea: 1.6 L turbo I4, FWD, 200 kW (270 PS), 1,210 kg, 5.4 s, 245 km/h, C (PR 590), can enter C and B.

| Option | How | Pros | Cons |
|---|---|---|---|
| A. Source another model | Time-boxed Sketchfab/Fab search: downloadable, CC0 or CC BY, "hatchback / hot hatch / city car / concept", separate wheels, under ~150k triangles | Fastest if a good one exists | The research found no verified original hatch. It needs the same debrand and silhouette check (reject anything close to a Golf GTI, Civic Type R, Fiesta ST, Mini, i30 N, GR Yaris, 205 GTI, Clio RS, Polo GTI or 500 Abarth) |
| B. Derive it from the Scree | Shorten the rear overhang, square the tail into a hatch, raise the roofline, FWD spec | No new licence; same pipeline | 2-3 artist days; shares the retro DNA, so less variety |
| C. Model or commission it (**recommended**) | Blender in-house, or a work-for-hire commission with full IP assignment in writing | Original by construction; livery UVs and LODs planned from day one | About 4-7 artist days, or a commission budget; owner decision because of the free-model rule |

Not recommended for hero cars: AI image-to-3D meshes. Their topology, UVs and licensing are too uncertain; at most use them for LOD3 or background props.

### 5.2 Open-wheel (formula) car, class X
Proposed name: **Slipwing SW-1** (Slipwing web-checked, clean; fallback constructor "Fennick", whose closest hits were real drivers named Fenwick). *Slipwing: a garage-born single-seater constructor; wings, slicks and nothing else. Tagline: "Draft first, ask later."* Spec idea: 2.0 L turbo I4 hybrid, 450 kW (610 PS), 650 kg with driver, RWD, 2.5 s, 310 km/h, high downforce.

| Option | How | Pros | Cons |
|---|---|---|---|
| A. Build in-house (**recommended**) | Monocoque, wings, exposed wheels, helmeted driver; no glass or full cabin | Simpler than a road car (about 3-5 artist days); fully original | Must avoid copying a specific season's F1/F2/IndyCar nose and sidepods. A generic halo is fine (it is a safety device), or use a 90s-style look without a halo |
| B. Source a CC0/CC BY single-seater | Same licence and silhouette checks | Possibly fastest | Most free open-wheelers are replicas of real chassis or carry real team liveries |
| C. Spec series only | One car, many liveries, its own X class | Fair by definition; one model to build | Needs the tyre model to handle high downforce |

Engineering notes:
- Open wheels interlock and launch cars. For a party game, give the car a soft capsule "bumper" collider and damp wheel-to-wheel impulses.
- Tune the chase cam per car, because the car sits low.
- Keep X separate from closed cars.
- Naming: never use "F1", "Formula 1", "Formula One", "Formula E", "IndyCar" or "FIA" in names or class labels. Call the class **Open-Wheel**.

## 6. Suggested order of work
1. **Mudlark Scree** as the pipeline pilot: no textures or branding to clean. It proves the whole pipeline, from reshape to new UVs (livery and AO) to the LOD chain to class kits. About 4-5 days.
2. **Dashwood Nightjar**: the default car, and the heaviest reshape. About 5 days.
3. **Briganti Zanna**: about 4 days.
4. **Brazen Haymaker**: about 5 days, including the hidden-geometry purge.
5. **Arvanta Sagitta**: about 5 days (decimation, new rear, cockpit, wheel resize). S2 opens with it.
6. Then the hot hatch (opens C) and the open-wheel car (opens X).

The day counts are rough guesses at close-up hero quality, per car, including livery UVs and LODs.

## 7. Credits to carry (ASSETS.md, `/licenses`, in-game credits)
- "Briganti Zanna" is based on "V12 Goblin" by Olli Teittinen, CC BY 4.0, modified (renamed, reshaped, debranded, re-materialed).
- "Dashwood Nightjar" is based on "Generic Sport Coupe" by MMC Works, CC BY 4.0, modified.
- "Brazen Haymaker" is based on "Muscle Car Concept" by ViktorKom, CC BY 4.0, modified.
- "Arvanta Sagitta" is based on "Futuristic Car 039" by unityfan777, CC0 (credit given as a courtesy).
- "Mudlark Scree" is based on "Ariel 350 V2" by orcha, CC BY 4.0, modified.

CC BY 4.0 allows commercial use and adaptation, as long as we credit the author and note the changes. It grants no trademark rights, which is one more reason to debrand fully.

## 8. Name check log (web search, 2026-10-10)

| Name | Use | Result | Verdict |
|---|---|---|---|
| Briganti | make | No car or automotive brand found | **use** |
| Zanna | model | No car found. The nearest is the Pagani Zonda, a different word ([Pirelli](https://www.pirelli.com/global/en-ww/road/cars/supercars/pagani-zonda-faster-than-the-wind-for-twenty-years-52046/)) | **use** (fallback Morso) |
| Dashwood | make | No car brand; only a 1950s club driver named John Dashwood ([Revs Institute](https://library.revsinstitute.org/advanced-search/entran%5EJohn%20Dashwood%5Eall%5Eand/1)) | **use** |
| Nightjar | model | No car found | **use** |
| Brazen | make | No car brand; Brava is an unrelated Brazilian motorcycle brand ([motonline](https://motonline.com.br/fipe/brava)) | **use** |
| Haymaker | model | No vehicle found; Haynes Automobile Co. is unrelated ([Wikipedia](https://en.wikipedia.org/wiki/Haynes_Automobile_Company)) | **use** |
| Arvanta | make | No company found; the Ararkis Sandstorm EV hypercar is a different name ([duPont Registry](https://news.dupontregistry.com/news/new-ev-hypercar-ararkis-sandstorm/)) | **use** |
| Sagitta | model | No car found; the Hispano Suiza Carmen Sagrera is a different word ([Magneto](https://www.magnetomagazine.com/hispano-suiza-launches-gt-spirited-carmen-sagrera-electric-hypercar/)) | **use** (low risk; note the shared "Sag-") |
| Mudlark | make | No brand; only the name of a 1932 university motoring trial ([Motor Sport archive](https://www.motorsportmagazine.com/archive/article/december-1932/6/the-inter-varsity-mud-lark/)) | **use** |
| Scree | model | No vehicle found | **use** |
| Hayaku / Pipsqueak | hot-hatch make / model | Nothing found | **use** |
| Slipwing | formula constructor | Nothing found (nearest: the Slotwings slot-car brand and a "Slipstream" design agency) | **use** |
| Fennick | formula fallback | No brand; real drivers named Fenwick ([Wikipedia](https://en.wikipedia.org/wiki/Alistair_Fenwick)) | fallback only |
| Kerbwell, Voltjaw, Dentless, Slickstone | sponsors | Nothing found under these names (Volt energy drinks, the Dentolo dental insurer and Slick 50 exist under other names) | **use** |
| Nocturne | GT model | **Bugatti Veyron 16.4 "Nocturne"** special edition ([RM Sotheby's](https://rmsothebys.com/auctions/ad25/lots/r0027-2010-bugatti-veyron-164-nocturne/)) | rejected |
| Halcyra | hypercar make | Too close to the **Chrysler Halcyon** concept ([Wikipedia](https://en.wikipedia.org/wiki/Chrysler_Halcyon)) and the UK Rolls-Royce remastering brand **Halcyon** ([report](https://autointernational.com.my/Rolls-Royce%20that%20once%20ruled%20the%20road,%20remastered%2060%20years%20later%20by%20HALCYON%20-%2028%20%20Mar%2025.html)) | rejected |
| Kairon | hypercar make | No hits, but said aloud it matches the **Bugatti Chiron** | rejected |
| Wrenfield | formula constructor | Too close to **Westfield** Sportscars, UK ([club page](https://www.carandclassic.com/clubs/westfield-sports-car-club-black-country-area)) | rejected |
| Malvento | supercar make | No hits, but it is a wind name. Pagani names cars after winds, and with "Zanna" it would echo Pagani on a car that already has Pagani cues | rejected by us |
| Strix R4 | working name | ASUS ROG Strix (gaming hardware); "R4" = Renault 4 nickname and an FIA rally class (known marks, not searched) | rejected |
| GTA cross-check | all models | None of the five model names turned up as GTA vehicles ([tracker.gg list](https://tracker.gg/gta6/vehicles)), and no make matches a GTA make (Pegassi, Grotti, Bravado, Dewbauchee and the rest) | ok |
