/**
 * Every tunable number in Split Ways, in one place. Units are metres, seconds, kilograms, radians and
 * newtons unless a name says otherwise. Comments say what turning a value up actually does.
 */

export const PHYSICS = {
  /** Physics runs at this fixed rate no matter how fast the screen refreshes. */
  stepHz: 60,
  /** If a frame took very long, simulate at most this many steps to catch up (prevents a death spiral). */
  maxStepsPerFrame: 5,
  /** Stronger than real gravity (9.81): cars feel heavier, stick to the road and land jumps faster. */
  gravity: 13,
} as const;

export const CAR = {
  /** Total mass. More mass = harder to push around in bumps, same acceleration (forces scale with it). */
  mass: 1300,
  /** Centre of mass height above the ground. Lower = harder to roll over. Real cars are ~0.5. */
  centreOfMassHeight: 0.28,
  /** Centre of mass forward offset. Slightly rear-biased makes the tail easier to swing out. */
  centreOfMassForward: -0.05,
  /** Resistance to rotating around each axis (pitch, yaw, roll). Lower yaw = snappier turn-in. */
  inertia: { pitch: 2300, yaw: 2100, roll: 900 },
  /** Body collision box (half sizes) and its height above the car's origin (which sits at road level). */
  chassisHalfExtents: { x: 0.92, y: 0.36, z: 2.2 },
  chassisCentreHeight: 0.72,
  /** Bounciness and scrape friction of the body when hitting walls or other cars. */
  bodyRestitution: 0.3,
  bodyFriction: 0.4,
} as const;

export const WHEELS = {
  /** Matches the car model: wheel centres at x = +-0.79, z = +-1.29, 0.32 above the ground. */
  halfTrack: 0.79,
  wheelbaseHalf: 1.288,
  centreHeight: 0.32,
  radius: 0.354,
  /** Suspension length at rest. Longer = softer, floatier ride over bumps. */
  suspensionRestLength: 0.3,
  /** How far the suspension can compress or extend from rest. */
  maxSuspensionTravel: 0.22,
  /** Spring strength. Higher = stiffer, less body roll, sits higher. */
  suspensionStiffness: 42,
  /** Damping while compressing / extending. Higher = less bouncing after bumps and landings. */
  suspensionCompression: 4.2,
  suspensionRelaxation: 5.2,
  /** Cap on spring force; high so hard landings never bottom out unexpectedly. */
  maxSuspensionForce: 80_000,
} as const;

export const TYRES = {
  /** Grip (friction coefficient). ~1 is a road car, 2+ is arcade-sticky. */
  frontGrip: 1.9,
  rearGrip: 1.8,
  /** Multiplies how hard the tyres resist sliding sideways. */
  sideStiffness: 1.0,
} as const;

export const ENGINE = {
  /** Peak driving force at a standstill. Higher = faster 0-100. */
  force: 11_500,
  /** Speed (m/s) where the engine runs out of push. 52 m/s = 187 km/h. */
  topSpeed: 52,
  /** Share of the engine force sent to the front wheels (rest goes to the rear). Lower = more tail-happy. */
  frontShare: 0.3,
  /** Reverse: force and max speed when holding brake at a standstill. */
  reverseForce: 6000,
  reverseTopSpeed: 11,
  /** Air drag (force = drag * speed^2) and rolling resistance. They slow you down when you lift off. */
  drag: 0.42,
  rollingResistance: 180,
} as const;

export const BRAKES = {
  /** Braking impulse per wheel per physics step. Higher = shorter stopping distance. */
  impulse: 62,
  /** Share of braking on the front wheels. */
  frontBias: 0.62,
} as const;

export const STEERING = {
  /** Max front wheel angle at low speed and at high speed. Blends between the two speeds below. */
  maxAngleLowSpeed: 0.58,
  maxAngleHighSpeed: 0.17,
  lowSpeed: 6,
  highSpeed: 44,
  /** How fast the road wheels turn towards the requested angle (deg/s; real cars sit at 120-180). */
  turnRateDegPerS: 150,
  /** How fast they return towards centre (deg/s). Faster than turning, so letting go settles quickly. */
  returnRateDegPerS: 240,
} as const;

export const DRIFT = {
  /** Handbrake: rear grip and side stiffness multipliers while held, plus rear braking impulse. */
  handbrakeRearGrip: 0.4,
  handbrakeRearSide: 0.35,
  handbrakeImpulse: 90,
  /** Tapping the brake mid-corner shifts weight forward: the rear loses this much side grip. */
  brakeOversteerRearSide: 0.55,
  /** Brake-oversteer only kicks in above this speed and with at least this much steering. */
  brakeOversteerMinSpeed: 12,
  brakeOversteerMinSteer: 0.25,
  /** While sliding, power + opposite lock helps the car straighten up again. */
  counterSteerAssist: 0.9,
} as const;

export const ASSISTS = {
  /** Pushes the car into the road as speed rises (force = downforce * speed^2). More grip at speed. */
  downforce: 3.2,
  /** Spinning faster than this (rad/s) is gently resisted, so a spin is recoverable, not a pirouette. */
  maxYawRate: 3.1,
  yawLimitStrength: 0.35,
  /** Above this slip angle (rad) the car slowly aligns with where it is travelling, unless drifting. */
  slideAlignStart: 0.18,
  slideAlignStrength: 0.9,
  /** Resists body roll and pitch on the ground (stiffness, damping). Keeps the car flat in hard turns. */
  antiRoll: 9000,
  antiRollDamping: 1600,
  antiPitchDamping: 1200,
  /** In the air: level the car out so jumps land on the wheels. */
  airLevelling: 2400,
  airDamping: 900,
} as const;

export const SURFACES = {
  /** Grip multiplier on tyre friction, extra rolling resistance (N, whole car on it), rumble 0..1 (audio, camera). */
  asphalt: { grip: 1, rolling: 0, rumble: 0 },
  kerb: { grip: 0.95, rolling: 60, rumble: 0.7 },
  grass: { grip: 0.55, rolling: 1500, rumble: 0.3 },
  gravel: { grip: 0.45, rolling: 6000, rumble: 0.6 },
} as const;

export const TRACKGEN = {
  /** Station spacing along the lap (m). Many constants count stations as metres, so keep it at 1. */
  spacing: 1,
  /** Corridor mesh chunk length (m): one chunk is the unit the renderer culls. */
  chunkLength: 150,
  /** Smallest crest and sag radii (m): v^2 / (0.5 g) and v^2 / g at 52 m/s, so crests never launch cars. */
  crestRadius: 416,
  sagRadius: 208,
  /** Run-off: steepest cross slope it inherits from the bank, and the extra fall away from the road (rise/run). */
  runoffMaxSlope: 0.035,
  runoffFall: 0.01,
  /** Invisible collision wall: height above the wall foot and thickness outwards (m). */
  wallHeight: 2.6,
  wallThickness: 1,
  /** A speed drop bigger than this (m/s) into a corner turns its outside barrier into a tyre wall. */
  tyreDropSpeed: 12,
  /** Terrain heightfield: margin around the track and grid spacing (m). */
  terrainMargin: 380,
  terrainSpacing: 5,
  /** Shoulder where the corridor blends into the natural ground (m beyond wall + 2 m, noise picks within). */
  shoulderMin: 12,
  shoulderMax: 28,
  /** Lap-validation gates: half their length along the road (m). Long enough that no car skips one. */
  checkpointHalfLength: 3,
  /** Moving-average window (m) for bank, road width and the barrier line, so none of them ever steps. */
  smoothWindow: 20,
  /** Default kerb for an `extraKerbs` override span without its own width (m), and its raise (m). */
  extraKerbWidth: 1.2,
  extraKerbHeight: 0.05,
  /** Pine candidates: grid spacing and random offset (m; >= 0.43 of the grid, or rows read as an orchard). */
  pineGrid: 7,
  pineJitter: 3.2,
  /** Pines stand at least this far beyond the wall (m), plus up to `pineGapNoise` more where noise says. */
  pineGap: 8,
  pineGapNoise: 6,
  /** Furthest pine beyond the wall (m), and the band beyond the wall where the forest is always dense (m). */
  pineReach: 260,
  pineDenseBand: 40,
  /** Most pines placed; over the cap, the ones furthest from the wall go first. */
  pineCap: 14_000,
} as const;

export const RACING_LINE = {
  /** Elastic-band relaxation: neighbours this many stations away pull each point straight, this many times. */
  span: 8,
  iterations: 600,
  /** The line keeps this far inside the asphalt edge (m). */
  edgeMargin: 1.3,
  /** Speed profile: top speed (m/s), cornering grip (m/s^2) and braking (m/s^2) it plans with. */
  vMax: 51,
  lateralAccel: 15,
  brakeDecel: 11,
  /** Acceleration cap of the forward pass (m/s^2); the engine curve takes over above it. */
  accelCap: 5,
} as const;

export const RACE = {
  /** Red lights: 3, 2, 1, then green. */
  countdownSeconds: 3,
  /** Once the winner finishes, everyone else has this long to cross the line. */
  finishTimeoutSeconds: 30,
  /** Seconds after the race ends before the podium appears (time to see your own finish). */
  podiumDelaySeconds: 3,
} as const;

export const RESPAWN = {
  /** Upside down (or on its side) for this long = respawn at the last checkpoint. */
  flippedSeconds: 3,
  /**
   * Pressing gas or brake but going nowhere (wedged against a wall) for this long = respawn. Long
   * enough for the reverse hint to work first, since a manual Reset exists now.
   */
  stuckSeconds: 6,
  /** Stuck on gas this long shows "Hold BRAKE to reverse". */
  stuckHintSeconds: 2,
  /** A manual Reset can't be pressed again for this long (s). */
  resetCooldownSeconds: 3,
  /** Counts as flipped when the car's up axis points less than this much upwards. */
  flippedUpDot: 0.35,
} as const;

export const INPUT = {
  /** If a pad has sent nothing for this long, its car coasts (no gas, no brake, wheel centred). */
  staleAfterMs: 600,
} as const;

/** Shared steering processing on the TV for every input mode (pad drag, pad buttons, keyboard). */
export const STEER_INPUT = {
  /** Inputs this close to centre count as centre (thumb wobble, a resting finger). */
  deadZone: 0.05,
  /** Response curve exponent. Above 1 = finer control near the centre, same full lock. */
  gamma: 1.5,
  /** Low-pass time constant (s): smooths wifi jitter and digital keys; settles in about 5x this. */
  lowPassSeconds: 0.04,
} as const;

export const REVERSE = {
  /** Hold brake (no gas) at a standstill this long to engage reverse; the pad ring fills meanwhile. */
  armSeconds: 0.35,
  /** "Standstill": forward speed below this (m/s). Rolling backwards counts too. */
  standstillSpeed: 0.5,
  /** Throttle at or above this counts as gas (lower is feathering residue and is ignored). */
  gasThreshold: 0.05,
  /** Brake above this arms reverse. */
  brakeThreshold: 0.5,
  /** In reverse, letting the brake fall to this or below leaves reverse. */
  releaseBrake: 0.05,
} as const;

export const PAD_STATUS = {
  /** Min gap (ms) between pushes of a changed reverse gear, stuck hint or RESET state to a pad. */
  pushMinMs: 50,
} as const;

export const CAMERA = {
  /** Chase camera distance behind the car, height above it, and the point it looks at. */
  distance: 6.1,
  height: 2.1,
  lookAhead: 4,
  lookHeight: 1,
  /** How quickly the camera catches up with the car. Lower = more lag and swing. */
  followStiffness: 9,
  /** How much the camera swings towards the direction of travel when the car slides (0..1). */
  velocityHeadingBlend: 0.35,
  /** Vertical field of view (degrees) at rest, and how much it widens at top speed. */
  baseFov: 57,
  speedFov: 10,
  /** Above this horizontal FOV (degrees) the vertical FOV shrinks, so wide split viewports don't fish-eye. */
  maxHorizontalFov: 100,
} as const;

export const RENDER = {
  /**
   * Canvas pixels per CSS pixel. Always 1: the 3D views render at their own internal resolution and
   * the final pass upscales and sharpens them, so a 4K TV at devicePixelRatio 2 costs no more than 1080p.
   */
  canvasPixelRatio: 1,
  /** Above this devicePixelRatio the browser upscales the canvas, so the final pass sharpens. */
  sharpenWhenDprAbove: 1.25,
  /** Black border around each view's tile in the shared HDR atlas (px), so bloom never bleeds across. */
  tilePadding: 16,
  /** Full frames rendered on the loading screen after the shader compile, so nothing compiles mid-race. */
  warmupFrames: 3,
  /** The dark seams between viewports. */
  seamColour: 0x050608,
} as const;

/**
 * Quality presets, picked by player count (1 high, 2 medium, 3-4 low). Starting values; the owner
 * tunes them from telemetry. `maxInternalPixels` caps the summed pixels of all views at scale 1,
 * `minScale` is how far dynamic resolution may drop, `sharpness` is the upscale sharpening in stops
 * (0 = strongest, each +1 halves it), `vegetationDensity` the share of pines drawn and `cameraFar`
 * the view distance (m). Changing shadow kind or MSAA rebuilds shaders, so presets only change on
 * the loading screen or in a benchmark.
 */
export const PRESETS = {
  high: {
    maxInternalPixels: 2560 * 1440,
    minScale: 0.6,
    msaa: 4,
    bloomLevels: 4,
    shadow: { kind: 'sun', mapSize: 2048, far: 160 },
    shadowRadius: 2.5,
    anisotropy: 8,
    sharpness: 0.3,
    vegetationDensity: 1,
    pineShadows: true,
    cameraFar: 2400,
  },
  medium: {
    maxInternalPixels: 1920 * 1080,
    minScale: 0.6,
    msaa: 4,
    bloomLevels: 4,
    shadow: { kind: 'sun', mapSize: 1024, far: 120 },
    shadowRadius: 2.5,
    anisotropy: 8,
    sharpness: 0.35,
    vegetationDensity: 0.75,
    pineShadows: true,
    cameraFar: 1800,
  },
  low: {
    maxInternalPixels: 1920 * 1080,
    minScale: 0.7,
    msaa: 2,
    bloomLevels: 3,
    /** One shadow pass per view, aimed at the car being drawn (two cascades per view cost too much at 4 views). */
    shadow: { kind: 'focus', mapSize: 1024, extent: 34 },
    shadowRadius: 2,
    anisotropy: 4,
    sharpness: 0.4,
    vegetationDensity: 0.5,
    pineShadows: false,
    cameraFar: 1400,
  },
} as const;

/**
 * Dynamic resolution, driven by GPU time (or by missed frames when the browser has no GPU timer).
 * Budgets are shares of the frame interval, which is never shorter than 1/60 s.
 */
export const RESOLUTION = {
  /** After a drop, aim the GPU time at this share of the frame interval. */
  targetShare: 0.78,
  /** Drop when the median GPU time is above this share... */
  dropAboveShare: 0.88,
  /** ...and raise one step after `raiseAfterMs` below this share. Lower = less flip-flopping. */
  raiseBelowShare: 0.65,
  /** Scale moves in steps of this size (linear, per axis). */
  step: 0.05,
  /** At most one GPU-mode change this often (ms). */
  minChangeMs: 250,
  raiseAfterMs: 2000,
  /** GPU samples in the median. */
  sampleWindow: 8,
  /** A frame is missed when the time since the last one is above this many frame intervals. */
  missedFactor: 1.5,
  /** Without a GPU timer: drop a step when this many of the last 60 frames missed... */
  fallbackMissedPer60: 3,
  /** ...at most this often (ms)... */
  fallbackMinChangeMs: 500,
  /** ...and raise a step after this long without a missed frame (ms). */
  fallbackRaiseAfterMs: 4000,
  /** A gap this long between frames is a tab switch or a load, not the game struggling (ms). */
  hiccupMs: 250,
  /** Loading benchmark: frames measured at scale 1 before the race, capped at `loadingBenchMaxMs`. */
  loadingBenchFrames: 90,
  loadingBenchMaxMs: 4000,
  /**
   * Drop a preset on the loading screen when the GPU median is above this many times the target,
   * or (without a GPU timer) when more than this share of its frames missed.
   */
  loadingDropFactor: 1.5,
  loadingDropMissedShare: 0.1,
  /** Start the next race one preset lower when the last one spent this share at the floor scale... */
  dropIfFloorShare: 0.2,
  /** ...or missed this share of frames. */
  dropIfMissedShare: 0.01,
} as const;

/** Scripted benchmarks: `?bench=auto|matrix` (camera fly-through) and `?bench=soak`. */
export const BENCH = {
  /** Each fly-through run warms up, then measures (s). */
  warmupSeconds: 3,
  measureSeconds: 20,
  /** Fly-through cameras: speed along the track (m/s), height above it and look-ahead distance (m). */
  cameraSpeed: 45,
  cameraHeight: 2.3,
  lookAhead: 25,
  /** Soak: total length (min), one telemetry sample per window (s), a POST every few minutes. */
  soakMinutes: 30,
  soakWindowSeconds: 60,
  soakPostEveryMinutes: 5,
} as const;

export const LIGHTING = {
  /**
   * Compass bearing of the sun (0 north, 90 east, 180 south, 270 west). Kestrel Pines' start line
   * heads due east (bearing 90), so 330 puts the sun behind and to the left of the grid, 120 degrees
   * off the direction of travel: lit rear three-quarters on the grid, a lit grandstand, and tree
   * shadows striping the road.
   */
  sunBearing: 330,
  /** The sun is a directional light (it casts the shadows). Colour and strength. */
  sunColour: 0xffe2b4,
  sunIntensity: 7.5,
  /** Soft light from the sky picture on every surface. Higher = flatter, brighter shadows. */
  environmentIntensity: 1,
  /**
   * The sky picture's sun is capped at this brightness when it lights the scene (the directional
   * light already plays the sun) and in the visible sky (so bloom around it stays a glow, not a
   * flood).
   */
  skyLightCap: 8,
  skyVisibleCap: 40,
  /** Light bounced up from the ground (linear RGB): mixed grass, forest floor and asphalt. */
  groundBounce: [0.1, 0.12, 0.07],
  /**
   * Haze: exponential-squared fog density per metre (13% at 200 m, 44% at 400 m, all but gone at
   * 1400 m, so no preset's far plane ever shows). Higher = distant treelines fade sooner.
   */
  fogDensity: 0.0019,
  /** Multiplies the sky colour the haze fades to: distant treelines stay a shade darker and cooler than the sky. */
  fogTint: 0xe2e9ef,
  /** Neutral sky/ground fill so shadows keep detail without turning sky-blue. */
  hemisphere: { sky: 0xdfe4e2, ground: 0x3a4430, intensity: 0.25 },
} as const;

export const POST = {
  /** Brightness before tone mapping (ACES). A forest is darker than sand, so this opens up a third of a stop. */
  exposure: 1.95,
  /** Bloom: only pixels brighter than `threshold` glow (with a soft `knee`); `strength` is how much. */
  bloomThreshold: 1.9,
  bloomKnee: 0.8,
  bloomStrength: 0.07,
  /** Darkening at the edges of each viewport, plus extra at top speed (0 = none). */
  vignette: 0.12,
  vignetteAtSpeed: 0.08,
  /** Speed lines fade in from the first speed and are fully visible at the second (km/h). Off: speed comes from FOV and the trackside. */
  speedLinesFromKph: 115,
  speedLinesFullKph: 175,
  speedLinesOpacity: 0,
  /** Grade: colour multiplied into the image (r, g, b) and saturation (1 = unchanged). The warmth comes from the sun, not a wash. */
  tint: [0.99, 1.0, 0.985],
  saturation: 1.05,
} as const;

/** Track 1 dressing: surface materials, forest and trackside props. Colours are linear multipliers unless a name says hex. */
export const SCENERY = {
  /** Texture tile sizes (m): asphalt, grass run-off, gravel, terrain grass and forest floor. */
  asphaltTile: 2.5,
  grassTile: 3,
  gravelTile: 2,
  terrainGrassTile: 4,
  forestTile: 3,
  /** The asphalt texture is far darker than real tarmac (mean 0.013), so its colour is scaled up; the paved apron is older, lighter tarmac. */
  asphaltAlbedo: 6,
  apronAlbedo: 7.5,
  /** Rubber line: half width (m) around the racing line, albedo multiplier and roughness drop. */
  rubberHalfWidth: 1.1,
  rubberAlbedo: 0.82,
  rubberRoughness: 0.12,
  /** Grass run-off, gravel and the two terrain layers: colour multipliers on the textures (linear RGB). */
  grassColour: [0.72, 0.86, 1.35],
  gravelColour: [1, 0.97, 0.92],
  terrainGrassColour: [0.66, 0.8, 1.25],
  forestFloorColour: [0.62, 0.78, 0.95],
  /** The deep forest floor is darker (albedo x (1 - this x wildness)), so it reads as shaded forest even without tree shadows. */
  canopyDarkening: 0.35,
  /** Pines: young trees in the edge band and tall emergents everywhere break up the treeline. */
  pineEdgeBand: 30,
  pineYoungShare: 0.25,
  pineEmergentShare: 0.03,
  /** Pines catch this much sky light (absolute; they would go black on their shadow side at the scene's own level). */
  pineSkyLight: 1.6,
  /** The sky light on the pines is blue: this warms their albedo back to a needle green (linear RGB). */
  pineTint: [1, 0.97, 0.78],
  /** Forest tile size (m): one instanced mesh per tile, so the main and shadow passes cull them. */
  pineTile: 200,
  /** Treeline ring around the land's edge: height range (m) and how far the skyline rolls (m). */
  ringHeightMin: 25,
  ringHeightMax: 40,
  ringRoll: 12,
  /** Blob shadow under each car: size (m) and darkness. */
  blobLength: 4.4,
  blobWidth: 2.2,
  blobOpacity: 0.55,
  /** Kerb camera shake per unit of surface rumble, at most once per this many seconds, above this speed (m/s). */
  kerbShake: 0.25,
  kerbShakeEvery: 0.2,
  kerbShakeMinSpeed: 10,
  /** High-speed buffeting: a faint shake from this speed (km/h), full strength after this many km/h more. */
  buffetFromKph: 160,
  buffetRampKph: 27,
  buffetShake: 0.12,
} as const;

export const AUDIO = {
  /** Overall volume, 0..1. */
  master: 0.8,
  /** Per-sound volumes. Engines are per car, so four cars add up. */
  engine: 0.26,
  screech: 0.32,
  wind: 0.1,
  /** Off-road and kerb rumble, scaled by the surface's `rumble`. */
  surface: 0.3,
  impact: 0.75,
  horn: 0.2,
  beeps: 0.3,
  crowd: 0.45,
  /** Engine revs at idle and at the top of each gear. The pitch is four pulses per rev, like a V8. */
  idleRpm: 950,
  redlineRpm: 7400,
  /** Speed (m/s) at the top of gears 1-6. */
  gearTops: [13, 21, 29, 37, 45, 54],
} as const;

export const SLIPSTREAM = {
  /** Within this distance behind a car (m), this far off its line (m), above this speed (m/s). */
  range: 16,
  width: 1.8,
  minSpeed: 20,
  /** At full slipstream: share of air drag removed. Aero only, no extra push. */
  dragCut: 0.55,
} as const;
