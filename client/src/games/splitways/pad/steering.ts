/** Phone button steering: hold left / right arrows for steer in -1 (left) .. +1 (right). */

/** Buttons: time to go from centre to full lock, and back to centre on release (seconds). */
export const BUTTON_RAMP_S = 0.15;
export const BUTTON_RETURN_S = 0.1;

/** Hold-to-steer buttons: ramps to full over BUTTON_RAMP_S, back to centre over BUTTON_RETURN_S. */
export function rampSteer(current: number, left: boolean, right: boolean, dt: number): number {
  const target = (right ? 1 : 0) - (left ? 1 : 0);
  const towardsCentre = target === 0 || Math.sign(target) !== Math.sign(current);
  const rate = towardsCentre && current !== 0 ? 1 / BUTTON_RETURN_S : 1 / BUTTON_RAMP_S;
  const delta = rate * dt;
  if (current < target) return Math.min(current + delta, target);
  return Math.max(current - delta, target);
}
