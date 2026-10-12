# Briganti Zanna: debrand notes (v12-goblin)

Source: "Fictional supercar - V12 Goblin" by Olli Teittinen, CC BY 4.0. Built by `cars-v2/_tools/cars/v12_goblin.py` (run with `python3 -I`) from `carkit/v12-goblin/`.

## Result

- GLB: `cars-v2/v12-goblin/v12-goblin.glb`, 3,324,376 bytes, 64,503 triangles (before: 3,495,812 bytes, 65,703 triangles).
- Structure kept: `wheel_fl/fr/rl/rr` nodes pivoted at the axle centre (same transforms as the carkit build), wheel meshes under them, brake/caliper nodes unchanged, `paint` still its own material.
- No Draco, meshopt or KTX2 (the game's loader in `/home/user/m8-wt/int` uses a plain GLTFLoader with no DRACOLoader/KTX2Loader). Textures are plain JPEG/PNG.
- Previews: `preview-front34.png`, `preview-rear34.png`, `preview-side.png`; close-ups in `check/` (front, rear, wheel_fl, wheel_rl).

## Changes

- Deleted 1200 trim triangles: 3D goblin crest on the grille (360) and tail (474) and the "V12" scripts on both front wings (127+61, 119+59).
- Base colour: replaced the New York "Empire State" plate (G08-L1N) and the ollite20.deviantart.com frame strip with a blank off-white Split Ways plate; painted out the yellow goblin roundel on the wheel centre caps (now plain gunmetal with a ring), the gold cog hub art, the red emblem texel block and the photo reflection inside both projector lenses.
- ARM (AO/roughness/metal): painted the baked "V12" scripts (both wings), the goblin crest shadow and the tail-crest shadow out of the AO; flattened the plate and centre-cap areas so no plate text or crest survives in the metal channel.
- Tyre normal + ARM maps: removed the STREAMSIDE wordmark, 245/35 R22 size, DOT/RX code, UTQG (treadwear/traction/temperature) and max-load text from both sidewall bands; the sidewalls are now plain with three soft circumferential ribs. Tread pattern untouched.
- Plate geometry: the plate mesh (250 triangles) now uses its own material "plate" with a 492x306 blank plate texture (`plate_basecolor`; u left to right, v top to bottom seen from behind, dark frame margin included); its UVs were remapped from the atlas rectangle to 0..1 so the game can draw the player tag on it.
- Root node renamed "v12-goblin" -> "briganti-zanna"; `asset.extras` carries title, make, model, source, licence and change list. The file name stays `v12-goblin.glb` only because the task fixed the output path; rename it on import (never ship it as "Goblin").

## Not done / open

- Distinctiveness reshape not done (geometry modelling): twin-stalk teardrop mirrors, roof snorkel, louvre pattern, twin hexagonal exhausts, tail-light graphic, front light signature, fang blades and the 10-blade turbine rims all still read as Pagani/Lamborghini/Koenigsegg cues.
- Tech items not done: no body normal map, low paint texel density (157 px/m), 750-triangle tyres, no livery UV1, calipers not parented to steering pivots, no LOD.
- The thin red lines left in the atlas next to the tail lights and on the calipers were checked: they are paint/caliper colour, not emblems.
