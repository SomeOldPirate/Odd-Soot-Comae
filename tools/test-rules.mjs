#!/usr/bin/env node
/** Check the rules against the Comae Engine's and Odd Soot's own numbers. */
import assert from "node:assert/strict";
import * as R from "../module/rules.mjs";
import C from "../module/config.mjs";

const tests = {
  "doubles are exceptional": () => {
    assert.equal(R.resultLevel(22, 50), 3);
    assert.equal(R.resultLevel(66, 50), 0);
    assert.equal(R.resultLevel(100, 120), 0);
    assert.equal(R.resultLevel(50, 50), 2);
    assert.equal(R.resultLevel(51, 50), 1);
    assert.equal(R.resultLevel(10, 50), 2);
  },
  "a Focus adds 20: Awareness 50 with //Perception is 70": () => assert.equal(R.rollTarget({ skill: 50, focus: true }), 70),
  "Limus: Move //Athletics 85 with Aggressive rolls under 65": () => assert.equal(R.rollTarget({ skill: 65, focus: true, mods: [-20] }), 65),
  "difficulties and Routine": () => {
    assert.equal(R.rollTarget({ skill: 30, difficulty: "veryHard" }), 0);
    assert.equal(R.rollTarget({ skill: 30, difficulty: "easy" }), 50);
    assert.equal(R.rollTarget({ skill: 30, difficulty: "routine" }), null);
  },
  "helpers: 10, then 5, then 2": () => {
    assert.equal(R.helperBonus(1), 10); assert.equal(R.helperBonus(2), 15); assert.equal(R.helperBonus(3), 17); assert.equal(R.helperBonus(5), 17);
  },
  "highest success wins; ties and double failures decide nothing": () => {
    assert.equal(R.highestSuccess([{ id: "yra", value: 50, level: 2 }, { id: "guard", value: 68, level: 1 }]).winner, "yra");
    assert.equal(R.highestSuccess([{ id: "a", value: 30, level: 2 }, { id: "b", value: 42, level: 2 }]).winner, "b");
    assert.deepEqual(R.highestSuccess([{ id: "a", value: 30, level: 2 }, { id: "b", value: 30, level: 2 }]).tie, ["a", "b"]);
    assert.equal(R.highestSuccess([{ id: "a", value: 90, level: 1 }, { id: "b", value: 95, level: 1 }]).winner, null);
  },
  "flip the dice": () => { assert.equal(R.flipDigits(73), 37); assert.equal(R.flipDigits(7), 70); assert.equal(R.flipDigits(10), 1); assert.equal(R.flipDigits(100), 100); },
  "pushing and Comae": () => {
    assert.equal(R.isPushed({ a: { value: 0 }, b: { value: 3 } }), false);
    assert.equal(R.isPushed({ a: { value: -1 } }), true);
    assert.equal(R.inComae(-12, 12), true); assert.equal(R.inComae(-11, 12), false);
    assert.equal(R.poolFloor(12, true), -12); assert.equal(R.poolFloor(12, false), 0);
  },
  "sleep: full above zero, a point a day below": () => {
    assert.equal(R.recover(3, 12), 12); assert.equal(R.recover(0, 12), 12); assert.equal(R.recover(-4, 12), -3); assert.equal(R.recover(-1, 12), 0);
  },
  "Lenses: Aggressive keeps the higher, Cautious halves up": () => {
    assert.equal(R.lensDamage("aggressive", [2, 5]), 5); assert.equal(R.lensDamage("cautious", [5]), 3); assert.equal(R.lensDamage("none", [4]), 4);
  },
  "armour soaks": () => { assert.equal(R.soak(5, 2), 3); assert.equal(R.soak(1, 4), 0); },
  "the pyramid: Espen Lind": () => {
    const espen = { awareness: 50, combat: 30, cunning: 30, knowledge: 30, move: 30, science: 5, social: 30, tech: 5, willpower: 30 };
    assert.equal(R.pyramidCheck(espen).ok, true);
    assert.equal(R.pyramidCheck({ ...espen, tech: 30 }).ok, false);
    assert.equal(R.pyramidCheck({ ...espen, willpower: 5 }).ok, false);
  },
  "converting: BODY is (CON+SIZ)/2 up; tiers": () => {
    assert.equal(R.bodyFromMythras(11, 12), 12); assert.equal(R.tierOf(55), "common"); assert.equal(R.tierOf(56), "skilled"); assert.equal(R.tierOf(81), "master");
  },
  "a Contact: 100, 50, 25, 13": () => { assert.deepEqual([0, 1, 2, 3].map(R.callChance), [100, 50, 25, 13]); },
  "casting costs": () => {
    assert.deepEqual(R.castCost(2, 5), { cost: 5, backlash: false });
    assert.deepEqual(R.castCost(3, 5), { cost: 3, backlash: false });
    assert.deepEqual(R.castCost(1, 15), { cost: 1, backlash: false });
    assert.deepEqual(R.castCost(0, 3), { cost: 3, backlash: true });
    assert.equal(R.complexity(15), 30);
  },
  "running dry: push POW, or pay from BODY": () => {
    assert.deepEqual(R.payPow({ pow: 3, powMax: 12, body: 10, cost: 5, overflow: "push", canPush: true }), { pow: -2, body: 10, short: 0 });
    assert.deepEqual(R.payPow({ pow: 3, powMax: 12, body: 10, cost: 5, overflow: "body", canPush: true }), { pow: 0, body: 8, short: 0 });
    assert.deepEqual(R.payPow({ pow: 3, powMax: 12, body: 10, cost: 5, overflow: "push", canPush: false }), { pow: 0, body: 10, short: 2 });
    assert.deepEqual(R.payPow({ pow: 2, powMax: 10, body: 10, cost: 15, overflow: "push", canPush: true }), { pow: -10, body: 10, short: 3 });
  },
  "the Peculiarity table, halved the first time": () => {
    // The system carries no rows: a Peculiarity is chosen.
    assert.equal(R.peculiarityTable(57, true).kind, "peculiarity");
    assert.equal(R.peculiarityTable(57, true).key, null);
    assert.equal(R.peculiarityTable(57).kind, "raise");
    assert.equal(R.peculiarityTable(31).kind, "soot");
    // With rows given by a content module, it is rolled.
    Object.assign(C.peculiarities.drugAddiction, { low: 1, high: 2 });
    Object.assign(C.peculiarities.hygiene, { low: 27, high: 29 });
    assert.equal(R.peculiarityTable(57, true).key, "hygiene");
    assert.equal(R.peculiarityTable(1).key, "drugAddiction");
    delete C.peculiarities.drugAddiction.low; delete C.peculiarities.drugAddiction.high;
    delete C.peculiarities.hygiene.low; delete C.peculiarities.hygiene.high;
  },
  "Fatigue: BODY −1 per 10%": () => { assert.equal(R.fatigueBody(30), 3); assert.equal(R.fatigueBody(15), 1); },
  "defying, a step harder each time": () => { assert.equal(R.defyDifficulty(1), "normal"); assert.equal(R.defyDifficulty(2), "hard"); assert.equal(R.defyDifficulty(5), "veryHard"); },
  "pairs on a d20": () => { assert.equal(R.pairRow(["a", "b", "c"], 1), "a"); assert.equal(R.pairRow(["a", "b", "c"], 4), "b"); },
  "disposition by reaction": () => { assert.equal(R.dispositionFor(10), "affectionate"); assert.equal(R.dispositionFor(50), "neutral"); assert.equal(R.dispositionFor(100), "malicious"); }
};
let failed = 0;
for ( const [name, fn] of Object.entries(tests) ) {
  try { fn(); console.log(`ok   ${name}`); } catch ( err ) { failed++; console.log(`FAIL ${name}\n     ${err.message}`); }
}
console.log(`${Object.keys(tests).length - failed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
