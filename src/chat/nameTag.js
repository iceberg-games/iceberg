// Name tag height per body type (no DOM/CSS deps, so mp/node tests can import it).
import { getBodySlots } from '../game/bodyTypes.js';

const CLASSIC_HEAD = getBodySlots('classic').head;
/** Name tag lift above the head bone (head pivot sits at the neck): classic = 1.1, bigger heads lift more. */
export const nameTagOffset = (bodyType) => 1.1 + (getBodySlots(bodyType).head - CLASSIC_HEAD);
