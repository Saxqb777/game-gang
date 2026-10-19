/**
 * Thumbnail studio (dev only, /tools/thumbs; spec C2a.5, D-C7). Renders every car in every paint
 * with the game's own car library, paint and sky, so the phone can show the car without three.js.
 * "Download all" zips the 40 WebP files plus thumbs.json (the SHA-256 of each GLB they show);
 * `pnpm assets:cars --thumbs <zip>` checks the zip into assets/cars/.
 */
import './thumbs.css';
import { CAR_IDS, PLAYER_COLOURS, carName, type CarId, type ColourId } from '@gamergang/shared';
import { useEffect, useState } from 'react';
import {
  ACESFilmicToneMapping,
  Box3,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { zipSync } from 'three/examples/jsm/libs/fflate.module.js';
import { LIGHTING } from '../../games/splitways/config';
import { Sky } from '../../games/splitways/render/sky';
import { CarModelLibrary } from '../../games/splitways/scene/carVisual';

/** Thumbnail size and WebP quality (contract 3.9: 512x288, at most 40 KB each). */
const WIDTH = 512;
const HEIGHT = 288;
const WEBP_QUALITY = 0.82;
/** The fixed 3/4 front view: direction from the car to the camera (car space, +Z forward, +X left). */
const VIEW_DIRECTION = new Vector3(-0.62, 0.32, 0.72).normalize();
const FOV = 30;
/** Share of the frame (width or height, whichever binds) the car fills. */
const FILL = 0.92;
/**
 * Lighting: the game's sky and sun, but a studio exposure. The race exposure is set for a whole
 * scene of dark asphalt and forest; on a lone car against nothing it blows the paint out.
 */
const EXPOSURE = 0.9;
const SUN_SHARE = 0.45;
/** Forces LOD0: a car this many pixels tall is always above the LOD0 threshold. */
const LOD0_VIEW_HEIGHT_PX = 100_000;

interface Thumb {
  car: CarId;
  colour: ColourId;
  blob: Blob;
  url: string;
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function toWebp(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob?.type === 'image/webp') resolve(blob);
        else reject(new Error('This browser cannot encode WebP'));
      },
      'image/webp',
      WEBP_QUALITY,
    );
  });
}

/** Places the camera on the fixed view direction so the box's corners fill the frame. */
function frame(camera: PerspectiveCamera, box: Box3): void {
  const centre = box.getCenter(new Vector3());
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map(
    (i) =>
      new Vector3(
        i & 1 ? box.max.x : box.min.x,
        i & 2 ? box.max.y : box.min.y,
        i & 4 ? box.max.z : box.min.z,
      ),
  );
  let distance = box.getSize(new Vector3()).length();
  const point = new Vector3();
  // The projected size shrinks about as 1 / distance; a few rounds settle it.
  for (let round = 0; round < 4; round++) {
    camera.position.copy(centre).addScaledVector(VIEW_DIRECTION, distance);
    camera.lookAt(centre);
    camera.updateMatrixWorld();
    let extent = 0;
    for (const corner of corners) {
      point.copy(corner).project(camera);
      extent = Math.max(extent, Math.abs(point.x), Math.abs(point.y));
    }
    distance *= extent / FILL;
  }
  camera.position.copy(centre).addScaledVector(VIEW_DIRECTION, distance);
  camera.lookAt(centre);
  camera.updateMatrixWorld();
}

async function renderAll(onProgress: (done: number) => void): Promise<Thumb[]> {
  const canvas = document.createElement('canvas');
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(WIDTH, HEIGHT, false);
  renderer.outputColorSpace = SRGBColorSpace;
  // The game tone-maps in its own composite pass with the same curve.
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = EXPOSURE;
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const sky = new Sky(renderer, await Sky.loadTexture());
  scene.environment = sky.environment;
  scene.environmentRotation.copy(sky.rotation);
  scene.environmentIntensity = LIGHTING.environmentIntensity;
  const sun = new DirectionalLight(0xffffff, LIGHTING.sunIntensity * SUN_SHARE);
  sun.position.copy(sky.sunDirection).multiplyScalar(20);
  scene.add(sun);

  const library = await CarModelLibrary.load(CAR_IDS);
  const camera = new PerspectiveCamera(FOV, WIDTH / HEIGHT, 0.1, 100);
  const thumbs: Thumb[] = [];
  try {
    for (const car of CAR_IDS) {
      for (const { id: colour } of PLAYER_COLOURS) {
        const visual = library.create(car, colour);
        scene.add(visual.root);
        visual.root.updateMatrixWorld(true);
        frame(camera, new Box3().setFromObject(visual.root));
        visual.selectLod(camera, LOD0_VIEW_HEIGHT_PX, 0, 0);
        renderer.clear();
        renderer.render(scene, camera);
        const blob = await toWebp(canvas);
        thumbs.push({ car, colour, blob, url: URL.createObjectURL(blob) });
        visual.dispose();
        onProgress(thumbs.length);
      }
    }
  } finally {
    library.dispose();
    sky.dispose();
    renderer.dispose();
  }
  return thumbs;
}

async function zipThumbs(thumbs: Thumb[]): Promise<Blob> {
  const files: Record<string, Uint8Array> = {};
  const manifest: Record<string, { glbSha256: string }> = {};
  for (const car of CAR_IDS) {
    const response = await fetch(`/cars/${car}/${car}.glb`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Cannot read /cars/${car}/${car}.glb`);
    manifest[car] = { glbSha256: await sha256Hex(await response.arrayBuffer()) };
  }
  for (const thumb of thumbs) {
    files[`${thumb.car}/thumb-${thumb.colour}.webp`] = new Uint8Array(
      await thumb.blob.arrayBuffer(),
    );
  }
  files['thumbs.json'] = new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`);
  // WebP is already compressed; storing keeps the zip quick to build.
  return new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' });
}

export default function ThumbStudio() {
  const total = CAR_IDS.length * PLAYER_COLOURS.length;
  const [done, setDone] = useState(0);
  const [thumbs, setThumbs] = useState<Thumb[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zipping, setZipping] = useState(false);

  useEffect(() => {
    let cancelled = false;
    renderAll((n) => {
      if (!cancelled) setDone(n);
    }).then(
      (result) => {
        if (!cancelled) setThumbs(result);
      },
      (e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const download = async () => {
    if (!thumbs) return;
    setZipping(true);
    try {
      const zip = await zipThumbs(thumbs);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zip);
      link.download = 'car-thumbs.zip';
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setZipping(false);
    }
  };

  const largest = thumbs ? Math.max(...thumbs.map((t) => t.blob.size)) : 0;
  return (
    <main className="thumb-studio">
      <header>
        <h1>Car thumbnails</h1>
        <p data-state={error ? 'error' : thumbs ? 'ready' : 'rendering'}>
          {error ??
            (thumbs
              ? `${thumbs.length} thumbnails, largest ${(largest / 1024).toFixed(1)} KB`
              : `Rendering ${done} of ${total}...`)}
        </p>
        <button type="button" disabled={!thumbs || zipping} onClick={() => void download()}>
          Download all
        </button>
        <p className="thumb-studio-hint">Then run: pnpm assets:cars --thumbs car-thumbs.zip</p>
      </header>
      {thumbs &&
        CAR_IDS.map((car) => (
          <section key={car}>
            <h2>{carName(car)}</h2>
            <div className="thumb-studio-row">
              {thumbs
                .filter((t) => t.car === car)
                .map((t) => (
                  <figure key={t.colour}>
                    <img
                      src={t.url}
                      width={WIDTH / 2}
                      height={HEIGHT / 2}
                      alt={`${car} ${t.colour}`}
                    />
                    <figcaption>
                      {t.colour} {(t.blob.size / 1024).toFixed(1)} KB
                    </figcaption>
                  </figure>
                ))}
            </div>
          </section>
        ))}
    </main>
  );
}
