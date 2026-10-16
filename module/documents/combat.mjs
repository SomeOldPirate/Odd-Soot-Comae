/**
 * Encounters. Every conflict, a fight included, is an Extended Conflict: the highest pool acts
 * first, and initiative is never rolled.
 * @module oddsoot-comae/documents/combat
 */

import { isConflict } from "../conflict.mjs";

export default class ComaeCombat extends Combat {

  /** In a conflict, initiative is the pool. */
  async rollInitiative(ids, options = {}) {
    if ( isConflict(this) ) return this;
    return super.rollInitiative(ids, options);
  }
}
