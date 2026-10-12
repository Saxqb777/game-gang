# Arvanta Sagitta: debrand notes (concept-car-039)

Source: "FREE Concept Car 039" by unityfan777, CC0. Built by `cars-v2/_tools/cars/concept_car_039.py` (run with `python3 -I`) from `carkit/concept-car-039/`.

## Result

- GLB: `cars-v2/concept-car-039/concept-car-039.glb`, 7,775,124 bytes, 298,944 triangles (before: 8,725,808 bytes (main) / 8,478,788 bytes (generic-tyre build), 300,736 triangles).
- Structure kept: `wheel_fl/fr/rl/rr` nodes pivoted at the axle centre (same transforms as the carkit build), wheel meshes under them, brake/caliper nodes unchanged, `paint` still its own material.
- No Draco, meshopt or KTX2 (the game's loader in `/home/user/m8-wt/int` uses a plain GLTFLoader with no DRACOLoader/KTX2Loader). Textures are plain JPEG/PNG.
- Previews: `preview-front34.png`, `preview-rear34.png`, `preview-side.png`; close-ups in `check/` (front, rear, wheel_fl, wheel_rl).

## Changes

- Source: built from work/concept-car-039-generic-tyre.glb (the generic, text-free sidewall), never from the main carkit GLB whose sidewall still carries the Bridgestone Potenza RE050A lettering. Every texture in it was checked: sidewall base colour/normal are plain rings, the tread maps carry no text.
- Wheels: deleted the chrome 5-point star on all four hubs (wheel_xx_rim_chrome, 300 triangles each) and the centre cap + five lug bolts (340 triangles per wheel); added a 12-flat centre-lock nut with flange and pin (node wheel_xx_hubnut, 192 triangles, new material "hub_nut") under each wheel node, so the hub now reads as a plain race 5-spoke with a centre lock.
- Size: removed the unused UV channel from 28 untextured primitives (chrome, trim, blackout, glass, lights, rims, discs, calipers, hub nuts). Paint keeps its UVs (needed later for the livery unwrap); tyres keep theirs.
- Metadata: root node renamed "arvanta-sagitta"; no "body_color_supra" (or any other real model/brand) string remains in material, texture, node or extras names (asserted).
- Root node renamed "concept-car-039" -> "arvanta-sagitta"; node extras trimmed to units/axes; credit extras added to `asset.extras`.
- No licence plate: the source has no plate or recess (concept hypercar). None added.

## Not done / open

- Distinctiveness reshape not done (geometry): own headlight signature (LED blade + DRL comma), finished rear (diffuser fins, light bar, active wing), side intake, minimal cockpit, wheel shrink 0.874 -> ~0.75 m and rear track widening.
- Tech items not done: 299k triangles (target ~125k LOD0), mirrored planar body UVs (needs UV1), materials are hand-set guesses.
- Delete the old main GLB (`carkit/concept-car-039/concept-car-039.glb`) and its Bridgestone sidewall source textures from any asset folder; this build never used them.
