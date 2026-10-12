# Assets

Every file shipped to players, where it came from, and its license.

| File / package | What | Source | License |
| --- | --- | --- | --- |
| `assets/favicon.svg` | Browser tab icon | Made for this project | CC0 |
| `assets/models/sports-car.glb` | The car (all players) | "Sports" from [Free Low Poly Vehicles Pack](https://opengameart.org/content/free-low-poly-vehicles-pack) by Raphael Gonçalves (Rgsdev). Converted from FBX by `pnpm assets:car` (source zip SHA-256 `9091e478...7c800`) | CC0 |
| `assets/textures/asphalt/asphalt_track_*_1k.jpg` | Kestrel Pines asphalt and paved aprons (colour, normal, AO/roughness/metal) | [Asphalt Track](https://polyhaven.com/a/asphalt_track) by Dimitrios Savva, Poly Haven. Shipped as downloaded | CC0 |
| `assets/textures/forest/forest_leaves_04_*_1k.jpg` | Forest floor (terrain far layer) | [Forest Leaves 04](https://polyhaven.com/a/forest_leaves_04) by Rob Tuytel, Poly Haven. Shipped as downloaded | CC0 |
| `assets/textures/grass/grass004_*_1k.jpg` | Grass run-off and terrain near layer | [Grass 004](https://ambientcg.com/view?id=Grass004), ambientCG (1K-JPG). Processed with PIL: `_Color` and `_NormalGL` re-encoded as JPEG q90; ARM packed as R = `_AmbientOcclusion`, G = 0.72 + 0.28 x `_Roughness` (grass was too glossy), B = 0, JPEG q90 | CC0 |
| `assets/textures/gravel/gravel022_*_1k.jpg` | Gravel traps | [Gravel 022](https://ambientcg.com/view?id=Gravel022), ambientCG (1K-JPG). Processed like Grass 004, with G = 0.55 + 0.40 x `_Roughness` | CC0 |
| `assets/hdri/syferfontein_18d_clear_puresky_2k.hdr` | Sky and image-based lighting | [Syferfontein 18d Clear (Pure Sky)](https://polyhaven.com/a/syferfontein_18d_clear_puresky) by Greg Zaal (photo) and Jarod Guest (sky edits), Poly Haven | CC0 |
| Kerb stripes, chequered line, gantry sign, name tags, banners (fictional brands), crowd, distance boards, armco gradient, blob shadows, pine and prop geometry | Drawn or computed at runtime | Made for this project | CC0 |
| All sound (engines, tyres, wind, horn, impacts, beeps, crowd) | Synthesised at runtime with Web Audio, no audio files | Made for this project | CC0 |
| `@fontsource/chakra-petch` (npm) | UI font (500 and 700 weights) | [Chakra Petch](https://fonts.google.com/specimen/Chakra+Petch) by Cadson Demak, packaged by Fontsource | SIL Open Font License 1.1 |
