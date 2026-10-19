import {
  CAR_IDS,
  CAR_INFO,
  colourHex,
  creditLine,
  type CarId,
  type CarStats,
  type ColourId,
} from '@gamergang/shared';
import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import '../carThumb.css';
import { failedThumbs, silhouette, thumbUrl } from '../cars';

/** Horizontal travel that counts as a swipe to the next or previous car. */
const SWIPE_PX = 40;

const STAT_LABELS: readonly { key: keyof CarStats; label: string }[] = [
  { key: 'speed', label: 'Speed' },
  { key: 'acceleration', label: 'Accel' },
  { key: 'handling', label: 'Handling' },
  { key: 'braking', label: 'Braking' },
  { key: 'ease', label: 'Ease' },
];

function CarSilhouette({ car }: { car: CarId }) {
  const s = silhouette(car);
  return (
    <svg className="car-sil" viewBox="0 0 160 90" aria-hidden>
      <ellipse className="car-sil-shadow" cx="80" cy="71" rx={s.length / 2 + 4} ry="3.2" />
      <path className="car-sil-body" d={s.body} />
      <path className="car-sil-glass" d={s.glass} />
      {s.wheels.map((x) => (
        <g key={x}>
          <circle className="car-sil-tyre" cx={x} cy={s.wheelY} r={s.wheelR} />
          <circle className="car-sil-rim" cx={x} cy={s.wheelY} r={s.wheelR * 0.58} />
        </g>
      ))}
    </svg>
  );
}

/**
 * The car in the player's paint: the pre-rendered thumbnail, over a drawn silhouette that shows
 * while it loads and stays when the file is missing (thumbnails ship with the car assets).
 */
export function CarThumb({
  car,
  colour,
  className = '',
}: {
  car: CarId;
  colour: ColourId;
  className?: string;
}) {
  const src = thumbUrl(car, colour);
  const [loaded, setLoaded] = useState<string | null>(null);
  const [, setFailed] = useState(0);
  const failed = failedThumbs.has(src);
  const shown = loaded === src && !failed;
  const style = { '--paint': colourHex(colour) } as CSSProperties;
  return (
    <div className={`car-thumb ${shown ? 'has-image' : ''} ${className}`} style={style}>
      {shown ? null : <CarSilhouette car={car} />}
      {failed ? null : (
        <img
          key={src}
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(src)}
          onError={() => {
            failedThumbs.add(src);
            setFailed((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

/**
 * Car card with previous / next arrows, a horizontal swipe and five dots. Make and model, body and
 * drive, five stat bars and the source credit in small print.
 */
export function CarPicker({
  car,
  colour,
  others,
  onChange,
}: {
  car: CarId;
  colour: ColourId;
  /** Names of the other players in the room, by the car they picked. */
  others: ReadonlyMap<CarId, readonly string[]>;
  onChange: (car: CarId) => void;
}) {
  const index = Math.max(0, CAR_IDS.indexOf(car));
  const info = CAR_INFO[car];
  const [direction, setDirection] = useState<'next' | 'prev' | null>(null);
  const swipe = useRef<{ id: number; x: number; y: number } | null>(null);
  const also = others.get(car) ?? [];

  const step = (by: 1 | -1) => {
    const next = CAR_IDS[(index + by + CAR_IDS.length) % CAR_IDS.length] ?? car;
    setDirection(by > 0 ? 'next' : 'prev');
    onChange(next);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    swipe.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const start = swipe.current;
    swipe.current = null;
    if (start?.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
  };

  return (
    <div
      className="car-card"
      role="group"
      aria-roledescription="car picker"
      aria-label={`Car ${String(index + 1)} of ${String(CAR_IDS.length)}`}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (swipe.current = null)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') step(-1);
        if (e.key === 'ArrowRight') step(1);
      }}
    >
      <div className="car-stage">
        <button
          type="button"
          className="car-arrow"
          aria-label="Previous car"
          onClick={() => step(-1)}
        >
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <div className="car-stage-frame">
          <CarThumb
            key={car}
            car={car}
            colour={colour}
            className={direction ? `is-from-${direction}` : ''}
          />
          <span className="car-drive">{info.drive}</span>
        </div>
        <button type="button" className="car-arrow" aria-label="Next car" onClick={() => step(1)}>
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      <div className="car-dots" aria-hidden>
        {CAR_IDS.map((id) => (
          <i key={id} className={id === car ? 'is-on' : ''} />
        ))}
      </div>
      <div className="car-title">
        <small>{info.make}</small>
        <strong aria-live="polite">
          <span className="pad-sr-only">{info.make} </span>
          {info.model}
        </strong>
        <span className="car-body">
          {info.body} · {info.drive}
        </span>
      </div>
      <dl className="car-stats">
        {STAT_LABELS.map(({ key, label }) => (
          <div key={key} className="car-stat">
            <dt>{label}</dt>
            <dd>
              <span
                className="car-bar"
                role="img"
                aria-label={`${String(info.stats[key])} of 10`}
                style={{ '--v': info.stats[key] } as CSSProperties}
              />
            </dd>
          </div>
        ))}
      </dl>
      {also.length > 0 ? <p className="car-also">Also: {also.join(', ')}</p> : null}
      <p className="car-credit">{creditLine(car)}</p>
    </div>
  );
}
