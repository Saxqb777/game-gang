/**
 * Per-car rework applied to the debranded source before packaging (spec C2b, LINEUP.md section 3).
 * The art track's V2 files are read-only; what the packager can fix without modelling tools lives
 * here, so every shipped file is rebuilt from V2 plus this table:
 *   - rims: the source rims (and any hub cap under the wheel node) are replaced by a generated rim,
 *     so iconic or simplifier-hostile rim designs never ship;
 *   - materials: per source material, new factors and optionally a new vocabulary name (family);
 *   - plate: the blank plate texture gets the Split Ways plate (LINEUP.md section 4 rules);
 *   - grille: an alpha-cut grille texture is redrawn as horizontal slats.
 * Everything is computed, never sampled from the clock or the machine, so builds stay byte-identical.
 */
import { BoxGeometry, CylinderGeometry, LatheGeometry, Matrix4, Vector2 } from 'three';
import { classifyMaterialName, CORNERS } from './classify.mjs';
import { decodeImage, encodeImage, linearToSrgb } from './images.mjs';
import { meshBounds, meshFromGeometry } from './mesh.mjs';

/**
 * Rim styles. Sizes are shares of the rim radius unless named in metres.
 *   spokes: spoke count; twin: each spoke is split into two parallel legs this far apart;
 *   hubShare: centre boss radius; rootWidth / tipWidth: spoke width at the boss and at the barrel;
 *   dish: how far (m) the boss sits behind the lip plane; centreLock: hexagon nut instead of lugs.
 */
const RIM_STYLES = {
  /** Mudlark: a flat-face six-spoke with five lugs, the rally look. */
  flatSix: {
    spokes: 6,
    twin: 0,
    hubShare: 0.24,
    rootWidth: 0.2,
    tipWidth: 0.17,
    spokeDepth: 0.028,
    dish: 0.008,
    centreLock: false,
  },
  /** Briganti: five deep-dished split spokes and a centre-lock nut. */
  twinFive: {
    spokes: 5,
    twin: 0.11,
    hubShare: 0.24,
    rootWidth: 0.075,
    tipWidth: 0.06,
    spokeDepth: 0.032,
    dish: 0.045,
    centreLock: true,
  },
  /** Dashwood: ten slim straight spokes, a quiet grand-tourer wheel. */
  slimTen: {
    spokes: 10,
    twin: 0,
    hubShare: 0.22,
    rootWidth: 0.11,
    tipWidth: 0.085,
    spokeDepth: 0.03,
    dish: 0.022,
    centreLock: false,
  },
};

/** A generated brake rotor (for sources without one): dark machined steel. */
const BRAKE_DISC = { color: [0.16, 0.16, 0.17], metalness: 0.9, roughness: 0.42 };

/** Lathe and nut resolution: round enough at LOD0 close-ups, cheap at four cars. */
const RIM_SEGMENTS = 48;
const LUG_COUNT = 5;

/**
 * The rework table. Material colours are linear RGB (glTF factors).
 * plate.text is what the Split Ways plate says (LINEUP.md section 4: the player tag or "SW P1").
 */
export const REWORK = {
  nightjar: {
    rims: { style: 'slimTen', color: [0.3, 0.31, 0.33], metalness: 0.85, roughness: 0.32 },
    materials: {
      // The white lens under the rear bar made the whole bar read white: it is a red lens now,
      // and part of the brake light.
      reverse_light: {
        name: 'taillight',
        color: [0.3, 0.012, 0.01],
        metalness: 0.1,
        roughness: 0.15,
      },
    },
    grille: 'grille',
    plate: true,
  },
  scree: {
    rims: { style: 'flatSix', color: [0.045, 0.047, 0.05], metalness: 0.75, roughness: 0.38 },
    plate: false,
  },
  haymaker: { plate: true },
  zanna: {
    rims: {
      style: 'twinFive',
      color: [0.09, 0.09, 0.1],
      metalness: 0.85,
      roughness: 0.3,
      disc: true,
    },
    plate: true,
  },
  sagitta: { plate: false },
};

/** Groups the rim replacement removes from a wheel: the rim itself and anything capping it. */
function replacedByRim(material) {
  return material.base === 'rim' || material.base === 'hub_nut' || material.family === 'trim';
}

function rotateToX(geometry) {
  // Lathe and cylinder axes are +Y; the wheel axis is X (outboard = +X before mirroring).
  return geometry.applyMatrix4(new Matrix4().makeRotationZ(-Math.PI / 2));
}

/** A spoke as a deformed box: radial from r0 to r1, centred on angle a, face at x(r). */
function spoke(style, radius, angle, faceX, offset = 0) {
  const geometry = new BoxGeometry(1, 1, 1, 1, 1, 1);
  const position = geometry.getAttribute('position');
  const r0 = radius * style.hubShare * 0.8;
  const r1 = radius * 0.9;
  for (let i = 0; i < position.count; i++) {
    const u = position.getX(i) + 0.5; // 0 at the boss, 1 at the barrel
    const v = position.getY(i); // across the spoke
    const w = position.getZ(i) + 0.5; // 0 back, 1 face
    const r = r0 + (r1 - r0) * u;
    const width = radius * (style.rootWidth + (style.tipWidth - style.rootWidth) * u);
    const front = faceX(r);
    // Spokes thin out towards the barrel and get a slight chamfer feel from the taper.
    const depth = style.spokeDepth * (1 - 0.35 * u);
    const x = front - (1 - w) * depth;
    const across = offset + v * width * (w > 0.5 ? 0.82 : 1);
    const y = Math.cos(angle) * r - Math.sin(angle) * across;
    const z = Math.sin(angle) * r + Math.cos(angle) * across;
    position.setXYZ(i, x, y, z);
  }
  // Flat-shaded: every face keeps its own vertices and normal.
  const flat = geometry.toNonIndexed();
  geometry.dispose();
  flat.deleteAttribute('normal');
  flat.computeVertexNormals();
  return flat;
}

/** The generated rim in wheel space: axis X, hub at the origin, lip face at x = faceX. */
function rimGeometries(styleName, radius, backX, lipX) {
  const style = RIM_STYLES[styleName];
  if (!style) throw new Error(`Unknown rim style ${styleName}`);
  const dish = style.dish;
  const hubFace = lipX - dish - 0.006;
  // Spoke face from the boss (deep) to the barrel (just behind the lip): the dish.
  const faceX = (r) => {
    const t = Math.min(
      1,
      Math.max(0, (r - radius * style.hubShare) / (radius * (0.9 - style.hubShare))),
    );
    return hubFace - 0.004 + (lipX - 0.012 - hubFace + 0.004) * Math.sqrt(t);
  };
  const parts = [];
  // Barrel and lip as one lathe (profile in [radius, axial]); seen from outside and inside.
  const profile = [
    [0.9, backX],
    [0.9, lipX - 0.04],
    [0.93, lipX - 0.016],
    [0.97, lipX - 0.002],
    [1.0, lipX - 0.006],
    [1.0, lipX - 0.03],
  ].map(([r, x]) => new Vector2(r * radius, x));
  for (const flip of [false, true]) {
    const points = flip ? [...profile].reverse() : profile;
    parts.push(rotateToX(new LatheGeometry(points, RIM_SEGMENTS)));
  }
  // Spokes.
  for (let i = 0; i < style.spokes; i++) {
    const angle = (i / style.spokes) * Math.PI * 2 + Math.PI / 2;
    if (style.twin > 0) {
      // Twin legs run parallel, a fixed gap apart.
      parts.push(spoke(style, radius, angle, faceX, (-style.twin / 2) * radius));
      parts.push(spoke(style, radius, angle, faceX, (style.twin / 2) * radius));
    } else {
      parts.push(spoke(style, radius, angle, faceX));
    }
  }
  // Centre boss: a short closed cylinder, then the nut or the lugs on its face.
  const boss = radius * style.hubShare;
  const bossDepth = 0.04;
  parts.push(
    rotateToX(new CylinderGeometry(boss, boss * 1.08, bossDepth, RIM_SEGMENTS)).translate(
      hubFace - bossDepth / 2,
      0,
      0,
    ),
  );
  if (style.centreLock) {
    const nut = rotateToX(new CylinderGeometry(boss * 0.42, boss * 0.5, 0.03, 6));
    parts.push(nut.translate(hubFace + 0.015, 0, 0));
    const pin = rotateToX(new CylinderGeometry(boss * 0.14, boss * 0.14, 0.012, 12));
    parts.push(pin.translate(hubFace + 0.034, 0, 0));
  } else {
    for (let i = 0; i < LUG_COUNT; i++) {
      const a = (i / LUG_COUNT) * Math.PI * 2;
      const lug = rotateToX(new CylinderGeometry(boss * 0.11, boss * 0.13, 0.016, 6));
      parts.push(
        lug.translate(hubFace + 0.008, Math.cos(a) * boss * 0.6, Math.sin(a) * boss * 0.6),
      );
    }
    const cap = rotateToX(new CylinderGeometry(boss * 0.32, boss * 0.36, 0.012, 24));
    parts.push(cap.translate(hubFace + 0.006, 0, 0));
  }
  return parts;
}

function newMaterial(source, template) {
  const index = source.materials.length;
  const material = {
    index,
    name: template.name,
    color: template.color,
    opacity: 1,
    metalness: template.metalness,
    roughness: template.roughness,
    emissive: [0, 0, 0],
    alphaMode: 'OPAQUE',
    alphaCutoff: 0.5,
    doubleSided: false,
    clearcoat: 0,
    clearcoatRoughness: 0,
    maps: { base: null, mr: null, normal: null, occlusion: null, emissive: null },
    normalScale: 1,
    occlusionStrength: 1,
  };
  const info = classifyMaterialName(material.name);
  material.base = info.base;
  material.family = info.family;
  material.cutout = false;
  source.materials.push(material);
  return material;
}

/** Replaces each wheel's rim with a generated one of the given style. */
function replaceRims(source, rims, log) {
  const material = newMaterial(source, { name: 'rim', ...rims });
  const discMaterial = rims.disc ? newMaterial(source, { name: 'brake', ...BRAKE_DISC }) : null;
  const kept = [];
  const removed = new Map(CORNERS.map((c) => [c, []]));
  for (const part of source.parts) {
    const corner = part.group.startsWith('wheel_') ? part.group.slice(-2) : null;
    if (corner && replacedByRim(source.materials[part.material])) removed.get(corner).push(part);
    else kept.push(part);
  }
  for (const corner of CORNERS) {
    const old = removed.get(corner);
    if (!old.some((part) => source.materials[part.material].base === 'rim')) {
      throw new Error(`wheel_${corner} has no rim mesh to replace`);
    }
    const rimParts = old.filter((part) => source.materials[part.material].base === 'rim');
    const { min, max } = meshBounds(rimParts.map((part) => part.mesh));
    const centre = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    const radius = Math.max(max[1] - min[1], max[2] - min[2]) / 2;
    // Left wheels (+X) face outward along +X, right wheels along -X.
    const outward = source.wheelOrigins[corner][0] >= 0 ? 1 : -1;
    const halfWidth = (max[0] - min[0]) / 2;
    const geometries = rimGeometries(rims.style, radius, -halfWidth, halfWidth);
    const place = new Matrix4()
      .makeTranslation(centre[0], centre[1], centre[2])
      .multiply(new Matrix4().makeScale(outward, 1, 1));
    for (const [i, geometry] of geometries.entries()) {
      kept.push({
        name: `wheel_${corner}_rim_${i}`,
        group: `wheel_${corner}`,
        material: material.index,
        mesh: meshFromGeometry(geometry, place),
      });
      geometry.dispose();
    }
    if (discMaterial) {
      // The source has no brake disc behind the spokes: a plain rotor fills the hole.
      const disc = rotateToX(
        new CylinderGeometry(radius * 0.74, radius * 0.74, 0.028, RIM_SEGMENTS),
      );
      disc.translate(-halfWidth * 0.25, 0, 0);
      kept.push({
        name: `wheel_${corner}_disc`,
        group: `wheel_${corner}`,
        material: discMaterial.index,
        mesh: meshFromGeometry(disc, place),
      });
      disc.dispose();
    }
    log(
      `wheel_${corner}: rim replaced by the generated ${rims.style} rim (r ${radius.toFixed(3)} m; removed ${old.map((p) => p.name).join(', ')})`,
    );
  }
  source.parts = kept;
}

function applyMaterials(source, overrides, log) {
  for (const [name, change] of Object.entries(overrides)) {
    const targets = source.materials.filter((m) => m.name === name);
    if (!targets.length) throw new Error(`Rework: no material named ${name}`);
    for (const material of targets) {
      if (change.name) {
        const info = classifyMaterialName(change.name);
        if (!info) throw new Error(`Rework: ${change.name} is not in the vocabulary`);
        material.name = change.name;
        material.base = info.base;
        material.family = info.family;
      }
      for (const key of ['color', 'metalness', 'roughness', 'emissive', 'opacity']) {
        if (change[key] !== undefined) material[key] = change[key];
      }
    }
    log(`material ${name}: ${JSON.stringify(change)}`);
  }
}

/** 5 x 7 glyphs for the plate text (rows top to bottom, '#' = ink). */
const GLYPHS = {
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
};
const PLATE_TEXT = 'SW P1';
/** Plate colours (sRGB): Split Ways navy band, charcoal letters. */
const PLATE_BAND = [24, 44, 92];
const PLATE_INK = [28, 30, 36];
const PLATE_SUPERSAMPLE = 4;

/** Paints the Split Ways plate into the light area of a blank plate image (keeps its frame). */
function drawPlate(image) {
  const { width, height, data } = image;
  // The blank area: the bounding box of the light pixels.
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      if (data[o] > 200 && data[o + 1] > 200 && data[o + 2] > 200) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    }
  }
  if (x1 < 0) throw new Error('Plate image has no light area');
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const band = Math.round(Math.min(w * 0.13, h * 0.55));
  // Text box right of the band, letters 7 cells tall filling 62% of the height.
  const cell = (h * 0.62) / 7;
  const textWidth = cell * (PLATE_TEXT.length * 6 - 1);
  const scale = Math.min(1, ((w - band) * 0.86) / textWidth);
  const c = cell * scale;
  const tx = x0 + band + (w - band - c * (PLATE_TEXT.length * 6 - 1)) / 2;
  const ty = y0 + (h - c * 7) / 2;
  const inkAt = (px, py) => {
    const gx = Math.floor((px - tx) / c);
    const gy = Math.floor((py - ty) / c);
    if (gy < 0 || gy > 6 || gx < 0) return false;
    const letter = Math.floor(gx / 6);
    const column = gx % 6;
    if (letter >= PLATE_TEXT.length || column === 5) return false;
    return GLYPHS[PLATE_TEXT[letter]][gy][column] === '#';
  };
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const o = (y * width + x) * 4;
      if (!(data[o] > 200 && data[o + 1] > 200 && data[o + 2] > 200)) continue;
      if (x < x0 + band) {
        data.set(PLATE_BAND, o);
        continue;
      }
      let ink = 0;
      for (let sy = 0; sy < PLATE_SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < PLATE_SUPERSAMPLE; sx++) {
          if (inkAt(x + (sx + 0.5) / PLATE_SUPERSAMPLE, y + (sy + 0.5) / PLATE_SUPERSAMPLE)) ink++;
        }
      }
      const share = ink / (PLATE_SUPERSAMPLE * PLATE_SUPERSAMPLE);
      for (let k = 0; k < 3; k++)
        data[o + k] = Math.round(data[o + k] * (1 - share) + PLATE_INK[k] * share);
    }
  }
  // A thin white "SW" mark would not survive LOD0 texel density; the band alone carries the brand.
  return image;
}

function replacePlate(source, log) {
  const plates = source.materials.filter((m) => m.base === 'plate' && m.maps.base !== null);
  if (!plates.length) throw new Error('Rework: no textured plate material');
  for (const material of plates) {
    const old = source.images[material.maps.base];
    const image = drawPlate(decodeImage(old.bytes));
    source.images.push({
      name: 'plate_basecolor',
      mimeType: 'image/png',
      bytes: encodeImage(image, { format: 'png' }),
    });
    material.maps = { ...material.maps, base: source.images.length - 1 };
    log(`plate: Split Ways plate "${PLATE_TEXT}" drawn on ${image.width}x${image.height}`);
  }
}

/** Horizontal slats in place of a mesh grille (alpha cut-out), same image size. */
function replaceGrille(source, name, log) {
  const material = source.materials.find((m) => m.name === name);
  if (!material || material.maps.base === null) throw new Error(`Rework: no textured ${name}`);
  const { width, height } = decodeImage(source.images[material.maps.base].bytes);
  const data = new Uint8Array(width * height * 4);
  const period = Math.max(8, Math.round(height / 9));
  for (let y = 0; y < height; y++) {
    const phase = (y % period) / period;
    const bar = phase < 0.58;
    // A lit top edge and a dark underside give the slats depth without a normal map.
    const shade = bar ? 0.16 + 0.5 * Math.max(0, 1 - phase / 0.12) * 0.4 - phase * 0.12 : 0;
    const value = linearToSrgb(Math.max(0, shade) * 0.25);
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      data[o] = value;
      data[o + 1] = value;
      data[o + 2] = value;
      data[o + 3] = bar ? 255 : 0;
    }
  }
  source.images.push({
    name: `${name}_basecolor`,
    mimeType: 'image/png',
    bytes: encodeImage({ width, height, data }, { format: 'png', alpha: true }),
  });
  material.maps = { ...material.maps, base: source.images.length - 1, normal: null };
  log(`${name}: mesh pattern redrawn as horizontal slats`);
}

/** Applies the car's rework to a neutral source model in place. */
export function applyRework(id, source, log = () => undefined) {
  const rework = REWORK[id];
  if (!rework) return source;
  if (rework.materials) applyMaterials(source, rework.materials, log);
  if (rework.rims) replaceRims(source, rework.rims, log);
  if (rework.plate) replacePlate(source, log);
  if (rework.grille) replaceGrille(source, rework.grille, log);
  return source;
}
