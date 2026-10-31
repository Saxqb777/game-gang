/**
 * Debrand contact sheet (dev only, /tools/thumbs?sheet=<id>; spec 4.6). Renders one car at LOD0
 * with the game's own car library, paint and sky in nine close views (3 x 3 tiles of 1024 x 576):
 * front, rear, both sides, 3/4 front and rear, a wheel close-up, the cockpit (dash and screens,
 * seen from behind the seats) and the plate area, so every debrand item can be checked on one image.
 * `?paint=<colour>` picks the paint (default blue); the finished sheet is the canvas `#sheet`.
 */
import { CAR_IDS, PLAYER_COLOURS, carName, type CarId, type ColourId } from '@gamergang/shared';
import { useEffect, useRef, useState } from 'react';
import {
  ACESFilmicToneMapping,
  Box3,
  CircleGeometry,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { CARS, LIGHTING } from '../../games/splitways/config';
import { Sky } from '../../games/splitways/render/sky';
import { CarModelLibrary } from '../../games/splitways/scene/carVisual';

const TILE_WIDTH = 1024;
const TILE_HEIGHT = 576;
const COLUMNS = 3;
/** Studio look: mid-grey backdrop and floor so dark trim and light lenses both read. */
const BACKDROP = 0x8a929c;
const FLOOR = 0x6c727a;
const EXPOSURE = 0.95;
const SUN_SHARE = 0.5;
/** Forces LOD0 (see ThumbStudio). */
const LOD0_VIEW_HEIGHT_PX = 100_000;

/** Cockpit camera: z (car space) just behind the seats, or null for a car without a cabin. */
const COCKPIT_EYE_Z: Record<CarId, number | null> = {
  nightjar: -0.55,
  scree: -0.55,
  haymaker: -0.55,
  zanna: 0.05,
  sagitta: null,
};

interface View {
  label: string;
  fov: number;
  /** Camera position and target from the car's box (min, max, centre) and geometry. */
  place: (box: Box3, car: CarId, camera: PerspectiveCamera) => { eye: Vector3; target: Vector3 };
}

/** Share of the tile (width or height, whichever binds) a whole-car view fills. */
const FILL = 0.86;

/**
 * A whole-car view from a direction (car space: +Z forward, +X left), at the distance where the
 * box's corners fill the tile (the projected size shrinks about as 1 / distance).
 */
function around(direction: [number, number, number]) {
  return (box: Box3, _car: CarId, camera: PerspectiveCamera) => {
    const centre = box.getCenter(new Vector3());
    const dir = new Vector3(...direction).normalize();
    const corners = [0, 1, 2, 3, 4, 5, 6, 7].map(
      (i) =>
        new Vector3(
          i & 1 ? box.max.x : box.min.x,
          i & 2 ? box.max.y : box.min.y,
          i & 4 ? box.max.z : box.min.z,
        ),
    );
    let distance = box.getSize(new Vector3()).length() * 2;
    const point = new Vector3();
    for (let round = 0; round < 5; round++) {
      camera.position.copy(centre).addScaledVector(dir, distance);
      camera.lookAt(centre);
      camera.updateMatrixWorld();
      let extent = 0;
      for (const corner of corners) {
        point.copy(corner).project(camera);
        extent = Math.max(extent, Math.abs(point.x), Math.abs(point.y));
      }
      distance *= extent / FILL;
    }
    return { eye: centre.clone().addScaledVector(dir, distance), target: centre };
  };
}

const VIEWS: View[] = [
  { label: 'front', fov: 30, place: around([0, 0.18, 1]) },
  { label: 'rear', fov: 30, place: around([0, 0.18, -1]) },
  { label: 'left side', fov: 30, place: around([1, 0.06, 0]) },
  { label: 'right side', fov: 30, place: around([-1, 0.06, 0]) },
  { label: '3/4 front', fov: 30, place: around([0.75, 0.3, 0.85]) },
  { label: '3/4 rear', fov: 30, place: around([-0.75, 0.3, -0.85]) },
  {
    label: 'wheel (front left)',
    fov: 30,
    place: (_box, car) => {
      const g = CARS[car].geometry;
      const hub = new Vector3(g.halfTrackFront, g.radiusFront, g.wheelbaseHalf);
      return { eye: hub.clone().add(new Vector3(1.5, 0.2, 0.45)), target: hub };
    },
  },
  {
    // From inside, behind the seats: the dashboard screens face the driver, so a view through
    // the windscreen cannot show them, and the screens are a debrand item.
    label: 'cockpit: dash and screens',
    fov: 62,
    place: (box, car) => {
      const height = box.max.y;
      const seat = COCKPIT_EYE_Z[car];
      if (seat === null) {
        // No modelled cabin (dark glass over a tub): look in through the windscreen instead.
        return {
          eye: new Vector3(0.1, height + 0.12, box.max.z * 0.62),
          target: new Vector3(0, height * 0.55, -0.4),
        };
      }
      return {
        eye: new Vector3(0, height * 0.84, seat),
        target: new Vector3(0, height * 0.55, seat + 1.45),
      };
    },
  },
  {
    label: 'plate area (rear)',
    fov: 30,
    place: (box) => {
      const y = box.max.y * 0.45;
      return {
        eye: new Vector3(0.35, y + 0.25, box.min.z - 2.6),
        target: new Vector3(0, y, box.min.z),
      };
    },
  },
];

async function renderSheet(car: CarId, paint: ColourId): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  const renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(TILE_WIDTH, TILE_HEIGHT, false);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = EXPOSURE;

  const scene = new Scene();
  scene.background = new Color(BACKDROP);
  const sky = new Sky(renderer, await Sky.loadTexture());
  scene.environment = sky.environment;
  scene.environmentRotation.copy(sky.rotation);
  scene.environmentIntensity = LIGHTING.environmentIntensity;
  const sun = new DirectionalLight(0xffffff, LIGHTING.sunIntensity * SUN_SHARE);
  sun.position.copy(sky.sunDirection).multiplyScalar(20);
  scene.add(sun);
  const floor = new Mesh(
    new CircleGeometry(30, 48).rotateX(-Math.PI / 2),
    new MeshStandardMaterial({ color: FLOOR, roughness: 0.9 }),
  );
  scene.add(floor);

  const library = await CarModelLibrary.load([car]);
  const visual = library.create(car, paint);
  scene.add(visual.root);
  visual.root.updateMatrixWorld(true);
  const box = new Box3().setFromObject(visual.root);

  const sheet = document.createElement('canvas');
  sheet.width = TILE_WIDTH * COLUMNS;
  sheet.height = TILE_HEIGHT * Math.ceil(VIEWS.length / COLUMNS);
  const context = sheet.getContext('2d');
  if (!context) throw new Error('No 2D canvas');
  const camera = new PerspectiveCamera(30, TILE_WIDTH / TILE_HEIGHT, 0.05, 200);
  try {
    for (const [i, view] of VIEWS.entries()) {
      const { eye, target } = view.place(box, car, camera);
      camera.fov = view.fov;
      camera.updateProjectionMatrix();
      camera.position.copy(eye);
      camera.lookAt(target);
      camera.updateMatrixWorld();
      visual.selectLod(camera, LOD0_VIEW_HEIGHT_PX, 0, 0);
      renderer.render(scene, camera);
      const x = (i % COLUMNS) * TILE_WIDTH;
      const y = Math.floor(i / COLUMNS) * TILE_HEIGHT;
      context.drawImage(canvas, x, y);
      context.fillStyle = 'rgba(0, 0, 0, 0.55)';
      context.fillRect(x, y, 520, 44);
      context.fillStyle = '#ffffff';
      context.font = '26px sans-serif';
      context.fillText(`${carName(car)}: ${view.label}`, x + 12, y + 31);
    }
  } finally {
    visual.dispose();
    library.dispose();
    floor.geometry.dispose();
    floor.material.dispose();
    sky.dispose();
    renderer.dispose();
  }
  return sheet;
}

export default function ContactSheet({ car, paint }: { car: string; paint: string | null }) {
  const holder = useRef<HTMLDivElement>(null);
  const id = CAR_IDS.find((c) => c === car);
  const colour = PLAYER_COLOURS.find((c) => c.id === (paint ?? 'blue'))?.id;
  const [result, setResult] = useState<{ state: 'ready' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!id || !colour) return;
    let cancelled = false;
    renderSheet(id, colour).then(
      (sheet) => {
        if (cancelled) return;
        sheet.id = 'sheet';
        sheet.style.width = '100%';
        holder.current?.replaceChildren(sheet);
        setResult({ state: 'ready', message: `${carName(id)} in ${colour}` });
      },
      (e: unknown) => {
        if (cancelled) return;
        setResult({ state: 'error', message: e instanceof Error ? e.message : String(e) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [id, colour]);

  const shown =
    !id || !colour
      ? { state: 'error', message: `Unknown car "${car}" or paint "${paint ?? ''}"` }
      : (result ?? { state: 'rendering', message: 'Rendering...' });
  return (
    <main className="thumb-studio">
      <header>
        <h1>Contact sheet</h1>
        <p data-state={shown.state}>{shown.message}</p>
      </header>
      <div ref={holder} />
    </main>
  );
}
