/**
 * Dice So Nice: the Odd Soot dice.
 *
 * A dice system ("Odd Soot", Limelight numerals) and four colour sets: Bakelite & Brass (everyone's
 * default), Soot, Enamel & Ink, and Luminarian. Spell rolls throw Luminarian dice and Soot rolls throw
 * Soot dice, whatever each player has chosen, unless the world setting turns that off.
 *
 * Players who have never saved their Dice So Nice settings get the Odd Soot dice through the
 * "preferred" registration. Players who have saved settings are switched once, the first time they
 * load a world with "Odd Soot dice for everyone" on; after that their choice stands.
 *
 * @module dice/dice-so-nice
 */

import { SYSTEM_ID } from "../config.mjs";

const DSN = "dice-so-nice";
export const DICE_SYSTEM = "oddsoot-comae";
export const DEFAULT_SET = "oddsoot-bakelite";

/** Bump when a change should switch every player over again. */
const APPLY_STAMP = "1";

const FONT = "Limelight";
const TEX = `systems/${SYSTEM_ID}/assets/dice`;

const TEXTURES = {
  "oddsoot-bakelite": { name: "Odd Soot: Bakelite", composite: "multiply", source: `${TEX}/bakelite.webp` },
  "oddsoot-soot": { name: "Odd Soot: Soot", composite: "screen", source: `${TEX}/soot.webp` },
  "oddsoot-enamel": { name: "Odd Soot: Enamel", composite: "multiply", source: `${TEX}/enamel.webp` },
  "oddsoot-luminarian": { name: "Odd Soot: Luminarian", composite: "screen", source: `${TEX}/luminarian.webp` }
};

const COLORSETS = [
  { name: DEFAULT_SET, description: "Odd Soot: Bakelite & Brass", foreground: "#e0bd72", background: "#6a2f1a",
    outline: "#1b1612", edge: "#3a1a0e", texture: "oddsoot-bakelite", material: "plastic" },
  // Kept under its old name so anyone who picked the earlier set still has it.
  { name: "oddsoot-comae", description: "Odd Soot: Soot", foreground: "#efe6d0", background: "#25211e",
    outline: "#0b0908", edge: "#0b0908", texture: "oddsoot-soot", material: "stone" },
  { name: "oddsoot-enamel", description: "Odd Soot: Enamel & Ink", foreground: "#1b1612", background: "#ebe1c8",
    outline: "#b08d47", edge: "#b08d47", texture: "oddsoot-enamel", material: "plastic" },
  { name: "oddsoot-luminarian", description: "Odd Soot: Luminarian", foreground: "#bfe3ff", background: "#13213d",
    outline: "#0a1222", edge: "#2c5a8a", texture: "oddsoot-luminarian", material: "glass" }
];

/** Card kinds whose rolls throw a set of their own. */
const THEMED = { cast: "oddsoot-luminarian", soot: "oddsoot-comae" };

/** Numerals; 6 and 9 carry a full stop where they could be misread. */
const n = (from, to, dot = true) => Array.from({ length: to - from + 1 }, (_, i) => {
  const v = String(from + i);
  return (dot && ((v === "6") || (v === "9"))) ? `${v}.` : v;
});
const PRESETS = {
  d4: n(1, 4, false),
  d6: n(1, 6, false),
  d8: n(1, 8, false),
  d10: [...n(1, 9), "0"],
  d12: n(1, 12),
  d20: n(1, 20),
  d100: ["10", "20", "30", "40", "50", "60", "70", "80", "90", "00"]
};

const active = () => !!game.modules.get(DSN)?.active;

/* -------------------------------------------- */

/** Called at init. */
export function registerDiceSoNice() {
  const config = active();
  game.settings.register(SYSTEM_ID, "diceForAll", {
    name: "COMAE.Settings.diceForAll.name", hint: "COMAE.Settings.diceForAll.hint",
    scope: "world", config, type: Boolean, default: true
  });
  game.settings.register(SYSTEM_ID, "diceThemed", {
    name: "COMAE.Settings.diceThemed.name", hint: "COMAE.Settings.diceThemed.hint",
    scope: "world", config, type: Boolean, default: true
  });

  Hooks.once("diceSoNiceReady", onReady);
}

// Registered on load, ahead of any module's hooks, so the dice are themed before anything reads them.
Hooks.on("preCreateChatMessage", themeRolls);

/* -------------------------------------------- */

/** @param {object} dice3d */
async function onReady(dice3d) {
  await Promise.all(Object.entries(TEXTURES).map(([id, data]) => dice3d.addTexture(id, data)));

  for ( const set of COLORSETS ) {
    await dice3d.addColorset({ category: "Odd Soot", font: FONT, ...set }, set.name === DEFAULT_SET ? "preferred" : "default");
  }

  dice3d.addSystem({ id: DICE_SYSTEM, name: "Odd Soot", group: "Odd Soot" }, "preferred");
  for ( const [type, labels] of Object.entries(PRESETS) ) {
    dice3d.addDicePreset({ type, labels, system: DICE_SYSTEM, font: FONT });
  }

  // Newer Dice So Nice versions set defaults through roles; older ones use "preferred" above.
  try {
    const system = dice3d.DiceFactory?.systems?.get(DICE_SYSTEM);
    system?.setRoleDefaults?.("basic", { global: { colorset: DEFAULT_SET } });
  } catch(err) {
    console.warn("Odd Soot (Comae Engine) | Dice So Nice role defaults not set", err);
  }

  try { await dice3d.preloadPresets?.(DICE_SYSTEM); } catch(err) { /* lazy loading is fine */ }

  await applyToUser();
}

/* -------------------------------------------- */

/** Switch this user to the Odd Soot dice once, if the world asks for it. */
async function applyToUser() {
  if ( !game.settings.get(SYSTEM_ID, "diceForAll") ) return;
  if ( game.user.getFlag(SYSTEM_ID, "diceApplied") === APPLY_STAMP ) return;
  try {
    const saved = game.user.getFlag(DSN, "appearance");
    const appearance = saved ? foundry.utils.deepClone(saved) : { global: {} };
    appearance.global ??= {};
    // Per-die settings would hide the set on those dice, so every scope is pointed at it.
    for ( const scope of Object.values(appearance) ) {
      if ( !scope || (typeof scope !== "object") ) continue;
      scope.system = DICE_SYSTEM;
      scope.colorset = DEFAULT_SET;
    }
    await game.user.update({
      [`flags.${DSN}.appearance`]: appearance,
      [`flags.${SYSTEM_ID}.diceApplied`]: APPLY_STAMP
    });
  } catch(err) {
    console.warn("Odd Soot (Comae Engine) | Could not set the Odd Soot dice", err);
  }
}

/* -------------------------------------------- */

/**
 * Spell and Soot rolls throw their own dice.
 * @param {ChatMessage} message
 */
function themeRolls(message) {
  if ( !active() || !message.rolls?.length ) return;
  if ( !game.settings.get(SYSTEM_ID, "diceThemed") ) return;
  const f = message.flags?.[SYSTEM_ID] ?? {};
  const colorset = THEMED[f.card?.kind ?? f.kind];
  if ( !colorset ) return;
  const rolls = message.rolls.map(roll => {
    for ( const die of roll.dice ) die.options.colorset = colorset;
    return JSON.stringify(roll);
  });
  message.updateSource({ rolls });
}
