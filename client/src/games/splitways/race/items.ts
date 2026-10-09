/**
 * Items mode: mystery boxes, the held item, and everything an item does once used (nitro, oil
 * slicks, rockets, shields, shockwaves, the bounty drone). Pure logic over the race and the cars,
 * so item races run in tests. Fixed pools: nothing is allocated while racing.
 */
import { ITEM_KINDS, type ItemKind } from '@gamergang/shared';
import { Vector3 } from 'three';
import { ITEMS } from '../config';
import type { Car } from '../sim/car';
import type { Track } from '../track/track';
import type { Boosts } from './boosts';
import type { Race, Racer } from './race';

export type HitKind = keyof typeof ITEMS.hits;

export interface ItemBox {
  readonly position: Vector3;
  /** Race clock when a taken box returns; 0 while it is there. */
  respawnAt: number;
}

export interface Holder {
  item: ItemKind | null;
  charges: number;
  /** Race clock until which the slot is still spinning. */
  rollUntil: number;
  /** Seconds of shield left. */
  shield: number;
  /** Seconds during which new hits are ignored. */
  immune: number;
  useQueued: boolean;
}

export interface Slick {
  active: boolean;
  readonly position: Vector3;
  owner: number;
  ownerSafeUntil: number;
  expires: number;
  hits: number;
}

export interface Missile {
  active: boolean;
  kind: 'rocket' | 'bounty';
  owner: number;
  /** Racer index it chases, or -1 to fly straight down the road. */
  target: number;
  /** Arc length along the track and offset from the centre line. */
  distance: number;
  lateral: number;
  height: number;
  expires: number;
  /** Flying backwards along the road (a rocket that overshot its target). */
  reversed: boolean;
  readonly position: Vector3;
  readonly heading: Vector3;
}

const MAX_SLICKS = 12;
const MAX_MISSILES = 8;
/** A rocket only locks on to a car closer than this ahead (m). */
const ROCKET_LOCK_RANGE = 260;
const scratch = new Vector3();
const forward = new Vector3();
const LOCAL_FORWARD = new Vector3(0, 0, 1);

/** Weight from a [leader, middle, last] triple at `position` (0 leader .. 1 last). */
function blend(values: readonly number[], position: number): number {
  const [front = 0, middle = 0, back = 0] = values;
  return position <= 0.5
    ? front + (middle - front) * position * 2
    : middle + (back - middle) * (position - 0.5) * 2;
}

/** Catch-up odds: the further back, the stronger the item. */
export function rollItem(
  place: number,
  count: number,
  random: () => number,
): { kind: ItemKind; charges: number } {
  const position = count > 1 ? (place - 1) / (count - 1) : 0.5;
  const weights = ITEM_KINDS.map((kind) =>
    kind === 'bounty' && (count < 3 || place === 1) ? 0 : blend(ITEMS.odds[kind], position),
  );
  let pick = random() * weights.reduce((sum, w) => sum + w, 0);
  let kind: ItemKind = 'nitro';
  for (let i = 0; i < ITEM_KINDS.length; i++) {
    pick -= weights[i] ?? 0;
    if (pick < 0) {
      kind = ITEM_KINDS[i] ?? 'nitro';
      break;
    }
  }
  const triple = kind === 'nitro' && random() < blend(ITEMS.tripleNitro, position);
  return { kind, charges: triple ? 3 : 1 };
}

/** Rows of boxes on the straightest bit of road near evenly spaced points around the lap. */
export function placeItemBoxes(track: Track): ItemBox[] {
  const boxes: ItemBox[] = [];
  const spacing = track.length / ITEMS.boxRows;
  const straightness = (distance: number) => {
    let worst = 0;
    for (let d = -12; d <= 12; d += 3)
      worst = Math.max(worst, Math.abs(track.sampleAt(distance + d).curvature));
    return worst;
  };
  for (let row = 0; row < ITEMS.boxRows; row++) {
    const target = track.startLine.distance + 150 + row * spacing;
    let best = target;
    for (let d = -80; d <= 80; d += 5) {
      if (straightness(target + d) < straightness(best)) best = target + d;
    }
    const sample = track.sampleAt(best);
    const across = (ITEMS.boxesPerRow - 1) / 2;
    for (let k = 0; k < ITEMS.boxesPerRow; k++) {
      const lateral = ((k - across) / across) * track.halfRoad * 0.62;
      boxes.push({
        position: sample.position
          .clone()
          .addScaledVector(sample.right, lateral)
          .setY(sample.position.y + 1.1),
        respawnAt: 0,
      });
    }
  }
  return boxes;
}

export class Items {
  readonly boxes: ItemBox[];
  readonly holders: Holder[];
  readonly slicks: Slick[] = [];
  readonly missiles: Missile[] = [];

  onPickup: ((index: number) => void) | null = null;
  onUse: ((index: number, kind: ItemKind) => void) | null = null;
  onHit: ((index: number, kind: HitKind) => void) | null = null;
  onBlocked: ((index: number) => void) | null = null;
  /** A rocket or drone went off at `position` (with or without hitting anyone). */
  onExplode: ((position: Vector3, kind: Missile['kind']) => void) | null = null;

  constructor(
    private readonly track: Track,
    private readonly race: Race,
    private readonly boosts: Boosts,
    private readonly random: () => number = Math.random,
  ) {
    this.boxes = placeItemBoxes(track);
    this.holders = race.racers.map(() => ({
      item: null,
      charges: 0,
      rollUntil: 0,
      shield: 0,
      immune: 0,
      useQueued: false,
    }));
    for (let i = 0; i < MAX_SLICKS; i++) {
      this.slicks.push({
        active: false,
        position: new Vector3(),
        owner: -1,
        ownerSafeUntil: 0,
        expires: 0,
        hits: 0,
      });
    }
    for (let i = 0; i < MAX_MISSILES; i++) {
      this.missiles.push({
        active: false,
        kind: 'rocket',
        owner: -1,
        target: -1,
        distance: 0,
        lateral: 0,
        height: 0,
        expires: 0,
        reversed: false,
        position: new Vector3(),
        heading: new Vector3(),
      });
    }
  }

  /** True while racer `index`'s item slot is still spinning. */
  rolling(index: number): boolean {
    const holder = this.holders[index];
    return holder !== undefined && holder.item !== null && this.race.clock < holder.rollUntil;
  }

  /** Debug: hand racer `index` an item straight away, no spin. */
  give(index: number, kind: ItemKind): void {
    const holder = this.holders[index];
    if (!holder) return;
    holder.item = kind;
    holder.charges = 1;
    holder.rollUntil = this.race.clock;
  }

  /** The ITEM button: used on the next step (if there is an item and the slot has stopped). */
  requestUse(index: number): void {
    const holder = this.holders[index];
    if (holder) holder.useQueued = true;
  }

  /** After each physics step (after the race update). */
  update(dt: number): void {
    const { race } = this;
    const clock = race.clock;
    for (const holder of this.holders) {
      holder.shield = Math.max(0, holder.shield - dt);
      holder.immune = Math.max(0, holder.immune - dt);
    }
    if (race.phase === 'countdown') return;
    for (const box of this.boxes)
      if (box.respawnAt > 0 && clock >= box.respawnAt) box.respawnAt = 0;
    for (let i = 0; i < race.racers.length; i++) {
      const racer = race.racers[i] as Racer;
      const holder = this.holders[i] as Holder;
      if (racer.finishedMs !== null) {
        holder.useQueued = false;
        continue;
      }
      this.collectBoxes(i, racer.car, holder, clock);
      if (holder.useQueued) {
        holder.useQueued = false;
        if (holder.item && clock >= holder.rollUntil && racer.car.spinTime === 0)
          this.use(i, holder);
      }
    }
    this.updateSlicks(clock);
    this.updateMissiles(dt, clock);
  }

  private collectBoxes(index: number, car: Car, holder: Holder, clock: number): void {
    for (const box of this.boxes) {
      if (box.respawnAt > 0) continue;
      const dx = car.position.x - box.position.x;
      const dz = car.position.z - box.position.z;
      if (dx * dx + dz * dz > 1.9 * 1.9 || Math.abs(car.position.y + 0.6 - box.position.y) > 2.5)
        continue;
      box.respawnAt = clock + ITEMS.boxRespawnSeconds;
      // Already holding something: the box breaks, but no second item.
      if (holder.item !== null) continue;
      const racer = this.race.racers[index] as Racer;
      const { kind, charges } = rollItem(racer.place, this.race.racers.length, this.random);
      holder.item = kind;
      holder.charges = charges;
      holder.rollUntil = clock + ITEMS.rollSeconds;
      this.onPickup?.(index);
    }
  }

  private use(index: number, holder: Holder): void {
    const kind = holder.item;
    if (!kind) return;
    const racer = this.race.racers[index] as Racer;
    const car = racer.car;
    switch (kind) {
      case 'nitro':
        this.boosts.give(index, ITEMS.nitroSeconds, 'nitro');
        break;
      case 'shield':
        holder.shield = ITEMS.shieldSeconds;
        break;
      case 'oil':
        this.dropSlick(index, car);
        break;
      case 'rocket':
        this.launch(index, 'rocket', this.rocketTarget(racer));
        break;
      case 'bounty': {
        // Hunts the leader; if you took the lead since grabbing it, it hunts second place.
        const leader = this.race.racers.findIndex((r) => r.place === 1);
        this.launch(
          index,
          'bounty',
          leader !== index ? leader : this.race.racers.findIndex((r) => r.place === 2),
        );
        break;
      }
      case 'shockwave':
        for (let j = 0; j < this.race.racers.length; j++) {
          if (j === index) continue;
          const other = (this.race.racers[j] as Racer).car;
          if (other.position.distanceTo(car.position) <= ITEMS.shockwaveRadius)
            this.hit(j, 'shockwave', car.position);
        }
        break;
    }
    holder.charges--;
    if (holder.charges <= 0) {
      holder.item = null;
      holder.charges = 0;
    }
    this.onUse?.(index, kind);
  }

  /** The car directly ahead in the order, if it is close enough to lock on to. */
  private rocketTarget(racer: Racer): number {
    const ahead = this.race.racers.findIndex((r) => r.place === racer.place - 1);
    if (ahead < 0) return -1;
    const gap = this.track.ahead(
      racer.projection.distance,
      (this.race.racers[ahead] as Racer).projection.distance,
    );
    return gap < ROCKET_LOCK_RANGE ? ahead : -1;
  }

  private dropSlick(owner: number, car: Car): void {
    const slick = this.slicks.find((s) => !s.active) ?? this.slicks[0];
    if (!slick) return;
    forward.copy(LOCAL_FORWARD).applyQuaternion(car.quaternion).setY(0).normalize();
    slick.active = true;
    slick.position.copy(car.position).addScaledVector(forward, -3.6);
    slick.owner = owner;
    slick.ownerSafeUntil = this.race.clock + 1;
    slick.expires = this.race.clock + ITEMS.oilSeconds;
    slick.hits = 0;
  }

  private launch(owner: number, kind: Missile['kind'], target: number): void {
    const missile = this.missiles.find((m) => !m.active);
    if (!missile) return;
    const racer = this.race.racers[owner] as Racer;
    missile.active = true;
    missile.kind = kind;
    missile.owner = owner;
    missile.target = target;
    missile.distance = this.track.wrap(racer.projection.distance + 3);
    missile.lateral = racer.projection.lateral;
    missile.height = kind === 'rocket' ? 0.7 : 4;
    missile.expires = this.race.clock + (kind === 'rocket' ? ITEMS.rocketLife : ITEMS.bountyLife);
    missile.reversed = false;
    this.placeMissile(missile);
  }

  private updateSlicks(clock: number): void {
    for (const slick of this.slicks) {
      if (!slick.active) continue;
      if (clock >= slick.expires) {
        slick.active = false;
        continue;
      }
      for (let j = 0; j < this.race.racers.length; j++) {
        if (j === slick.owner && clock < slick.ownerSafeUntil) continue;
        const car = (this.race.racers[j] as Racer).car;
        const dx = car.position.x - slick.position.x;
        const dz = car.position.z - slick.position.z;
        if (dx * dx + dz * dz > ITEMS.oilRadius * ITEMS.oilRadius) continue;
        if (Math.abs(car.position.y - slick.position.y) > 1.5) continue;
        if (this.hit(j, 'oil', slick.position)) {
          slick.hits++;
          if (slick.hits >= 2) slick.active = false;
        }
      }
    }
  }

  private updateMissiles(dt: number, clock: number): void {
    const { track, race } = this;
    for (const missile of this.missiles) {
      if (!missile.active) continue;
      const rocket = missile.kind === 'rocket';
      const target = missile.target >= 0 ? race.racers[missile.target] : undefined;
      // Metres the target is ahead of the missile (just behind reads as almost a lap).
      const gap = target ? track.ahead(missile.distance, target.projection.distance) : Infinity;
      const overshot = rocket && target !== undefined && gap > track.length - 20;
      // A rocket that flew past its target turns back for it; otherwise full speed ahead.
      const speed = overshot ? -30 : rocket ? ITEMS.rocketSpeed : ITEMS.bountySpeed;
      missile.distance = track.wrap(missile.distance + speed * dt);
      missile.reversed = overshot;
      if (target && (gap < 60 || overshot)) {
        // Home in sideways, hard when close (and the drone dives on its target).
        const rate = rocket ? (gap < 40 || overshot ? 30 : 12) : 16;
        const step = rate * dt;
        missile.lateral += Math.max(
          -step,
          Math.min(step, target.projection.lateral - missile.lateral),
        );
        if (!rocket) missile.height = Math.max(1, missile.height - 6 * dt);
      }
      this.placeMissile(missile);

      let victim = -1;
      if (rocket) {
        for (let j = 0; j < race.racers.length && victim < 0; j++) {
          if (j === missile.owner) continue;
          scratch.subVectors((race.racers[j] as Racer).car.position, missile.position);
          const near = scratch.x * scratch.x + scratch.z * scratch.z < 2.8 * 2.8;
          if (near && Math.abs(scratch.y) < 2.5) victim = j;
        }
      } else if (target && target.car.position.distanceTo(missile.position) < 3.2) {
        victim = missile.target;
      }
      if (victim >= 0) this.explode(missile, victim);
      else if (clock >= missile.expires) this.explode(missile, -1);
    }
  }

  private explode(missile: Missile, victim: number): void {
    missile.active = false;
    this.onExplode?.(missile.position, missile.kind);
    if (victim < 0) return;
    this.hit(victim, missile.kind, missile.position);
    if (missile.kind === 'bounty') {
      // The drone's blast catches anyone right next to the leader too.
      for (let j = 0; j < this.race.racers.length; j++) {
        if (j === victim || j === missile.owner) continue;
        if ((this.race.racers[j] as Racer).car.position.distanceTo(missile.position) < 7)
          this.hit(j, 'bounty', missile.position);
      }
    }
  }

  private placeMissile(missile: Missile): void {
    const sample = this.track.sampleAt(missile.distance);
    missile.position
      .copy(sample.position)
      .addScaledVector(sample.right, missile.lateral)
      .setY(sample.position.y + missile.height);
    missile.heading.copy(sample.tangent).multiplyScalar(missile.reversed ? -1 : 1);
  }

  /** Returns true if the hit landed (not shielded, finished or immune). */
  private hit(index: number, kind: HitKind, from: Vector3): boolean {
    const racer = this.race.racers[index];
    const holder = this.holders[index];
    if (!racer || !holder || racer.finishedMs !== null || holder.immune > 0) return false;
    if (holder.shield > 0) {
      holder.shield = 0;
      holder.immune = 0.5;
      this.onBlocked?.(index);
      return false;
    }
    const car = racer.car;
    const { seconds, turns, speedKept } = ITEMS.hits[kind];
    car.spinOut(seconds, speedKept, turns);
    if (kind === 'shockwave') {
      scratch.subVectors(car.position, from).setY(0);
      if (scratch.lengthSq() < 0.01) scratch.set(1, 0, 0);
      scratch.normalize().multiplyScalar(ITEMS.shockwavePush);
      car.push(scratch.x, 2, scratch.z);
    } else if (kind !== 'oil') {
      car.push(0, kind === 'bounty' ? 5 : 3.5, 0);
    }
    holder.immune = ITEMS.hitImmunity;
    this.onHit?.(index, kind);
    return true;
  }
}
