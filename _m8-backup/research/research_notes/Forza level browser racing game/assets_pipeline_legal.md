# Asset sources, web asset pipeline, licensing and trademark risks for "Split Ways" (Gamer Gang)

Scope: where to get commercially usable assets for a paid subscription browser racing game, how to compress and stream them, what the licences require, and which trademark and IP risks to avoid. Research date: October 2026. This is not legal advice. Several answers depend on jurisdiction (US Rogers-test case law does not apply in the UAE or EU). The sibling note `car_rendering_cameras.md` already covers car-model sourcing in depth (Kenney, Quaternius, RG Poly, Fab, Sketchfab cars). This note adds to it rather than repeating it.

## 1. CC0 and CC-BY asset sources for a race track (vegetation, rocks, textures, HDRIs, props, cars, engine/tyre/ambient sound, UI fonts)

### Takeaway
Poly Haven (CC0, 521 models, 997 HDRIs, 867 textures) and ambientCG (CC0, 2,014 materials including 78 asphalt and 51 road surfaces, 433 HDRIs) can cover almost all environment needs with no attribution and no commercial restriction. Car bodies and engine sounds are the weak spots. Freesound CC0 recordings and the Sonniss GDC archive (royalty-free, no attribution, but AI training banned) are the cleanest free audio. Paid engine-loop packs have inconsistent licence wording that must be read before purchase.

### Cited Findings

**Poly Haven (CC0)**
- All Poly Haven assets are CC0. "You can use our assets for any purpose", including in "a product you sell". No credit is needed ("although it is appreciated"), and redistribution is allowed. Website content other than the CC0 assets, such as logos and user renders, is protected. The site Terms of Service prohibit "Web scraping or data mining without express permission", so bulk downloads should use the official API rather than scraping. — [Poly Haven licence](https://polyhaven.com/license)
- Live API counts (queried 2026-10-09): 521 models, 997 HDRIs and 867 textures. Model categories include nature 110, plants 57, rocks 37, ground cover 32 and trees 20. HDRI categories include outdoor 705, skies 299, pure skies 59, overcast 134, sunrise-sunset 225 and midday 206. Texture categories include terrain 131, rock 125, road 36, asphalt 20, sand 60 and cobblestone 38. — [Poly Haven API: models](https://api.polyhaven.com/assets?t=models), [HDRIs](https://api.polyhaven.com/assets?t=hdris), [textures](https://api.polyhaven.com/assets?t=textures)
- Track-relevant Poly Haven models from that query include pine_tree_01, fir_tree_01, fir_sapling, pine_sapling_small/medium, island_tree_01–03, jacaranda_tree, shrub_01–04, fern_02, grass_medium_01/02, grass_bermuda_01, dandelion_01, nettle_plant, moss_01, rock_07, rock_09, boulder_01, rock_face_01/02, rock_moss_set_01/02, mountainside, coastal_cliff_01/02/04, the namaqualand_boulder/cliff/rocks set, tree_stump_01/02 and dead_tree_trunk. — [Poly Haven API: models](https://api.polyhaven.com/assets?t=models)

**ambientCG (CC0)**
- All ambientCG assets, including downloadable files and preview renders, are under CC0 1.0. You can "copy, modify, distribute and perform the assets, even for commercial purposes, all without asking permission" and "include the raw files in your project, for example a video game". Credit is optional. The suggested credit line is "Created using <asset name> from ambientCG.com, licensed under the Creative Commons CC0 1.0 Universal License." — [ambientCG licence docs](https://docs.ambientcg.com/license/)
- Live API counts (queried 2026-10-09): 2,014 materials, 433 HDRIs, 2,901 3D-model entries, 127 decals, 61 atlases and 5 terrains. Keyword hits among materials: asphalt 78, road 51, gravel 66, ground 169, rock 76, grass 15. Road surfaces include the Road006–Road015 series (A/B/C variants) and Asphalt015/019/023S/033. — [ambientCG API v2](https://ambientcg.com/api/v2/full_json?type=Material&q=road&limit=30)
- The site was started in 2018 and reports "over 1,000,000 monthly downloads" (undated figure). — [ambientCG home](https://ambientcg.com/)

**Fab / Megascans (paid, Standard licence, not CC)**
- Fab's own summary says the Standard licence allows commercial use, modification, and use "with any compatible tools (usage is not limited to Unreal Engine)". The main restriction is reselling or redistributing an asset on its own. The summary is not binding; the Fab EULA is. — [Fab CLA/licence summary](https://www.fab.com/cla)
- At Fab's October 2024 launch, Sketchfab said the Fab Standard License lets you use assets, "including Megascans, in any game engine or tool you want". — [Sketchfab blog: Fab launches](https://sketchfab.com/blogs/community/epics-unified-marketplace-fab-launches-today) (2024)
- Some Fab Standard-licence listings ship only in Unreal format, so check both the licence and the file formats. — [Unreal forums thread](https://forums.unrealengine.com/t/publishing-a-fab-standard-license-asset-not-uefn-tagged-in-an-island-compliance-requirement-or-technical-guarantee/2751589)
- Fab's NoAI tag "indicates that an asset must not be used for generative AI data collection", and it is only available on Standard-licence assets. — [Epic: Licenses and pricing in Fab](https://dev.epicgames.com/documentation/en-us/fab/licenses-and-pricing-in-fab)

**Sketchfab (CC-BY and other CC models)**
- Downloadable Sketchfab models carry either a Standard licence or a CC licence: CC BY, BY-NC, BY-ND, BY-SA or CC0. Models under the Sketchfab Standard licence need no credit. NC variants block commercial use. — [Sketchfab download API guidelines](https://sketchfab.com/developers/download-api/guidelines); [Sketchfab help: crediting users](https://help.sketchfab.com/en/articles/16152215-crediting-users-for-3d-model-downloads)
- Sketchfab's example credit is "This work is based on Model 2 by Sketchfab licensed under CC BY 4.0". Attribution typically means the creator's username plus a link to the model. The download popup has a copy button for a formatted credit. — [Sketchfab help: crediting users](https://help.sketchfab.com/en/articles/16152215-crediting-users-for-3d-model-downloads); [Sketchfab download API guidelines](https://sketchfab.com/developers/download-api/guidelines)
- CC BY 4.0 §2(b)(2): "Patent and trademark rights are not licensed under this Public License." A CC-BY model of a real car therefore grants no trademark or trade-dress rights. — [CC BY 4.0 legal code](https://creativecommons.org/licenses/by/4.0/legalcode.en)

**Car models (supplements `car_rendering_cameras.md`)**
- Kenney Car Kit: more than 40 models in OBJ/FBX/glTF, CC0, tagged for racing. Stylised. — [Kenney Car Kit (itch.io)](https://kenney-assets.itch.io/car-kit)
- Khronos glTF Sample Assets "CarConcept" is CC BY 4.0, by Eric Chadwick (Darmstadt Graphics Group). It is a concept car with Khronos logos and material variants, started from a public-domain model by "Unity Fan". — [Khronos glTF Assets: CarConcept](https://github.khronos.org/glTF-Assets/model/CarConcept); [Needle asset explorer](https://asset-explorer.needle.tools/CarConcept); [glTF-Sample-Assets repo](https://github.com/KhronosGroup/glTF-Sample-Assets)
- The Speed Dreams base-data repository now ships only one car, "sc-cavallo-360". Its readme lists authors from 2002 to 2021 (Eric Espie, Jean-Christophe Durieu, Bernhard Wymann, Olaf Saßnick, Andrew Sumner, Eckhard M. Jäger, W.E.C, Chad Phillips) and says it is under the Free Art License. — [speed-dreams-data: sc-cavallo-360/readme.txt](https://forge.a-lec.org/speed-dreams/speed-dreams-data/raw/branch/main/data/cars/models/sc-cavallo-360/readme.txt)

**Engine, tyre and ambient sound**
- Freesound uses CC0, CC BY 4.0 and CC BY-NC 4.0, plus the legacy Sampling+ licence, which is being retired. NC sounds cannot be used commercially. CC BY requires crediting each sound by name, author, Freesound link and licence. A separate credits page is suggested for long lists. Users can view their downloads at freesound.org/home/attribution/. — [Freesound FAQ](https://freesound.org/help/faq/)
- Speed Dreams' Nov 2024 sound update credits these Freesound engine recordings as CC0. They are good seed material, but they are fly-bys and revs rather than steady-RPM loops:
  - Heigh-hoo #128611: Japanese GT V8 fly-by.
  - kevp888 #649889: German V10 sports car fly-by.
  - Ears68 #260445: Australian muscle cars.
  - cr4sht3st #157144: old American V8 revving.
  - cheesepuff #112075: V12 Italian supercars.
  - Also CC0: LukaCafuka #752837 (tyre skid), OBXJohn #251662 (dirt skid), mpuffenbarger #683809 (dirt ride), Bidone #66048 (grass/snow ride), and crash sounds #681461, #245714, #422438 and #504921.
  - — [Speed Dreams SoundCredits.txt](https://forge.a-lec.org/speed-dreams/speed-dreams-data/raw/branch/main/data/data/sound/SoundCredits.txt)
- Sonniss GameAudioGDC archive (bundles 2015–2024):
  - "All of the sounds are royalty free and commercially usable." "No attribution is required." You can use them "on an unlimited number of projects for the rest of your lifetime".
  - "Use for AI/ML training is strictly prohibited."
  - The sounds cannot be resold or redistributed "as standalone files or in sound effect libraries". Use inside a finished game is permitted.
  - — [Sonniss GameAudioGDC](https://sonniss.com/gameaudiogdc/)
  - A 2026 bundle was also released, reportedly with the same terms. — [Rekkerd: GDC 2026 bundle](https://rekkerd.org/sonniss-releases-gdc-2026-game-audio-bundle/)
- Magic Sound Effects packs (paid, itch.io and Construct):
  - "Car Engines" vol. 1: 294 SFX, including 70 seamless RPM loops at five speeds plus transitions and accel/decel.
  - Vol. 2: 400 SFX, including 80 RPM loops and 32 start/stop sounds.
  - "Truck Engines": 30 loops.
  - The licence wording conflicts between listings. One says "personal use and one commercial project"; another says "personal and commercial purposes".
  - — [Car Engines (itch.io)](https://magicsoundeffects.itch.io/car-engines); [Car Engines Vol. 2](https://magicsoundeffects.itch.io/car-engines-vol-2); [Construct listing](https://www.construct.net/en/game-assets/sounds/sound-effects/car-engines-vol-1435)

**UI fonts**
- OFL fonts can be bundled in games and apps, in original or modified form. Bundled software must include the copyright notice, licence notice and licence text. For webfonts, "Authorship, copyright notices and license information must be sufficiently visible to your users or subscribers."
- Subsetting counts as modification. A modified font generally cannot use its Reserved Font Names.
- OFL fonts "cannot be sold by themselves".
- — [OFL FAQ](https://openfontlicense.org/ofl-faq/)
- Speed Dreams bundles fonts with their own licence files: 5by7 (OFL), ArmataHL (SIL OFL), DroidSans (separate LICENSE.txt), LiberationSans (separate LICENSE.txt) and Vera (README.TXT). — [speed-dreams-data repository API listing](https://forge.a-lec.org/api/v1/repos/speed-dreams/speed-dreams-data/git/trees/main?recursive=true)

### Inferences
- Environment kit: Poly Haven and ambientCG alone can supply trees, shrubs, grass cards, rocks, cliffs, road and asphalt PBR sets, gravel traps, kerb and concrete textures, and HDRI skies for each track mood (clear midday, overcast, sunset). Both are CC0, so there are no attribution or share-alike duties. A courtesy credit is still good practice and costs nothing.
- Poly Haven vegetation is photoscanned or high-poly and made for offline rendering. Expect to decimate, bake impostors or billboards, and pack atlases before it fits a 4-player split-screen budget on an M1. CC0 places no limits on such changes.
- Trackside props (barriers, tyre walls, catch fencing, marshal posts, grandstands, gantries, cones) are thin in CC0 libraries. Poly Haven's "props/industrial" set and ambientCG metal and concrete materials help. Bespoke kit-bashing in Blender, or Kenney-style CC0 kits restyled with PBR materials, is likely faster than searching for them.
- Megascans via Fab is the highest-fidelity paid option for rocks and foliage, and the Standard licence appears engine-agnostic. Read the full Fab EULA for "subscription service" or "streaming" wording before committing (not verified here).
- Engine audio: no free source was found that ships a proper multi-layer on-load/off-load RPM loop set under an unambiguous licence. Two realistic routes:
  - (a) Build loops from CC0 Freesound and Sonniss recordings by cutting steady-state segments, pitch-mapping them, and crossfading 4–6 RPM layers.
  - (b) Buy a pack such as Magic Sound Effects only after getting written confirmation that a subscription web platform counts as "one commercial project".
- Shipping audio to browsers puts the files in the user's cache. A Sonniss-style "no standalone redistribution" clause is normally satisfied by embedding in the game. Encoding into Opus/OGG sprites, rather than shipping raw WAVs in a public folder, keeps it clearly "within a finished game".
- Fonts: Google Fonts / OFL faces are fine for a subscription product. Ship the OFL text and copyright on a /licenses page. If you subset (recommended for size), rename the family or confirm the font has no Reserved Font Name.

### Gaps
- No verified free, realistic (non-stylised), original-design car model with LODs was found. The sibling note reaches the same conclusion; commissioning or paid Fab/CGTrader "generic" cars remains the realistic route.
- I did not independently verify on Freesound that each sound in the Speed Dreams credits is still CC0. The licence shown on each Freesound page should be checked at download time.
- I did not read the Magic Sound Effects licence file or the full Fab EULA. Their applicability to a subscription web platform is unconfirmed.
- I found no free engine-sound pack with a clear CC0/CC-BY licence that includes on-load/off-load layers across a full RPM range.

## 2. Free Art License 1.3 and Speed Dreams data: commercial use, share-alike scope, attribution, CC BY-SA compatibility, GPL parts, sound provenance

### Takeaway
FAL 1.3 allows commercial use and modification. Distributed copies or modified versions must carry the licence (or a link to it), name the original authors, say where the originals are, and stay under FAL or a compatible licence. Share-alike reaches the derived artwork and data, but not separate game code that merely loads that data as distinct files. Speed Dreams code is GPLv2-or-later, so porting its physics code would make the game code GPL. Much of the Speed Dreams sound folder has no documented provenance and real-brand filenames, so do not ship those sounds.

### Cited Findings

**FAL 1.3 text**
- Copying (§2.1): "You have the right to copy this work for yourself, your friends or any other person, whatever the technique used." — [FAL 1.3 (artlibre.org)](https://artlibre.org/licence/lal/en/)
- Distribution (§2.2) is allowed in any medium, free or paid. You must:
  - "attach this license without any modification to the copies of this work", or indicate exactly where it can be found;
  - "specify to the recipient the names of the author(s) of the originals";
  - "specify to the recipient where to access the originals".
  - — [FAL 1.3](https://artlibre.org/licence/lal/en/)
- Modification (§2.3): you must indicate that the work was modified and, where possible, how. You must "distribute the subsequent work under the same license or any compatible license." — [FAL 1.3](https://artlibre.org/licence/lal/en/)
- Incorporation (§3–4):
  - Including the work in a database, compilation or anthology does not stop others from reusing it under the same terms.
  - If the work can no longer be accessed apart from a larger work, incorporation is allowed only if "the larger work is subject either to the Free Art License or a compatible license".
  - — [FAL 1.3](https://artlibre.org/licence/lal/en/)
- Compatibility (§5): a compatible licence must allow copying, distribution and modification "including for commercial purposes", must ensure "proper attribution of the work to its authors", must recognise FAL as compatible (reciprocity), and must keep changes under the same or a compatible licence. — [FAL 1.3](https://artlibre.org/licence/lal/en/)
- §10: "Sub-licenses are not authorized by this license." — [FAL 1.3](https://artlibre.org/licence/lal/en/)
- The suggested marking is the author's name, the title and the date of the work, plus where the originals can be found and a copyleft notice linking to the licence. — [FAL 1.3 user guide](https://artlibre.org/licence/lal/en/)

**Artlibre FAQ (French)**
- Copies may be made for any purpose, "gratuite ou onéreuse" (free or paid), and no IP royalty is owed.
- "Vous devez soumettre à la LAL l'intégralité de vos travaux" (you must place all of your work based on the originals under the LAL).
- Yes, an unmodified ("servile") copy can be included in a non-LAL collection, provided the LAL notice is given.
- It describes the LAL as "une GPL pour l'art" (a GPL for art).
- The attribution template is "[Nom de l'auteur, titre, date et le cas échéant, le nom des auteurs de l'oeuvre initiale…]" followed by "Copyleft: cette oeuvre est libre, vous pouvez la copier, la diffuser et la modifier…".
- — [Artlibre FAQ](https://artlibre.org/faq/)

**CC BY-SA compatibility**
- Creative Commons declared FAL 1.3 a "BY-SA–Compatible License" for BY-SA 4.0 on 21 October 2014. You may therefore license your contributions to BY-SA 4.0 adaptations under FAL 1.3. The CC page does not address the reverse direction.
- GPLv3 was declared BY-SA 4.0-compatible on 8 October 2015, one way only.
- — [CC: Compatible licenses](https://creativecommons.org/share-your-work/licensing-considerations/compatible-licenses/)

**Speed Dreams licensing**
- The README says: "By default, Speed Dreams code is licensed under the GPLv2-or-later license… whereas non-functional data is licensed under the Free Art License by default. However, some sections of the code and some other assets are distributed under various free (as in freedom) licenses. Please read their license files located in their respective directories." The repository's top-level LICENSE file is GPL v2. — [speed-dreams-data README](https://forge.a-lec.org/speed-dreams/speed-dreams-data/raw/branch/main/README.md); [Wikipedia: Speed Dreams](https://en.wikipedia.org/wiki/Speed_Dreams)
- Speed Dreams began as a TORCS fork. Fedora's TORCS data package lists its licence as "GPLv2+ and Free Art", and the TORCS data README notes some artwork with non-free (in the GPL sense) licences. This is inherited context; it does not describe Speed Dreams 1.4 directly. — [Fedora torcs-data.spec](https://src.stg.fedoraproject.org/rpms/torcs-data/blob/9a0c82dff64833eeb11b7314e1eb49af83d4eac8/f/torcs-data.spec)
- The current Speed Dreams `data/data/sound` folder (main branch, queried 2026-10-09) holds about 70 WAVs. Many are named after real cars and brands:
  - ferrarif355.wav, ferrarif50.wav, f360.wav, lamborghinidiablo.wav, mclarenf1.wav, porsche_engine.wav, 935.wav, 944.wav, gt40.wav, nsx.wav, nsxnew.wav;
  - xj220.wav, viper2.wav, cleanviper.wav, alpha-romeo.wav, corolla1400hi2.wav, evo7_engine.wav, impreza2002_engine.wav, renault-v10.wav, 206_engine.wav, lotus.wav.
  - — [speed-dreams-data contents API: data/data/sound](https://forge.a-lec.org/api/v1/repos/speed-dreams/speed-dreams-data/contents/data/data/sound)
- `SoundCredits.txt` documents only the 29–30 Nov 2024 additions. It covers the v8_formula, v10_raw, v8-ears68, v8-cr4sht3st and v12 sets (all CC0 from Freesound), surface and crash sounds (CC0), and curb_ride/axle (CC BY-SA 4.0 by "Overshot").
  - Two sounds are listed as "CC-BY, sampled and edited from" YouTube videos: v6-raw from Buildinup6's channel and rotary2 from a video by Vitmin.
  - skid_metal is listed with no licence.
  - The file gives no provenance for the older brand-named samples.
  - — [Speed Dreams SoundCredits.txt](https://forge.a-lec.org/speed-dreams/speed-dreams-data/raw/branch/main/data/data/sound/SoundCredits.txt)
- `credits.xml` lists contributors with roles such as "Sound expert", "HQ rework of most sound samples (except most car specific ones)" and "Sound samples". It does not give a per-file licence. — [speed-dreams-data credits.xml](https://forge.a-lec.org/speed-dreams/speed-dreams-data/raw/branch/main/data/data/credits.xml)

### Inferences
- **Commercial use:** FAL permits selling or including the work in a paid product. A subscription is not a problem in itself.
- **Share-alike scope:**
  - Any artwork or data derived from Speed Dreams files is a "subsequent work" and must be released under FAL 1.3 (or a compatible licence such as CC BY-SA 4.0, per CC's 2014 declaration and FAL §5 reciprocity). Examples: track JSON converted from SD XML segments, re-textured SD meshes, car parameter files transcribed from SD XML.
  - Ship such files as separate, downloadable data files (e.g., `/data/tracks/*.json` with an FAL header). Under §3 and §4 the larger work, your TypeScript/React code and your original art, then does not need to be FAL, because the FAL data stays accessible separately.
  - Do not bake FAL data into an inseparable binary blob together with proprietary assets.
- **Facts vs expression:** numeric car specs (torque curves, gear ratios, masses) and track geometry parameters are close to facts or ideas. In many jurisdictions they may not be copyrightable, but EU sui generis database rights and differing national laws make this jurisdiction-dependent. The safe default is to treat derived data as FAL and credit it.
- **A low-obligation path:** use Speed Dreams layouts only as reference. Re-author the tracks with your own spline tool and measurements, without copying XML values verbatim. Use real-world physics references (published Pacejka coefficients, manufacturer-agnostic engine curves) instead of SD numbers. This reduces, but may not remove, the derivation argument.
- **Attribution format:** add a "Credits & Licences" screen and a `/licenses` page. For each FAL item, give:
  - the title, original authors and date (e.g., the sc-cavallo-360 authors list);
  - "Modified by Gamer Gang, 2026: converted to glTF/JSON, re-textured…";
  - a link to the originals (forge.a-lec.org/speed-dreams/speed-dreams-data or the SourceForge 1.4 tarball);
  - the FAL 1.3 notice and a link to artlibre.org/licence/lal/en/.
- **GPL:** Speed Dreams' engine code (simuv2/v3/v4 physics, robots, sound code) is GPLv2+. Translating that C++ into TypeScript would create a GPL derivative. Distributing the bundled JS to browsers would then oblige you to offer the whole client under GPL with source. Re-implement from published equations instead. Also check per-directory licence files in the 1.4 data for any GPL-only "functional data" such as robot setups, which need GPL text and source offers if shipped.
- **Sounds:** do not ship any SD 1.4 sound sample.
  - The 1.4-era samples predate the 2024 SoundCredits file.
  - Their provenance is undocumented, and their filenames point to recordings of real Ferraris, Lamborghinis, McLarens and Porsches. These are likely third-party recordings, possibly from commercial games or videos, whose FAL status cannot be verified.
  - Even the 2024 "CC-BY from YouTube" entries are doubtful unless those specific YouTube videos are marked CC BY.
  - Use the documented CC0 Freesound originals directly, at source quality, rather than SD's processed versions.
  - The curb_ride/axle CC BY-SA 4.0 sounds are usable, but they bring share-alike for those files and need "Overshot" credited.
- **Fonts:** if SD UI fonts are reused, ship their individual licence files (OFL or other), not the FAL text.

### Gaps
- I could not fetch the Speed Dreams 1.4 release tarball and its per-directory licence files. The current repo tree listing was truncated at 1,000 entries, and the 1.4 track and car packages live outside the base-data repo. The exact licence of each of the 29 track layouts and the car setups in the owner's 1.4 kit is unverified.
- No authoritative source (court or official FAQ) settles whether FAL share-alike reaches game code that loads FAL data. The inference above rests on the licence's §3–4 wording only.
- CC's page confirms BY-SA 4.0 → FAL 1.3 compatibility. I found no official artlibre statement confirming FAL → CC BY-SA 4.0, so the reverse direction relies on FAL §5 reciprocity, which is my reading.
- Whether "Rudskogen", "Jarama" or other SD tracks are faithful replicas of real circuits, and whether the SD authors had any rights in those layouts, was not established.

## 3. Trademark and IP: real circuit names, "Forza", real car shapes and trade dress, how to name tracks and cars

### Takeaway
Avoid every real name: "Forza" (a Microsoft game mark), "Laguna Seca"/"WeatherTech Raceway", "Rudskogen", "Monza", and car makes and models. Avoid close copies of iconic real car shapes. US case law (AM General v. Activision, 2020) protected realistic depictions under the Rogers test. Jack Daniel's (2023) narrowed Rogers, which is in any case a US-only doctrine. Car makers and circuits actively license to games, and EU design rights protect car shapes. A small subscription studio should therefore use invented track names and GTA-style invented makes with silhouettes that are mixed or blended rather than copied.

### Cited Findings

**Forza**
- Microsoft Corporation is the registered owner of the FORZA trademark for computer game software in Canada (registered December 2023). — [CIPO trademark 1956936](https://ised-isde.canada.ca/cipo/trademark-search/1956936)
- A US FORZA standard-character application (Serial 88382091, filed April 2019) covers video game software. Justia did not show the owner in the snippet seen. — [Justia: FORZA 88382091](https://trademark.justia.com/883/82/forza-88382091.html)
- Microsoft's FORZA HORIZON application faced a partly successful opposition in Colombia, which shows the mark is actively prosecuted. — [Holland & Knight (2022)](https://hklaw.com/en/news/intheheadlines/2022/05/microsoft-no-logro-el-registro-de-su-marca-forza-horizon)

**Laguna Seca**
- The circuit is owned by the County of Monterey. WeatherTech's naming-rights deal was extended in June 2023 through 30 June 2028. Mazda held naming rights for 17 years before that. — [Engine Builder (June 2023)](https://www.enginebuildermag.com/2023/06/weathertech-extends-naming-rights-of-laguna-seca/); [The Drive](https://www.thedrive.com/accelerator/19178/laguna-seca-will-soon-be-called-weathertech-raceway-at-laguna-seca)
- A WeatherTech Raceway press release (18 Feb 2026) describes "expanded licensing agreements". It says the track is licensed into Microsoft's Forza Motorsport, Sony's Gran Turismo and iRacing, including a new iRacing INDYCAR console licence. — [WeatherTech Raceway press release (2026)](https://weathertechraceway.com/blogs/news/weathertech-raceway-laguna-seca-accelerates-global-brand-growth-through-expanded-licensing-agreements)

**Rudskogen**
- Rudskogen Motorsenter is a real Norwegian circuit: 3.254 km and 14 turns since 2012, redesigned by Tilke and opened in 2011, with a 42 m elevation difference. — [Wikipedia: Rudskogen](https://en.wikipedia.org/wiki/Rudskogen); [Tilke](https://tilke.de/?p=16999)
- It was added to iRacing as base content in 2022. — [BSimRacing](https://www.bsimracing.com/rudskogen-motorsenter-coming-to-iracing-as-base-content/)

**AM General v. Activision (SDNY, 31 Mar / 1 Apr 2020)**
- The court granted Activision summary judgment on trademark, trade dress, unfair competition, false designation, false advertising and dilution claims over Humvees in Call of Duty.
- Under the Rogers test, it found the vehicles artistically relevant (realism) and not explicitly misleading. Six of eight Polaroid factors favoured Activision.
- — [Finnegan (2020)](https://www.finnegan.com/en/insights/blogs/incontestable/in-legal-warfare-over-humvee-trademarks-the-first-amendment-goes-beyond-the-call-of-duty-in-dismissing-am-generals-claims.html); [AIPLA (2020)](https://www.aipla.org/detail/news/2020/04/08/activision-beats-humvee-trademark-claims-over-call-of-duty); [The Drive](https://www.thedrive.com/tech/32872/you-have-a-first-amendment-right-to-humvees-in-call-of-duty-games-judge-rules)
- AM General had previously licensed the Humvee to several game publishers (Infogrames, Novalogic, Codemasters, THQ). Its complaint centred on unpaid use. — [IBA: When 3-D objects in video games pose IP challenges (2021)](https://www.ibanet.org/ip-july-2021-3d-object-video-games-ip)

**Jack Daniel's v. VIP Products (US Supreme Court, 8 June 2023, unanimous)**
- Rogers does not apply "when an alleged infringer uses a trademark… as a designation of source for the infringer's own goods". The Court called its holding "narrow" and left open whether Rogers has merit in other contexts. — [Wikipedia: Jack Daniel's v. VIP](https://en.wikipedia.org/wiki/Jack_Daniel%27s_Properties,_Inc._v._VIP_Products_LLC); [Nixon Peabody (2023)](https://www.nixonpeabody.com/-/media/files/alerts/2023/06/scotus-clarifies-use-of-the-first-amendment-defense-in-jack-daniels-properties-v-vip-products-llc.pdf); [Greenberg Traurig (2023)](https://gtlaw.com/nl/insights/2023/6/rogers-test-in-unsettled-paw-sition-after-scotuss-latest-trademark-decision)

**Other cases**
- Saber v. Oovee (2022): the court applied Rogers to a game's depiction of the Kirovets K-700 tractor's trade dress and found no explicit misleading. — [Eric Goldman blog (2022)](https://blog.ericgoldman.org/archives/2022/10/first-amendment-protects-videogames-depiction-of-tractors-trade-dress-saber-v-oovee.htm)
- Ferrari v. Take-Two: Ferrari alleged that GTA IV's "Turismo" copied the 360 Modena, relying on registered designs and copyright. The outcome could not be confirmed. — [IBA (2021)](https://www.ibanet.org/ip-july-2021-3d-object-video-games-ip)
- E.S.S. Entertainment v. Rock Star (9th Cir.): the "Pig Pen" parody of the "Play Pen" club in GTA: San Andreas did not infringe. — [IBA (2021)](https://www.ibanet.org/ip-july-2021-3d-object-video-games-ip)

**Creative Commons and trademarks**
- CC licences do not license trademark rights (CC BY 4.0 §2(b)(2)). — [CC BY 4.0 legal code](https://creativecommons.org/licenses/by/4.0/legalcode.en)

### Inferences
- **Naming the product and marketing:**
  - Never use "Forza" in the product name, track names, store copy, SEO keywords or ads. A "Forza-like" comparison in marketing risks a source-identifying use, which is exactly where Jack Daniel's removed Rogers protection.
  - Keep "Forza level" as an internal research label only. The repo folder name `research_notes/Forza level browser racing game` is fine internally, but should not appear in public URLs.
- **Tracks:**
  - Use invented names and fictional geography (e.g., "Brackenridge Club Circuit", "Valdoro Autodromo", "Kestrel Pass").
  - The 3.3 km club circuit should not reproduce Rudskogen's 3.254 km / 14-turn layout one-to-one under any name.
  - The 5.9 km "Monza-style" track should borrow the archetype (long straights, chicanes, a banked curve) without replicating Monza's layout or names ("Parabolica", "Lesmo", "Ascari").
  - The mountain road should not use real pass names.
  - Real circuits clearly treat their names and likenesses as licensable products (Laguna Seca's 2026 licensing push), so a faithful replica plus a "spoof" name is more exposed than a genuinely original layout.
- **Cars:**
  - GTA-style invented makes are the norm for unlicensed games. Avoid near-copies of iconic silhouettes and details (Ferrari side intakes, the Porsche 911 roofline plus round headlamps, the Lamborghini Countach wedge). Mix features from several cars, and design your own grilles, lamps and badge shapes.
  - Ferrari's GTA IV claim relied on registered designs (EU), where no Rogers-style defence exists. The UAE also has its own trademark and industrial-design laws.
  - The SD "sc-cavallo-360" name and lineage hint at a Ferrari 360 lookalike. If any SD car mesh is used even as a base, rename it and reshape it away from the original.
- **Sounds:** prefer engine-type labels ("flat-six", "V12") over model names in file names and UI. Do not name sounds "f355" or "diablo".
- **Logos and marks inside assets:**
  - Strip any logos baked into downloaded models: Khronos logos on CarConcept, real sponsor decals on CC-BY props, tyre-brand sidewalls, fuel-brand signage on Poly Haven or Sketchfab props.
  - Use fictional sponsors for trackside banners.
- **Jurisdiction:** the US cases are persuasive only in the US. The owner is UAE-based and serves a global audience via Vercel. Assume the strictest regime (EU registered designs; UAE trademark law) when deciding what to avoid, and consider a one-off clearance search of chosen brand, car and track names in the UAE, US, EU and UK.

### Gaps
- I did not verify the US owner of FORZA Serial 88382091 or the current status of related US Forza registrations (USPTO TSDR not fetched).
- No source was found on whether "Laguna Seca" or "Rudskogen" are registered trademarks, or who holds them. Only the naming-rights and licensing context was found.
- The final outcome of Ferrari v. Take-Two (GTA IV Turismo) was not found.
- No UAE-specific case law or guidance on depicting real vehicles or circuits in games was found (UAE Federal Decree-Laws on trademarks and copyright not researched here).
- Whether a track layout itself (as opposed to its name) is protectable was not established.
- No published licensing fees or practices from car manufacturers for small studios were found.

## 4. Web asset pipeline: glTF/KTX2, meshopt vs Draco, gltf-transform recipes, budgets, download targets, caching, hosting costs (Vercel vs Cloudflare R2)

### Takeaway
Ship glTF 2.0 GLBs compressed with meshopt (the gltf-transform 4.5.x default, with faster decoding than Draco and support for animation) plus KTX2 textures. Use ETC1S for colour and flat maps, UASTC with RDO and Zstd for normal and ORM maps. Use hashed filenames with `Cache-Control: max-age=31536000, immutable`. Aim for an initial load that a portal would accept (CrazyGames caps it at 50 MB, or 20 MB for mobile) and stream each track while the lobby fills. A subscription product must use Vercel Pro, not Hobby. At scale, R2's free egress is far cheaper than Vercel's $0.15–$0.35/GB.

### Cited Findings

**gltf-transform 4.5.1 `optimize` (CLI help captured locally)**
- `--compress` accepts draco, meshopt, quantize or false; the default is "meshopt". "Draco compresses geometry; Meshopt and quantization compress geometry and animation."
- `--texture-compress` accepts ktx2, webp, avif, auto or false; the default is "auto". "KTX2 optimizes VRAM usage and performance; AVIF and WebP optimize transmission size."
- `--texture-size` defaults to 2048.
- `--simplify` is on by default with `--simplify-error` 0.0001.
- `--instance` is on by default with `--instance-min` 5.
- `--flatten`, `--join`, `--join-meshes`, `--join-named`, `--palette`, `--prune`, `--weld` and `--sparse` are all on by default. `--meshopt-level` defaults to "high".
- — [gltf-transform CLI](https://gltf-transform.dev/cli) (v4.5.0 on the docs page; v4.5.1 from `npx @gltf-transform/cli@4 optimize --help`)
- Individual commands are available: etc1s, uastc, meshopt, draco, quantize, resize, simplify, instance, dedup, prune, weld, palette, join and flatten. The docs recommend running `gltf-transform inspect` first, and note that `optimize` defaults "may not be ideal for all scenes". — [gltf-transform CLI](https://gltf-transform.dev/cli)
- `gltf-transform uastc --help` (4.5.1) shows the following:
  - Dependency: "KTX-Software (https://github.com/KhronosGroup/KTX-Software/)". It spawns toktx jobs (`--jobs`, default 8).
  - Options: `--slots <glob>`, `--pattern <glob>`, `--level 0–4` (default 2; level 4 = "Very slow", 48.24 dB), `--rdo`, `--rdo-lambda` (default 1; "For normal maps, try [.25, .75]"), `--rdo-dictionary-size` (default 32768, max 65536), `--resize`, `--mipmaps` (default true) and `--filter` (default lanczos4).
  - `--zstd` defaults to 18. "Values above 20 should be used with caution, requiring more memory to decompress" (level 22 uses a 134 MB window vs 8 MB at 18–19).
  - The help also says to apply UASTC "only where higher quality is necessary, and apply ETC1S for textures where the quality is sufficient."
  - — [gltf-transform CLI](https://gltf-transform.dev/cli) (help text captured from @gltf-transform/cli 4.5.1)

**Meshopt vs Draco**
- Meshopt decoding is "considerably faster" than Draco. Neither improves runtime rendering. Meshopt output should be gzip/brotli-compressed for full benefit. — [gltf-transform: EXTMeshoptCompression](https://gltf-transform.dev/modules/extensions/classes/EXTMeshoptCompression)
- Community comparisons suggest Draco often compresses high-poly static meshes smaller, while meshopt can be smaller after gzip on mid-poly meshes and supports animation. These are anecdotal figures to benchmark rather than rely on. — [svilenkovic: Draco vs meshopt](https://www.svilenkovic.com/3d/draco-vs-meshopt); [three.js forum: Draco animation](https://discourse.threejs.org/t/draco-animation/10945/6)

**KTX2 / Basis (Khronos KTX Artist Guide, undated, KTX 2.0 era)**
- "ETC1S offers greater compression and works better with large areas of solid colors or mostly monochromatic values". UASTC is for "higher visual quality for high-contrast high-detail color textures". Use UASTC for normal, ORM, clearcoat and transmission maps.
- Example toktx settings:
  - ETC1S: `--t2 --encode etc1s --clevel 4 --qlevel 255`
  - UASTC: `--t2 --encode uastc --uastc_quality 4 --uastc_rdo_l .5 --uastc_rdo_d 65536 --zcmp 22` (use `--uastc_rdo_l .25` for higher quality)
  - Mipmaps: `--genmipmap`
  - Non-colour maps: add `--assign_oetf linear --assign_primaries none`
- In the lamp example, JPG/PNG at about 13 MB on disk and 96 MB in GPU memory became about 10 MB on disk and 21 MB in GPU memory. In the duck example, a 512² PNG dropped from 1.5 MB to 277 KB of GPU memory.
- Use power-of-two sizes, multiples of 4 are required for KHR_texture_basisu, and "usually no larger than 2048x2048".
- — [Khronos KTX Artist Guide](https://github.com/KhronosGroup/3D-Formats-Guidelines/blob/main/KTXArtistGuide.md)
- Khronos's launch press release says UASTC is "particularly suitable for normal maps", while ETC1S gives much smaller transmission and memory sizes than JPEG/PNG (2021-era). — [Khronos press release](https://www.khronos.org/news/press/khronos-ktx-2-0-textures-enable-compact-visually-rich-gltf-3d-assets)

**Download-size benchmarks from web portals**
- CrazyGames requires an initial download of 50 MB or less (20 MB or less for the mobile homepage), a total of 250 MB or less, and at most 1,500 files. With the SDK, the initial download is measured until the first gameplay-start event. — [CrazyGames technical requirements](https://docs.crazygames.com/requirements/technical)
- Poki figures are unofficial and conflicting: about 8 MB initial (2026 third-party guide) vs "no larger than 5 MB" (Defold manual, undated). — [Cinevva Poki guide (2026)](https://app.cinevva.com/guides/publish-game-poki); [Defold: optimizing size](https://defold.com/manuals/optimization-size)

**HTTP caching**
- Put a hash or version in each static asset URL, never change content at that URL, and serve `Cache-Control: max-age=31536000, immutable`. Serve the HTML with `Cache-Control: no-cache` so clients pick up new URLs. `immutable` avoids revalidation requests on reload. — [MDN: Cache-Control](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control)

**Vercel pricing (pricing page and docs, fetched Oct 2026)**
- Hobby is $0 and Pro is $20/month. "Our Hobby plan is for personal, non-commercial use."
- Fast Data Transfer: Hobby includes 100 GB/month; Pro includes 1 TB/month, then "starting at $0.15 per GB".
- Fast Origin Transfer: Pro starts at $0.06/GB.
- Blob on Pro: storage $0.023/GB, simple operations $0.40/M, advanced operations $5/M.
- — [Vercel pricing](https://vercel.com/pricing)
- Regional ranges (docs last updated 2026-09-14): Fast Data Transfer $0.15–$0.35/GB, CDN requests $2.00–$3.20 per million, Blob data transfer $0.05–$0.117/GB, Blob storage $0.023–$0.041/GB. — [Vercel regional pricing](https://vercel.com/docs/pricing/regional-pricing)

**Cloudflare R2 pricing**
- Standard storage $0.015/GB-month, Class A operations $4.50 per million, Class B operations $0.36 per million, egress free.
- Infrequent Access: $0.01/GB-month plus $0.01/GB retrieval, with a 30-day minimum.
- Monthly free tier: 10 GB-month of storage, 1M Class A and 10M Class B operations (Standard storage only).
- — [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- Since May 2023, Cloudflare's CDN terms let customers serve video and other large files through the CDN "so long as that content is hosted by a Cloudflare service like Stream, Images, or R2". Large files hosted elsewhere and proxied through the CDN remain restricted. — [Cloudflare blog: Goodbye section 2.8 (May 2023)](https://blog.cloudflare.com/updated-tos/)

### Inferences
- **Recommended recipes** (to verify on your own assets; flags from 4.5.1 help and the Khronos guide):
  - **Environment props and vegetation:**
    1. Run `gltf-transform optimize in.glb mid.glb --compress meshopt --texture-compress false --texture-size 1024 --instance-min 3`.
    2. Encode normal and ORM maps with UASTC: `gltf-transform uastc mid.glb mid2.glb --slots "{normalTexture,occlusionTexture,metallicRoughnessTexture}" --level 4 --rdo --rdo-lambda 0.5 --zstd 18`.
    3. Encode the remaining colour maps with ETC1S: `gltf-transform etc1s mid2.glb out.glb --slots "{baseColorTexture,emissiveTexture}"`.
    - Check the exact `--slots` glob syntax with `gltf-transform uastc -h`.
    - Use zstd 18–19 rather than the Khronos guide's 22, to limit the decompression memory on TVs and laptops.
    - Simplification is on by default in `optimize`. For foliage cards, set `--simplify false` to avoid alpha-card collapse.
  - **Cars:** keep named wheel, brake and steering-wheel nodes. Use `--flatten false --join-named false` (or `--join false`), `--simplify false` on the LOD0 hero mesh, and `--texture-size 2048` for the paint/livery atlas. Generate LOD1 and LOD2 with explicit `simplify --ratio 0.5/0.2` passes, and use UASTC for normal maps and the livery mask.
  - **Track road mesh:** generate it procedurally at runtime from the spline, so no download. Ship only the tiling road, kerb and run-off texture sets as KTX2 (UASTC for normal/ORM, ETC1S for albedo), with a 1024² or 2048² tiling detail plus macro variation.
  - **HDRIs:** Poly Haven HDRIs come as 1k–16k EXR/HDR. For the sky, ship a 2k equirect as .hdr or, smaller, an RGBM/RGBE PNG or KTX2 UASTC HDR, and pre-filter (PMREM) on load. Use 4k only for a visible sky dome at 4K output. Check whether three.js r186's KTX2Loader supports UASTC HDR; not verified here.
- **GPU memory arithmetic** (my calculation): a 2048² RGBA8 texture is about 16 MB, or about 21 MB with mips. Transcoded to BC7 or ASTC 4x4 (8 bpp) it is about 4 MB, or 5.3 MB with mips. A track with about 40 unique 2k material maps therefore drops from about 850 MB to about 210 MB. That is the difference between fitting comfortably in the M1's unified memory alongside four split-screen render targets and not fitting.
- **Download targets for a TV party game:**
  - Initial (shell, lobby, UI, fonts, one car set, audio core): at most about 15–20 MB, so TVs and phones on household Wi-Fi reach the lobby fast.
  - Per track: about 30–60 MB, streamed during lobby and car selection, and prefetched for the voted next track during the results screen.
  - Total library: at most about 250 MB for v1.
  - These figures are informed by the CrazyGames 50/20/250 MB limits, but they are a design choice, not a sourced standard.
- **Caching:**
  - Use content-hashed URLs with an immutable one-year cache for every GLB, KTX2, audio sprite and font, and `no-cache` for index.html and the asset manifest.
  - Add a service worker (Workbox or hand-rolled) that pre-caches the manifest's current track and lazily caches others, giving repeat sessions near-zero downloads. Call `navigator.storage.persist()` to reduce eviction risk.
  - Version the manifest so a deploy only invalidates changed files.
- **Hosting cost model** (my arithmetic from the cited prices; 1 MAU = 1 monthly active TV host):
  - Assume each new TV downloads about 150 MB in its first month and caches it thereafter.
  - At 10k MAU that is 1.5 TB. On Vercel Pro, (1,500 − 1,000 GB included) × $0.15–$0.35 ≈ $75–$175/month plus the $20 seat.
  - At 100k MAU that is 15 TB, about $2,100–$4,900/month.
  - The same 15 TB from R2 behind a Cloudflare custom domain has $0 egress. Storage of 0.5 GB is within the free tier. About 20M Class B reads is roughly (20M − 10M free) × $0.36/M ≈ $3.60, and fewer still when the Cloudflare cache absorbs repeats.
  - Recommendation: keep the app shell and APIs on Vercel Pro (Hobby is non-commercial, so it is not allowed for a subscription product), and serve `/assets/*` from R2 on an `assets.` subdomain with CORS enabled for the app origin. This is explicitly allowed under Cloudflare's post-2023 terms because the content is hosted on R2.
- **Draco vs meshopt choice:** meshopt is the better default for this project. It decodes faster (load time matters on TV), compresses animation (wheel or door clips), is gltf-transform's default, and is smaller after brotli, which both Vercel and Cloudflare apply. Use Draco only for a few very dense static meshes if benchmarks show a meaningful saving.

### Gaps
- I did not fetch the three.js r186 KTX2Loader / MeshoptDecoder docs. The exact setup (`ktx2Loader.setTranscoderPath(...).detectSupport(renderer)`, `gltfLoader.setMeshoptDecoder(MeshoptDecoder)`) and UASTC-HDR support should be confirmed against r186 sources.
- The CLI help confirms that the uastc/etc1s commands depend on KTX-Software. The minimum KTX-Software version, and whether CI (e.g., a Vercel build) can install it, was not checked. The likely approach is to pre-bake assets locally or in GitHub Actions and commit or upload the outputs.
- Which compressed formats (BC7/BPTC, ASTC, ETC2) Chrome exposes through WebGL2 on Apple Silicon macOS, and therefore what Basis transcodes to on the target M1, was not verified.
- Browser storage quotas and eviction rules for Cache Storage and IndexedDB were not fetched (MDN "Storage quotas and eviction criteria" would be the source).
- No Vercel per-region Fast Data Transfer price for the Middle East, or for the regions serving UAE users, was found; only the $0.15–$0.35/GB global range.
- No measured download sizes for comparable three.js racing games were found.
