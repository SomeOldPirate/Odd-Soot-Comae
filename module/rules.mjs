/**
 * The arithmetic of Odd Soot on the Comae Engine, kept free of Foundry so that it can be tested
 * on its own (tools/test-rules.mjs).
 * @module oddsoot-comae/rules
 */

import C from "./config.mjs";

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** A d100 result as it reads on the dice: 100 is "00". */
export const d100Text = n => (n === 100 ? "00" : String(n).padStart(2, "0"));

/* -------------------------------------------- */
/*  Skill Rolls                                 */
/* -------------------------------------------- */

/** Doubles (11, 22 … 99, and 00) are exceptional. */
export function isDouble(roll) {
  if ( roll === 100 ) return true;
  return (roll >= 11) && (roll <= 99) && (roll % 11 === 0);
}

/**
 * Read a d100 roll. 3 exceptional success, 2 success, 1 failure, 0 exceptional failure.
 * A double under the skill is exceptionally good, over it exceptionally bad; 00 is always bad.
 * @param {number} roll     1-100
 * @param {number} target
 */
export function resultLevel(roll, target) {
  if ( roll === 100 ) return 0;
  const success = roll <= target;
  if ( isDouble(roll) ) return success ? 3 : 0;
  return success ? 2 : 1;
}

export const isSuccess = level => level >= 2;

/** Swap a roll's digits (Luck): 73 becomes 37, 07 becomes 70, 00 stays 00. */
export function flipDigits(roll) {
  if ( roll === 100 ) return 100;
  const s = d100Text(roll);
  const n = Number(s[1] + s[0]);
  return n === 0 ? 100 : n;
}

/** What a helping hand adds: +10% for the first helper, +5% the second, +2% the third. */
export function helperBonus(n) {
  return C.helpers.slice(0, clamp(n, 0, C.helpers.length)).reduce((a, b) => a + b, 0);
}

/**
 * The target of a skill roll.
 * @param {object} o
 * @param {number} o.skill              The skill.
 * @param {boolean} [o.focus]           A Focus applies (+20%).
 * @param {string} [o.difficulty]       A key of C.difficulties.
 * @param {number} [o.helpers]          How many help.
 * @param {number[]} [o.mods]           Every other modifier.
 * @returns {number|null}               null for Routine: no roll.
 */
export function rollTarget({ skill, focus = false, difficulty = "normal", helpers = 0, mods = [] }) {
  const d = C.difficulties[difficulty] ?? C.difficulties.normal;
  if ( d.mod === null ) return null;
  const total = skill + (focus ? C.focusBonus : 0) + d.mod + helperBonus(helpers) + mods.reduce((a, b) => a + b, 0);
  return Math.max(0, total);
}

/**
 * An opposed roll or a conflict round: the highest successful roll wins. Two equal successes tie.
 * @param {{id: string, value: number, level: number}[]} entries
 * @returns {{winner: string|null, tie: string[], succeeded: string[]}}
 */
export function highestSuccess(entries) {
  const succeeded = entries.filter(e => isSuccess(e.level));
  if ( !succeeded.length ) return { winner: null, tie: [], succeeded: [] };
  const best = Math.max(...succeeded.map(e => e.value));
  const top = succeeded.filter(e => e.value === best);
  if ( top.length > 1 ) return { winner: null, tie: top.map(e => e.id), succeeded: succeeded.map(e => e.id) };
  return { winner: top[0].id, tie: [], succeeded: succeeded.map(e => e.id) };
}

/* -------------------------------------------- */
/*  Pools                                       */
/* -------------------------------------------- */

/** Is any pool pushed below zero? */
export function isPushed(pools) {
  return Object.values(pools).some(p => p.value < 0);
}

/** Has a pool reached its full negative value? */
export const inComae = (value, max) => (max > 0) && (value <= -max);

/** Odd Soot's optional rule: at half or less, the pool's skills are Hard. */
export const isHalved = (value, max) => (value > 0) && (value <= Math.floor(max / 2));

/**
 * The lowest a pool may fall.
 * @param {number} max
 * @param {boolean} canPush   Player characters and Master NPCs may push below zero.
 */
export const poolFloor = (max, canPush) => (canPush ? -max : 0);

/**
 * A night's sleep. A pool at zero or above refills; below zero it climbs one point a day.
 * @param {number} value
 * @param {number} max
 */
export function recover(value, max) {
  if ( value >= 0 ) return max;
  return Math.min(0, value + 1);
}

/** Armour soaks a blow point for point. */
export const soak = (damage, ap) => Math.max(0, damage - Math.max(0, ap));

/**
 * Damage after a Lens. Aggressive keeps the higher of two rolls; Cautious halves (rounding up).
 * @param {string} lens
 * @param {number[]} rolls   One roll, or two for Aggressive (or Clever's second round).
 */
export function lensDamage(lens, rolls) {
  const best = Math.max(...rolls);
  if ( lens === "cautious" ) return Math.ceil(best / 2);
  return best;
}

/** Fatigue showing lowers BODY's maximum by 1 for every 10%. */
export const fatigueBody = value => Math.floor(Math.max(0, value) / 10);

/* -------------------------------------------- */
/*  Character Creation                          */
/* -------------------------------------------- */

/**
 * Check a set of skill values against the pyramid: 50, 30, 30 and four more 30s, the rest 5.
 * @param {Record<string, number>} skills   The nine.
 * @returns {{ok: boolean, used: number[], free: number[]}}
 */
export function pyramidCheck(skills) {
  const want = C.pyramid.map(p => p.value).sort((a, b) => b - a);
  const have = Object.values(skills).filter(v => v > C.skillFloor).sort((a, b) => b - a);
  const free = [...want];
  const used = [];
  for ( const v of have ) {
    const i = free.indexOf(v);
    if ( i < 0 ) return { ok: false, used, free };
    used.push(free.splice(i, 1)[0]);
  }
  return { ok: free.length === 0, used, free };
}

/** Converting a Mythras-built character: BODY is (CON + SIZ) / 2, rounded up. */
export const bodyFromMythras = (con, siz) => Math.ceil((con + siz) / 2);

/** An NPC's tier from its best skill: 55% or less Common, to 80% Skilled, above that Master. */
export function tierOf(best) {
  if ( best <= 55 ) return "common";
  if ( best <= 80 ) return "skilled";
  return "master";
}

/** Round a converted skill to the nearest 10. */
export const toTens = n => Math.round(n / 10) * 10;

/* -------------------------------------------- */
/*  Tags                                        */
/* -------------------------------------------- */

/** The chance a Contact or Lab answers: certain the first time, then halved each time. */
export function callChance(uses) {
  if ( uses <= 0 ) return 100;
  return Math.ceil(100 / (2 ** uses));
}

/* -------------------------------------------- */
/*  Magic                                       */
/* -------------------------------------------- */

/** A spell's Complexity is twice its POW cost. */
export const complexity = cost => Math.max(1, cost) * 2;

/**
 * What a casting costs, by result. Success: the cost; exceptional success: half, rounded up;
 * failure: 1; exceptional failure: the cost, and a 1d6 backlash rolled on top.
 * @param {number} level
 * @param {number} cost
 * @returns {{cost: number, backlash: boolean}}
 */
export function castCost(level, cost) {
  switch ( level ) {
    case 3: return { cost: Math.ceil(cost / 2), backlash: false };
    case 2: return { cost, backlash: false };
    case 1: return { cost: Math.min(1, cost), backlash: false };
    default: return { cost, backlash: true };
  }
}

/**
 * Pay a magical cost from POW. With too little, push POW below zero (if allowed) or pay the
 * rest from BODY.
 * @param {object} o
 * @param {number} o.pow        Current POW.
 * @param {number} o.powMax
 * @param {number} o.body       Current BODY.
 * @param {number} o.cost
 * @param {string} o.overflow   "push" or "body".
 * @param {boolean} o.canPush
 * @returns {{pow: number, body: number, short: number}}   New values, and what could not be paid.
 */
export function payPow({ pow, powMax, body, cost, overflow, canPush }) {
  const available = Math.max(0, pow);
  if ( cost <= available ) return { pow: pow - cost, body, short: 0 };
  const rest = cost - available;
  if ( overflow === "body" ) {
    const fromBody = Math.min(rest, Math.max(0, body));
    return { pow: pow - available, body: body - fromBody, short: rest - fromBody };
  }
  const floor = poolFloor(powMax, canPush);
  const newPow = Math.max(floor, pow - cost);
  return { pow: newPow, body, short: cost - (pow - newPow) };
}

/* -------------------------------------------- */
/*  The Soot                                    */
/* -------------------------------------------- */

/**
 * Read the Peculiarity table. The first roll on it is halved, rounding up. 01-29 a Peculiarity,
 * 30-49 The Soot deepens, 50+ an existing Peculiarity worsens. A Peculiarity's rows come from a
 * content module; without them the key is null and the caller chooses.
 * @param {number} roll
 * @param {boolean} [first]
 */
export function peculiarityTable(roll, first = false) {
  const r = first ? Math.ceil(roll / 2) : roll;
  if ( r >= 50 ) return { kind: "raise", roll: r };
  if ( r >= 30 ) return { kind: "soot", roll: r };
  for ( const [key, p] of Object.entries(C.peculiarities) ) {
    if ( (r >= p.low) && (r <= p.high) ) return { kind: "peculiarity", key, roll: r };
  }
  // Without the book's rows (see config), a Peculiarity is chosen rather than rolled.
  return { kind: "peculiarity", key: null, roll: r };
}

/**
 * The phase of the disease.
 * @param {number} soot
 * @param {number} [npcPhase]   An infected NPC may be set further along.
 */
export function sootPhase(soot, npcPhase = 0) {
  if ( npcPhase > 1 ) return npcPhase;
  if ( soot <= 0 ) return npcPhase === 1 ? 1 : 0;
  if ( soot >= 100 ) return 2;
  return 1;
}

/** Defying a Peculiarity again takes Willpower, a step harder each time. */
export function defyDifficulty(count) {
  return ["normal", "normal", "hard", "veryHard"][clamp(count, 0, 3)];
}

/** Find a row of a ranged table. */
export function tableRow(table, roll) {
  return table.find(r => (roll >= r.low) && (roll <= r.high)) ?? null;
}

/** Read a d20 table laid out in pairs (1-2, 3-4 …). */
export const pairRow = (list, d20) => list[clamp(Math.ceil(d20 / 2), 1, list.length) - 1];

/** The Disposition for a d100 reaction roll. */
export function dispositionFor(roll) {
  return Object.entries(C.dispositions).find(([, d]) => (roll >= d.low) && (roll <= d.high))?.[0] ?? "neutral";
}
