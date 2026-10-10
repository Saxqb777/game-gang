# Phone touch controller UX for a TV racing game (touch-only, no tilt)

Scope: each player's phone is the gamepad for a three.js split-screen racer (1-4 players) on a TV. Phones join through a QR code web page and send inputs over WebRTC data channels at about 60 Hz. Tilt/gyro steering is being removed. Research date: October 2026.

Context from the local repo (for the report writer): the pad currently offers only two steering modes, `'tilt' | 'buttons'` ([client/src/pad/profile.ts](/home/user/game-gang/client/src/pad/profile.ts)). Haptics go only through `navigator.vibrate` ([client/src/pad/device.ts](/home/user/game-gang/client/src/pad/device.ts)). Fullscreen plus a guarded `screen.orientation.lock` and a wake lock that is re-requested on `visibilitychange` are already in place (same file). The input channel is already `ordered: false, maxRetransmits: 0` ([client/src/net/rtc.ts](/home/user/game-gang/client/src/net/rtc.ts)). Per the project brief, players could not find reverse, which works by holding brake at a standstill.

## 1. Touch steering without tilt: which methods give fine control, how mobile racers do it, and which assists to pair with them

### Takeaway
No shipped mobile racer bets on one touch scheme. They ship a casual scheme (digital left/right arrows or tap-the-screen-sides, almost always with auto-accelerate and assists) and a precision scheme (analog drag or wheel steering that appears under the thumb). For a TV game where players' eyes stay on the TV, the evidence points to a floating, relative horizontal drag-steer as the default analog method, with large digital arrows as the simple option. Both should feed game-side smoothing: speed-sensitive steering, a rate limit, a response curve and auto-centring.

### Cited Findings
**Shipped mobile racers**
- GRID Autosport (Feral, mobile) ships Tilt, Tilt Pro, Wheel Touch, Wheel Touch Pro, Arrow Touch and Arrow Touch Pro. In Wheel Touch you "steer by rotating the on-screen wheel, which appears when you hold down on the left side of the screen". The wheel is a floating control that spawns under the thumb. "The Wheel Touch Pro controls are more sensitive but allow for more precise handling." — [Feral GRID Autosport FAQ](https://www.feralinteractive.com/en/faqs/gridautosport/latest/ios/)
- GRID's Arrow Touch puts left/right arrow buttons on either side of the screen. Acceleration is automatic, you hold anywhere to brake, and the scheme is offered only on Rookie/Professional difficulty with automatic transmission. Arrow Touch Pro lets you "enable manual throttle control by moving both steering arrows to the left of the screen" and adds a throttle slider on the right. A "Mirrored Mode" swaps the sides. — [Feral GRID Autosport FAQ](https://www.feralinteractive.com/en/faqs/gridautosport/latest/ios/)
- A GRID update added Arrow Touch Pro, described as a "much-requested alternative layout", and a Throttle Slider for setting acceleration "with pinpoint precision". — [The Mac Observer](https://www.macobserver.com/cool-stuff-found/grid-autosport-game-controls/)
- A review called GRID's touch and tilt controls "very well-implemented", with "very nice vibration feedback", but said they never felt as in control as console racing games. — [Operation Sports](https://www.operationsports.com/ios-grid-autosport-truly-console-quality/)
- Another review found that GRID's tilt steering took a while to learn even in Rookie mode. — [MacStories](https://www.macstories.net/reviews/game-day-grid-autosport/)
- Asphalt 9's TouchDrive steers the car along the racing line for you. The player chooses when to brake, drift and boost, and picks routes at branch points. It was pitched at newcomers and also allows one-handed play. — [TouchArcade, June 2018](https://toucharcade.com/2018/06/19/asphalt-9-legends-wants-to-make-insane-driving-as-easy-as-possible/)
- Asphalt guides warn that TouchDrive players struggle in multiplayer against Tilt/Touch players, who "steer more precisely". They also say that with tap steering "it is quite difficult to drift", and call tilt "the most difficult, but also the most effective" setting. — [TouchTapPlay Asphalt 9 controls guide](https://www.touchtapplay.com/asphalt-9-controls-settings-guide/); [SuperCheats TouchDrive](https://www.supercheats.com/android/asphalt-9-legends/1414/touchdrive/). My search results did not separate which quote came from which guide, and both date from the 2018 launch.
- Real Racing 3 originally defaulted to accelerometer (tilt) steering, with a tap to brake. Steering assist, brake assist and traction control were on by default and could be turned off. — [Android Police review, 2013](https://www.androidpolice.com/2013/03/06/real-racing-3-review-there-is-a-good-game-in-here-somewhere/)
- Mario Kart Tour's default steering is dragging a finger across the screen, with gyro as an option. "Smart Steering" adds automatic acceleration and steers the kart away from walls, and its intensity is adjustable. — [Super Mario Wiki](https://www.mariowiki.com/Mario_Kart_Tour). Its control settings include Manual Drift, Smart Steering, Auto-item and Gyro Handling. — [Pocket Gamer](https://www.pocketgamer.com/mario-kart-tour/mario-kart-tour-cheats-tips-custom-control-settings-for-victory/)
- Need for Speed No Limits steers by default when you tap or hold the left or right side of the screen, and offers tilt and a swipe-based "virtual steering" option. The car accelerates automatically. Swipe up for nitro. Drift gestures differ by source: swipe down, or hold the bottom of the screen. — [Level Winner](https://www.levelwinner.com/need-for-speed-no-limits-beginners-guide-tips-cheats-strategies-to-level-up-fast-and-win-more-races/); [TouchTapPlay](https://www.touchtapplay.com/how-to-drift-like-a-pro-in-need-for-speed-no-limits/); [GamersHeroes](https://www.gamersheroes.com/game-guides/need-for-speed-no-limits-guide-how-to-drift/)

**Platform guidance on sticks and pads**
- AirConsole's guideline: "Do not use d-pads and virtual joysticks." Free movement with them feels worse than with a gamepad. With no tactile feedback, fingers slip off targets unnoticed, so larger targets reduce frustration. — [AirConsole: Smartphones as Controllers](https://developers.airconsole.com/smartphones-as-controllers)
- The AirConsole team also writes that even a well-built digital d-pad or joystick "is not ideal". One of their games (Balloon Party) made a d-pad work by splitting it "into two two-button pads controlled by two thumbs". — [Game Developer, Alice Ruppert (AirConsole), 1 Mar 2016](https://www.gamedeveloper.com/design/airconsole---using-smartphones-as-controllers)
- Microsoft's Xbox touch guidance says a relative joystick (its origin is where the touch began) is more familiar to gamepad players. A non-relative (absolute) joystick "can provide a higher skill ceiling by allowing players to more quickly apply their desired input without always needing to drag". When speed depends on how far the stick is pushed, it recommends a relative stick, because "Non-relative joystick doesn't work well in the situation where a player needs to gradually change the input". Its sample joysticks use a radial dead zone threshold of 0.05. — [Microsoft GDK: A designer's guide to building touch controls (TAK)](https://learn.microsoft.com/en-us/gaming/gdk/docs/features/common/game-streaming/building-touch-layouts/game-streaming-tak-designers-guide?view=gdk-2604)
- One open-source browser racer made a steering slider its default. It is "analog, absolute position (touching an end steers fully)", has a 15% dead zone, and its knob springs back to centre. Left/right arrow buttons are the alternative mode. This is a single hobby project, so treat it as an implementation example rather than evidence. — [GitHub Nikzz3/racing-game PR #159](https://github.com/Nikzz3/racing-game/pull/159)

**Smoothing and assists from console/PC racing**
- Assetto Corsa's gamepad settings expose four steering filters:
  - **Speed sensitivity** lowers steering input sensitivity at higher speeds. One guide suggests about 50% to keep steering feeling consistent across speeds.
  - **Steering gamma** reshapes the response curve. 1.0 is linear, and higher values give less effect from small stick movements.
  - **Steering filter** softens or delays erratic inputs.
  - **Steer speed** sets how fast the virtual wheel moves to the target angle.

  — [SimRacingSetup AC controller guide](https://simracingsetup.com/assetto-corsa/assetto-corsa-controller-settings/); [Steam community AC discussion](https://steamcommunity.com/app/244210/discussions/0/135510194249998528/?ctp=2). These are community sources, and the values people post vary widely.
- Forza Horizon 5's default controller mapping lists "Brake/Reverse (Hold) · LT", so holding brake to reverse is the genre convention. — [Gamezo FH5 controls](https://gamezo.gg/forza-horizon-5-controls/). Forza also exposes inner dead zones for throttle and steering. — [Forza Support: FH5 Wheel Setup and Tuning](https://support.forza.net/hc/en-us/articles/4409761195923-FH5-Wheel-Setup-and-Tuning)

### Inferences
- **Default steering, "Drag steer" (analog, relative, auto-centring):**
  - The whole left ~45% of the screen, below the top status strip, is the steering zone.
  - Where the thumb lands becomes centre, and horizontal displacement from that point maps to steer from -1 to 1.
  - Releasing the thumb returns steer to 0 (auto-centre).
  - Vertical movement is ignored, so diagonal thumb drift doesn't matter.
  - Show a knob or ghost wheel at the touch point so a glance confirms the state.

  Why this method: it is analog (fine control), and it works without looking because there is no fixed target to miss, which follows AirConsole's "fingers slip off unnoticed" warning. It has mass-market precedent in Mario Kart Tour's drag steering and GRID's floating Wheel Touch. It also fits the TAK advice to use a relative stick where the input amount must change gradually.

  It is not a 2-D virtual joystick: it is a single-axis drag, which avoids the free-movement problem AirConsole describes. Suggested starting values to playtest: full lock at about 22-30% of viewport height of travel, a dead zone of about 4-6% of travel, and a gamma of about 1.3-1.8 for finer control near centre. Size the travel against the viewport so it is roughly the same physical distance on every phone.
- **Alternative, "Arrows" (digital, for kids and first-timers):** two large adjacent zones (◀ | ▶) under the left thumb, with pedals on the right (the GRID "Arrow Touch Pro" layout). The game ramps steer instead of snapping it:
  - About 150-250 ms from 0 to full while held.
  - About 80-120 ms back to centre on release.
  - An immediate pass through zero when the direction flips.

  Real Racing 3's "binary on/off" criticism (see section 2) and Asphalt's "hard to drift" comment are the reasons to ramp.
- **Steering wheel drag:** GRID's floating rotating wheel is the closest precedent. Rotating a thumb around a centre is harder to do without looking than a straight horizontal slide. A cheaper premium touch is to render a steering-wheel graphic that rotates with the drag-steer value: the wheel as a visual metaphor, without the rotational gesture.
- **Absolute "touch-and-hold position" zones** (touch the left end for full left) give the fastest input (TAK's higher skill ceiling) but need the player to look at the phone. Offer them only as an expert option, if at all.
- **Game-side processing** (apply to every mode on the TV/host, not the phone):
  1. Dead zone, then response curve (gamma).
  2. Speed-sensitive maximum steer angle: full lock at low speed, roughly 35-55% of lock at top speed, as in Assetto Corsa's speed sensitivity.
  3. Steer-rate limit (Assetto Corsa's steer speed).
  4. Light low-pass filter.
  5. Optional counter-steer and drift help.
- **Per-player assist level, picked in the lobby:**
  - **Off:** raw input.
  - **Assist:** auto-accelerate, plus Mario Kart Tour-style wall avoidance.
  - **Autopilot:** TouchDrive-style steering along the racing line, where the player only brakes, drifts and uses items.

  This is how a mixed-skill party (including children) stays fun. Asphalt shows that assisted players are slower, so the assist works as a natural handicap.
- Remove tilt entirely, but keep the name "Buttons" for the existing digital mode so returning players still recognise it.

### Gaps
- No usage telemetry or player-preference survey comparing drag, arrows and wheel was found. Reddit threads did not come up in my searches.
- CarX Drift Racing's touch options could not be verified (no results). Current menus for Asphalt Legends Unite (2024) and Real Racing 3 were not verified, since most sources date from 2013-2018.
- No published research gives an optimal drag distance or dead zone for thumb steering. The numbers above are design starting points to playtest, not findings.

## 2. Throttle and brake, auto-accelerate, handbrake, reverse and gears, look-back, horn, pause

### Takeaway
Mobile racers use either digital pedals (hold one screen area to accelerate and another to brake), often with optional auto-accelerate, or an analog throttle slider (GRID). Reviewers criticize binary touch pedals for lacking finesse. "Hold brake to reverse" is the standard convention (Forza), so keep it but make it visible. On a touchscreen only two inputs can be active at once (two thumbs), so any combination such as gas + handbrake has to be designed into a single gesture.

### Cited Findings
- **GRID pedal layouts:**
  - Tilt: "hold down on the right side of the screen to accelerate" and "hold down on the left side of the screen to brake".
  - Wheel Touch: "hold down on the lower-right side of the screen to accelerate" and "upper-right side ... to brake".
  - Mirrored Mode reverses positions.

  — [Feral GRID Autosport FAQ](https://www.feralinteractive.com/en/faqs/gridautosport/latest/ios/)
- **GRID's Throttle Slider:** it "allows for analogue control of speed". You drag up and down, and releasing it "immediately reduce[s] throttle to zero". It is available with every scheme except standard Arrow Touch. Auto-accelerate is always on for Arrow Touch and optional for Tilt and Wheel Touch on lower difficulties. — [Feral GRID Autosport FAQ](https://www.feralinteractive.com/en/faqs/gridautosport/latest/ios/)
- **GRID gear changes** apply only with manual transmission on lower difficulties:
  - "flicking up or down anywhere on the screen" (Tilt);
  - nudging the device (Wheel Touch);
  - optional on-screen gear buttons.

  The FAQ does not document reverse or how the handbrake works. — [Feral GRID Autosport FAQ](https://www.feralinteractive.com/en/faqs/gridautosport/latest/ios/)
- In Real Racing 3, manual gas and brake "sometimes lack finesse since they are binary on/off touchscreen commands". — [Game Informer preview, 2013](https://gameinformer.com/games/real_racing_3/b/ios/archive/2013/02/28/real-racing-3-preview.aspx). The developers recommended turning off brake assist and enabling manual acceleration to carry more speed through corners. — [EA "Top 7 tips for new drivers"](https://www.ea.com/news/top-7-tips-for-new-drivers). The page now returns 404, so this comes from a search snippet.
- Mario Kart Tour's Smart Steering includes automatic acceleration. — [Super Mario Wiki](https://www.mariowiki.com/Mario_Kart_Tour). NFS No Limits accelerates automatically; the player taps the gas pedal at the countdown for a launch. — [Level Winner](https://www.levelwinner.com/need-for-speed-no-limits-beginners-guide-tips-cheats-strategies-to-level-up-fast-and-win-more-races/)
- Forza Horizon 5 default: "Accelerate · RT / Brake/Reverse (Hold) · LT". — [Gamezo](https://gamezo.gg/forza-horizon-5-controls/)
- Xbox Accessibility Guideline 107 gives a racing example: when a player remaps analog trigger gas to a digital button, the game should still work. — [Xbox Accessibility Guideline 107](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/107) (per search summary; page not fetched)
- Hotshot Racing on Xbox Cloud Gaming has a touch-controlled throttle. — [Xbox Wire, Oct 2020](https://news.xbox.com/en-us/2020/10/22/xbox-touch-controls-on-mobile-giving-more-ways-to-play/) (per search summary; page not fetched)
- **Microsoft TAK guidance:**
  - "Usually only two inputs at a time are possible by using the left and right thumb while holding a device."
  - A `pullAction` button lets "one touch and drag motion ... activate two actions" (press for one action, pull outward for the second).
  - Joysticks can fire an extra action past a threshold (walk to sprint).
  - "The upper-left corner is reserved for system buttons. Players are expecting similar actions that might pause or navigate the game in the upper row."

  — [Microsoft TAK designer's guide](https://learn.microsoft.com/en-us/gaming/gdk/docs/features/common/game-streaming/building-touch-layouts/game-streaming-tak-designers-guide?view=gdk-2604)
- AirConsole: "Label each button / interactive area with its actual function", and show only the inputs needed right now. — [AirConsole: Smartphones as Controllers](https://developers.airconsole.com/smartphones-as-controllers)

### Inferences
- **Pedals, all under the right thumb:**
  - **GAS:** the largest control, a tall pedal at the bottom-right.
  - **BRAKE / REV:** an equally tall pedal just inside it (toward screen centre), along the thumb's natural arc. This matches the real-car order of brake to the left of gas, and the thumb rolls between them without lifting.
  - Touching GAS gives 100% throttle, so digital play works (XAG 107).
  - Optional analog feathering: sliding the thumb down from where it landed reduces throttle, with about 30% of pedal height going from 100% to 0%. This keeps GRID-style analog control without forcing first-timers to learn a slider.
  - Brake also gives 100% on touch, and the physics provides ABS, so no lock-ups.
  - A settings toggle offers GRID-style absolute "Analog pedals" for enthusiasts.
- **Reverse:** keep "hold brake at standstill to reverse" (the Forza convention) and make it impossible to miss:
  1. The brake pedal shows a permanent "BRAKE · R" label.
  2. When speed is below about 1 km/h and brake is held, a short ring fills on the pedal (about 300-400 ms). The phone then gives a haptic tick (Android), the pedal label flips to "REVERSE", an "R" gear chip lights on both the phone and the player's TV quadrant, and reverse lights and a beep play.
  3. Stuck detection: if speed stays near 0 for more than about 2 s while the player holds gas, show a contextual hint, "Hold BRAKE to reverse", in that player's TV quadrant and on the phone. This mirrors TAK's guidance on contextual and touch-specific prompts.
  4. Add a "Recover/Reset" action (auto after N seconds stuck or flipped, plus a small manual button). Party racers need a guaranteed way out, and reverse alone is not enough for novices.
- **Gears:** automatic only for the party product. Show gear (including R) on the TV HUD. Manual paddles, if ever added, belong in an opt-in "Pro" layout; GRID restricts touch manual shifting to flicks or nudges on lower difficulties.
- **Handbrake:** the right thumb cannot hold gas and handbrake at the same time (two-input limit). Two options:
  - (a) A HANDBRAKE button above the GAS pedal (TAK's "secondary" slot, upper-right of the primary). While it is held, the game keeps the last throttle value ("throttle latch").
  - (b) A TAK-style `pullAction`: slide the thumb up off GAS onto the handbrake strip, so gas stays applied while the handbrake engages.

  Option (b) is the more "premium" single gesture.
- **Item/boost (M7 items):** a large button in the upper part of the right cluster, beside HANDBRAKE, or a top-centre band reachable by either thumb. Avoid swipe gestures on the steering zone, because they would conflict with drag steering.
- **Pause:** a small icon in the top-left corner (TAK). It needs a hold of about 0.5 s, or a tap followed by a confirm, so a stray thumb cannot pause a 4-player race.
- **Horn:** fun in the lobby and on the grid. In-race it should be a small top-bar button with a rate limit; it is optional.
- **Look-back:** omit in v1. Split-screen quadrants are small, it is rarely used, and it would cost screen space. If needed later, make it a hold button in the top-right.

### Gaps
- No source documents how Asphalt or Real Racing 3 expose reverse on touch, or what hold time players find natural. The 300-400 ms value is an inference to playtest.
- No published data compares analog and digital touch throttles on lap times or satisfaction.

## 3. Layout and ergonomics: thumb zones, safe areas, target sizes, multi-touch reliability, accidental gestures

### Takeaway
Design for two thumbs anchored at the bottom corners. Comfortable reach is radial from the grip, the screen centre and bottom-centre are hard to reach, and the upper row is for system and infrequent actions. Because players watch the TV, size primary controls far above the 44 pt (Apple) and 48 dp (Material) minimums, and keep them clear of safe-area insets and system edge gestures.

### Cited Findings
- **Microsoft TAK guidance:**
  - Touch allows about two simultaneous inputs and gives no physical response like a gamepad.
  - "Notice how a player's thumbs can only reach so far into the center of the screen and how the regions of comfortable movement are often almost radial from where the device is being gripped."
  - Primary actions go on the left and right "wheels", and less frequent actions go in the upper and lower zones.
  - Rank all actions by how often they are used.
  - The lower-centre zone is the least used ("challenging to reach the middle").
  - "Players frequently move their wheels slightly lower for a comfortable playing position."
  - Check that controls are reachable on every screen size.

  — [Microsoft TAK designer's guide](https://learn.microsoft.com/en-us/gaming/gdk/docs/features/common/game-streaming/building-touch-layouts/game-streaming-tak-designers-guide?view=gdk-2604)
- **AirConsole guidance:**
  - "Make all buttons / interactive areas as big as possible."
  - Show only the input fields needed right now.
  - Use stretchable elements instead of fixed angles or aspect ratios so the layout fits different phone resolutions.

  — [AirConsole: Smartphones as Controllers](https://developers.airconsole.com/smartphones-as-controllers)
- In action games, "buttons need to be big enough for the player to find them without looking". The AirConsole team found that up to four buttons work, "one in each corner of the controller", and that "half a second of distraction can mean 'Game Over'". — [Game Developer (AirConsole), 2016](https://www.gamedeveloper.com/design/airconsole---using-smartphones-as-controllers)
- Apple asks for a minimum tappable area of 44 pt × 44 pt for all controls. Material Design suggests 48 × 48 dp, which it says results in a physical size of about 9 mm regardless of screen size. — quoted in [W3C WCAG issue #1831](https://github.com/w3c/wcag/issues/1831)
- WCAG 2.2 sets a 24×24 CSS px minimum at AA (2.5.8) and 44×44 at the older AAA criterion (2.5.5). — [Front-End Checklist: touch targets](https://frontendchecklist.io/rules/accessibility/touch-targets). Platform figures are minimums, and primary actions deserve larger targets where precision decreases. — [OpenReplay blog](https://blog.openreplay.com/improving-tap-targets-mobile-ux/)
- Safe areas: use `viewport-fit=cover` plus `env(safe-area-inset-*)` padding so "the notch / Dynamic Island / home indicator never covers the play-field or the touch controls". — [GitHub moamoamorte/x-76 issue #56, Oct 2026](https://github.com/moamoamorte/x-76/issues/56)
- "An application using Pointer events will receive a `pointercancel` event when the browser starts handling a touch gesture." `touch-action: none` will "Disable browser handling of all panning and zooming gestures". — [MDN touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action)
- GRID offers Mirrored Mode to swap the control sides. — [Feral GRID Autosport FAQ](https://www.feralinteractive.com/en/faqs/gridautosport/latest/ios/)

### Inferences
- **Recommended landscape layout** (every control inset by the safe area plus about 12-16 px):
  ```
  +--------------------------------------------------------------------+
  | [II]    ● P2 "SAM" (player colour band)   [item icon]   [R] [conn] |  <- status strip (~12% height, no gameplay input)
  |                                                   [ITEM]  [HBRAKE] |
  |                                                                    |
  |   STEER ZONE (left ~45%, floating drag;     |   [BRAKE·R]  [ GAS  ]|
  |   knob/wheel appears under the thumb)       |   tall pedal  tallest|
  |        <=====( o )=====>                    |                      |
  +--------------------------------------------------------------------+
  ```
- **Sizes:**
  - GAS: at least ~22% of screen width and ~55-65% of height.
  - BRAKE: at least ~16% of width and the same height.
  - HANDBRAKE and ITEM: at least about 2× the 44 pt / 48 dp minimum (≈ 88-96 CSS px).
  - Pause and other system icons can sit near the 44 pt minimum because they are rarely and deliberately used.

  Hit areas should cover the whole region, not just the drawn shape, with no dead gaps between the pedals.
- **Edge clearance:** the iOS home indicator (bottom-edge swipe) and Android gesture navigation (side-edge back swipe) can steal touches near the edges. Leave a margin and keep the steering zone's start a little inside the left edge. On Android, push a history state so an accidental back gesture only triggers "Leave game?" instead of navigating away. This is an untested inference; see Gaps.
- Offer a "Mirror layout" toggle (left-handed players, as GRID does) and a "Controls size" slider (S/M/L) in the lobby.
- Adjust the layout per state (lobby, race, results, pause), following AirConsole's views advice. Don't show item or handbrake controls before the player can use them (the TAK progressive-reveal pattern).

### Gaps
- No primary source on Android gesture-navigation conflicts with web content, or on whether `env(safe-area-inset-*)` reflects Android gesture insets in Chrome, was found in this session.
- No thumb-reach heatmap specific to landscape phones (Steven Hoober-style research) was retrieved. The TAK radial-zone guidance is the best available source.
- No sourced list of 2026 phone viewport sizes; the percentages above are design inferences.

## 4. Feedback: haptics on Android and iOS (2026 status), visual and audio feedback, and what belongs on the phone vs the TV

### Takeaway
Android Chrome and Samsung Internet support `navigator.vibrate`, but only after the user has tapped the page. iOS Safari still has no Vibration API in iOS 27. The hidden-`<input switch>` hack that gave iPhone web pages haptics in early 2026 was reportedly limited in iOS 26.5 to real finger taps and single ticks. In practice, haptics for game events (collisions, curbs, reverse engaged) are Android-only, and iOS needs strong visual (and optionally audio) feedback. Race information belongs on the TV. The phone shows control state, identity and private or contextual information.

### Cited Findings
- **Vibration API support (caniuse):**
  - Safari on iOS: not supported from 3.2 through 26.6 or in 27.0-27.2.
  - Chrome for Android: supported.
  - Samsung Internet: supported.
  - Firefox for Android 157: not supported.

  — [caniuse: Vibration API](https://caniuse.com/vibration)
- The Vibration API was removed in Firefox 129. — [haptics-web (vendor page)](https://haptics-web.vercel.app/)
- Chrome intervention: calls to `navigator.vibrate` "will immediately return 'false' if user hasn't tapped on the frame or any embedded frame yet". This became the default around M60 (2017). — [Chromium code review](https://codereview.chromium.org/2778693004). Console message: "[Intervention] Blocked call to navigator.vibrate because user hasn't tapped on the frame or any embedded frame yet". — [W3C public-device-apis log, Dec 2020](https://lists.w3.org/Archives/Public/public-device-apis-log/2020Dec/0048.html)
- **The iOS hack:** a hidden `<input type="checkbox" switch>` with a `<label>`, where calling `.click()` on the label produces a Taptic tick. Rapid toggling or "pulse width modulation" can build patterns. — [jhey on X, Mar 2026](https://x.com/jh3yy/status/2028544698055299220); [Maximiliano Firtman on X, Mar 2026](https://x.com/firt/status/2028807962295230776)
  - Sources disagree on when it started working. Libraries target "iOS Safari 17.4+" ([web-haptics-polyfill](https://github.com/doublej/web-haptics-polyfill)), while Ionic tracks "haptic feedback to Toggle in Safari on iOS 18+" ([Ionic issue #29942](https://github.com/ionic-team/ionic-framework/issues/29942)).
- **The iOS 26.5 change:** "Apple's 26.5 patch closed the programmatic path every web haptics library was using." The surviving approach places an invisible switch inside each tappable element, so a real finger tap counts as direct interaction with the switch. On iOS 26.5 and later, "Multi-segment presets fire only their first tick." — [haptics-web](https://haptics-web.vercel.app/). This is the vendor's own claim. Another tool page also reports that scripted calls no longer trigger the Taptic Engine on the latest iOS: [iOS Haptics Tester](https://rapidtoolset.com/en/tool/ios-haptics-tester) (per search summary). I found no Apple documentation of the change.
- The Safari 27.0 release notes (Sept 2026) list no Vibration, haptics, Fullscreen-on-iPhone or Screen Orientation lock items in the portion I read (about the first 100k of 147k characters). — [WebKit Features for Safari 27.0](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/)
- AirConsole tells developers to use vibration for feedback on controls and on in-game events. Its API supports composed patterns from primitives (for example a THUD at scale 0.8, or QUICK_FALL then TICK with a 10 ms delay). It warns that vibration drains battery and that overuse can numb players' hands. — [AirConsole: Smartphones as Controllers](https://developers.airconsole.com/smartphones-as-controllers)
- GRID's "very nice vibration feedback" was singled out by a reviewer. — [Operation Sports](https://www.operationsports.com/ios-grid-autosport-truly-console-quality/)
- Touchscreens lack the haptic feedback of physical buttons, so controller simplicity matters more. Action-game players shouldn't need to look away from the big screen. — [Game Developer (AirConsole), 2016](https://www.gamedeveloper.com/design/airconsole---using-smartphones-as-controllers)
- AirConsole recommends personal views on the phone (player colour, secret cards, items, objectives) and says the controller's visual style should match the big-screen graphics. — [AirConsole: Smartphones as Controllers](https://developers.airconsole.com/smartphones-as-controllers)
- Xbox's guidance: use custom art that matches the game, show touch-specific prompts (Gears 5), and reveal controls progressively (Minecraft Dungeons). — [Microsoft TAK designer's guide](https://learn.microsoft.com/en-us/gaming/gdk/docs/features/common/game-streaming/building-touch-layouts/game-streaming-tak-designers-guide?view=gdk-2604)

### Inferences
- **Haptic vocabulary for Android** (keep it sparse to avoid numbness; durations are starting points):
  - Pedal or button press: 8-12 ms tick.
  - Reverse engaged or gear into R: double tick.
  - Wall or car collision: 25-60 ms, scaled by impulse.
  - Curb or rumble strip: periodic 6-8 ms pulses.
  - Item pickup or use: a short pattern.
  - Lap or finish: a celebratory pattern.

  The TV sends haptic events over the reliable channel. Rate-limit them on the phone (for example, at most one collision buzz per 150 ms). Add a per-player "Vibration" toggle.
- **iOS:** assume no event-driven haptics. Optionally add press ticks on discrete buttons (ITEM, HANDBRAKE, menu buttons) through the invisible-switch overlay, and expect only a single tick. Two cautions:
  - The switch toggles on a click, so the tick probably lands on release rather than on press (the timing is unverified).
  - A click requires not calling `preventDefault()` on that element's touch events, which conflicts with full gesture suppression.

  Do not put switch overlays on the steering zone or the pedals.
- **Visual feedback is the primary channel on every phone:**
  - A press state (brightness and scale) driven from `pointerdown` in JS rather than CSS `:active`.
  - A live steer knob and offset bar, and a throttle and brake fill level inside each pedal.
  - An "R" chip that lights up for reverse.
  - A colour flash on item pickup, and a brief edge glow on collision.
  - A connection-quality dot.
- **Audio:** keep phone sounds off by default. Party audio should come from the TV, and phone speakers in a room of 4 are noise. A soft click on press can be an option.
- **Phone vs TV:**
  - The TV (each split-screen quadrant) holds everything players read while driving: speed, gear and R, position, lap, minimap, hints.
  - During the race the phone shows only identity (colour band, name and number, so players know which quadrant is theirs), control state, the current item and connection status. Nothing that requires reading.
  - Between races, the phone can be richer: results, vote, car and colour, settings.

### Gaps
- Whether the switch-overlay haptic fires on touch-down or on release, and whether iOS 27 changed the 26.5 behaviour, could not be confirmed. Test on devices.
- No source on the minimum perceptible `vibrate()` duration across Android motors.
- No study was found on how much information players will read on a phone during TV play. The phone-vs-TV split is an inference from AirConsole's "don't look away" guidance.

## 5. Platform guidance (AirConsole, Xbox touch, Jackbox, others): latency, reconnects, onboarding

### Takeaway
The platforms converge on the same advice: don't emulate a gamepad, use big labelled targets with one layout per game state, art that matches the TV game, and plan for disconnects (restore state and pause). For latency, the industry pattern is an unordered, no-retransmit data channel carrying self-contained input snapshots, plus a reliable channel for discrete events. The project already uses the unordered setting.

### Cited Findings
- AirConsole handles fullscreen, device orientation, stay-alive and connection and session management for developers. Its guidance: "Don't emulate a regular gamepad – make a controller that's truly unique." — [AirConsole developer home](https://developers.airconsole.com/)
- AirConsole uses "views" for game states (play, pause, cooldown, respawn wait). It recommends Custom Device States rather than messages for switching views, provides a View Manager, and advises playing existing AirConsole games to learn which control schemes work. — [AirConsole: Smartphones as Controllers](https://developers.airconsole.com/smartphones-as-controllers)
- AirConsole's FAQ lists latency and the number of controller buttons as constraints to plan around. — [AirConsole FAQ](https://developers.airconsole.com/faq-help) (per search summary; page not fetched)
- **Xbox Cloud Gaming:**
  - "Twenty percent of Xbox Cloud Gaming players use touch as their exclusive method of playing games." Titles with touch controls are played "about twice as much" as titles without, and touch players report equivalent or higher satisfaction.
  - Design advice: start from a template, "stay minimal", and use custom assets that match the game's art.
  - On disconnects: restore the touch layout and state when the player returns, and "Pause gameplay where possible when a player is disconnected".

  — [Microsoft TAK designer's guide](https://learn.microsoft.com/en-us/gaming/gdk/docs/features/common/game-streaming/building-touch-layouts/game-streaming-tak-designers-guide?view=gdk-2604)
- **Jackbox rejoin:** refresh or go back to jackbox.tv and re-enter the room code, which is always shown on the main screen. Players must use their name "exactly as you had it at the beginning of the game", or they may be forced to join as audience. — [Fullerton College Library Jackbox guide](https://library.fullcoll.edu/?p=17782) (secondary source; no official Jackbox page found)
- **WebRTC data channels:**
  - RFC 8831: "Limiting the number of retransmissions to zero, combined with unordered delivery, provides a UDP-like service where each user message is sent exactly once and delivered in the order received." — quoted in [Tor Snowflake MR 315](https://gitlab.torproject.org/tpo/anti-censorship/pluggable-transports/snowflake/-/merge_requests/315)
  - `maxRetransmits` and `maxPacketLifeTime` cannot be set together. — [web.dev WebRTC data channels](https://web.dev/articles/webrtc-datachannels?hl=ja)
  - Send self-contained state snapshots on the unreliable channel (a lost packet is harmless) and one-shot events on a separate reliable channel. — [Bugnet blog](https://bugnet.io/blog/how-to-fix-webrtc-datachannel-ordered-mode-latency) (vendor blog, not measured)
  - Large reliable messages on the same SCTP association get fragmented, and those fragments can "monopolize the send queue", delaying small messages on the sending side. Pion's fix is RFC 8260 interleaving. — [Pion blog, May 2026](https://pion.ly/blog/sctp-interleaving)
  - Safari 27 adds the WebRTC `targetLatency` attribute (a media feature, not data channels). — [WebKit Features for Safari 27.0](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/)
- The project already opens its input channel with `ordered: false, maxRetransmits: 0`. — [client/src/net/rtc.ts](/home/user/game-gang/client/src/net/rtc.ts)

### Inferences
- **Input packet (unreliable channel):** one small binary message (about 12-16 bytes) carrying:
  - a `seq` number;
  - `steer` as an int16;
  - `throttle` and `brake` as uint8 each;
  - a button bitmask (handbrake, item, horn held);
  - counters for edge actions (`itemPresses`, `pauseRequests`), so a lost packet cannot lose an event.

  Send immediately on any change and at a steady 60 Hz otherwise. The host keeps only the highest `seq` and zeroes a player's inputs if nothing arrives for about 250 ms (failsafe against a stuck throttle). Send nothing large on the same SCTP association during races; per Pion, large messages delay small ones on the sending side.
- **Reliable channel** (TV → phone): view or state changes (AirConsole-style "device state": lobby, countdown, racing, paused, results), haptic events, item changes and the "R" state.
- **Reconnects:**
  - Keep a player's slot, colour and car for at least 60-120 s, keyed to a device token stored on the phone, with the name as a fallback (the Jackbox model).
  - While the player is away, auto-pause, or show "P2 reconnecting…" on their quadrant with AI coasting and braking (TAK says pause where possible).
  - On `visibilitychange` to hidden, the phone sends zeroed inputs. On return, it re-acquires the wake lock and requests the current device state.
- **Onboarding (first-time friendly):**
  1. Scan the QR code. The join page asks for a name (prefilled from the last session) and gives an auto-assigned unique colour, with a tap to change it.
  2. A "Choose controls" card shows Drag steer (recommended) and Arrows as animated mini-demos, plus an Assist level.
  3. A 10-second "try it" view: the player's TV tile shows the car's front wheels and pedal bars responding live to the phone.
  4. Ready.

  Use function labels (GAS, BRAKE·R, DRIFT, ITEM), not A/B (AirConsole). Show "Add to Home Screen for full screen" once, on iPhone only (see section 6).
- **Premium polish:** controller art in the TV game's visual language (AirConsole, TAK), 60 fps UI with no layout shifts, a press response on the next frame, and a consistent colour identity between the phone band and the car or quadrant.

### Gaps
- No documentation was retrieved on Steam Link touch controls, Backbone or Nintendo-style phone controller apps. These platforms were not covered in this session.
- AirConsole's message-rate limits and its own latency numbers were not verified (the FAQ page was not fetched).
- No measured latency comparison exists in my sources for unordered vs ordered WebRTC channels or vs WebSockets on home Wi-Fi.

## 6. Web implementation: fullscreen and landscape lock, gesture suppression, pointer vs touch events, wake lock, PWA

### Takeaway
As of Safari 27 (Sept 2026), an iPhone web page still cannot enter element fullscreen or lock orientation. The only way to get a page with no Safari interface is Add to Home Screen, and iOS 26+ opens such shortcuts as web apps by default. On Android Chrome, `requestFullscreen()` and then `screen.orientation.lock('landscape')` works, but only once the page is fullscreen and after a user gesture. Build the controller on Pointer Events with `touch-action: none`, plus iOS-specific suppression of callouts, selection and pinch zoom. Wake Lock works on iOS 16.4+, including home-screen apps since about iOS 18.4, but must be re-acquired after the page has been hidden.

### Cited Findings
- **Fullscreen:**
  - caniuse lists Safari on iOS as "partial support" from 12 through 27.2, and Chrome for Android as supported. — [caniuse: Fullscreen API](https://caniuse.com/fullscreen)
  - `Element.requestFullscreen()` isn't supported on iPhone. It works on iPad from iPadOS 16.4, and on iPhone only `<video>` can go fullscreen, through `webkitEnterFullscreen()`. — [Underpass App, Feb 2025](https://underpassapp.com/news/2025/2/1.html)
  - An October 2026 issue confirms: "iPhone Safari has no element Fullscreen API at all, on any iOS version", and Add to Home Screen is "the only way to get a chrome-free page on iPhone". — [GitHub moamoamorte/x-76 issue #56](https://github.com/moamoamorte/x-76/issues/56)
  - Apple staff once said iPhone fullscreen was available behind a feature flag in Safari 17.2 beta, but a later poster said it still isn't supported. — [Apple Developer Forums thread 133248](https://developer.apple.com/forums/thread/133248)
- **Orientation lock:**
  - caniuse marks Safari on iOS as not supporting `screen.orientation.lock` through 26.x. — [caniuse: Screen orientation lock](https://caniuse.com/wf-screen-orientation-lock)
  - Safari 16.4 added `ScreenOrientation.type`, `angle` and `onchange`, but not `lock`. — [MDN browser-compat-data issue #19355](https://github.com/mdn/browser-compat-data/issues/19355)
  - In September 2026, a project still had to stub `lock()` because it is undefined on iOS Safari and calling it threw on every fullscreen toggle. — [bccsa/luminary-media-convert PR #252](https://github.com/bccsa/luminary-media-convert/pull/252)
  - MDN: "Typically orientation locking is only enabled on mobile devices, and when the browser context is full screen." `lock()` rejects with `NotSupportedError`, `SecurityError` (hidden document) and other errors. — [MDN ScreenOrientation.lock()](https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/lock)
- **Home-screen web apps:**
  - In iOS and iPadOS 26, "By default every website added to the Home Screen opens as a web app", and users can turn this off with an "Open as Web App" switch. — [Michael Tsai blog, Oct 2025](https://mjtsai.com/blog/2025/10/03/web-apps-in-ios-26/); [Initial Charge, Oct 2025](https://initialcharge.net/2025/10/open-as-web-app-option/)
  - An older article says iOS does not honour the manifest `orientation` field. — [Expo blog](https://blog.expo.dev/enabling-ios-splash-screens-for-progressive-web-apps-34f06f096e5c). Unverified for iOS 26/27.
- **Wake Lock:**
  - Supported on Safari iOS 16.4+ (through 27.2) and on Chrome for Android. — [caniuse: Screen Wake Lock](https://caniuse.com/wake-lock)
  - WebKit bug 254545 (wake lock not working in home-screen web apps) is marked RESOLVED FIXED. — [WebKit bug 254545](https://bugs.webkit.org/show_bug.cgi?id=254545)
  - One source says the fix shipped in iOS 18.4 and advises wrapping `request()` in try/catch. — [Progressier](https://progressier.com/pwa-capabilities/screen-wake-lock). An MDN mirror notes that iOS 16.4-18.4 did not work in standalone home-screen web apps. — [docs.w3cub (MDN mirror)](https://docs.w3cub.com/dom/wakelock) (per search summary)
  - A commenter on the WebKit bug reported being unable to re-set the lock after going to the home screen and back. — [WebKit bug 254545](https://bugs.webkit.org/show_bug.cgi?id=254545)
- **Gesture suppression (MDN):**
  - `touch-action: none` disables all browser panning and zooming. `manipulation` disables double-tap zoom and so removes the click delay.
  - Apps using Touch Events should call `preventDefault()` and also set `touch-action`, "to ensure the browser knows the intent of the application before any event listeners have been invoked".
  - Changes to `touch-action` after a gesture starts have no effect.
  - Pointer Events apps receive `pointercancel` when the browser takes over a gesture.
  - MDN warns that `touch-action: none` can inhibit zoom for low-vision users.

  — [MDN touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action)
- **iOS specifics:**
  - On iOS 15, Safari still showed a callout or magnifier even when the page was marked non-selectable. A non-passive `touchstart` listener that calls `preventDefault()` stopped it. — [WebKit bug 231161](https://bugs.webkit.org/show_bug.cgi?id=231161)
  - An installed PWA game fixed the same symptoms by suppressing the touch callout and text selection on the play surface and blocking `gesturestart` (pinch). — [royashbrook/clonedash issue #27](https://github.com/royashbrook/clonedash/issues/27)
  - `touch-action: manipulation` removes double-tap zoom on iOS. — [DEV: TIL CSS removes double-tap zoom on iOS](https://dev.to/shadowfaxrodeo/til-you-can-use-css-to-remove-the-double-tap-zoom-feature-on-ios-2dhi)
- Safari 27 fixed a bug where "adjusting text selection with touch handles was prevented by JavaScript touch event handling on some websites". This is a reminder that touch handlers interact with selection UI. — [WebKit Features for Safari 27.0](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/)

### Inferences
- **Launch flow:**
  - **Android:** on the first tap (Join or Ready), call `document.documentElement.requestFullscreen({navigationUI:'hide'})`, then `screen.orientation.lock('landscape')` inside `.then`, wrapped in try/catch. This is the current code path, which is correct.
  - **iPhone:** skip fullscreen. Detect it with `!document.fullscreenEnabled` or the iPhone UA, and if the page is not in standalone mode (`navigator.standalone` or `matchMedia('(display-mode: standalone)')`), show a one-time "Add to Home Screen for full screen" card. Ship a manifest (`display: fullscreen` or `standalone`, `orientation: landscape`, icons) and `apple-mobile-web-app-*` metas so the home-screen app looks native.
- **Orientation on iOS:** the page cannot force landscape. In portrait, show a full-screen "Rotate your phone" overlay with an animation.
  - If the user has the system rotation lock on, an alternative is to render the controller rotated 90° with a CSS transform, plus a flip button. Two downsides: pointer coordinates then need transforming, and it is untested here.
  - The layout must also tolerate Safari's own toolbars in landscape. Use `100dvh` or `visualViewport` sizing, not `100vh`.
- **Gesture and selection kill-switch** on the controller root:
  - CSS: `touch-action:none; user-select:none; -webkit-user-select:none; -webkit-touch-callout:none; -webkit-tap-highlight-color:transparent; overscroll-behavior:none;`, and `position:fixed; inset:0` on `html` and `body`.
  - Listeners: non-passive `touchstart` and `touchmove` that call `preventDefault()` on control surfaces; `contextmenu` and `selectstart` with `preventDefault`; `gesturestart`, `gesturechange` and `gestureend` with `preventDefault` (iOS pinch).
  - Viewport meta: `width=device-width, initial-scale=1, viewport-fit=cover` (iOS may ignore `user-scalable=no`, so rely on the CSS and JS above).
  - No focusable inputs on the race view, so the keyboard never pops up.
- **Pointer Events for multi-touch:**
  - Track each finger by `pointerId` in a map, from `pointerdown` to its zone.
  - Call `setPointerCapture(pointerId)` so a steering drag that leaves the zone keeps steering.
  - Treat `pointerup`, `pointercancel` and `lostpointercapture` as a release.
  - On `visibilitychange`, `pagehide` or `blur`, release everything and send zeroed inputs.
  - Read `pointermove` at full rate, but sample the latest value per animation frame for UI and per send tick for the network.
  - Don't use `<button>` click handlers for driving controls, since clicks come late and only fire on release.
- **Wake Lock:** request it on the first tap, re-request it on `visibilitychange` to visible (already implemented), and fall back silently. As a backstop, show "Tap to resume" if the page was hidden.
- **Vibration:** call `navigator.vibrate` only after the Join tap, which gives the page sticky activation. Guard with feature detection, which the existing code does. For iOS, see section 4.
- **PWA benefits** worth telling users about: on iPhone, the only chrome-free full-screen experience. On both platforms: faster re-launch, a persistent wake lock (iOS 18.4+), and a home-screen icon that brings players back. This is also a retention lever for a subscription product.

### Gaps
- No primary Apple or WebKit statement on future iPhone Fullscreen or orientation-lock plans. The Safari 27 notes were only read up to about 100k of 147k characters.
- Whether iOS 26/27 home-screen web apps honour the manifest `orientation: landscape` field is unverified (the only source is an older Expo article).
- No source verified how Safari 26's redesigned toolbars (Liquid Glass) behave in landscape on iPhone, or how much viewport they take.
- The Android Chrome back-gesture conflict with edge drags and the history-trap mitigation are unverified inferences.
