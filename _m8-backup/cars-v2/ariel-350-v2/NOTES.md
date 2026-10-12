# Mudlark Scree: debrand notes (ariel-350-v2)

Source: "Ariel_350-V2" by orcha, CC BY 4.0. Built by `cars-v2/_tools/cars/ariel_350_v2.py` (run with `python3 -I`) from `carkit/ariel-350-v2/`.

## Result

- GLB: `cars-v2/ariel-350-v2/ariel-350-v2.glb`, 7,820,028 bytes, 279,169 triangles (before: 8,156,104 bytes, 279,169 triangles).
- Structure kept: `wheel_fl/fr/rl/rr` nodes pivoted at the axle centre (same transforms as the carkit build), wheel meshes under them, brake/caliper nodes unchanged, `paint` still its own material.
- No Draco, meshopt or KTX2 (the game's loader in `/home/user/m8-wt/int` uses a plain GLTFLoader with no DRACOLoader/KTX2Loader). Textures are plain JPEG/PNG.
- Previews: `preview-front34.png`, `preview-rear34.png`, `preview-side.png`; close-ups in `check/` (front, rear, wheel_fl, wheel_rl).

## Changes

- Root node renamed from the working name "strix-r4" (ASUS ROG Strix / Renault 4 / FIA R4 clash) to "mudlark-scree". No other node, mesh or material name referenced Ariel, Strix or any brand (checked every JSON string).
- Size: interior_trim (77,250 vertices, 32-bit indices) split into 2 primitives with 16-bit indices; same geometry and material.
- No textures in the source, so there were no plates, logos, decals, tyre text or URLs to remove (re-checked: every material is a plain colour factor).
- No licence plate added: the rear is a light bar over a flat panel with no recess. Add a plate quad later if wanted.

## Not done / open

- Distinctiveness reshape not done (geometry): BBS RS/LM-style basketweave rims (iconic aftermarket design, the most important one to replace), full-width black front panel and pill lamps, rear bar with square loops, ducktail/wing, C-pillar, roof vent, body width (2.20 m).
- Tech items not done: no livery UVs or AO, 279k triangles (target ~130k), faceted rear quarter, A-pillar gap, octagonal exhaust tips.
