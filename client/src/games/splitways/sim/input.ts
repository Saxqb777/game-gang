/** What a driver is asking the car to do this instant, whatever the input device. */
export interface DriveInput {
  /** -1 full left .. +1 full right. */
  steer: number;
  /** 0..1 */
  throttle: number;
  /** 0..1. Held at a standstill (without gas) it reverses. */
  brake: number;
  handbrake: boolean;
  horn: boolean;
}

export const NEUTRAL_INPUT: Readonly<DriveInput> = {
  steer: 0,
  throttle: 0,
  brake: 0,
  handbrake: false,
  horn: false,
};

export function copyInput(target: DriveInput, source: Readonly<DriveInput>): DriveInput {
  target.steer = source.steer;
  target.throttle = source.throttle;
  target.brake = source.brake;
  target.handbrake = source.handbrake;
  target.horn = source.horn;
  return target;
}

/** Keyboard and pad can both drive the same car: take the stronger of each control. */
export function mergeInputs(
  target: DriveInput,
  a: Readonly<DriveInput>,
  b: Readonly<DriveInput>,
): DriveInput {
  target.steer = Math.abs(a.steer) >= Math.abs(b.steer) ? a.steer : b.steer;
  target.throttle = Math.max(a.throttle, b.throttle);
  target.brake = Math.max(a.brake, b.brake);
  target.handbrake = a.handbrake || b.handbrake;
  target.horn = a.horn || b.horn;
  return target;
}
