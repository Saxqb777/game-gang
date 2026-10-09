import { Hub } from '../hub/hub';
import { HostTransport } from '../net/hostTransport';

let hub: Hub | null = null;

/** One hub per TV page, created outside React so remounts never open a second room. */
export function getHub(): Hub {
  if (!hub) {
    hub = new Hub('splitways', (events) => new HostTransport(events));
    hub.start();
  }
  return hub;
}
