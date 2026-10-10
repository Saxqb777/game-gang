# Premium, Handcrafted TV Platform UI (Lobby, Game Picker, Menus, Results, Landing and Subscription Pages) That Avoids Generic AI-Generated Design

Scope: a "phones as controllers, TV as console" party game platform with a flagship racing game. React 19 + Vite; `/tv` runs fullscreen in Chrome on a MacBook connected to a 1080p or 4K TV; `/pad` is a separate phone page. The current UI (dark cards, orange/pink/purple gradients, Chakra Petch) is felt to look like AI slop. Research date: October 2026.

Note on sources: platform guidance (Apple, Microsoft, Google) was fetched directly. Console and racing-game material is mostly studio case studies and press coverage, because Sony, Nintendo and Polyphony publish little design documentation. Where a claim comes from a search-result summary rather than a page I fetched, I say so.

---

## 1. 10-foot UI fundamentals for TV: text sizes, contrast, overscan/safe areas, focus states, density, couch readability, 1080p vs 4K

### Takeaway
Apple, Microsoft and Google give closely matching guidance. Plan for a viewer about 10 ft away and a 1920×1080 logical canvas. Keep text and interactive elements about 5% in from the edges (Apple: 80 pt at the sides, 60 pt top and bottom), but let background imagery run to the edges. Body text should be about 29–30 px at 1080p, with a floor of about 23–24 px. Avoid light font weights, keep information density close to a phone's, and make focus unmistakable. The current `/tv` lobby breaks several of these rules: many labels are 0.8–1.15vw, which is about 15–22 px on a 1920-px-wide screen.

### Cited Findings

#### Viewing distance, density, principles
- Microsoft calls it the "10-foot experience" because "the user is generally sitting approximately 10 feet away from the screen." — [Microsoft Learn: Designing for Xbox and TV](https://learn.microsoft.com/en-us/windows/apps/design/devices/designing-for-tv) (archived UWP doc, page dated 2020, updated 2026-03-13)
- On density: "The amount of information displayed on a TV should be comparable to what you'd see on a mobile phone, rather than on a desktop." — [Microsoft Learn](https://learn.microsoft.com/en-us/windows/apps/design/devices/designing-for-tv)
- Microsoft's three principles. **Simple**: keep the design clean. **Coherent**: "Make the focus clear and unmistakable… Give people the shortest path to what they want to do." **Captivating**: "Edge-to-edge scenery, elegant motion, and vibrant use of color and typography take your apps to the next level. Be bold and beautiful." — [Microsoft Learn](https://learn.microsoft.com/en-us/windows/apps/design/devices/designing-for-tv)
- Moving from one edge of the screen to the other "should take no more than **six clicks**". Interactive elements should be at least **32 epx** tall, which is 64 px at 1080p. — [Microsoft Learn](https://learn.microsoft.com/en-us/windows/apps/design/devices/designing-for-tv)
- Microsoft advises avoiding tooltips on TV because they pop up whenever focus lands and "could be distracting". — [Microsoft Learn](https://learn.microsoft.com/en-us/windows/apps/design/devices/designing-for-tv)

#### Resolution and scaling (1080p vs 4K)
- Xbox renders apps at 1080p (1920×1080) "regardless of TV resolution". XAML apps are scaled 200%, so you design at 960×540 epx. HTML apps are scaled 150%, so you design at 1280×720. Microsoft says to double epx values to get real pixels, or multiply by 1.5 for HTML apps. — [Microsoft Learn](https://learn.microsoft.com/en-us/windows/apps/design/devices/designing-for-tv)
- tvOS point sizes "are based on 72 ppi for @1x and 144 ppi for @2x designs". — [Apple HIG: Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
- tvOS grid table: 2 columns at 860 pt wide, 3 at 560, 4 at 410, 5 at 320, 6 at 260, 7 at 217, 8 at 184, 9 at 160. Horizontal spacing is **40 pt** and minimum vertical spacing is **100 pt**, "to prevent overlap when an item comes into focus". — [Apple HIG: Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- With a 4K external display, macOS reportedly defaults to a HiDPI mode that "looks like 1920×1080" (effectively 200% scaling) while still sending 3840×2160. Picking "1920×1080 (low resolution)" sends a true 1080p signal, which looks soft on a 4K panel. "Looks like 2560×1440" renders at 5K and downsamples, which costs more GPU. These come from forums, not Apple documentation. — [MacRumors forum](https://forums.macrumors.com/threads/4k-monitor.2079449); [FredMiranda forum](https://www.fredmiranda.com/forum/topic/1915954/1/); [Evetech deep dive](https://evezone.evetech.co.za/deep-dives/macbook-1440p-vs-4k-scaling)

#### Safe areas and overscan
- Apple: "Inset primary content 60 points from the top and bottom of the screen, and 80 points from the sides… regardless of TV compatibility settings or overscan cropping." — [Apple HIG: Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- Microsoft: "draw only non-essential visuals within 5% of the screen edges". Keep essential UI 27 epx from the top and bottom and 48 epx from the sides, which is 54 px and 96 px at 1080p. Let backgrounds, nav panes and scrolling lists run to the edge for a "cinematic effect", but keep the focus visual and focused item inside the safe area. Boxing everything into the safe area "gives the app a 'boxed-in' effect". — [Microsoft Learn](https://learn.microsoft.com/en-us/windows/apps/design/devices/designing-for-tv)
- Android TV: margins of 48 dp left and right and 27 dp top and bottom (5%). Don't clip background art to the overscan-safe area. One current page says most modern TVs no longer overscan. Older preview-era docs swapped the axes, and a 58/28 dp figure also appears. This comes from a search-result summary of the [Android TV layouts page](https://developer.android.com/design/ui/tv/guides/styles/layouts), which I did not fetch directly.

#### Typography
- tvOS: default size **29 pt**, minimum **23 pt**. Built-in styles (size/line height, weight Medium unless noted): Title 1 76/96, Title 2 57/66, Title 3 48/56, Headline 38/46, Subtitle 1 38/46 (Regular), Callout 31/38, Body 29/36, Caption 1 25/32, Caption 2 23/30. The emphasized weight is Bold. — [Apple HIG: Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
- Apple says to avoid Ultralight, Thin and Light weights, which "can be difficult to see, especially when text is small". It recommends going above the minimum sizes when a custom font is thin. — [Apple HIG: Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
- Microsoft: main text at least **15 epx**, non-critical text at least **12 epx**. That is 30 and 24 px at 1080p for 200%-scaled apps, or 22.5 and 18 px for 150%-scaled HTML apps. — [Microsoft Learn](https://learn.microsoft.com/en-us/windows/apps/design/devices/designing-for-tv)
- Android TV says to "Prioritize using larger typography", "Maximize legibility by avoiding decorative fonts", and that "More personable fonts are best suited to bigger size text". Display styles are for "short, important text passages, or numerals", and you should not "use large display styles for section or cluster headings". — [Android TV: Typography](https://developer.android.com/design/ui/tv/guides/styles/typography)

#### Focus states
- On tvOS a focused item "stands out… through elevation to the foreground, illumination, and animation", usually with parallax. Because focus increases scale, you need assets at the focused size, and the bigger item must not crowd its neighbours. There are five states: unfocused, focused, highlighted, selected and unavailable. Highlighted gives "instant visual feedback… a button might briefly invert its colors and animate". — [Apple HIG: Focus and selection](https://developer.apple.com/design/human-interface-guidelines/focus-and-selection)
- "Avoid displaying a pointer… use the focus model when people navigate menus." "Avoid changing focus without people's interaction." — [Apple HIG: Focus and selection](https://developer.apple.com/design/human-interface-guidelines/focus-and-selection)
- "Include appropriate padding between focusable elements… an element gets bigger when it comes into focus." "Make partially hidden content look symmetrical." — [Apple HIG: Layout](https://developer.apple.com/design/human-interface-guidelines/layout)

#### Color and contrast
- TVs handle extreme intensities poorly. They can band, wash out or bloom. RGB values from **16 to 235** are "generally safe". Xbox has auto-scaled full-range content since the Fall Creators Update. — [Microsoft Learn](https://learn.microsoft.com/en-us/windows/apps/design/devices/designing-for-tv)
- "Don't assume colors will look exactly as they do on your monitor. If your app relies on subtle differences in color… colors could blend together." — [Microsoft Learn](https://learn.microsoft.com/en-us/windows/apps/design/devices/designing-for-tv)
- Xbox defaults to a dark theme because it is expected to be used more for media than productivity. — [Microsoft Learn](https://learn.microsoft.com/en-us/windows/apps/design/devices/designing-for-tv)

#### Current codebase (local files, for grounding)
- `client/src/tv/tv.css` sets TV font sizes in vw: 0.8, 0.85, 0.9, 1, 1.05, 1.1, 1.15 and 1.2vw (about 15.4–23 px at 1920 px wide). There are also `15px` labels. The lobby has `padding: 3.5vw 4vw` (about 67 px top/bottom and 77 px at the sides at 1920 wide). `.lobby-join` uses `backdrop-filter: blur(12px)`. Source: repo file `client/src/tv/tv.css`.
- `client/src/styles/global.css` sets `--font: 'Chakra Petch'` for all text and `--accent: #ff8a1f`. The wordmark is uppercase with 0.14em tracking. Source: repo file `client/src/styles/global.css`.

### Inferences
- **A canvas spec for `/tv` (derived):** Apple's grid works out exactly to a 1920-pt-wide canvas with 80-pt side insets: 2×860+40 = 3×560+2×40 = 1760 = 1920 − 2×80. Use a fixed **1920×1080 CSS-px stage** and scale it uniformly to the window with `transform: scale(min(innerWidth/1920, innerHeight/1080))`, rather than sizing fonts in vw. That way layout holds even when the window isn't exactly 16:9, for example when testing on the MacBook's 16:10 screen. On a 1080p TV, `devicePixelRatio` is 1. On a 4K TV in the default "looks like 1080p" mode it is 2, so DOM text is drawn crisply at 4K for free. Ship raster art at 2× (Apple's @2x = 144 ppi convention). Verify `innerWidth` and `devicePixelRatio` on the actual TV, because the macOS default comes from forum reports.
- **Type scale at 1080p (derived from Apple's table and Microsoft's minimums):** Display/numerals (race position, countdown, room code) 96–160 px. Title 57–76 px. Headline 38–48 px. Body 29–32 px. Caption 24–25 px. **Nothing below 23–24 px.** Use Regular, Medium or Bold weights; nothing lighter. In the current CSS, every label under about 1.2vw (23 px) should get bigger or be removed.
- **Safe area:** keep text, the QR code, the room code and focusable elements at least **96 px from the sides and 60 px from the top and bottom**. That is the stricter of Apple and Microsoft. Let backgrounds, the 3D scene and poster art bleed to the edges. HDMI output from a Mac to a TV can still be overscanned if the TV's picture-size setting isn't "Just Scan"/"Screen Fit". This is an inference; I found no source on Mac-specific overscan. An optional "edge check" screen in settings would be cheap insurance.
- **Focus:** even though input comes from phones, the TV still needs a focus state everyone on the couch can see. Use a scale of about 1.05–1.1, a high-contrast outline or "illumination" in the brand colour, a lift shadow, and a short sound. Leave Apple-style spacing (about 40 px horizontal, about 100 px vertical) so focused items can grow without overlapping. Show which player has control, for example "Host is choosing…" with that player's colour.
- **Density:** about one decision per screen, with no more than 6 focus steps from edge to edge. The game picker should be a short horizontal row of large posters, not a dense grid.
- **Colour:** keep UI colours inside 16–235 and avoid pure #000 and #FFF across large areas. Player colours must differ in lightness as well as hue, because TVs vary.

### Gaps
- Apple's "Designing for tvOS" overview page rendered empty, so the viewing-distance wording comes from Microsoft. The 1920×1080-pt canvas is inferred from the grid math.
- The Android TV type scale (sp values) exists only as an image, so I couldn't extract it.
- PlayStation's UX/TRC guidance isn't public. I found nothing citable.
- The macOS 4K default rests on forum sources, not Apple documentation.

---

## 2. What premium console UIs, racing-game menus and party platforms do well

### Takeaway
Premium systems treat the platform UI as a quiet, fast frame and let the content supply the spectacle. Nintendo optimised for speed, short animations and rhythmic sounds tied to movement. PS5 moved to an unobtrusive bottom bar and content cards. Forza Motorsport's menus are built from in-engine renders inside one strict graphic language, with a signature gold "ribbon". GT7 gives its menus a "sense of place" through a warm world map. Party platforms (Jackbox, AirConsole) build the whole lobby around a big URL and room code on the TV, with phones as controllers.

### Cited Findings

#### Console dashboards
- **Nintendo Switch OS (CEDEC 2018):** goals were "simple yet functional", separating games from apps, adjusting "size, colors, and density" so the screen is less crowded, simple rows and grids, and NES-like immediacy ("one switch flip and you're in the game"). The HOME menu's design resources were kept **under 200 KB** so it stays snappy. Speed came first: fewer actions to commit, and the cursor defaults to "Yes" when quitting a game. Sound effects were paired with movement, using **"rhythmic sound effects with no background music"**. Animations were "as short as possible while still feeling responsive". Text sometimes beats icons. "Cutting uncomfortable elements matters more than adding comfortable ones." — [Nintendo Wire on CEDEC 2018](https://nintendowire.com/news/2018/08/22/nintendo-talks-about-the-design-of-the-switchs-os-at-cedec-2018/) (reported via WSJ's Takashi Mochizuki; speakers not named)
- **Switch 2:** Nintendo published a video of its system sounds. Icons such as the eShop and GameChat have their own distinctive "cute" sounds. — [My Nintendo News](https://mynintendonews.com/2025/05/18/nintendo-shows-off-switch-2-unique-home-screen-sounds/); [GoNintendo](https://gonintendo.com/contents/48565-nintendo-shows-off-the-menu-sounds-of-the-switch-2)
- **Switch tap pitch (informal):** a 2017 observation that the HOME menu tap sound's pitch varies with the size of the surface touched. This is a fan finding, not a Nintendo statement. — [Nintenderos](https://www.nintenderos.com/2017/07/los-sonidos-del-menu-home-de-switch-varian-en-funcion-del-tamano-de-la-superficie-que-toques/)
- **PS5 (October 2020 reveal coverage):** the Control Center is a bottom bar that replaced the PS4's big left-side display. Activity cards help players jump straight into levels or challenges, some open picture-in-picture, and each shows an **approximate time to complete**. Sony stressed speed from a rebuilt software stack and called the footage pre-production. — [Tom's Guide](https://www.tomsguide.com/news/ps5-interface-revealed-sony); [Creative Bloq](https://www.creativebloq.com/news/ps5-ui-revealed); [Den of Geek](https://www.denofgeek.com/games/playstation-5-ui-demo-video-details/)
- **Apple TV:** focus through parallax, elevation, illumination and animation, with no pointer (see Q1). — [Apple HIG: Focus and selection](https://developer.apple.com/design/human-interface-guidelines/focus-and-selection)
- **Xbox:** "Simple / Coherent / Captivating", edge-to-edge scenery and an "unmistakable" focus (see Q1). — [Microsoft Learn](https://learn.microsoft.com/en-us/windows/apps/design/devices/designing-for-tv)

#### Racing games
- **Forza Motorsport (We Are Royale, external studio):** they started with "a graphic language that would allow for a wide variety of design styling while still holding true to Forza's sensibilities". Event posters come in several aspect ratios for different menu sections. Some share a global style per tour; others are bespoke to one race type. **"Each and every car featured on the poster is a captured render from the game."** Designers mocked up an angle, then matched camera, lens, lighting and car in a dev build, using a Forza dev kit at the studio. Over 300 parts were rendered for upgrades. Some posters became **looping animations** that start an in-game series, designed around high-contrast reflections on glossy paint. Track loading screens show graphic track maps from several angles, with the route as a **"vibrant gold ribbon"** matching the menu styling. Tuning screens use a "black and gold style". In total they delivered more than 800 assets (menus, maps, parts, logos, fake trackside ads). — [We Are Royale case study](https://weareroyale.com/case-studies/forza-motorsport/) (the page says "the next installment" without a year; LBB coverage is titled "We Are Royale revs Forza Motorsport into the future": [LBB Online](https://lbbonline.com/news/we-are-royale-revs-forza-motorsport-into-the-future))
- A Turn 10 UI/UX designer's portfolio covers track loading screens, "track ribbons" and onboarding modals for modes such as Builders Cup. — [Behance: Forza Motorsport UIUX Work](https://www.behance.net/gallery/193663367/Forza-Motorsport-UIUX-Work-Part-II-In-Game-Art) (from a search summary; not fetched)
- Territory Studio says Turn 10 brought it in "to help set the game's high level aesthetic language and movement concepts for the Forza series" (Forza Motorsport 5/6 era). — [Territory Studio](https://territorystudio.com/project/forza/) (from a search summary)
- **Gran Turismo 7:** preview coverage describes the return of the classic **World Map** as deliberately warm and "cozy" compared with the "cold and clinical menus" of recent entries, giving features "a sense of place". Map locations include Brand Central, the Café, Garage, Tuning Shop, License Center, Used Car Dealership, Scapes and World Circuits. In the Café, proprietor Luca talks you through cars as you complete 30+ "menu books". Yamauchi called the Café "a sort of road map to the things that you can do in the game". One review found the map easy but the menus inside each location "fiddly". Fans asked for background art showing each location. — [GTPlanet State of Play coverage](https://gtplanet.net/gt7-state-of-play-everything-new-20220202); [GamesRadar preview](https://gamesradar.com/gran-turismo-7-preview); [DualShockers on menu books](https://www.dualshockers.com/here-are-how-many-menu-books-gt7-cafe-mode-features/); [Use A Potion review](https://www.useapotion.com/2022/03/gran-turismo-7-playstation-5-review/); [GTPlanet forum](https://www.gtplanet.net/forum/threads/features-that-i-think-pd-should-implement-in-gran-turismo-7.401032). These come from search summaries of 2021–22 coverage; I did not check which URL each quote came from.
- **Forza Horizon 5 typography:** Microsoft and Playground Games have not published the in-game font names, so any specific font attribution is unconfirmed. — [Made Good Designs](https://madegooddesigns.com/?p=10598) (from a search summary)

#### Party platforms
- **Jackbox (official):** "Once you hit play, the game will open a lobby room." Players go to **jackbox.tv** on their phones and enter the room code shown on the host screen. Phones act as controllers. "Once everybody is in, with device in hand, launch the game from the host screen." — [Jackbox: How to play](https://www.jackboxgames.com/how-to-play)
- Third-party guides say the first player to connect becomes the **VIP**, who can start the game once everyone is in (unless a "Start Game from Controller Only" setting is on). They disagree on whether the code has 3 or 4 letters. These sources are low quality. — [The Wearify](https://thewearify.com/can-you-play-jackbox-online/)
- **AirConsole Hero page:** headline "Get more with AirConsole Hero". Benefits: unlimited players, no ad breaks, all games unlocked on PC, unique in-game content, early access. "One Hero in a session removes ad-breaks for everyone", and some Hero-exclusive games become available to everyone in a session when one Hero is connected. Purchase is in-app via Google Play or the App Store. — [AirConsole Hero](https://www.airconsole.com/hero)

### Inferences
- **"The platform is the frame; the game is the picture."** Switch, PS5 and Xbox keep system chrome quiet and fast and let game art provide the spectacle. Apply this here. Platform UI (lobby frame, settings, menus) should be restrained: one typeface family, neutral surfaces, one brand colour. Each game tile should be full-bleed **in-engine key art**, as Forza does, instead of the current `linear-gradient(135deg, #ff8a1f, #ff3b6b, #3a1c71)` card art in `client/src/games/registry.ts`.
- **Screen-by-screen patterns to adopt:**
  - **Lobby:** build it around the most distinctive artifact, the join. Use a huge room code (for example styled as a race number or number plate), a large QR code and a short URL, all inside the safe area. When a phone joins, a slot fills with a moment: that player's car rolls into a grid slot in the live 3D scene with their livery colour, number and name, plus a pitched "rev" or chime. Show who is host (the Jackbox VIP pattern) and a clear "Waiting for host to start" state. This combines Jackbox's flow with Forza's in-engine imagery.
  - **Game/track picker:** a short row of large posters rendered from the engine, with one focused poster expanded (animated loop or slow camera push, like Forza's looping posters). Show metadata PS5-style ("3 laps · ~4 min · 1–4 players"). Draw the track map as a single **signature-colour ribbon**, the Forza gold-ribbon idea, which can become a recurring brand device for progress and selection.
  - **Menus/settings:** few items, text labels over ambiguous icons (Nintendo), minimal steps to commit, default focus on the likely choice (Nintendo's default "Yes").
  - **Results:** 3D podium (`client/src/games/splitways/scene/podium.ts` already exists) followed by a timing table with tabular numerals and big position numbers. Then a one-tap "Rematch / Next track" vote on phones.
  - **Attract/idle:** after a period of inactivity, run a slow cinematic flythrough of the flagship track with the join code still visible. This is the console/arcade "attract mode" convention; I found no source on it, so treat it as an inference.
- **Sense of place (GT7):** a metaphor such as a seaside paddock or garage gives menus warmth. GT7's criticism shows the risk: keep the places as backdrops, not extra navigation layers.

### Gaps
- F1 25 menus, Steam Big Picture and the current Xbox dashboard: I found no design write-ups. Gameuidatabase.com (a screenshot library of game UIs) returned HTTP 403, so I couldn't verify its catalogue. A manual visit is worthwhile for racing lobbies and results screens.
- I couldn't locate GDC talks on Forza or GT UI. Jackbox's official page says little about how the lobby displays joining players. AirConsole's lobby visuals weren't researched.
- I found no primary source on PS5, Xbox or Apple TV menu sound design.

---

## 3. Patterns that make web UIs look generic or AI-generated, and what designers recommend instead

### Takeaway
"AI slop" is a recognisable set of defaults: Inter or another single default font, indigo/purple-to-blue gradients (traced to Tailwind's `bg-indigo-500`), gradient text, glassmorphism and `backdrop-blur`, centred heroes over three identical rounded cards, emoji or worn Lucide icons, the same fade-up on everything, count-up stats, and vague copy ("Elevate", "Seamless", "Get Started"). Critics now also flag second-order "tasteful" defaults: cream + terracotta, near-black + one acid accent, broadsheet layouts, all-caps mono labels, and Space Grotesk, Geist, Instrument Serif or Fraunces. The fix is to make real decisions that come from the product's own subject matter and artifacts. The current `/tv` UI uses several first-order tells.

### Cited Findings
- **925studios' list of tells:** Inter everywhere; an indigo-to-purple palette traced to Tailwind's indigo-500; a blue-to-purple gradient behind the headline and a gradient "Get Started" button; a dark hero "that could belong to any product"; "a row of three evenly spaced feature cards with rounded corners and soft shadows"; generic thin-line icons; "weightless headlines such as 'Build faster. Ship smarter.'" Fixes: "a typeface that carries a point of view", a palette built "from something true about the product", breaking the three-card reflex with asymmetry, and specific copy about who the product is for. — [925studios: AI Slop Fonts and Gradients](https://www.925studios.co/blog/ai-slop-design-tells)
- Tailwind creator Adam Wathan joked that he would "formally apologize for making every button in Tailwind UI bg-indigo-500 five years ago". 925studios quotes this without a link; search summaries date the post to August 2025 on X. — [925studios](https://www.925studios.co/blog/ai-slop-design-tells)
- **The avoid-ai-design catalogue (GitHub):**
  - *Typography:* "Inter used for every word"; the "tasteful free font" set of Space Grotesk, Geist, Instrument Serif and Fraunces; Roboto or the system stack with no display face.
  - *Colour:* purple/indigo gradients into blue; gradient headline text (`bg-clip-text`); untouched shadcn palettes; muted text below WCAG AA.
  - *Layout:* centred hero with two buttons and a three-card grid; the stock section order "hero, logos, features, stats, pricing, CTA"; "three-tier pricing with rings"; a four-column footer.
  - *Components:* `rounded-2xl shadow-lg` everywhere; "reflexive glass and `backdrop-blur`"; an icon inside a rounded square; stock Aceternity/Magic UI effects; a sparkle pill badge; missing focus states.
  - *Motion:* the same fade-up on every section; bounce easing; count-up stats; ignoring reduced motion.
  - *Icons, copy, imagery:* the "worn Lucide set"; emoji feature cards; "Elevate / Seamless / Powerful"; arrows on CTAs; "Get Started"; placeholder avatars.
  - *Consistency:* "design-system drift" between pages.
  - *Second-order tells:* cream + terracotta ("the Claude look"); near-black + one acid-green accent; "broadsheet cosplay"; all-caps mono "template chrome"; one accented word in the headline; decorative "01 / 02 / 03" numbering; fake window dots.
  - *Remedies:* build around "the product's most characteristic artifact" (their example makes a cohort table the hero), use a restrained palette, and write the direction into a `DESIGN.md` so every page follows it.
  — [GitHub: funboy322/avoid-ai-design](https://github.com/funboy322/avoid-ai-design)
- **Anthropic's frontend-design skill (public):**
  - *Tells to avoid:* "Accenting just a single word or phrase in a headline"; "Using all caps for labels"; "Adding unnecessary typographic labels above content"; the "SaaS-card kit: content chopped into identical rounded cards, one border-radius on everything regardless of hierarchy"; "fade-and-slide-up entrances on each section and hover transitions on every card"; "gradient washes as decoration"; the cream/terracotta and near-black/acid-accent defaults.
  - *Do instead:* "Choose your typefaces deliberately… use one family or two, and if two, make them clearly distinct"; set a clear type scale; "Spend your boldness in one place. Let one element be the memorable thing, keep everything around it quiet and disciplined"; "A single orchestrated moment — one page-load sequence or one reveal — lands better than scattered effects"; use motion when it "answers a person's action"; draw distinctive choices from "the subject's industry, subject matter, materials, and vernacular".
  — [GitHub: anthropics/skills frontend-design SKILL.md](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md)
- **Current UI against these tells (repo files):**
  - `tv.css` and `landing.css` paint two radial "glows", orange `rgba(255,138,31,…)` and purple `rgba(155,92,255,…)`, over near-black: a gradient wash used as decoration.
  - `.lobby-join` is a frosted panel (`backdrop-filter: blur(12px)`, 2vw radius): glassmorphism.
  - `.lobby-heading` and `.lobby-scan` are muted, uppercase labels tracked at 0.2–0.24em: all-caps label chrome.
  - Game card art is an orange→pink→purple CSS gradient instead of imagery (`client/src/games/registry.ts`).
  - One display face (Chakra Petch) is used for every role (`global.css`).

### Inferences
- **What specifically reads as "slop" in this UI:** gradient blobs; frosted glass panels; gradient "art" instead of real renders; uppercase tracked micro-labels; and one techno display font used for body text too. That last one is the same failure as "Inter everywhere", and Android TV specifically warns against decorative fonts for body text at distance. I found no source naming squared "gaming" faces such as Chakra Petch, Orbitron or Rajdhani as AI tells; the judgment that they read as a template "gaming" default is my inference.
- **Anti-slop rules for this platform** (worth writing into a `DESIGN.md`, per avoid-ai-design):
  1. No CSS gradient as content. Every game, track, mode and result image is an **in-engine render** (Forza's approach) or a real photo or video of people playing.
  2. No glass or `backdrop-filter` panels. Use solid, opaque surfaces with clear hierarchy (this also helps performance; see Q4).
  3. Two typefaces at most. (a) A **display face** with real character, used only large: race numbers, positions, countdown, room code, titles. (b) A **highly legible text face** with tabular numerals for lap times, used at 29 px or more. Don't fall back to Inter or the "tasteful free" set (Space Grotesk, Geist, Instrument Serif, Fraunces). Consider a commissioned or customised wordmark and numeral set. A distinctive numeral set is a cheap way to own the look of a racing game.
  4. One brand colour used decisively, not a three-hue gradient. Player colours form a separate, purpose-built set (see Q6).
  5. Corner radii vary by hierarchy: big poster surfaces sharp or near-square, small chips rounded. Don't use one radius everywhere.
  6. Copy is specific and spoken: "Scan to join — no app needed", "Waiting for Sam to start", "Corniche Run · 3 laps · about 4 min". Avoid "Elevate your game night".
  7. Labels in sentence case; no tracked all-caps eyebrows above every block.
- **Art-direction options grounded in the product** (follows the skill's advice to use the subject's own vernacular):
  - (A) **Race-weekend broadcast:** timing-tower tables, start-light countdown, number boards, livery stripes per player, tabular numerals. Risk: near-black plus one neon accent (a second-order tell). Mitigate with full-colour renders and daylight scenes.
  - (B) **Coastal grand tour**, matching the flagship "Corniche Run" track: sunlit Mediterranean blues, asphalt and paint-white road markings, poster compositions in the tradition of vintage Grand Prix and rally posters, built from in-engine renders. Risk: drifting into cream + terracotta. Keep colour from the actual scene (sea, sky, asphalt, livery) rather than a beige "editorial" palette.
  - (C) **Toy garage / couch party:** chunky shapes, tactile sounds, playful avatars, leaning into the party side. Risk: looking cheap next to the realistic car rendering.
  - Recommended: a quiet, ownable platform frame (Q2) plus (B) as the flagship game's art direction. That gives a premium look from realistic rendering and daylight colour, which most dark/neon "gaming" templates don't use.

### Gaps
- I found no study measuring how users judge "AI-generated looking" interfaces. The tells come from practitioners and agencies, some with a commercial interest (925studios is an AI design agency).
- I found no source on AI tells specific to game or console UI (techno fonts, neon on black, HUD-style corner brackets).

---

## 4. Motion and implementation: CSS/WAAPI vs Motion vs GSAP vs Rive/Lottie; 60 fps alongside WebGL; live 3D lobby vs 2D

### Takeaway
Animate only `transform` and `opacity` (plus small `filter`/`clip-path`) so the compositor can run the animation even while the game loop keeps the main thread busy. Avoid large blurs and `backdrop-filter`, and don't animate global CSS variables. Use Motion (WAAPI-backed where possible) for React UI transitions. GSAP has been completely free since April 2025, but it is driven by requestAnimationFrame on the main thread, so keep it for lobby and results sequences rather than gameplay overlays. Rive suits interactive brand and character animation. A live 3D lobby in react-three-fiber/three is viable if it renders on demand, adapts DPR, and reuses the game's renderer and assets.

### Cited Findings
- **Motion's "Web Animation Performance Tier List"** (Matt Perry, Motion's author, 2025-11-05):
  - *Tiers:* S-tier properties run entirely on the compositor: `transform`, `opacity`, `filter`, `clip-path`. C-tier triggers paint: `background-color`, `color`, `border-radius`, SVG attributes, CSS variables. D-tier triggers layout: `width`, `margin`, `top`. F-tier is layout thrashing, "the cardinal sin of web animations".
  - *rAF libraries:* libraries driven by requestAnimationFrame (GSAP is named) run on the main thread and are "vulnerable to jank whenever the main thread gets blocked".
  - *Blur:* cost "can escalate sharply" with radius and layer size. Framer warns at blur values over 10px. "90% of performance issues" are often a large `filter: blur`.
  - *CSS variables:* changing one "will always trigger paint" on affected elements. One "inheritance bomb" case had 1300+ elements recalculating at about 8 ms per frame.
  - *What Motion does:* it animates WAAPI-eligible values (such as `opacity`) through the Web Animations API, so they "stay smooth when the main thread is busy". Independent transforms (`x`, `y`, `scale`) are driven from JS on the main thread. Layout animations use FLIP. Motion does not set `will-change` automatically. The article recommends using IntersectionObserver to pause off-screen animations.
  — [Motion blog](https://motion.dev/blog/web-animation-performance-tier-list) (vendor source)
- **GSAP:** Webflow, which acquired GSAP in late 2024, announced on April 30, 2025 that GSAP is "100% free" for everyone, including the former Club plugins (SplitText, MorphSVG and others) and commercial use. SplitText was rewritten (described as 50% smaller with built-in screen-reader accessibility and masking). The `gsap-trial` package is deprecated. — [Webflow blog](https://webflow.com/blog/gsap-becomes-free); [GSAP 3.13 release notes](https://gsap.com/blog/3-13/)
- **Rive vs Lottie:**
  - *File size:* Rive's and LottieFiles' own blogs both say a `.riv` file is typically **10–15× smaller** than an *uncompressed* Lottie JSON (for example 240 KB vs 16 KB), and that dotLottie narrows the gap. — [LottieFiles blog](https://lottiefiles.com/blog/lottie-animations/lottiefiles-or-rive); [Rive blog](https://framer.rive.app/blog/rive-as-a-lottie-alternative)
  - *Runtime:* in one React Native test by Callstack, Lottie ran at about 17 FPS and Rive at about 60 FPS. Memory was 246 MB for Lottie vs 276 MB for Rive. — [Callstack](https://callstack.com/blog/lottie-vs-rive-optimizing-mobile-app-animation)
  - *Interactivity:* Rive has native state machines, and LottieFiles added a state machine to Lottie Creator in late 2025 (per a search summary). Treat the ratios as vendor claims; Callstack's test is a single case.
- **react-three-fiber performance:**
  - *Render on demand:* `<Canvas frameloop="demand">` renders only when something changes, and `invalidate()` requests a frame for changes React can't see.
  - *Reuse and draw calls:* share geometries and materials. Keep draw calls to "no more than 1000 as the very maximum, and optimally a few hundred or less". Use `instancedMesh` and LOD (`<Detailed>`).
  - *Adaptive quality:* `PerformanceMonitor` adjusts DPR, for example starting at 1.5, dropping to 1 when FPS declines and rising to 2 when it recovers. `regress()` lets you lower quality while the camera moves.
  - *Scheduling:* `startTransition` keeps heavy work from stalling frames. Their benchmark showed about 60 fps vs 5–20 fps.
  — [R3F docs: Scaling performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance)
- **Nintendo:** animations "as short as possible while still feeling responsive"; sound paired with movement. — [Nintendo Wire on CEDEC 2018](https://nintendowire.com/news/2018/08/22/nintendo-talks-about-the-design-of-the-switchs-os-at-cedec-2018/)
- **Motion as an AI tell:** the same fade-up everywhere, bounce easing, count-up stats, and ignoring reduced motion are flagged as tells. A "single orchestrated moment" and motion that "answers a person's action" are recommended instead. — [avoid-ai-design](https://github.com/funboy322/avoid-ai-design); [Anthropic frontend-design skill](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md)
- **Real renders:** Forza's menu posters are captured in-engine renders, and some are looping animations. — [We Are Royale](https://weareroyale.com/case-studies/forza-motorsport/)

### Inferences
- **Suggested split by layer:**
  1. **During gameplay** (HUD, countdown, position changes, item pop-ups): CSS transitions or keyframes, or Motion with WAAPI-eligible values. Use the full `transform` property rather than independent `x`/`scale`, so animations keep running on the compositor while Rapier and three.js occupy the main thread. Don't run GSAP timelines over live gameplay.
  2. **Lobby, picker and menus:** Motion for React state transitions, shared-element moves (focused poster expanding into the track-detail view) and staggered player-join reveals.
  3. **Scripted sequences** (boot/sonic logo, results podium reveal, attract-mode titles): GSAP timelines are fine here because the main thread is lightly loaded and GSAP is now free. Motion's `animate` sequences would also work, so avoid adding a second library unless the timelines get complex.
  4. **Brand and character animation** (animated logo, player avatars reacting to join, ready, win or lose, and the matching phone screens): Rive, whose state machines can be driven by game events, with small files. Lottie only for non-interactive one-offs.
- **Keeping 60 fps with a WebGL scene behind the DOM:**
  - *No `backdrop-filter` over the canvas.* My inference is that a blur sampling a canvas that changes every frame has to be recomputed every frame. Use solid or semi-opaque fills, or a pre-blurred texture drawn inside WebGL.
  - *Keep overlays small and promoted only while animating* (`will-change` sparingly), avoid large box-shadow animations, and never animate layout properties.
  - *Avoid global CSS variables that change per frame,* such as a `--speed` driving many elements. Set `transform` directly on the target elements.
  - *Cap WebGL resolution independently of `devicePixelRatio`.* On a 4K TV in HiDPI mode, DPR 2 means four times the pixels. Render the 3D scene at DPR 1–1.5 with `PerformanceMonitor` while the DOM text stays at native 4K sharpness. A 1080p-equivalent 3D render under crisp 4K UI text will look premium.
- **Live 3D lobby vs 2D:**
  - *Use live 3D for the lobby hero.* A "showroom" with the actual car or cars on a turntable, or the grid slots filling as players join, is the strongest anti-slop signal because no template can produce it. Reuse the game's renderer, HDRI and car assets so the lobby also loads the assets and warms up shader compilation before the race (both inferences). Run it at a reduced cost: `frameloop="demand"` with a slow, capped camera move, or a capped frame rate, low DPR and no heavy post-processing.
  - *Use 2D posters for picker tiles.* Several live scenes at once multiply draw calls. Render poster stills and short loops offline from the engine, Forza-style, and play them as images or video.
  - *Results:* live 3D podium, then a 2D timing table.
- **Motion system tokens** (inference; I found no source with exact durations): focus move about 120–160 ms, ease-out. Select/confirm about 180–250 ms, with a short scale-down-and-release "press". Screen-to-screen about 300–450 ms, always the same direction metaphor. One hero moment per screen about 0.8–1.5 s (player car arriving, podium reveal). No bounce easing on UI. Respect `prefers-reduced-motion` on the landing page and phone page.

### Gaps
- I found no benchmark for DOM overlays plus a WebGL canvas in Chrome on macOS feeding a 4K TV. Validate with Chrome DevTools Performance and the FPS meter on the actual hardware.
- Exact motion durations above are not sourced. The Motion article is written by a library vendor. The Rive/Lottie numbers are mostly vendor claims plus one independent mobile test.

---

## 5. Landing page and subscription/pricing page best practices for game subscriptions

### Takeaway
Leading game-subscription pages (Apple Arcade, Xbox Game Pass) lead with real game art, a few concrete promises ("No ads. No in-app purchases."), a free trial or low entry price, sharing or "whole household" value, and an FAQ that answers cancellation and compatibility questions. AirConsole Hero's page has a strong, unusual party-specific promise: one subscriber unlocks the room for everyone. The page itself is thin: no trust signals and an unclear price. Mobile subscription data favours trials and paywalls over open freemium, plus annual plans that are pre-selected. That data is mobile-app data, not web/TV.

### Cited Findings
- **Apple Arcade page:**
  - *Hero:* "Fun for all. All on iPhone." and "Enjoy hundreds of games." The hero image is a collage of real game art. CTA: "Get started".
  - *Value bullets:* play online or offline; "No ads. No in-app purchases. No interruptions."; share with up to five people.
  - *Offers:* "Subscribe and save." with "3 months free" with a new device, "1 month free" with Apple One, and $6.99/mo.
  - *Showcase and FAQ:* "Action. Adventure. Puzzles. Let the gaming begin." with a featured game card. "Play across your devices." A 7-item FAQ covers which games are included, how often new games arrive, pricing, controllers, and whether **progress is kept after cancelling**. Legal fine print sits in the footer.
  — [Apple Arcade](https://www.apple.com/apple-arcade/)
- **Xbox Game Pass (October 2025 restructure):** three tiers.
  - *Essential:* $9.99, replaces Core, about 50 games.
  - *Premium:* $14.99, replaces Standard, 200+ games, PC and cloud; Xbox-published games arrive within a year of launch.
  - *Ultimate:* $29.99, up from $19.99, 75+ day-one releases a year, 400+ titles.
  — [GamesBeat](https://gamesbeat.com/xbox-upgrades-game-pass-tiers-and-raises-the-ultimate-price/); [Stevivor](https://stevivor.com/features/in-depth/xbox-game-pass-changed-again-new-expensive-tiers-detailed); [tbreak](https://tbreak.com/xbox-game-pass-price-increase-50-percent-ultimate-2999/) (not checked against Microsoft's own page)
- **AirConsole Hero page:**
  - *Structure:* "Get more with AirConsole Hero", then pricing (yearly/monthly), benefits, and a 5-question FAQ (getting Hero, sharing, cancelling, exclusive content, billing). CTAs: "Get AirConsole Hero now" and "Try AirConsole now". Purchase is in-app only.
  - *Trust signals:* none, meaning no ratings, press or user counts.
  - *Price:* rendered ambiguously ("Yearly for 59.99" under the monthly heading). The page also contains a typo ("Unlitmited players").
  — [AirConsole Hero](https://www.airconsole.com/hero)
- **AirConsole history:** a free version limited by "games, number of players, and rounds"; Hero was PHP 249/month or PHP 629/year in the Philippines in 2021, and about $4.99/month in the US in 2020. — [ABS-CBN (2021)](https://corporate.abs-cbn.com/newsroom/news-releases/2021/5/18/sky-fiber-subs-get-free-access-to-airconsole-hero?lang=en); [TheGamer (2020)](https://www.thegamer.com/airconsole-free-browser-games-quarantine/)
- **Subscription benchmarks (mobile apps, all categories):**
  - *Scale:* RevenueCat's 2025 report covers 75,000+ apps and $10B+ in revenue.
  - *Price:* higher-priced apps have a median conversion of **9.8% vs 4.3%** for low-priced ones (funnel step not specified in the summary).
  - *Annual churn:* **30% of annual subscribers cancel within the first month.**
  — [RevenueCat State of Subscription Apps 2025](https://revenuecat.com/state-of-subscription-apps-2025) (from a search summary)
  - *Paywall type:* median hard-paywall apps convert **10.7%** to paid by day 35, vs **2.1%** for freemium. This is from a RocketShip HQ summary of RevenueCat data; the edition is unclear.
  - *Trial length:* trials of 17–32 days convert **42.5%** to paid vs **25.5%** for trials of 4 days or less. — [SaaStr on RevenueCat's 2026 edition](https://saastr.com/the-top-10-learnings-from-revenuecats-state-of-subscription-apps-how-115000-mobile-apps-deliver-16b-in-revenue-whats-working-whats-quietly-killing-growth)
  - *Default plan:* pre-selecting the annual plan gave a **69%** annual take rate vs **28%** when monthly was the default (Adapty 2025 benchmarks, via RocketShip HQ).
  - The paywall-type and default-plan figures came through search summaries of two RocketShip HQ posts, and I couldn't tell which post carries which figure. — [RocketShip HQ post A](https://www.rocketshiphq.com/?p=5478); [RocketShip HQ post B](https://www.rocketshiphq.com/?p=6000)
- **Landing-page AI tells to avoid:** the stock section order "hero, logos, features, stats, pricing, CTA", "three-tier pricing with rings", count-up stats, "Get Started" CTAs, arrows on CTAs, emoji feature cards and placeholder avatars. — [avoid-ai-design](https://github.com/funboy322/avoid-ai-design)

### Inferences
- **Landing page blueprint** (built around the product's most distinctive artifact, a TV plus phones in a real room):
  1. **Hero:** full-bleed video or in-engine footage of the flagship race on a TV, with real phones in hands in the foreground. Headline names the mechanic concretely, for example "Your TV is the console. Your phones are the controllers." Primary CTA "Start a game on this screen" opens `/tv`. Secondary CTA "How it works".
  2. **How it works:** three real steps, each illustrated with an actual screenshot or photo, not icons. Open on a big screen → scan the code → race. Say plainly "No app. No console. No download."
  3. **The flagship game:** one editorial section (poster renders, track map ribbon, a short loop), not a feature-card grid.
  4. **Pricing** (see below).
  5. **FAQ:** devices needed, number of players, whether everyone needs a subscription (answer: no), cancel anytime, what happens to progress, latency and Wi-Fi.
  6. **Trust:** real gameplay capture, secure payment provider, a clear refund/cancel policy and contact details. Add press quotes, ratings and player counts only once they genuinely exist. Never fabricate them.
- **Pricing structure:**
  - *Free tier:* the flagship game playable with limits, for example a few tracks, a player cap or round limits. This follows AirConsole's historical limits.
  - *Paid tier:* everything unlocked, unlimited players, no ads, new games and tracks. Main promise: **"One pass unlocks the whole room."** AirConsole precedent shows this is the strongest party-specific value proposition, because only the host pays.
  - *Plans:* monthly and annual, with **annual pre-selected** and showing real savings. A free trial of 1–4 weeks fits a game-night cadence (trial-length data above). A two-option toggle reads less "template" than a three-tier ring layout.
  - *Copy:* specific ("Unlock all tracks for everyone on your couch"). Show the price per month for annual plans. Put "Cancel anytime" next to the button.
- **Where checkout happens:** the TV is a poor place to type card details. Offer "Scan to subscribe on your phone" (a QR code on the TV paywall) plus the web pricing page. This is an inference consistent with the product's phone-as-controller model.

### Gaps
- AirConsole Hero's current price couldn't be read reliably. Jackbox's pricing model (one-time Party Packs) wasn't researched.
- I found no subscription conversion data for games or web/TV. The RevenueCat and Adapty figures are mobile, all categories, and partly come from third-party summaries.
- I didn't fetch the Xbox Game Pass marketing page itself, so its layout and section order aren't covered.

---

## 6. Branding for a party game platform: name, logo/wordmark, colour systems, sound identity

### Takeaway
Distinctive brands come from something true about the product, applied consistently and written down. Here that truth is: TV plus phones, friends on a couch, racing. The most-seen brand touchpoints are the join URL and room code (Jackbox's `jackbox.tv` pattern), the wordmark, a signature colour, and the sound kit. Nintendo shows that short, rhythmic UI sounds tied to motion can carry a platform's identity. A sonic logo should run 1–3 seconds and work on both TV and phone speakers.

### Cited Findings
- **Colour from the product:** "Build a deliberate palette from something true about the product." Linear, Stripe and Duolingo are cited as distinctive identities to learn from, not copy. — [925studios](https://www.925studios.co/blog/ai-slop-design-tells)
- **Distinctiveness from the subject:** distinctive choices should come from "The subject's industry, subject matter, materials, and vernacular". "Spend your boldness in one place." — [Anthropic frontend-design skill](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md)
- **Consistency:** fonts, colours, radii, nav or footer that change between pages ("design-system drift") read as AI-made. Write the direction into a `DESIGN.md`. — [avoid-ai-design](https://github.com/funboy322/avoid-ai-design)
- **The URL is part of the brand:** Jackbox players go to **jackbox.tv** and type the room code shown on the TV. — [Jackbox: How to play](https://www.jackboxgames.com/how-to-play)
- **Sound identity, consoles:** Nintendo paired sound effects with movement and used "rhythmic sound effects with no background music" in the HOME menu. — [Nintendo Wire](https://nintendowire.com/news/2018/08/22/nintendo-talks-about-the-design-of-the-switchs-os-at-cedec-2018/) Switch 2 gives icons their own distinctive sounds. — [My Nintendo News](https://mynintendonews.com/2025/05/18/nintendo-shows-off-switch-2-unique-home-screen-sounds/) Microsoft says sounds "play a key role in the 10-foot experience" for immersion and feedback, and UWP turns on sounds for common controls automatically on Xbox. — [Microsoft Learn](https://learn.microsoft.com/en-us/windows/apps/design/devices/designing-for-tv)
- **Sonic logos:**
  - *Length:* usually a 1–3 second sound that identifies the brand "without a single word or image". — [Oakgen sonic logo guide](https://oakgen.ai/blog/sonic-logo-guide)
  - *Variants and testing:* make the motif in several lengths for different placements, and test it "everywhere from TV to a phone speaker". — [IRPR Sound guide](https://sounddesign.irpr.agency/guides/how-to-design-a-sonic-logo/)
  - *Example with animation:* Resmed's brand sting runs 5 s, including about 1.5 s of resting silence and animation. — [Resmed brand sting](https://brand.resmed.com/brand-sting)
- **Colour on TVs:** use colours "different enough" to tell apart on any TV, within RGB 16–235. — [Microsoft Learn](https://learn.microsoft.com/en-us/windows/apps/design/devices/designing-for-tv)

### Inferences
- **Name and URL:**
  - *Sayable across a room:* short (1–2 syllables per word), easy to spell after hearing it once, and owning a short domain players will type: "go to ___.tv / ___.gg". The URL plus room code is read aloud at every session, so test it by shouting it across a room.
  - *Room codes:* uppercase, with no ambiguous characters (no O/0, I/1).
  - *Collision check:* avoid names close to Jackbox or AirConsole.
- **Logo and wordmark:**
  - *Custom-drawn:* a wordmark drawn for the brand, not a font typed in caps with wide tracking (the current `.wordmark` approach).
  - *Hero mark:* consider a mark built from the core mechanic, such as a phone that is also a steering wheel or controller, or the TV and phones as a group.
  - *Simplified variant:* small enough for the phone pad header and a favicon.
  - *Separate game marks:* each game, the flagship included, gets its own title treatment under the platform's graphic language, as Forza does with event posters under one system.
- **Colour system:**
  - *Base:* deep neutrals that aren't pure black, plus off-white text.
  - *One signature brand colour:* tied to a brand idea, for example the racing-ribbon colour used for selection, progress and the track ribbon, as Forza uses gold.
  - *Player colours:* 4–8 designed as a set. Each must be distinct in lightness and hue on cheap TVs, pass colour-blind checks, and be backed by number and shape (race number, slot position), so colour never carries meaning alone.
  - *Per-game palettes:* sub-palettes that sit under the platform palette.
  - *Retire:* the orange→pink→purple gradient entirely.
- **Typography system:** one display face (titles, numerals, room code) and one text face, ideally licensed for web use. A custom or customised numeral set is a high-value, low-cost distinctive asset for a racing platform.
- **Sound identity kit:**
  1. Sonic logo, 1–3 s, on boot and the attract loop, with 0.5 s and 3 s variants.
  2. Focus tick, select, back and error, all very short and from one consistent "material". Options: mechanical (gear-lever clack, indicator tick, tyre chirp) or musical (one instrument family), with Nintendo's rhythmic approach.
  3. Player join, a rising note pitched per slot so a full lobby plays a chord.
  4. Ready-up and countdown, start-light beeps.
  5. Win and podium sting.
  - *Testing:* make sure sounds read on TV speakers and phone speakers.
  - *Music:* low-key lobby music is optional. Nintendo's no-BGM choice suggests silence plus rhythmic SFX can feel more premium than generic stock music.
  - *Engine sound:* the flagship game's engine audio can double as brand sound, for example a rev blip as the join sound.

### Gaps
- I found no case studies of party-game platform identities (Jackbox, AirConsole, Kahoot logo or brand systems), no research on naming party platforms, and no primary documentation of PlayStation or Xbox UI sound identities.
- The material.io sound-design guidelines (UI sounds, hero sounds, brand sounds) failed to render (JS-only page), so the formal taxonomy of product sound categories is missing.
- Sonic-logo length guidance comes from sound-design vendors, not independent research.
