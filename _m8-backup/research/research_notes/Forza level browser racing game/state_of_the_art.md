# State of the art: browser racing/driving games, real-time 3D web showcases, and phone-controller TV platform business models (researched October 2026)

Scope note: covers the best-looking web racing/driving experiences and their engines and techniques (2023-2026), and how phone-as-controller TV platforms (AirConsole, Jackbox) make money. Anything older than 2024 is marked [OLDER]. Several tools were not covered by any source I found (Needle Engine, Godot web, PlayCanvas and Babylon.js racing showcases). Those are listed under Gaps rather than filled in from memory.

## 1. Which web racing/driving games and demos look best today, and what engines do they use?

### Takeaway
In 2025-2026 the visual high end of browser driving is custom three.js work on WebGPURenderer + TSL: Bruno Simon's 2025 portfolio (written up March 2026) and Anderson Mancini's "threejspunk" WebGPU racing game (September 2026). Unity 6 WebGPU builds are now a real second option (Ashline Racing, June 2025; WebGPU production-supported in Unity 6.6, September 2026). The most-played web racers (Madalin Stunt Cars 2, Drift Hunters, PolyTrack) win on instant play and handling, not on visual fidelity. I found no PlayCanvas or Babylon.js racing showcase that sets a visual bar.

### Cited Findings
**three.js (WebGPU/TSL): the current visual high end**
- Bruno Simon's new portfolio (a drivable vehicle in an island world) uses TSL, three.js's JavaScript shading language. The case study says "the experience automatically runs on WebGPU when available". Work began about five years after the 2019 original, aimed at an end-of-2025 release, and took "a little over a year". Case study dated March 11, 2026. — [Awwwards case study](https://www.awwwards.com/brunos-portfolio-case-study.html)
- A secondary aggregator says the portfolio renders with both WebGL and WebGPU and that the code and Blender files are on GitHub under MIT, with CC0 music. I could not verify the repo or licence against the primary source. — [GeekNews/hada.io summary](https://news.hada.io/topic?id=24963)
- "threejspunk" (threejspunk.com) by Anderson Mancini was posted to the three.js forum Showcase on September 29, 2026. It is billed as "a full racing game", built with "WebGPU, TSL, and GPUCompute" plus "a lot of custom rendering techniques". It has realistic rendering, rain, reflections and physics, 50+ missions, several cars, a large city, desktop and mobile support, and multiplayer (added October 2, 2026, "using CloudFlare service for that, for now"). One user said it "Runs well even on my company spec laptop". No FPS figures or Mac reports were given. Another reply found it beautiful with great handling but repetitive. — [three.js forum thread](https://discourse.threejs.org/t/free-game-cyberpunk-inspired-game-realistic-graphics/94779)
- On April 29, 2026 the Sensei Notes newsletter featured an unnamed web "racing game that makes Gran Turismo nervous", alongside an infinite WebGPU world. I could not identify the game. — [Sensei Notes archive](https://buttondown.com/wawasensei/archive)
- PolyTrack (Kodub) is a TrackMania-style low-poly time-trial racer with loops, jumps and a track editor. The developer says it is written in TypeScript/JavaScript, uses three.js for graphics and Ammo.js for physics, builds all UI in HTML/CSS, and runs a Deno backend for leaderboards. It also ships downloadable builds (Windows/Linux/macOS/Android) next to the browser version. — [Kodub reply on itch.io](https://itch.io/t/3293744/how-did-you-do-this)

**Custom WebGL**
- Slow Roads (Anslo), an endless procedurally generated scenic driving game, runs on a "bespoke" WebGL engine with custom shaders and a custom minimal physics engine. The article mentions three.js only as a general library and does not say Slow Roads uses it. [OLDER: case study last updated 2023-04-11.] — [web.dev case study](https://web.dev/case-studies/slow-roads)

**Unity WebGL / WebGPU**
- Madalin Stunt Cars 2 is by Madalin Stanciu (Romania). CrazyGames lists its engine as Unity 2022 (HTML5/Unity WebGL). — [CrazyGames listing](https://www.crazygames.com/es/game/madalin-stunt-cars-2)
- Drift Hunters is described as playing in the browser via Unity WebGL. This is a low-quality blog source and the developer is not named. — [blog post](https://monitoring.toky.co/?p=5697)
- Ashline Racing: Born To Burn (June 2025) is listed on CrazyGames as a Unity 6 game running "entirely in your browser using WebGPU", desktop browsers only. — [CrazyGames listing](https://www.crazygames.com/fr/game/ashline-racing-born-to-burn-tmr)
- Unity 6.1 (April 2025) added WebGPU for web builds as an experimental backend. Unity 6.6 (September 1, 2026) made it production-supported but not the default. With WebGPU, web builds gain GPU Resident Drawer, GPU occlusion culling, STP upscaling, VFX Graph GPU particles, Adaptive Probe Volumes and compute skinning. Unity's browser demos were Fantasy Kingdom (a dense stylised town) and a spaceship interior, not a racing scene. [Secondary aggregator. The two articles disagree on whether 6.1 called it "supported" or "experimental".] — [Cinevva, Unity 6.6 WebGPU production](https://app.cinevva.com/news/2026-09-01-unity-6-6-webgpu-production); [Cinevva, Unity 6.1 WebGPU](https://app.cinevva.com/news/2025-04-22-unity-6-1-webgpu)

**PlayCanvas and Babylon.js (engine status only; no racing showcase found)**
- An August 2025 newsletter lists PlayCanvas engine updates: WebGPU indirect draw support and "100% of GLSL ported to WGSL". An earlier PlayCanvas post called WebGPU "Beta" and opt-in [OLDER]. — [Web Game Dev newsletter](https://buttondown.com/webgamedev/archive/issue-027/); [PlayCanvas blog, graphics tag](https://blog.playcanvas.com/tags/graphics)
- A community Babylon.js 8 + Vite 6 template uses "WebGPU engine by default, WebGL2 supported as well" with Havok physics, and was later updated to Babylon 9. — [Babylon.js forum](https://forum.babylonjs.com/t/babylon-js-8-vite-6-typescript-template-with-havok-physics/57460)
- Babylon's Havok-based Physics V2 is reported as up to 20x faster than V1 [OLDER, 2023-era newsletter]. — [Web Game Dev newsletter issue 14](https://buttondown.com/webgamedev/archive/issue-014/)

### Inferences
- The project's chosen stack (three.js + Rapier, custom HDR post) puts it in the same family as the current best-looking web drivers. The visual ceiling in 2026 is set by three.js WebGPU/TSL projects, not by Unity WebGL portal games.
- The most-played web racers (Madalin, Drift Hunters, PolyTrack) show that instant load and good handling drive play, not fidelity. A "Forza-level" pitch needs both: the threejspunk feedback ("beautiful… great handling… but repetitive") shows that looks without content variety are not enough.
- Unity 6.6 WebGPU is now a credible competitor for richer web games. For a team already invested in three.js and React, switching engines does not look justified by these sources.

### Gaps
- No public load sizes, FPS figures or Apple Silicon (M1) measurements for Bruno Simon's portfolio, threejspunk, PolyTrack, Madalin Stunt Cars 2, Drift Hunters or Ashline Racing.
- No PlayCanvas or Babylon.js car/racing demo surfaced that sets a visual benchmark. Needle Engine and Godot web racing examples were not found in this pass.
- I could not identify the "racing game that makes Gran Turismo nervous" from the April 2026 Sensei Notes issue, or verify the Bruno Simon repo and licence.

## 2. Rendering, LOD, streaming and physics techniques, download sizes, and Apple Silicon performance

### Takeaway
The documented techniques are all pragmatic. High detail is kept in a corridor around the road and distant scenery is low-res. Generation work is spread across frames. Allocations are pooled. Physics is minimal. Textures ship as KTX2 (ETC1S/UASTC) and meshes as Draco. Vegetation is instanced or merged single-triangle geometry. Quality presets are driven by real telemetry. The most useful hard data point is from Slow Roads: only 52% of players got above 55 FPS. Without automatic quality presets, a large share of users will miss 60 fps.

### Cited Findings
**Slow Roads [OLDER, 2023 case study, still the most detailed web-driving postmortem found]** — [web.dev](https://web.dev/case-studies/slow-roads)
- The road midline is generated well ahead of the player. This works because the road is a single non-branching path, so the engine can predict where detail will be needed.
- High-resolution geometry exists only in a narrow corridor beside the road. "Distant portions of the environment, which should never be seen up close, are rendered at a much lower resolution." Because the camera stays on the road, LODs do not need constant loading and unloading.
- Chunks are generated gradually just before they are needed, chunks that will be revisited soon are cached, and heavy generation is spread over time to avoid frame spikes.
- Physics has no dynamic collisions or destructibles. Road and guard-rail collisions use a distance check to the road centre.
- Loop memory is pre-allocated and recycled each frame, geometry buffers are pooled, and `Object.keys()` and `Array.map()` are avoided in hot paths to cut GC pauses.
- Converting images to WebP "halved the Slow Roads bundle size". Average environment generation takes 3.2 s. Over 60% of users load within 3 s and over 97% within 10 s. No absolute download size is given.
- The game targets 60 FPS at monitor refresh, but "only 52% of players achieve above 55 FPS", partly skewed by disabled hardware acceleration.
- Performance and resolution telemetry go to a Node backend. The game highlights the settings menu when FPS stays low and suggests enabling hardware acceleration. Settings trade view distance against detail.
- No web workers yet (planned for parallel generation). WASM and WebGPU were mentioned as future options.

**Bruno Simon portfolio (2025, case study March 2026)** — [Awwwards](https://www.awwwards.com/brunos-portfolio-case-study.html)
- The world is authored entirely in Blender. Object-naming conventions drive engine behaviour: e.g. "refLandingPhysicalFixed" becomes a fixed physics body exposed to JS as "landing". Empties define collision shapes, respawn points and area boundaries.
- Grass is about 78,400 blades, each a single triangle, packed into one geometry, with a limited set looping toward the edges. Trees have trunk geometry plus camera-facing SDF-textured foliage planes, and leaves shrink in front of the car so the player can see ahead.
- Trees, foliage, benches, lanterns, bowling pins and bricks are instanced. Non-visible areas are frustum culled. Hidden faces are removed, geometries merged, and colours come from a shared palette texture via UVs.
- Textures are compressed GPU formats (ETC1S and UASTC, i.e. KTX2/Basis). Models use Draco, mainly via quantisation.
- The mobile preset disables water blur and depth of field and reduces shadow-map resolution. No formal LOD system is described, and no total load size is given.
- Audio: object sounds are positioned in 3D, and the vehicle has separate sounds for springs, hydraulics, engine, tyre friction, boost and horn.

**Unity 6.6 web (September 2026)** — [Cinevva](https://app.cinevva.com/news/2026-09-01-unity-6-6-webgpu-production)
- WebAssembly64 raises the memory ceiling from 4 GB to 16 GB in recent Chrome, Edge and Firefox.
- "Progressive Asset Loading" delivers assets per scene instead of in one upfront download. [Secondary source.]

### Inferences
- A closed circuit is an even better fit for Slow Roads' corridor LOD than an endless road. The track spline is fully known, so high-detail trackside dressing can be limited to a band around the racing line, with low-res backdrop terrain beyond it. Split-screen views can share a single LOD set chosen by the nearest car per region.
- For 1-4 split viewports on an M1 at 4K, the data argues for (a) auto quality presets driven by measured frame time (which the project already has as dynamic resolution) and (b) telemetry of FPS, resolution and preset to the existing Neon backend, as Slow Roads did, to tune presets on real hardware.
- The Bruno Simon pipeline (Blender naming to physics and metadata, KTX2 + Draco, instanced and merged vegetation, palette textures) carries over to building circuits from Speed Dreams XML plus free models.
- Bruno Simon's "automatically runs on WebGPU when available" shows a TSL path is production-viable. However, the project's custom WebGLRenderer post pipeline would need porting to the node/TSL post system to benefit. That is a migration-cost judgement, not something these sources settle.

### Gaps
- No source gave measured FPS for any web racing game on Apple Silicon (M1/M2/M3) at 1080p or 4K.
- No absolute download sizes (MB) for Slow Roads, Bruno Simon's portfolio, PolyTrack, threejspunk or Unity racing builds.
- No source documented a physics stack for threejspunk or Bruno Simon's 2025 portfolio (Rapier was not confirmed).

## 3. Developer talks, blog posts and postmortems

### Takeaway
There are few deep, first-party technical postmortems for web racers. The two substantive ones are the web.dev Slow Roads case study (2023) and the Awwwards case study of Bruno Simon's 2025 portfolio (March 2026). The others are forum showcases and newsletters.

### Cited Findings
- web.dev "How Slow Roads intrigues gamers and developers alike…" by Anslo [OLDER, 2023-04-11]: procedural generation, LOD corridor, GC avoidance, load-time histogram and FPS telemetry. — [web.dev](https://web.dev/case-studies/slow-roads)
- Awwwards case study, Bruno Simon portfolio (March 11, 2026): TSL/WebGPU, Blender-driven world authoring, compression, instancing, audio design. — [Awwwards](https://www.awwwards.com/brunos-portfolio-case-study.html)
- three.js forum Showcase, threejspunk (Sept-Oct 2026): WebGPU/TSL/GPUCompute racing game, with player feedback on handling and repetitiveness. — [three.js forum](https://discourse.threejs.org/t/free-game-cyberpunk-inspired-game-realistic-graphics/94779)
- Kodub's itch.io reply on how PolyTrack was built (three.js + Ammo.js + HTML/CSS UI + Deno). — [itch.io](https://itch.io/t/3293744/how-did-you-do-this)
- 2026 WebGL-to-WebGPU migration guide for three.js. Not fetched; listed as a candidate reference only. — [Utsubo](https://www.utsubo.com/blog/webgpu-threejs-migration-guide)

### Inferences
- The thinness of public web-racing postmortems is itself a positioning opportunity. A well-documented "AAA-feel racing in the browser" build log would stand out in a sparse field.

### Gaps
- No GDC or conference talk specific to browser racing games from 2024-2026 surfaced.
- No Chrome for Developers WebGPU case study for a racing game was found.

## 4. Phone-as-controller TV platforms: business models, subscription pricing, what players pay for, and catalogue size

### Takeaway
AirConsole runs a freemium subscription ("Hero"). Free play is limited to a weekly selection of games, 2 players maximum, with ad breaks that are AirConsole's own Hero promos, not third-party ads. One Hero subscriber in a session unlocks extra content for everyone. Developers are paid from subscription revenue split by the games each subscriber played. It also licenses itself into cars (BMW, VW). Jackbox sells annual premium packs ($29.99 for Party Pack 11) and in 2026 is expanding to Netflix and a free, ad-supported smart-TV streaming service.

### Cited Findings
**AirConsole Hero: pricing (sources conflict; current official price not confirmed)**
- Apple App Store in-app purchases (snapshot 2026-07-03): "AirConsole Hero Monthly" $7.99 and "AirConsole Hero for lifetime" $29.99, plus unlabelled Hero items at $2.99, $4.99, $11.99, $17.99 and $23.99 (likely yearly, promo and regional tiers, but not labelled). — [App Pricing Lab](https://apppricinglab.com/iap/apple/1017688554)
- An older AirConsole press release lists Hero at $4.99/month or $23.99/year [OLDER, about 2020]. — [PR Newswire (DE)](https://prnewswire.com/de/pressemitteilungen/airconsole-nimmt-es-mit-nintendo-switch-und-ps4-auf-und-bringt-konsolenspiele-ins-internet-877316052.html)
- A CGMagazine review cites $3.99/month [OLDER, August 2018]. — [CGMagazine](https://www.cgmagonline.com/reviews/air-console-hero-review/)
- In the Philippines, an ISP bundle (SKY Fiber) gave subscribers 6 months of Hero free; others paid P249/month [OLDER, 2021]. — [ABS-CBN](https://www.abs-cbn.com/newsroom/news-releases/2021/6/19/sky-fiber-treats-fathers-to-new-and-exciting-games?lang=en)

**AirConsole: what players pay for**
- The free "Starter Pack" is a weekly selection of free games, "2 players maximum, with ad breaks". Hero offers the "full experience without advertisement breaks", and "only one AirConsole Hero player needed per session" to unlock perks for everyone. — [Microsoft Store listing](https://microsoft.com/store/p/airconsole/9nblggh4wk46)
- Hero is described as access to all games, unlimited players, no ad breaks and unique in-game content. The App Store listing cites 170+ multiplayer games. [From search snippets of these pages; not fetched in full.] — [AirConsole developer FAQ](https://developers.airconsole.com/faq-help); [App Store](https://apps.apple.com/app/airconsole/id1017688554)
- Hero-exclusive content rules (updated 26 Sep 2024):
  - Cosmetics are only for the Hero subscriber themselves.
  - Extra content and convenience features unlock for the whole session if at least one person is a Hero.
  - Exclusive content should add variety or convenience, never a "mechanical advantage".
  - — [AirConsole Hero Exclusive Content](https://developers.airconsole.com/hero-exclusive-content)

**AirConsole: developer economics and ads**
- There are no third-party ads and so no ad revenue. Ad breaks are AirConsole's own Hero promotions, shown on the screen and all controllers via `showAd()`, with `onAdShow` and `onAdComplete` callbacks so games pause and mute.
- "Every user's subscription revenue is split among the games that the user played", after App Store and infrastructure deductions. The percentage is not public on that page.
- AirConsole states that a Hero user typically spends about half their playtime in one favourite game.
- AirConsole frequently A/B tests the free and paid offering.
- (Updated 21 Nov 2024.) — [AirConsole Hero and revenue](https://developers2.airconsole.com/airconsole-hero-and-revenue)

**AirConsole: automotive pivot**
- BMW has partnered with AirConsole since 2022 across BMW and MINI models. VW launched it on the ID.7 in Europe (2024), with Passat, Tiguan and Golf planned. VW of America is bringing it to six 2027 models (incl. Atlas and Tiguan), tied to a $149/year "In-Vehicle Premium" plan. — [TheShopMag](https://theshopmag.com/news/airconsole-unveils-in-car-gaming-platforms-for-bmw-vw-models/); [Express & Star (2024)](https://www.expressandstar.com/news/motors/2024/08/27/volkswagen-confirms-airconsole-mobile-gaming-platform-will-arrive-in-select-ev-models-soon/); [Sovereign Magazine](https://sovereignmagazine.com/article/airconsole-volkswagen-2027-atlas-tiguan-in-car-gaming)

**Jackbox**
- The main Party Pack series is annual, with five games per pack. Party Pack 11 launched October 23, 2025 at $29.99 on Steam, Xbox, Switch, PlayStation, Epic, Apple TV, iPad, the Mac App Store and the Jackbox channel on Amazon Luna. — [Triple Point PR release](https://pressreleases.triplepointpr.com/md/jackbox-games-releasing-the-jackbox-party-pack-11-on-october-23-2025.md/); [Wikipedia](https://en.wikipedia.org/wiki/The_Jackbox_Party_Pack)
- Jackbox says players have joined its games "over 826 million times since December 2022" (May 2026 release). Party Pack 12 releases October 15, 2026 on PC, Switch/Switch 2, PS5, Xbox Series, Apple TV, iPad and the Mac App Store. — [Jackbox PP12 press release](https://indigo-pearl.prezly.com/the-party-returns-to-tens-of-millions-of-players-jackbox-games-announces-the-jackbox-party-pack-12); [GamingOnLinux](https://www.gamingonlinux.com/2026/05/the-jackbox-party-pack-12-announce-for-release-later-this-year/)
- Netflix offers "The Jackbox Party Essentials" through Netflix Games on TV; terms are undisclosed. Jackbox is also building its own smart-TV "streaming solution" on AWS GameLift Streams. It was announced April 2026, is due before the end of 2026, launches free and ad-supported with a "small collection" of games, and its stated aim is reaching people without consoles. — [CloudDosage, Aug 19 2026](https://clouddosage.com/jackbox-says-its-smart-tv-cloud-gaming-service-is-still-coming-in-2026/)
- Third-party Steam-only estimates (medium confidence): the original Party Pack at about 36.2K copies / $542.6K gross, and Party Pack 5 at about 53.7K copies / $966.7K gross. These are not official and exclude consoles. — [Raijin PP1](https://raijin.gg/app/331670/The_Jackbox_Party_Pack); [Raijin PP5](https://raijin.gg/app/774461/The_Jackbox_Party_Pack_5)

### Inferences
- The AirConsole App Store snapshot ($7.99 monthly next to a $29.99 lifetime) suggests heavy discounting toward longer commitments. The monthly price appears to have risen from $3.99 (2018) to $4.99 (about 2020) to $7.99 (2026 App Store), though the unlabelled tiers make this uncertain.
- AirConsole's "one subscriber unlocks the room" rule and Jackbox's "one copy, everyone plays from phones" model both put the purchase on the host, not each player. Gamer Gang's subscription should follow that convention: the TV/host pays and guests join free.
- AirConsole's per-playtime revenue split shows that subscribers concentrate on one favourite game (about 50% of playtime). That supports a single high-quality flagship such as Split Ways as the subscription driver, rather than a wide shallow catalogue.
- Jackbox moving onto Netflix and launching a free ad-supported TV service means "party games on your TV from phones" is becoming free or bundled. A paid subscription has to justify itself on depth and quality that free bundles lack.

### Gaps
- I could not confirm the current official AirConsole Hero monthly and yearly price on airconsole.com, or the current game count (170+ comes from a store-listing snippet).
- AirConsole's revenue-share percentage, subscriber numbers and revenue are not public in the sources found.
- Jackbox company revenue, Party Pack 11 sales and the Netflix deal terms were not found.

## 5. Lessons for positioning a premium racing game, and what makes a party platform "worth the money"

### Takeaway
Reviewers judge a phone-controller platform by the polish of its best games, not the size of its library. The main 2018-era criticisms of AirConsole Hero were a long tail of mediocre clones, frustrating free-movement games on touchscreens, and connection lag. A premium racing flagship has to be excellent on touch controls and latency, have enough variety to avoid "repetitive", and clearly beat the free and bundled alternatives.

### Cited Findings
- CGMagazine scored AirConsole Hero 7/10 at $3.99/month with 100+ games [OLDER, Aug 2018]. — [CGMagazine](https://www.cgmagonline.com/reviews/air-console-hero-review/)
  - Praised: simple-control trivia and drawing games; a few standouts (Golffriends, Dust Squad); a cheap way to host party play with only phones.
  - Criticised: many titles are "less than stellar" and stale after one session; some are clones (Bomberman- and Smash-likes); free-movement games are frustrating on touchscreens; lag and missed inputs on slow connections.
  - Verdict: none of the games "really stand out" enough to justify the subscription, and the reviewer pointed readers to the more polished Jackbox Party Pack instead.
- threejspunk feedback (Sept 2026): visually "beautiful" with "great handling" but "repetitive". The suggested fixes were more varied challenges and NPC voice acting. — [three.js forum](https://discourse.threejs.org/t/free-game-cyberpunk-inspired-game-realistic-graphics/94779)
- Jackbox's Kniaz frames its smart-TV push around removing barriers to play: no console, the TV people already own. — [CloudDosage](https://clouddosage.com/jackbox-says-its-smart-tv-cloud-gaming-service-is-still-coming-in-2026/)
- AirConsole forbids Hero-only "mechanical advantage" and allows cosmetics and convenience. — [AirConsole Hero Exclusive Content](https://developers.airconsole.com/hero-exclusive-content)

### Inferences
- Touch-only steering (the owner's decision) is exactly where reviewers said phone-controller platforms fail ("free-movement" games). Split Ways' touch input mapping, arcade assists and the 60 Hz WebRTC latency path are product-critical, not polish.
- For a subscription, "worth it" depends on (a) one or two standout games and (b) ongoing variety: new tracks, cars and events on a cadence. Jackbox's annual five-game packs and AirConsole's one-favourite-game data both suggest this.
- Paid perks should be content and convenience (more tracks and cars, 3-4 player split-screen, championships) and cosmetics, never paid performance. This matches AirConsole's rule and a Forza-style fairness expectation.
- Visual fidelity at a locked 60 fps on an ordinary laptop plus TV is a real differentiator, given that the most-played web racers are Unity WebGL portal games with modest visuals. It also creates a demo-able "wow" that free bundles (Netflix/Jackbox) do not offer in the racing genre.

### Gaps
- I found no 2024-2026 reviews of AirConsole Hero's value, so the main critical review is from 2018 and may be superseded.
- No published player surveys or retention data for phone-controller party platforms were found.
- No direct premium-racing-on-a-party-platform comparable was found (e.g. a paid racing title on AirConsole with public reviews).
