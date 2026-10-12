# Dashwood Nightjar: debrand notes (generic-sport-coupe)

Source: "Generic Sport Coupé Car" by MMC Works, CC BY 4.0. Built by `cars-v2/_tools/cars/generic_sport_coupe.py` (run with `python3 -I`) from `carkit/generic-sport-coupe/`.

## Result

- GLB: `cars-v2/generic-sport-coupe/generic-sport-coupe.glb`, 7,231,860 bytes, 113,616 triangles (before: 21,181,816 bytes, 113,614 triangles).
- Structure kept: `wheel_fl/fr/rl/rr` nodes pivoted at the axle centre (same transforms as the carkit build), wheel meshes under them, brake/caliper nodes unchanged, `paint` still its own material.
- No Draco, meshopt or KTX2 (the game's loader in `/home/user/m8-wt/int` uses a plain GLTFLoader with no DRACOLoader/KTX2Loader). Textures are plain JPEG/PNG.
- Previews: `preview-front34.png`, `preview-rear34.png`, `preview-side.png`; close-ups in `check/` (front, rear, wheel_fl, wheel_rl).

## Changes

- Dashboard screen texture redrawn from scratch: the Apple CarPlay screenshot (BMW roundel, Apple Music/Maps/Podcasts/Books, Amazon Music, Audible, Spotify, Google Maps icons) is replaced by an original dark infotainment page (abstract night-route map, plain list bars, clock, temperature), and the photographed instrument cluster by two original drawn dials (rpm 0-8, km/h 0-300) with a gear readout. No logos or real UI.
- Tyre normal/base colour/ORM: the sidewall ring (centre 1226,1060) is made rotationally symmetric (per-radius median, normals decomposed radially), which erases the Michelin "Pilot Sport A/S 3+ ZP" wordmark, logo, size/load-index code, UTQG and warning text while keeping the bead and shoulder ribs; tread-shoulder marks flattened. Maps downscaled 2048 -> 1024.
- Size: body normal + body/interior/wheel ORM maps downscaled to 1024 px, interior/wheel/chassis normal maps (mostly flat or hidden) to 512 px (base colour maps kept at 2048) to bring the GLB from 21.2 MB to under 8 MB without Draco/KTX2 (the game has no DRACOLoader/KTX2Loader).
- Rear: added a 0.40 x 0.104 m plate quad (2 triangles, node "plate", material "plate", own 512x128 blank plate texture with UV 0..1) inside the previously empty rear plate recess, 6 mm proud of the recess floor. No front plate (the bumper has no recess).
- Metadata: root node renamed to "dashwood-nightjar"; asset copyright string ("... not debranded") replaced by title/credit extras. The converted GLB already carried no author file paths (checked every JSON string for drive/home paths).
- Root node renamed "generic-sport-coupe" -> "dashwood-nightjar"; `asset.copyright` ("... not debranded") replaced by credit extras.

## Not done / open

- Distinctiveness reshape not done (geometry): GR Supra-style three-projector headlamps and L-shaped DRL, hex-mesh front intake, fender blade, side-window/C-pillar outline, full-width boomerang tail bar, ducktail, diffuser/exhaust layout, mirrors and rim are unchanged.
- Tech items not done: 24-sided tyres, faceted discs, hub stubs that poke through when steering, mirrored body UVs (needs livery UV), no AO, metallic paint = 1, x0.935 scale to game wheel size, KTX2.
- Front plate: none added (the front bumper has no recess). Add one if the owner wants front plates.
