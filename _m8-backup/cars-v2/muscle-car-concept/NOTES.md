# Brazen Haymaker: debrand notes (muscle-car-concept)

Source: "Muscle Car Concept" by ViktorKom, CC BY 4.0. Built by `cars-v2/_tools/cars/muscle_car_concept.py` (run with `python3 -I`) from `carkit/muscle-car-concept/`.

## Result

- GLB: `cars-v2/muscle-car-concept/muscle-car-concept.glb`, 7,900,120 bytes, 134,886 triangles (before: 17,790,688 bytes, 134,886 triangles).
- Structure kept: `wheel_fl/fr/rl/rr` nodes pivoted at the axle centre (same transforms as the carkit build), wheel meshes under them, brake/caliper nodes unchanged, `paint` still its own material.
- No Draco, meshopt or KTX2 (the game's loader in `/home/user/m8-wt/int` uses a plain GLTFLoader with no DRACOLoader/KTX2Loader). Textures are plain JPEG/PNG.
- Previews: `preview-front34.png`, `preview-rear34.png`, `preview-side.png`; close-ups in `check/` (front, rear, wheel_fl, wheel_rl).

## Changes

- B atlas: the New York "Empire State" plate (CVK-0667, printed in base colour and embossed in the normal map) is blanked to plain off-white with a flat normal and uniform satin in the metal/rough map; the dealer URL printed on the plate frame is painted out (colour, normal, metal/rough).
- B atlas: cleared the BRIDGESTONE strip behind the grille (colour, normal, metal/rough), the "2000 GTI" spoiler badge and a small engine-bay monogram. A atlas: cleared a hand-drawn monogram label on an engine-bay part.
- A atlas: painted the "brembo" wordmark and logo off both caliper islands, replaced the "V" crest on the rim centre caps with a plain machined cap and ring (flat normal), and removed the red/black monogram from the blue engine strip (colour, normal, metal/rough).
- Geometry: the 2 plate-face triangles were split from the plate mesh into a new node "plate" (material "plate", own 512x196 blank plate texture, UV 0..1, size [0.426, 0.159, 0.034] m); the rest of the old plate mesh (frame) keeps the atlas and its material is renamed "plate_frame".
- Size: base colour atlases stay 2048 (JPEG q86); metal/rough and emissive atlases downscaled to 1024; normal atlases downscaled to 1024 and stored as JPEG q91 (4:4:4) instead of 2048 PNG. Cut-out alpha copies (used only by small grille/brake cut-out parts) updated with the same paint-outs and downscaled to 1024.
- Root node renamed "muscle-car-concept" -> "brazen-haymaker"; credit extras added to `asset.extras`.

## Not done / open

- Distinctiveness reshape not done (geometry): Ford Capri Mk1 quad lamps in a black band, oval lower grille, rear lamp pods, Challenger/Cuda front, shaker scoop and fender stalk mirrors are unchanged; the missing car-left inner headlamp lens is still missing.
- Tech items not done: hidden interior/engine/chassis triangles (61%) not cut, 37 draw calls not re-atlased, stacked paint UVs (needs livery unwrap), KTX2.
- The "CAUTION!" warning text, "P R N D" gear marks, "RPM x1000" and km/h dial art in the atlases are generic (no brand) and were kept.
- Normal atlases are now 1024 px JPEG (q91, 4:4:4) to fit 8 MB without Draco/KTX2; expect slightly softer bolt/panel detail than the 2048 PNG source.
