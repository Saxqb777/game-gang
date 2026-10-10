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
  /** Below this forward speed, holding brake (without gas) engages reverse instead. */
  reverseBelowSpeed: 0.8,
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

export const CAMERA = {
  /** Chase camera distance behind the car, height above it, and the point it looks at. */
  distance: 6.4,
  height: 2.3,
  lookAhead: 4,
  lookHeight: 0.9,
  /** How quickly the camera catches up with the car. Lower = more lag and swing. */
  followStiffness: 9,
  /** How much the camera swings towards the direction of travel when the car slides (0..1). */
  velocityHeadingBlend: 0.35,
  /** Vertical field of view (degrees) at rest, and how much it widens at top speed. */
  baseFov: 62,
  speedFov: 16,
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
  /** Compass bearing of the sun (0 north, 90 east, 180 south, 270 west). The sea is to the south. */
  sunBearing: 240,
  /** The sun is a directional light (it casts the shadows). Colour and strength. */
  sunColour: 0xffd2a1,
  sunIntensity: 6,
  /** Soft light from the sky picture on every surface. Higher = flatter, brighter shadows. */
  environmentIntensity: 1,
  /**
   * The sky picture's sun is capped at this brightness when it lights the scene (the directional
   * light already plays the sun) and in the visible sky (so bloom around it stays a glow, not a
   * flood).
   */
  skyLightCap: 8,
  skyVisibleCap: 40,
  /** Light bounced up from the sand (linear RGB): what the underside of a car sees. */
  groundBounce: [0.3, 0.24, 0.17],
  /** Haze: exponential fog density per metre. Higher = distant dunes and towers fade sooner. */
  fogDensity: 0.0013,
} as const;

export const POST = {
  /** Brightness before tone mapping (ACES). */
  exposure: 1.5,
  /** Bloom: only pixels brighter than `threshold` glow (with a soft `knee`); `strength` is how much. */
  bloomThreshold: 2.5,
  bloomKnee: 1,
  bloomStrength: 0.08,
  /** Darkening at the edges of each viewport, plus extra at top speed (0 = none). */
  vignette: 0.2,
  vignetteAtSpeed: 0.12,
  /** Speed lines fade in from the first speed and are fully visible at the second (km/h). */
  speedLinesFromKph: 115,
  speedLinesFullKph: 175,
  speedLinesOpacity: 0.2,
  /** Golden-hour grade: colour multiplied into the image (r, g, b) and saturation (1 = unchanged). */
  tint: [1.05, 1.0, 0.93],
  saturation: 1.1,
} as const;

export const AUDIO = {
  /** Overall volume, 0..1. */
  master: 0.8,
  /** Per-sound volumes. Engines are per car, so four cars add up. */
  engine: 0.26,
  screech: 0.32,
  wind: 0.1,
  sand: 0.22,
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
