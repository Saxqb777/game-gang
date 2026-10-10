# Kestrel Pines art direction (Track 1, M8)

Written 2026-10-10 for the M8 build (spec `M8-SPEC.md`, revision 2). Main reader: the P5 agent (Track 1
dressing). Some items are requests to P2 or P3, or later work. Each one is tagged (legend below).

**What the numbers are based on.** The light, exposure and colour values come from a model of the real
pipeline: three r186 `MeshStandardMaterial` lighting (`BRDF_Lambert`, PMREM irradiance × π), the
composite's ACES Hill fit (exposure, then `/0.6`), the sRGB encode, irradiance measured from the HDRI
files themselves, and albedo means measured from the CC0 texture files. The script is
`scratchpad/m8/scripts/tonecalc2.py` (run it with `python3 -I`; it imports `tonecalc.py` next to it).
Everything is a starting value. Tune it from screenshots on the M1 with the 4K TV, not on a laptop
panel.

**Tags**
- **[P5]**: inside P5's files. **[P5-cfg]**: a `LIGHTING`, `POST` or P5-anchor constant in `config.ts`.
- **[cfg]**: a shared constant with no owner in the spec (`CAMERA`). The orchestrator assigns it.
- **[P2-ask]** / **[P3-ask]**: needs a change in a P2 or P3 file. Optional for M8; the orchestrator
  decides.
- **[M9+]**: later milestone.

Section 15 lists every change from the spec in one table.

---

## 0. The look in one paragraph

Late afternoon on a dry autumn day in a northern pine forest. The sun is low and warm (18° up), behind
and to the left of the grid. Pine trunks and treetops glow orange where the sun hits them. The treelines
read as dark, ragged walls against a pale, hazy horizon, and each layer further back is lighter and
bluer. Long tree shadows stripe the grey tarmac. The rubber line is darker and slightly glossier. The
grass is mown in stripes, the gravel is pale and clean, and the kerbs are worn at the apex. The circuit
looks lived in: marshal posts, distance boards, a footbridge, flags that move, and boards for fictional
sponsors in flat colours. Post-processing stays restrained: no crushed blacks, no neon, no speed lines,
and bloom only on real highlights. The goal is the "race weekend broadcast" look the research report asks
for, not the near-black-plus-neon gaming template.

**Three pillars** (what makes 2023-2026 racing games read as current-gen, and what we can afford):
1. **Light and tone.** Correct exposure, shadows with detail in them, warm key light against a cool sky
   fill, and layered atmospheric depth. Turn 10 and Polyphony spend most of their effort here (GI,
   perceptual tone mapping). It costs us almost nothing.
2. **Contact and wear.** Things sit *on* the ground: blob AO under cars, grime at the base of every
   object, rubber on the road, worn kerbs. Forza Motorsport's RTAO "seats" cars on the track (GamingBolt).
   We fake it with a quad, vertex colours and a road mask.
3. **Silhouette and storytelling.** Ragged pine skylines, emergent trees, a footbridge, posts, boards
   and flags. GamingBolt calls Forza Motorsport's crowds and vegetation only "decent" and fine at speed.
   So the road and the first barrier line get the detail, and the forest gets the silhouette.

---

## 1. Reference: what current racing games do, and what we take from them

| Game | What the sources say | What Kestrel Pines takes |
|---|---|---|
| Forza Motorsport (2023) | Surfel GI shared with Forza Horizon 5, ray-traced direct light, no baked lighting; RTAO contact shadows that integrate cars with the ground; photogrammetry track surfaces; thick tyre-scrub marks; volumetric clouds; dynamic time of day; environments "decent", acceptable at speed ([GamingBolt](https://gamingbolt.com/forza-motorsport-graphics-analysis-a-new-visual-benchmark-for-racing-games)). Ray-traced reflections only on some surfaces; SSR, planar and cube maps elsewhere ([Multiplayer.it on DF](https://multiplayer.it/notizie/forza-motorsport-analisi-digital-foundry-evidenzia-limiti-del-ray-tracing.html)). | A fake-GI ambient (env + hemisphere fill), blob AO and grime, a road mask with rubber, a strong road material. One fixed time of day. |
| Gran Turismo 7 | "Physically Based Tone Mapping": colour-volume mapping that keeps hue (red brake lights don't turn orange), two-stage eye adaptation (a sunny day is allowed to look bright), and glare plus auto white balance ([GTPlanet](https://www.gtplanet.net/why-gran-turismo-7-graphics-look-20250902/)). A LUT-based physical sky dome with ray-marched clouds ([SIGGRAPH 2025 PDI slides](https://blog.selfshadow.com/publications/s2025-shading-course/pdi/s2025_pbs_pdi_slides.pdf), [GDC Vault](https://gdcvault.com/play/1028916/Advanced-Graphics-Summit-Realistic-Real)). BeamNG replaced its ACES tone mapper with a GT7-style one in 2026 ([GTPlanet](https://www.gtplanet.net/beamng-drive-is-using-gran-turismo-7s-hdr-tone-mapping-technology-20260803/)). | Keep reds red: check kerbs and brake lights after grading. Don't force every scene to mid-grey; a bright day may look bright. Glare is subtle. **Do not** swap to stock AgX: the model turns kerb red `#b81c2b` salmon (224/103/100). |
| Assetto Corsa EVO (early access 2025) | Players criticised fog that limits view distance even in clear weather, and a "cold, blue-green cast in shaded areas" ([Steam discussion](https://steamcommunity.com/app/3058630/discussions/0/756142145462624110)). Later patches fixed cloud shadows dimming the sun and tree flicker ([0.7 notes](https://assettocorsa.gg/assetto-corsa-evo-early-access-0-7-now-available/), [0.8 notes](https://traxion.gg/assetto-corsa-evos-version-0-8-update-released-adding-more-content-and-multiplayer-mods/)). | Anti-references: the haze must not milk out the middle distance (≤ 15% at 200 m), and shadows need a neutral fill so they don't go teal. Trees must not flicker (no alpha cards in M8). |
| Fictional forest circuits (GT7 Deep Forest, Forza Grand Oak) | Deep Forest is praised for its abundant trees and for light streaming through them. Fans noticed the canopy covers less sky than before ([TheGamer](https://www.thegamer.com/deep-forest-raceway-gran-turismo-7/), [EGM](https://egmnow.com/?p=19211)). Grand Oak's forest frames the track ([bsimracing](https://www.bsimracing.com/?p=91569)). | Trees close to the road in places (speed, framing, shadow stripes), emergent trees breaking the skyline, and clearings for variety. |
| Perceived speed research | In third-person racing games, a wider geometric FOV significantly raises perceived speed. Strong motion blur *lowers* it. A higher camera raises it, but only at high speed (Holm, Skovhus, Kraus 2017, [EUDL](https://eudl.eu/doi/10.1007/978-3-319-55834-9_14)). | Speed comes from FOV widening and close trackside objects, not from blur or speed lines (§11). |

Gap: I found no published FOV or exposure numbers for any of these games, and no independent technical
breakdown of EVO's lighting. The numbers below come from the model and from physical albedos, not from
copying a game.

---

## 2. Time of day and mood

### 2.1 Hero look: "Late afternoon, clear" (ship in M8)

- **Sky:** keep the shipped `syferfontein_18d_clear_puresky_2k.hdr` (decision D-8, no new download).
  The sun is at **18.4°** (measured: 18.46° on the 1k file, 18.37° in `sky.ts` on the 2k file). Its
  shadows are 3.0× the height of the object that casts them: a 16 m pine throws a 48 m shadow, so trees
  20-35 m from the road stripe the whole 12 m road. Below about 10° the shadows outrun the 160 m cascade.
  Above about 30° the forest loses its glow and stripes.
- **Sun bearing [P5-cfg]:** the sun sits **behind and to the left of the grid, 120° from the direction
  of travel on the start straight**:
  `LIGHTING.sunBearing = (travelBearing − 120 + 360) % 360`, where
  `travelBearing = atan2(t.x, −t.z) · 180/π` for the start line's unit tangent `t`. In `sky.ts` north is
  −z and east is +x (checked from `targetAzimuth = atan2(−cos b, sin b)`). Compute it once from the
  generated track and hard-code the number with a comment.
  - Why: the chase camera on the grid sees the lit rear three-quarters of every car. The grandstand on the
    right faces the sun, so the crowd is lit. The left treeline throws diagonal shadow stripes forward
    and right across the grid. The camera sees no glare at the start.
  - The lap runs anticlockwise through every heading, so the back section drives towards the sun, which
    sits about 60° right of the view direction. That gives a few seconds of golden glare per lap without
    blinding anyone.
- **Mood words:** warm key, cool fill, crisp, long shadows, glowing trunks, hazy horizon.

### 2.2 Alternative look: "Misty morning" (needs a small `sky.ts` change; M8 follow-up or M9 manifest)

- **Sky:** `kloofendal_28d_misty_puresky` at **1k** (1.24 MB). Sun at **28.5°** (measured u = 0.4699)
  behind thin mist, so its direct irradiance is only about 0.56 against about 3.4 of sky. Shadows are soft
  and faint, the sky is pale, the trees are dark silhouettes, and fog does the work.
- **Why 1k is enough:** the misty sky is an almost featureless gradient, so 1k loses nothing visible.
  Even the 2k hero sky is magnified about 3× at 1080p (2048 px / 360° = 5.7 px per degree, against about
  19 px per degree on screen).
- **Budget:** `assets/` is estimated at about 10.4 MB after M8. A second 2k sky (4.5 MB) would break the
  14 MB cap; the 1k file takes it to about 11.7 MB.
- **Sun bearing:** `travelBearing + 25` (ahead and to the right on the start straight), so the bright
  mist glow sits down the straight on the grid shot.
- **Code needed (outside P5's "constants only" rule for `sky.ts`):** make `HDRI_URL`, `HDRI_SUN_U`,
  `HDRI_SUN_ELEVATION` and `SMUDGE` (the smudge paint-out is specific to syferfontein, so use `null`
  here) a per-look record. About 20 lines. The research report already plans a per-track manifest with
  sky, fog, sun and shadow settings, which is the natural home. Re-measure the sun position on the
  shipped file.
- **Bonus:** fog at density 0.0034 is 98.4% at 600 m, so the look can cap the camera far plane at 900 m
  and skip the far tree band. That frees GPU time for the 4-player Low preset.

### 2.3 Other verified CC0 skies (Poly Haven API, checked 2026-10-10)

The full list came from `https://api.polyhaven.com/assets?t=hdris` (997 HDRIs); file sizes came from
`https://api.polyhaven.com/files/<id>`. All are CC0. I measured sun elevation and colour from the 1k
files myself. "Sun colour" is the disc's normalised linear RGB.

| Id | Poly Haven tags | Sun elev. | Sun colour | 1k / 2k | Verdict for a pine forest |
|---|---|---|---|---|---|
| `syferfontein_18d_clear_puresky` (Greg Zaal, Jarod Guest) | clear, high contrast, morning-afternoon | 18.4° | 1.00/0.87/0.54 | 1.11 / 4.19 MB | **Hero** (already shipped). |
| `kloofendal_28d_misty_puresky` (Greg Zaal, Jenelle van Heerden) | partly cloudy, medium contrast | 28.5° | 0.97/1.00/0.99 (diffuse) | 1.24 / 4.47 MB | **Alternative** (misty morning). |
| `qwantani_late_afternoon_puresky` (Greg Zaal, Jarod Guest) | clear, high contrast | 19.2° | 1.00/0.81/0.58 | 1.12 / 4.43 MB | The best replacement hero if you want more warmth: a warmer sky and a hazier horizon glow. |
| `kloofendal_38d_partly_cloudy_puresky` | partly cloudy, midday, high contrast | 38.0° | 1.00/0.95/0.85 | 1.37 / 5.29 MB | Thin high cloud adds sky interest, but the light is flatter. A "midday" variant. |
| `kloofendal_48d_partly_cloudy_puresky` | partly cloudy, midday | 47.8° | 0.99/1.00/0.92 | 1.44 / 5.45 MB | Postcard cumulus, but the high sun kills the forest stripes. |
| `kloofendal_misty_morning_puresky` | overcast, low contrast | (no disc) | n/a | 0.70 / 2.96 MB | Overcast fog look. No sun, so shadows could go off (a performance win). |
| `kloofendal_overcast_puresky` | overcast, low contrast | (no disc) | n/a | 1.17 / 4.34 MB | A grey northern day. Good for a future "wet" look. |
| `rosendal_park_sunset_puresky` (Dimitrios Savva, Jarod Guest) | clear, low contrast, sunrise-sunset | near the horizon (from the thumbnail; not measured) | warm | 1.23 / 5.05 MB | True golden hour, but shadows run past the cascades. Only with M9's baked shadows. |
| `syferfontein_6d_clear_puresky` (Greg Zaal, Jarod Guest) | clear, low contrast, sunrise-sunset | about 6° (by name; not measured) | warm | 1.13 / 4.65 MB | Evening variant for M9+. Same shadow caveat. |
| `misty_pines` (Greg Zaal) | overcast, pine, mist, forest | n/a | n/a | n/a | **Not a sky** (it has trees and ground on the horizon). Use it only as a colour and mood reference for the alternative look. |

---

## 3. Sun, sky and ambient light

| Constant | Now (desert) | Hero (M8) | Misty alt | Notes |
|---|---|---|---|---|
| `LIGHTING.sunColour` [P5-cfg] | `0xffd2a1` | **`0xffe2b4`** | `0xfff4e6` | The HDRI's own sun disc measures `#fff0c2`. The hero is a touch warmer for the "glowing trunk" look. The old value is too orange for 18°. |
| `LIGHTING.sunIntensity` [P5-cfg] | 6 | **7.5** | 2.0 | Raises the sun/shadow ratio to about 2.5 stops on the road, so tree stripes read. |
| `LIGHTING.environmentIntensity` [P5-cfg] | 1.0 | **1.3** | 1.0 | Fake bounce. The clear HDRI sky alone gives only 0.57 luminance on a horizontal surface, which ACES's toe crushes to black. |
| Hemisphere fill [P5] (new `HemisphereLight` in `world.ts`) | none | **sky `#dfe4e2`, ground `#3a4430`, intensity 0.4** | none (or 0.15) | Neutral fill that keeps shadows from going pure sky-blue (the EVO "blue-green cast" complaint). Add it before `precompile`, because it changes programs. Fallback with no new light: `environmentIntensity` 1.6 (shadows a bit bluer: road 25/39/61 instead of 33/44/61). |
| `LIGHTING.groundBounce` [P5-cfg] | sand | **`[0.10, 0.12, 0.07]`** (spec) | same | Confirmed: it matches a mixed grass and asphalt ground at these light levels. |
| `LIGHTING.skyLightCap` / `skyVisibleCap` | 8 / 40 | keep 8 / 40 | keep | The sun disc reaches 40 × 3.25 = 130 after exposure: a white glow, not a flood. |

**Pine foliage ambient [P5]:** foliage needs about 2.3× the ambient of the ground, or the shadow side of
every treeline goes black (model: 6/31/20). The only way to boost one material in r186: when
`material.envMap` is null, `WebGLRenderer.js:2736-2740` overwrites `envMapIntensity` with
`scene.environmentIntensity`, so setting it alone does nothing. Set:

```ts
pineMaterial.envMap = sky.environment;            // the PMREM texture
pineMaterial.envMapRotation.copy(sky.rotation);   // same rotation as the scene environment
pineMaterial.envMapIntensity = 3.0;               // absolute; scene.environmentIntensity no longer applies
```

That lifts the shadow side to 15/59/42 (dark green, not black) and the sunlit side to about 144/180/110.
Do the same for the treeline ring (§9.6). Misty look: 2.3.

---

## 4. Exposure and target values

- **`POST.exposure` [P5-cfg]: 1.5 → 1.95** (+0.38 EV). A forest scene has a much lower average albedo
  than sand: pines about 0.05, forest floor about 0.10, asphalt about 0.08. A photographer opens up a
  third to half a stop for the same scene. P5.5 says "keep exposure unless it looks wrong"; at 1.5 the
  model puts sunlit asphalt at 66/60/57 and shadowed asphalt at 7/15/28, which is wrong. Misty look: 1.2.
- **Target sRGB values on output** (model, hero settings, before fog, AO maps, tree shadows and specular).
  Use them as a screenshot sanity check with a colour picker on a TV-res capture. ±15 is fine.

| Surface | Hero target (R G B) | Misty target |
|---|---|---|
| Asphalt, sunlit | **114 109 104** | 102 103 107 |
| Asphalt, rubber line, sunlit | 100 95 90 | 89 90 93 |
| Asphalt, in shadow | **33 44 61** | 76 78 84 |
| Grass, sunlit / shadow | 122 146 69 / 35 68 36 | 112 139 81 / 84 111 61 |
| Gravel, sunlit | 186 174 152 | 173 169 157 |
| White kerb, sunlit | 236 234 231 (never 255) | 232 232 232 |
| Red kerb, sunlit | 248 36 50 | 230 47 64 |
| Forest floor, sunlit (before canopy darkening) | 156 118 70 | 139 113 79 |
| Pine, sunlit side / shadow side | 144 180 110 / 15 59 42 | 98 141 96 / 48 88 61 |
| Pine trunk, upper, sunlit | 233 174 98 | 149 97 61 |
| Sky, horizon away from sun / 10° up / zenith | 206 205 200 / 181 204 221 / 66 105 157 | 222 223 226 / 217 221 226 / 193 200 212 |
| Sky at the horizon towards the sun | 249 249 248 | 249 249 249 |

---

## 5. Fog and atmospheric perspective

`haze.ts` is exponential-squared with the colour taken per azimuth from the sky's horizon:
`f = 1 − exp(−(density · d)²)`, colour = `fogColor × hazeColour(direction)`.

**Hero: `LIGHTING.fogDensity` = 0.0019** [P5-cfg] (spec: "about 0.002").

| Distance | 50 m | 100 m | 200 m | 300 m | 400 m | 600 m | 800 m | 1000 m | 1400 m |
|---|---|---|---|---|---|---|---|---|---|
| Hero 0.0019 | 0.9% | 3.5% | **13.4%** | 27.7% | **43.9%** | 72.7% | 90.1% | 97.3% | **99.9%** |
| Misty 0.0034 | 2.8% | 10.9% | 37% | 64.7% | 84.3% | 98.4% | 99.9% | 100% | 100% |

- **Invariant (all presets, both looks):** `f(preset.cameraFar) ≥ 0.985`, so the far plane never shows.
  This needs `density ≥ 2.05 / cameraFar`: 0.00146 for Low (1400 m), 0.00114 for Medium, 0.00085 for
  High. Use the **same density on every preset**: fog is free, and identical haze keeps 1-player and
  4-player screenshots looking like the same place.
- **Fog tint [P5-cfg + P5 in `game.ts`]:** add `LIGHTING.fogTint = 0xe2e9ef` and use it as the
  `FogExp2` colour (it is 0xffffff today). Fogged objects then fade to 76-86% of the sky's brightness and
  slightly cooler. Distant treelines stay readable as darker silhouettes against the sky (layered depth)
  instead of dissolving into it. The terrain edge stays hidden because the treeline ring covers all
  360°. Misty look: `0xf0f3f5`.
- **Layering target:** in a hero screenshot down a straight, three or more distinct value layers must be
  visible:
  1. Near trees: dark green, full contrast.
  2. The treeline across the infield (200-400 m): 15-45% haze, mid green-grey.
  3. The ring and distant canopy (500+ m): pale blue-grey silhouette.
  4. The sky.

  If layers 2 and 3 merge, raise the ring's base height (§9.6), not the density.
- **[P3-ask] Haze v2** (better, cheap; M8 follow-up or M9): a linear plus squared optical depth with a
  height falloff gives a little haze near the camera and full haze far away:
  `τ = (σ1·d + (σ2·d)²) · h`, `f = 1 − e^(−τ)`, with σ1 = 0.0004 and σ2 = 0.0016 (hero: 6% at 100 m,
  17% at 200 m, 43% at 400 m, 86% at 800 m, 99.6% at 1400 m). `h` is the analytic height-fog integral
  along the ray (Quilez), with base y = mean track height and scale height H = 80 m for the hero, 25 m
  for misty (mist pools in the dips between the rolling hills: the signature of the alternative look).
  World y in the fragment is `cameraPosition.y + vFogDirection.y`, because `vFogDirection` is already a
  world-space camera-to-fragment vector. About 6 lines in `fog_fragment`, with no new varyings.

---

## 6. Colour grading

**M8, config only [P5-cfg]:**
- `POST.tint = [0.99, 1.0, 0.985]` (was golden-hour `[1.05, 1.0, 0.93]`). The warmth now comes from the
  sun colour, not a global wash. That makes the image "slightly cooler and greener" (P5.5) while the
  lit surfaces stay warm.
- `POST.saturation = 1.05` (was 1.1). Forest greens saturate fast under ACES. Check that grass never
  passes G ≈ 150 in sun.
- Misty look: tint `[0.98, 1.0, 1.02]`, saturation 0.92.

**[P3-ask] Three uniforms in the composite** (no extra pass and no new program if added before
precompile; about 6 ALU):

```glsl
// after acesFilmic(color), before vignette: display-linear offset/slope (ASC-CDL style)
uniform vec3 lift;   // hero [0.0030, 0.0035, 0.0045]: black floor at about 12-16 sRGB, very slightly cool
uniform vec3 gain;   // hero [1.000, 0.995, 0.985]: highlights a touch warm
color = lift + color * (gain - lift);
// optional, before saturation: log contrast around mid-grey, hero 1.04
// color = 0.18 * pow(max(color, 1e-6) / 0.18, vec3(contrast));
```

- Why lift: TVs in their default picture modes crush shadows further. With lift, the pine AO darks
  (0/6/4 in the model) land at about 12/14/16 instead of pure black, so form survives on a living-room
  TV. Don't lift above 0.005: blacks would go milky.
- **3D LUT ([M9+], optional):** one 32³ RGBA8 `Data3DTexture` (128 KB) sampled once after tone
  mapping, so an artist can grade in any photo tool. Capture a screenshot with an identity-LUT strip in a
  corner, grade it, then extract the strip. It costs one texture fetch per pixel.

**Grading rules:** no teal-and-orange split tone, no global warm wash, no crushed blacks (≥ 10 sRGB), no
clipped whites on large areas (white kerbs and walls ≤ 240). Red stays red (kerb red ≥ 230 R with G ≤ 60).

---

## 7. Bloom and lens effects

| Constant | Now | Hero | Misty | Why |
|---|---|---|---|---|
| `POST.bloomThreshold` [P5-cfg] | 2.5 | **1.9** | 3.0 | Keeps the same display-referred threshold after the exposure change (2.5 × 1.5 / 1.95). Only the sun, the circumsolar sky (about 2.0), chrome and paint glints, and brake lights (emissive 6-10, M12) glow. |
| `POST.bloomKnee` | 1.0 | **0.8** | 1.0 | Soft roll-in between 1.1 and 2.7. |
| `POST.bloomStrength` | 0.08 | **0.07** | 0.05 | The sun's halo should cover about 6-8% of frame height and never wash the horizon. The misty sky towards the sun is 3.2, so keep that look's glow small. |
| Bloom levels | 4 | 4 / 4 / 3 (spec) | same | Low gets a smaller halo; don't compensate with more strength. |
| `POST.vignette` | 0.2 | **0.12** | 0.12 | Barely noticeable on a TV; the corners stay readable for the HUD. |
| `POST.vignetteAtSpeed` | 0.12 | **0.08** | 0.08 | |
| `POST.speedLinesOpacity` | 0.2 | **0 (off)** | 0 | Speed lines are an arcade tell, and no current-gen sim racer uses them. Speed comes from FOV and the environment (§11). |

**Lens rules:** no lens-flare ghost chains, no chromatic aberration, no lens dirt, no film grain beyond
the existing 1/255 dither, no anamorphic streaks. If a sun flare is ever added (M12), make it one soft
disc plus one faint hexagon at ≤ 3% opacity, drawn in the composite.

---

## 8. Materials

Measured texture means (linear): `asphalt_track` diffuse **0.013** (sRGB 34/30/28: far darker than real
asphalt, which is 0.04-0.12); `Grass004` 0.118/0.152/0.030 (yellow lawn), roughness **0.26** (far too
glossy for grass); `Gravel022` 0.213/0.198/0.160, roughness 0.46; `forest_leaves_04` 0.222/0.114/0.044
(orange-brown). The material colour multiplies the map in linear space, and three allows values above 1.
Set them with `color.setRGB(r, g, b, LinearSRGBColorSpace)` or `color.setScalar(s)`.

| Surface | Map / tile | Colour multiplier (linear) | Roughness / normal | Extra |
|---|---|---|---|---|
| **Asphalt** [P5] | `asphalt_track`, **2.5 m** tile (spec "about 4 m": at 4 m the aggregate looks twice too coarse right in front of the car; macro noise hides the repeat instead) | **`setScalar(6.0)`** → albedo about 0.078 | ARM.G as is (about 0.83); `normalScale` **0.6** (calmer grain at grazing angles) | Track mask below |
| Track mask (asphalt shader) [P5] | `racingLine` attribute | rubber line ±1.1 m: ×0.82 albedo, roughness −0.12 (spec) | | Braking zones (100 m before each board-300 location, ±1.5 m of the line): an extra ×0.92. The 0.6 m strip next to each edge line: ×1.10 (dust, no traffic). Macro noise: ±6% at about 25 m wavelength plus ±3% at about 6 m. Optional patchwork: world-noise threshold makes 10-20 m resurfaced rectangles, ×0.9 albedo and −0.05 roughness, about 1 per 400 m. |
| **Apron** (paved run-off) [P5] | asphalt | `setScalar(7.5)` → about 0.10 (older, lighter tarmac) | +0.05 roughness, no rubber | (The spec's "0.85 grey multiplier" would make the apron darker than the road.) |
| **Kerb** [P5] | 64×8 canvas, 1 m per colour (spec) | red **`#b81c2b`**, white **`#e2e0da`** (spec: `#c8102e` / `#f2f2f2`: `#f2f2f2` sits at 240+ in sun and clips with bloom; real kerb paint is about 0.75 albedo) | 0.55 | Rubber on the road-side 40% of apex kerbs: ×0.72 with noise (`customProgramCacheKey 'sw-kerb-v1'`). Sawtooth risers ×0.8 via vertex colour. |
| **Lines** [P5] | none | `#e4e2da` | 0.5, `polygonOffset` | 8% wear noise (×0.85) so lines don't look like stickers. |
| **Grass run-off** [P5] | `grass004`, 3 m (spec) | **(0.72, 0.86, 1.35)** → 0.085/0.131/0.041: deeper, less yellow | **Remap roughness when packing ARM (P5.1): G' = 0.72 + 0.28·G** (mean 0.26 → 0.79); `normalScale` 0.8 | **Mowing stripes**: ±5% albedo bands 4.5 m wide parallel to the track (from `u`), the classic manicured-circuit look. Macro noise ±10% lightness at about 30 m, with dry patches (+6% R) on crests. |
| **Gravel** [P5] | `gravel022`, 2 m (spec) | (1.0, 0.97, 0.92) | **G' = 0.55 + 0.40·G** (mean → 0.73) | ×0.85 over the outer 1.5 m next to grass (dirt transition), so the band edge isn't a clean cut. |
| **Terrain near layer** [P5] | `grass004` | (0.66, 0.80, 1.25): a shade darker than run-off (unmown) | as run-off | |
| **Terrain far layer** [P5] | `forest_leaves_04` | **(0.62, 0.78, 0.95)** → about 0.138/0.089/0.042 | ARM as shipped | **Canopy darkening**: albedo × (1 − 0.35·wildness), so the deep forest floor reads as shaded forest interior even on Low, where pines cast no shadows. Moss patches by noise: ×(0.8, 1.05, 0.8). |
| **Skirt** [P5] | none | `#5e4d36` (forest floor in light shade) | 0.95 | |
| **Armco** [P5] | narrow canvas W-beam gradient | `#aeb3b6` galvanised | metalness **0.9**, roughness **0.42** (spec 0.8 / 0.35 reads as chrome at grazing angles) | Bottom 0.25 m ×0.7 (road spray). Posts `#6f7377`, metalness 0.8, roughness 0.55. |
| **Concrete wall** [P5] | none | `#c4c1b8` | 0.85 | Base 0.4 m ×0.7. Rub marks (×0.6 streaks) on the road face in corners. |
| **Tyre walls** [P5] | instanced stacks | rubber `#161616`; paint red `#9e1f27`, white `#d6d4ce` | 0.92 | **Paint in bands of 3 stacks** (≈ 3 m): 2 bands painted (alternating red and white) then 1 band bare black, via instance colour. Alternating per stack (spec) makes a 1 m pattern that shimmers at 4-player resolution. |
| **Blob AO** [P5] | radial gradient | black, alpha **0.55** (spec) | | Gradient falloff `pow(1 − r, 1.6)`. Add a second, tighter core (1.8 × 0.9 m, alpha 0.35) in the same texture, under the tyres' footprint. |

**Contact grime rule (all props) [P5]:** every object that touches the ground gets a vertex-colour
darkening at its base: ×0.6 at ground level, fading to ×1 at 0.4 m (or 15% of the object's height for
small props). It applies to walls, armco, tyre walls, board posts, marshal huts, grandstand, gantry legs,
bridge piers and tree trunks (base ×0.55). It costs nothing at runtime and fixes the most common "floating
prop" tell.

**Texture processing (P5.1 additions):** do the grass and gravel roughness remaps in the PIL ARM packing
step and record them in `ASSETS.md`. Poly Haven sets ship unchanged (the asphalt fix is the material
multiplier, not a re-encode).

---

## 9. Vegetation (the identity)

### 9.1 Pine geometry [P5] (`forest.ts`, ≤ 120 tris, one geometry for M8)

- **Shape:** a spruce-like stack of 4 tiers with **star rims**: each rim has 12 vertices alternating
  radius 1.0 and 0.78, which breaks the clean "Christmas tree" outline into a ragged one.
  - Rim vertices droop 15% of the tier height below the tier's base centre, so branches read as hanging.
  - Each tier also gets a shallow inverted-cone underside in the AO colour. Trees beside the road are
    seen from below.
  - Tier heights at scale 1 (16 m tree):
    | Tier | Base | Top | Radius |
    |---|---|---|---|
    | 1 | 3.0 m | 8.5 m | 3.0 m |
    | 2 | 6.5 m | 11.5 m | 2.4 m |
    | 3 | 9.5 m | 14.0 m | 1.7 m |
    | 4 | 12.5 m | 16.0 m | 1.0 m |
  - Offset each tier's apex sideways by 0.1-0.3 m in a fixed pattern.
  - Count: 4 × (12 side + 12 underside) = 96 tris, plus a 5-sided trunk (10 tris) from y = −0.4 to 13 m
    = **106 tris**.
- **Normals:** don't use faceted or cone-surface normals. Use **spherised foliage normals**:
  `n = normalize(0.65 · radial_from_trunk_axis + 0.35 · up)`. Foliage then shades as one soft volume, the
  standard foliage trick, and the facets disappear.
- **Vertex colours** (sRGB → linear):
  | Part | Colour | Linear |
  |---|---|---|
  | Tier rim / outer tips | `#3f5a3c` | 0.050/0.102/0.045 |
  | Mid canopy | `#2e4733` | 0.027/0.063/0.033 |
  | Inner and underside (AO) | `#1d3024` | 0.012/0.030/0.018 |
  | Lower trunk | `#4a3b30` | |
  | Upper trunk (Scots pine orange bark, catches the low sun) | `#7a5236` | |

  The spec's `#3e6a35` light end is too yellow and bright for conifers.
- **Material:** `MeshStandardMaterial`, `vertexColors`, roughness **0.85**, metalness 0, explicit
  `envMap` at intensity **3.0** (§3), `customProgramCacheKey` if any `onBeforeCompile` is used.

### 9.2 Instances [P5]

- `y = terrain.heightAt(x, z) − 0.3 × scale` (sink, so no floating on slopes).
- Random yaw. Non-uniform scale: `sx = sz = s · U(0.85, 1.15)`, `sy = s · U(0.9, 1.2)`.
- A random lean of at most 2.5° (trees grow vertical even on slopes; more looks wind-blown).
- **Per-instance colour:**
  - Lightness ×U(0.90, 1.10) (spec ±8% is fine).
  - Hue: × (1 + 0.05a, 1, 1 − 0.06a) with a ∈ [−1, 1], from yellower to bluer pines.
  - 4% of trees: ×(1.15, 1.05, 0.85), sun-bleached and olive.
- **Scale remap by distance beyond the wall** (P5 can do this from the placement and track queries;
  [P2-ask] if preferred in P2):
  - Edge band (≤ 30 m beyond the wall): 25% of trees become "young" at ×0.45-0.7 of their scale. They
    fill the gap between the ground and the mature canopy, so the edge reads as a green wall from the
    ground up, not a row of lollipops on a lawn.
  - Everywhere: 3% "emergents" at ×1.4-1.6 (26-29 m) to break the skyline.
  - The spec's 0.8-1.35 range stays the base.

### 9.3 Density, counts per km and presets

P2.9 places candidates on a jittered 7 m grid (1 per 49 m²). Density is forced to 1 within 40 m of the
wall and noise-driven (clearings) out to 260 m, with a cap of 14,000. On a 3.3 km lap this saturates the
cap: **about 4,200 pines per km of track** (both sides combined).

| Preset | `vegetationDensity` (spec) | Pines drawn | Per km | Pine shadows |
|---|---|---|---|---|
| High (1 P) | 1.0 | about 14,000 | about 4,200 | yes (2 cascades to 160 m) |
| Medium (2 P) | 0.75 | about 10,500 | about 3,150 | yes (to 120 m) |
| Low (3-4 P) | 0.5 | about 7,000 | about 2,100 | no |

Triangles: 106 tris × 14,000 = 1.48 M placed. With 200 m tile culling, about 35-45% are in view, so
about 0.6 M in the main pass at High (budget 2.5 M in total).

- **Instance order within each tile [P5] (changes the spec's pure shuffle):** first the trees within
  30 m of the wall, shuffled; then the rest, shuffled. `count = round(total × density)` then thins the
  interior first and keeps the treeline silhouette intact on every preset.
  - Low ends up with 100% of the edge band and about 37% of the interior.
  - Medium ends up with 100% of the edge band and about 69% of the interior.
  - Gaps in the interior show the darkened forest floor (§8), which reads as forest gloom.
- **[P2-ask] three checks on placement:**
  1. Grid jitter ≥ ±3 m (≥ 0.43 × spacing), or the rows show as an orchard from some angles.
  2. When the cap truncates, drop the candidates **farthest** from the wall first.
  3. Keep the noise clearings: they give the skyline rhythm.
- **Tunnel sections ([P2-ask], optional):** one or two 150-250 m straights where pines stand at the
  minimum 8 m beyond the wall on both sides. Close trunks give the strongest speed cue, and the shadow
  stripes there are dramatic.

### 9.4 Shadows from trees

- High and Medium: `castShadow = preset.pineShadows` (spec). Hero shadows are long (48 m at scale 1).
  Check that cascade edges don't show as a line where stripes stop. If they do, fade the shadow in the
  last 15% of `shadow.far` (P3's SunLight setting).
- **Low has no tree shadows on the road.** This is the biggest visual gap between 1 and 4 players.
  M8 mitigations:
  - Canopy darkening on the terrain (§8).
  - Blob AO under cars.
  - The focus rig still shadows cars and barriers.
- **[M9+]** M9's lighting bake (or a load-time "sun visibility" pass) should write a track-space
  shadow-stripe mask for the corridor, at 0.5 m per texel: 6,600 × 80 texels for this lap, folded into
  one L8 texture. Then every preset, and High beyond 160 m, gets the stripes.

### 9.5 Silhouette rules

- The treeline top must never be a straight line. On any straight, its height should vary by ≥ 25%
  within a 100 m stretch (emergents, young trees, clearings).
- No tree within 25 m of the inside of tight corners (spec sight lines). On the outside of fast corners,
  let the forest come close behind the run-off: it frames the corner.
- On crests, trees on the skyline are worth more than anywhere else. Don't place clearings on crests
  that face the camera.

### 9.6 Treeline ring [P5] (1 draw call)

- A vertical skirt at the terrain edge, height 25-40 m (spec).
  - **Base y modulated by low-frequency noise ±12 m** (period about 600 m), so the far skyline rolls
    like wooded hills. This is where "rolling hills" shows from the track.
  - Top edge: a spike every 5 ± 2 m, spike height 0.6-1.0 of the local maximum.
- Vertex colour from `#1f3326` at the base to `#2a4231` at the top, fog on, the same explicit-envMap
  boost as the pines, no shadows cast or received.
- At about 380 m (terrain margin) the fog is about 40%, so it reads as the mid-grey silhouette layer
  (§5).
- From the 3-player overview camera (about 30° down) it shows as a dark band at the horizon, which is
  fine.

### 9.7 For M9 impostors [M9+]

- Capture impostors from these exact meshes, palette and spherised normals. Use an albedo plus normal
  octahedral atlas (8 × 8 views, 2048²) relit at runtime, never baked lighting, so time of day still
  works.
- Add the second variant then: a Scots pine with a bare trunk to 55-60% of its height and 2-3 offset
  flattened crowns. In M8 it would double the vegetation draw calls; impostors make variants nearly free.
- Add M9's card bushes and edge grass at the forest edge only (the 0-15 m band), never in open run-off.

---

## 10. Trackside storytelling

Placeholder sponsor names are invented for this track. **They must pass the clearance search in the
research report before launch.** Never put real brands, real circuit names, "Forza" or Gran Turismo or
Assetto marks anywhere in the scene.

### 10.1 Brand kit (all drawn at runtime on canvas, per §4.2 of the spec)

| Brand | Use | Colours | Notes |
|---|---|---|---|
| **Kestrel Pines** (the circuit) | Gantry, bridge fascia, backs of distance boards, flags | forest `#1f3b2d`, kestrel rust `#b5562c`, cream `#efe9dc` | A simple kestrel-wing chevron mark plus the wordmark. |
| **FENNIK** tyres | Banners at braking zones, tyre-wall belt boards | white on `#1f3b2d`, thin `#b8c24a` underline | Avoid the yellow-on-black and blue-on-yellow schemes of real tyre makers. |
| **SOLVANE** fuel | Straight banners, bridge fascia | cream `#efe9dc` on rust `#a8462a` | Avoid red-yellow, green-yellow and blue-orange (real fuel brands). |
| **VAELTO** timing | Gantry clock, start/finish boards | silver `#c9cccf` on black `#161616` | |
| **HOLMRIDGE** timber | Marshal post panels (small), paddock signs | cream on wood brown `#6b4a2f` | A local sponsor that ties into the setting. |
| **QUENNA** water | Banners | `#2f5d8a` on white `#ecebe6` | |
| Gamer Gang | **Once**, on the gantry | solid cream on `#1f3b2d` | **Replace the current orange-pink-purple gradient banner.** Gradients as content are a listed tell in the research report. |

- **Typography:** condensed bold grotesque. Use the stack `700 64px "Barlow Condensed", "Arial Narrow",
  "Helvetica Neue", Arial, sans-serif` with `ctx.scale(0.82, 1)` when no condensed face is loaded. Don't
  use Chakra Petch on boards (one techno font everywhere is another listed tell).
- Sentence or upper case, tracking 0, flat fills, no outlines, glows or gradients.
- **Board finish:** roughness 0.75, metalness 0. Bake about 10% sun fade (desaturation) into the canvas
  colours and 2% dirt noise along the bottom edge.

### 10.2 Inventory (counts for this 3.3 km lap)

| Item | Count | Size and placement | Look | Draws (main pass) |
|---|---|---|---|---|
| Trackside banners | 30-40 | 4.5 × 0.9 m, bottom 0.15 m up, on the barrier face or 1 m behind it, on both straights and at braking zones (where the camera looks). Never the same brand twice in a row; 1 per 40-60 m. | Brand kit | 1-2 (one 1024×512 atlas of 8 boards) |
| Distance boards (300/200/100) | 3 per braking zone with a speed drop ≥ 15 m/s (P2 places them 2.5 m beyond the outside wall) | 1.2 × 0.9 m board, 0.4 m above ground, two black posts | White `#e8e6e0`, black numerals `#161616`, numerals 0.55 m tall in condensed bold; back of board in circuit green | 1 (instanced, numerals from an atlas) |
| Corner number boards | 1 per corner (about 12) | 0.6 × 0.6 m at turn-in, outside | Circuit green with cream numerals | shares the board mesh |
| Marshal posts | about 11 (every 300 ± 40 m) | Hut 2.4 w × 1.8 d × 2.6 h m, 4 m behind the wall | Walls `#d9d7d0`, roof `#2e4a3a`, **orange panel `#e8601c`** 0.8 × 0.6 m with the white post number (not emissive), 2 rolled flags (yellow `#e3b81f`, green `#3a7d44`) in a holder, white "F" extinguisher board | 2-3 (instanced) |
| Grandstand | 1 | Outside of the start straight, 6 m behind the wall (spec), about 70-90 m long, 10 rows, cantilever roof | Concrete `#bdb9ae`, seats circuit green `#2e5a46`, roof underside `#2a2c2e` (a deep roof shadow gives depth), 75% of seats filled | 3-4 |
| Crowd texture | in the grandstand | | **Muted palette:** `#e6e2d8`, `#2b3a55`, `#5a6b80`, `#3a3a3a`, `#8a8f94`, `#a33a32`, `#c9b27a`, plus clusters in circuit green `#2f5a46` and rust `#b5562c` (fan groups). Remove today's neon shirts (`#1fe0e6`, `#9b5cff`, `#ff3b6b`). | (in the grandstand) |
| Gantry (P5.8) | 1 | Spans the walls | Structure `#2b2e31`, black name board with cream "KESTREL PINES", VAELTO clock, 5 start-light pairs (emissive red at 8 when lit) | 2-3 |
| **Footbridge** (P5 stretch, recommended) | 1 | Over the back straight just past a crest; 4 m deck, 6.5 m clearance, lattice truss; ≤ 1.5 k tris | Truss `#2e4a3a`, fascia banner 1.2 m tall (SOLVANE or the circuit). Casts a shadow band across the road, a great speed cue. | 2 |
| Flags | 8-12 poles (grandstand top row, gantry) | 8 m poles, 1.5 × 1.0 m flags, merged into 1 mesh | Circuit and sponsor flags; vertex wave `0.25 m · (x/w) · sin(2.2 t + 1.5 x)`; `customProgramCacheKey 'sw-flag-v1'` | 1 |
| TV camera towers | 4 (outside of T1, the slowest corner, the last corner, the end of the back straight) | Scaffold 2 × 2 × 7 m with a platform and a black-tarp camera box | Galvanised grey, black tarp | 1 (instanced) |
| Paddock dressing | 6 marquees + 4 cabins | Behind the grandstand, seen through gaps; never shadowing the track | White pyramid roofs, grey cabins | 1-2 |

Budget: **≤ 30 storytelling draws per view in the main pass.** Only the grandstand, gantry, bridge and
marshal huts cast shadows. Everything is identical on every preset, so nothing pops when the player count
changes. All props sit on `track.lateralPoint` or `terrain.heightAt`, with the contact grime from §8.

---

## 11. Camera feel and speed sensation

**[cfg] `CAMERA` starting values** (the M12 rewrite replaces the behaviour; these are constant changes
only):

| Constant | Now | Recommended | Why |
|---|---|---|---|
| `baseFov` (vertical) | 62 | **57** | 62° vertical is about 95° horizontal at 16:9, far wider than a couch view of a 55-65" TV (about 30-35°). Trees shrink and the forest loses scale. |
| `speedFov` | 16 | **10** | 57 + 10 = 67° at top speed, just under the 67.6° cap that `maxHorizontalFov` 100 imposes at 16:9. Today 62 + 16 = 78 gets clipped to 67.6 anyway, so the widening stops early. The new range uses the whole ramp. FOV widening is the strongest speed cue in the Holm study. |
| `distance` | 6.4 (+1.6 at speed in code) | **6.1** | Slightly tighter; the car fills more of the frame. |
| `height` | 2.3 (−0.25 at speed in code) | **2.1** | |
| `lookHeight` | 0.9 | **1.0** | With the values above, the camera pitches down 6.2° and the horizon sits 39% from the top of the frame. That puts the treeline skyline in the upper third and leaves road below. |
| `lookAhead`, `followStiffness`, `velocityHeadingBlend`, `maxHorizontalFov` | 4, 9, 0.35, 100 | keep | In 2-player strips (aspect about 3.55) the cap gives about 37° vertical, which suits a strip. |

- **Kerb shake [P5] (spec bug):** P5.7 says `addShake(0.05 × rumble)`. `ChaseCamera` moves by
  `shake² × 0.35 m`, so 0.035 gives 0.4 mm (0.07 px), which is invisible. Use **`addShake(0.25 ×
  rumble)`**: kerb 0.175 → 1.1 cm, about 2 px at 1080p internal. Keep the 0.2 s rate limit.
- **High-speed buffeting [P5, `game.ts` P5 region]:** above 160 km/h, keep the shake at least
  `0.12 × min(1, (kph − 160) / 27)` (about 5 mm at top speed). It's a subtle hum, not a wobble.
- **Speed cues from the world:**
  - Kerb stripes every 1 m.
  - Armco posts every 4 m.
  - Tyre-wall paint bands every 3 m.
  - Banners every 40-60 m.
  - The footbridge shadow.
  - Tree trunks within 8-15 m of the wall in the tunnel sections.
  - Tree shadow stripes across the road.

  These replace the speed lines. No motion blur in M8: strong blur lowers perceived speed (Holm 2017),
  and the WebGL path has no motion vectors.
- **For M12:** critically damped springs by half-life (yaw about 0.12 s, height 0.18 s, distance
  0.25 s), look-ahead along the spline 20-40 m, and trauma-model shake with smooth noise instead of
  fixed sines (all from the research report).

---

## 12. Per-preset differences (art view)

| | High (1 P) | Medium (2 P) | Low (3-4 P) |
|---|---|---|---|
| Exposure, grade, fog, sky, sun | same | same | same |
| Pines drawn (edge band always 100%) | 100% (about 14 k) | 75% | 50% |
| Pine shadows / road stripes | yes, to 160 m | yes, to 120 m | **none** (focus rig ±34 m: cars and barriers only); M9 bake fixes this |
| Canopy darkening, blob AO, contact grime | on | on | on (it matters most here) |
| MSAA | 4 | 4 | 2: expect edge shimmer on armco, kerb risers and distant trunks. No pattern finer than 1 m on far-visible props (tyre-wall bands, not per-stack paint). |
| Bloom levels | 4 | 4 | 3 (smaller halo; strength unchanged) |
| Camera far (spec) | 2400 m | 1800 m | 1400 m: fog is 99.9% there, so all three presets show the same skyline |
| Anisotropy | 8 | 8 | 4: distant road softer; the macro noise still reads |
| Storytelling props, flags, crowd | all | all | all |
| Viewport | full 16:9, vertical FOV 57-67° | 1920×540 strips, about 37° vertical | 960×540 cells, as High |

---

## 13. Do not (cheap tells that look dated)

1. **Christmas-tree pines:** smooth faceted cones, all the same size, upright on a visible grid, one
   flat green. Use star rims, spherised normals, a scale mix, hue jitter and emergents (§9).
2. **Pure or neon colours:** `#00ff00` grass, yellow lawn, neon kerb red, `#ffffff` surfaces, the old
   neon crowd shirts.
3. **Crushed black shadows** (asphalt shadow at 7/15/28, the black shadow side of a treeline), or the
   opposite: a milky haze over the middle distance.
4. **Bloom on everything:** white kerbs glowing, a sky halo across half the frame, lens-flare ghost
   chains, chromatic aberration, lens dirt, heavy vignette.
5. **Speed lines** (anime streaks) and heavy motion blur.
6. **Gradient or neon banners,** one techno font on everything, real logos, real circuit or game names
   in the scene.
7. **Plastic grass:** roughness 0.26 straight from the Grass004 file makes grass shine in the low sun.
   Remap it (§8).
8. **Visible tiling** on grass, asphalt or forest floor with no macro variation; texture stretching on
   terrain slopes.
9. **Floating props** with no grime at the base; cars without blob AO; trees not sunk into slopes.
10. **The end of the world:** a visible terrain edge, an empty band below the horizon, a ruler-straight
    skyline.
11. **Hard, straight boundaries** between grass and gravel with no transition; trees in rows at a
    constant offset from the road ("orchard").
12. **Shimmer:** per-stack red and white tyre paint, 1 px lines, sub-pixel trunks at 4-player
    resolution, over-strong RCAS halos on pine silhouettes against the sky (check at 4K).
13. **A sun that doesn't match its shadows,** or a directional light colour that differs wildly from the
    sky's sun.
14. **Teal-and-orange grading,** or a warm wash over everything.
15. **Over-clean surfaces:** no rubber, no worn kerbs, no dusty edges, no dirt at the foot of walls.
16. **Anything that pops** during a race: props, trees or shadows appearing at fixed distances. Counts
    change only between races (spec), and fog must cover the far plane.

---

## 14. Screenshot checklist (for P5 acceptance (a)-(g), plus the owner's M1 run)

- [ ] **Grid (1 P, High):**
  - Lit rear three-quarters of the cars, blob AO visible.
  - Diagonal tree shadow stripes from the left treeline.
  - Grandstand lit, with a dark roof underside.
  - Gantry legible.
  - No glare.
- [ ] **Down a straight:** at least 3 depth layers (§5); the treeline top varies by ≥ 25%; banners don't
  repeat back to back.
- [ ] **Colour picker** on a 1080p capture: sunlit asphalt 100-130 grey; shadowed asphalt ≥ 25 in every
  channel; white kerb ≤ 240; grass G ≤ 155; sky horizon 195-215.
- [ ] **Banked corner with kerbs:** stripes follow the curve, apex kerb rubber visible, rubber line
  visible and slightly glossy into the sun.
- [ ] **Gravel trap:** pale gravel, an irregular edge, beige dust.
- [ ] **4 P Low:**
  - Forest still reads as forest (darkened floor, intact edge rows).
  - No shimmering tyre walls.
  - Same exposure and haze as 1 P.
- [ ] **Into the sun** (back section): circumsolar glow and bloom on chrome only; the horizon is not
  washed out.
- [ ] **Overview cell (3 P):** the treeline ring reads as distant forest, not as a wall.
- [ ] **On the TV** (owner): shadows hold detail in the TV's default picture mode; nothing looks neon.

---

## 15. Changes from the spec, at a glance (for the orchestrator)

| # | Item | Spec | This guide | Owner |
|---|---|---|---|---|
| 1 | Asphalt albedo | not specified | `color.setScalar(6.0)` (texture mean is 0.013) | P5 |
| 2 | Asphalt tile | about 4 m | 2.5 m + macro noise | P5 |
| 3 | Grass and gravel roughness | ARM as packed | remap G when packing (0.72 + 0.28·G; 0.55 + 0.40·G) | P5.1 |
| 4 | Kerb colours | `#c8102e` / `#f2f2f2` | `#b81c2b` / `#e2e0da` + apex rubber | P5 |
| 5 | Tyre paint | every other stack | bands of 3 stacks, 1 band in 3 left bare | P5 |
| 6 | Pine | 4 cones, `#2b4a2a`-`#3e6a35`, ≤ 120 tris | star rims, spherised normals, `#1d3024`/`#2e4733`/`#3f5a3c`, 106 tris, explicit envMap at 3.0 | P5 |
| 7 | Pine order | shuffle per tile | edge band (≤ 30 m) first, then shuffle | P5 |
| 8 | Lighting | groundBounce, fog about 0.002, "keep exposure" | sun 7.5 `#ffe2b4`, env 1.3, hemisphere fill 0.4, exposure 1.95, fog 0.0019 + tint `0xe2e9ef` | P5 / P5-cfg |
| 9 | Grade and post | "cooler, greener, by eye" | tint `[0.99, 1, 0.985]`, sat 1.05, bloom 1.9/0.8/0.07, vignette 0.12/0.08, speed lines off | P5-cfg |
| 10 | Kerb shake | 0.05 × rumble | 0.25 × rumble (the spec value moves the camera 0.4 mm) | P5 |
| 11 | Banners and crowd | banners stay | the gradient banner goes; brand kit; muted crowd | P5 |
| 12 | Composite lift/gain, haze v2, 3D LUT | none | optional | P3-ask / M9+ |
| 13 | Placement jitter, cap order, tunnel sections | none | optional | P2-ask |
| 14 | Camera | 62 / 16 / 6.4 / 2.3 / 0.9 | 57 / 10 / 6.1 / 2.1 / 1.0 | cfg (assign) |
| 15 | Alternative misty look | none | 1k `kloofendal_28d_misty_puresky` + a per-look sky record | follow-up / M9 manifest |

**Proposed `config.ts` values (hero)**, ready to paste into the P5 anchor and comments:

```ts
// LIGHTING
sunColour: 0xffe2b4, sunIntensity: 7.5, environmentIntensity: 1.3,
groundBounce: [0.1, 0.12, 0.07], fogDensity: 0.0019, fogTint: 0xe2e9ef,
hemisphere: { sky: 0xdfe4e2, ground: 0x3a4430, intensity: 0.4 },
// sunBearing: (startStraightBearing - 120 + 360) % 360, computed once and hard-coded
// POST
exposure: 1.95, bloomThreshold: 1.9, bloomKnee: 0.8, bloomStrength: 0.07,
vignette: 0.12, vignetteAtSpeed: 0.08, speedLinesOpacity: 0,
tint: [0.99, 1.0, 0.985], saturation: 1.05,
```

---

## Sources

- M8 spec §1, §2.5, §2.7, §3.6-3.12, §4.2, §4.5; research report "Forza level browser racing game.md"
  (rendering, cars, tracks, UI sections); three r186 source in `node_modules` (`WebGLRenderer.js`
  2736-2740, `ShaderChunk/common`, `lights_physical_*`, `envmap_physical_pars_fragment`,
  `tonemapping_pars_fragment`); `SW/render/haze.ts`, `sky.ts`, `postProcessing.ts`, `chaseCamera.ts`,
  `config.ts` at `a2933a9`.
- Poly Haven API: <https://api.polyhaven.com/assets?t=hdris>, `https://api.polyhaven.com/files/<id>`
  (checked 2026-10-10).
- GamingBolt, Forza Motorsport graphics analysis:
  <https://gamingbolt.com/forza-motorsport-graphics-analysis-a-new-visual-benchmark-for-racing-games>
- Multiplayer.it on Digital Foundry's Forza Motorsport ray-tracing analysis:
  <https://multiplayer.it/notizie/forza-motorsport-analisi-digital-foundry-evidenzia-limiti-del-ray-tracing.html>
- GTPlanet, why GT7 looks the way it does (SIGGRAPH 2025):
  <https://www.gtplanet.net/why-gran-turismo-7-graphics-look-20250902/>
- Polyphony Digital, SIGGRAPH 2025 PBS course slides:
  <https://blog.selfshadow.com/publications/s2025-shading-course/pdi/s2025_pbs_pdi_slides.pdf>;
  GDC Vault: <https://gdcvault.com/play/1028916/Advanced-Graphics-Summit-Realistic-Real>
- GTPlanet, BeamNG adopts GT7 tone mapping:
  <https://www.gtplanet.net/beamng-drive-is-using-gran-turismo-7s-hdr-tone-mapping-technology-20260803/>
- Assetto Corsa EVO: Steam discussion
  <https://steamcommunity.com/app/3058630/discussions/0/756142145462624110>; 0.7 notes
  <https://assettocorsa.gg/assetto-corsa-evo-early-access-0-7-now-available/>; 0.8 notes
  <https://traxion.gg/assetto-corsa-evos-version-0-8-update-released-adding-more-content-and-multiplayer-mods/>
- Deep Forest (GT7): <https://www.thegamer.com/deep-forest-raceway-gran-turismo-7/>,
  <https://egmnow.com/?p=19211>; Grand Oak (Forza Motorsport): <https://www.bsimracing.com/?p=91569>
- Holm, Skovhus, Kraus (2017), "Increasing the Perceived Camera Velocity in 3D Racing Games by Changing
  Camera Attributes": <https://eudl.eu/doi/10.1007/978-3-319-55834-9_14>
- Inigo Quilez, fog (height fog integral): <https://iquilezles.org/articles/fog/>
