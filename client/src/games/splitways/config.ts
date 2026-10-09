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
  /** How fast the wheels turn towards the requested angle and back to centre (radians per second). */
  turnRate: 3.4,
  returnRate: 5.5,
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
  /** Pressing gas or brake but going nowhere (wedged against a wall) for this long = respawn. */
  stuckSeconds: 3,
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
  /** Render at most this many pixels per CSS pixel. 1.25 is crisp on a TV without melting the GPU. */
  maxPixelRatio: 1.25,
  /** Anti-aliasing samples for the 3D view. 0 turns it off (faster, jaggier). */
  msaaSamples: 4,
  /**
   * Dynamic resolution: when fps drops below `lowFps` the 3D view renders at a lower scale (in
   * `step`s, never below `minScale`), and creeps back up after `recoverSeconds` of smooth 60 fps.
   */
  dynamicResolution: { minScale: 0.6, step: 0.1, lowFps: 55, recoverSeconds: 5 },
  /**
   * Shadow map resolution and the size of the area around each car that gets shadows (metres).
   * The map is re-rendered for every viewport, so with 3-4 players a smaller map keeps 60 fps.
   */
  shadowMapSize: 2048,
  shadowMapSizeManyPlayers: 1024,
  shadowExtent: 34,
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
