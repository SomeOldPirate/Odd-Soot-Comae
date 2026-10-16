/**
 * Odd Soot on the Comae Engine: mystery and investigation in an alternate 1920s where humanity has
 * reached the stars and an alien plague of the mind called The Soot is spreading, played with
 * Clarence Redd's lighter d100 rules (FrostByte Books): nine skills and their Focuses, four Conflict
 * Pools, Tags, Lenses, and every challenge an Extended Conflict.
 * A Foundry Virtual Tabletop game system for Foundry V14.
 *
 * @module oddsoot-comae
 */

import C, { SYSTEM_ID } from "./config.mjs";
import * as R from "./rules.mjs";

import { CharacterData, NpcData } from "./data/actors.mjs";
import { FocusData, TagData, PeculiarityData, WeaponData, ArmorData, GearData, CareerData } from "./data/items.mjs";

import ComaeActor from "./documents/actor.mjs";
import ComaeCombat from "./documents/combat.mjs";

import { CharacterSheet, NpcSheet } from "./apps/actor-sheets.mjs";
import ComaeItemSheet from "./apps/item-sheet.mjs";
import ConflictBoard, { registerBoardHooks } from "./apps/conflict-board.mjs";

import * as Chat from "./helpers/chat.mjs";
import * as Dice from "./dice/roll.mjs";
import * as Magic from "./dice/magic.mjs";
import * as Conflict from "./conflict.mjs";
import { migrateWorld } from "./migration.mjs";
import { registerEnrichers } from "./helpers/enrichers.mjs";

const { t } = Chat;

/* -------------------------------------------- */
/*  Init                                        */
/* -------------------------------------------- */

Hooks.once("init", () => {
  console.log("Odd Soot (Comae Engine) | Every challenge is a conflict; every killing, a test.");

  CONFIG.COMAE = C;
  game.oddSootComae = {
    config: C, rules: R, chat: Chat, dice: Dice, magic: Magic, conflict: Conflict,
    applications: { CharacterSheet, NpcSheet, ComaeItemSheet, ConflictBoard },
    /** Start an extended conflict (Game Master). */
    newConflict: o => Conflict.createConflict(o),
    /** Open the board of the current conflict. */
    openConflict: () => {
      const c = Conflict.conflicts().find(x => x.active) ?? Conflict.conflicts()[0];
      return c ? ConflictBoard.show(c) : ui.notifications.info(t("COMAE.Conflict.none"));
    },
    /** The start of a session: every investigator's Peculiarities are rolled. */
    newSession: async () => {
      if ( !game.user.isGM ) return;
      for ( const a of game.actors.filter(x => x.type === "character" && x.hasPlayerOwner) ) await a.rollPeculiarities("session");
    },
    /** The end of a session: experience rolls for every investigator. */
    endSession: async () => {
      if ( !game.user.isGM ) return;
      for ( const a of game.actors.filter(x => x.type === "character" && x.hasPlayerOwner) ) await a.endSession();
    },
    rollItemMacro
  };

  /* ---------- Documents ---------- */
  CONFIG.Actor.documentClass = ComaeActor;
  CONFIG.Combat.documentClass = ComaeCombat;
  CONFIG.Actor.dataModels = { character: CharacterData, npc: NpcData };
  CONFIG.Item.dataModels = {
    focus: FocusData, tag: TagData, peculiarity: PeculiarityData,
    weapon: WeaponData, armor: ArmorData, gear: GearData, career: CareerData
  };
  CONFIG.Actor.trackableAttributes = {
    character: { bar: ["pools.body", "pools.int", "pools.pow", "pools.cha"], value: ["luck.value", "soot.value"] },
    npc: { bar: ["pools.body", "pools.int", "pools.pow", "pools.cha"], value: ["soot.value"] }
  };
  // A conflict's order is its pool; nothing is rolled.
  CONFIG.Combat.initiative = { formula: "@pools.body.value", decimals: 0 };

  /* ---------- Fonts ---------- */
  const font = `systems/${SYSTEM_ID}/assets/fonts`;
  CONFIG.fontDefinitions.Limelight = { editor: true, fonts: [{ urls: [`${font}/Limelight-Regular.woff2`] }] };
  CONFIG.fontDefinitions["Special Elite"] = { editor: true, fonts: [{ urls: [`${font}/SpecialElite-Regular.woff2`] }] };
  CONFIG.fontDefinitions["Cormorant Garamond"] = {
    editor: true,
    fonts: [
      { urls: [`${font}/CormorantGaramond.woff2`], weight: "300 700" },
      { urls: [`${font}/CormorantGaramond-Italic.woff2`], weight: "300 700", style: "italic" }
    ]
  };

  /* ---------- Sheets ---------- */
  const { DocumentSheetConfig } = foundry.applications.apps;
  DocumentSheetConfig.registerSheet(Actor, SYSTEM_ID, CharacterSheet, { types: ["character"], makeDefault: true, label: "COMAE.Sheet.character" });
  DocumentSheetConfig.registerSheet(Actor, SYSTEM_ID, NpcSheet, { types: ["npc"], makeDefault: true, label: "COMAE.Sheet.npc" });
  DocumentSheetConfig.registerSheet(Item, SYSTEM_ID, ComaeItemSheet, { makeDefault: true, label: "COMAE.Sheet.item" });

  /* ---------- Templates ---------- */
  const tpl = `systems/${SYSTEM_ID}/templates`;
  foundry.applications.handlebars.loadTemplates([
    `${tpl}/chat/card.hbs`,
    `${tpl}/dialog/roll.hbs`,
    `${tpl}/apps/conflict-setup.hbs`,
    `${tpl}/actor/parts/skill-row.hbs`,
    `${tpl}/actor/parts/peculiarity.hbs`,
    ...["focus", "tag", "peculiarity", "weapon", "armor", "gear", "career"].map(type => `${tpl}/item/${type}.hbs`)
  ]);
  Handlebars.registerHelper("ocSigned", n => (Number(n) > 0 ? `+${n}` : String(n)));

  registerSettings();
  registerBoardHooks();
  registerEnrichers();
});

/* -------------------------------------------- */
/*  Settings                                    */
/* -------------------------------------------- */

function registerSettings() {
  const flag = (key, def, extra = {}) => game.settings.register(SYSTEM_ID, key, {
    name: `COMAE.Settings.${key}.name`, hint: `COMAE.Settings.${key}.hint`, scope: "world", config: true, type: Boolean, default: def, ...extra
  });
  flag("lenses", true);
  flag("halving", false);
  flag("negativeLuck", false);
  flag("lethal", true);
  flag("corruption", false);
  game.settings.register(SYSTEM_ID, "magicOverflow", {
    name: "COMAE.Settings.magicOverflow.name", hint: "COMAE.Settings.magicOverflow.hint", scope: "world", config: true,
    type: String, default: "push", choices: { push: "COMAE.Settings.magicOverflow.push", body: "COMAE.Settings.magicOverflow.body" }
  });
  game.settings.register(SYSTEM_ID, "migrated", { scope: "world", config: false, type: String, default: "" });
}

/* -------------------------------------------- */
/*  Chat                                        */
/* -------------------------------------------- */

Hooks.on("renderChatMessageHTML", Chat.onRenderChatMessage);
Hooks.on("createChatMessage", Chat.onCreateChatMessage);

/* -------------------------------------------- */
/*  Combat Tracker                              */
/* -------------------------------------------- */

Hooks.on("renderCombatTracker", (app, html) => {
  const combat = app.viewed;
  if ( Conflict.isConflict(combat) ) {
    const conflict = Conflict.conflictOf(combat);
    const banner = document.createElement("div");
    banner.className = "oc-tracker-banner";
    banner.innerHTML = `<span class="oc-tracker-banner__kicker">${t("COMAE.Conflict.kicker")}</span>
      <strong>${Chat.esc(conflict.name)}</strong>
      <span>${t("COMAE.Conflict.roundN", { n: combat.round })} · ${C.pools[conflict.pool]?.abbr ?? ""}</span>
      <button type="button" class="oc-tracker-banner__open"><i class="fa-solid fa-scale-unbalanced"></i> ${t("COMAE.Conflict.openBoard")}</button>`;
    banner.querySelector("button").addEventListener("click", () => ConflictBoard.show(combat));
    const list = html.querySelector(".combat-tracker") ?? html.querySelector("ol");
    list?.before(banner);
  }
  if ( game.user.isGM && !html.querySelector(".oc-new-conflict") ) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "oc-new-conflict";
    button.innerHTML = `<i class="fa-solid fa-scale-unbalanced"></i> ${t("COMAE.Conflict.new")}`;
    button.addEventListener("click", () => Conflict.createConflict());
    const header = html.querySelector(".combat-tracker-header") ?? html.querySelector("header");
    header?.append(button);
  }
});

/* -------------------------------------------- */
/*  Hotbar                                      */
/* -------------------------------------------- */

Hooks.on("hotbarDrop", (bar, data, slot) => {
  if ( data.type !== "Item" ) return;
  createItemMacro(data, slot);
  return false;
});

async function createItemMacro(data, slot) {
  const item = await fromUuid(data.uuid);
  if ( !item?.parent || !["focus", "weapon", "peculiarity", "tag"].includes(item.type) ) return;
  const command = `game.oddSootComae.rollItemMacro("${item.uuid}");`;
  let macro = game.macros.find(m => (m.name === item.name) && (m.command === command));
  macro ??= await Macro.create({ name: item.name, type: "script", img: item.img, command, flags: { [SYSTEM_ID]: { itemMacro: true } } });
  return game.user.assignHotbarMacro(macro, slot);
}

async function rollItemMacro(uuid) {
  const item = await fromUuid(uuid);
  if ( !item?.parent ) return ui.notifications.warn(t("COMAE.Macro.missing"));
  return item.parent.rollItem(item);
}

/* -------------------------------------------- */
/*  Items                                       */
/* -------------------------------------------- */

Hooks.on("preCreateItem", (item, data) => {
  if ( data.img && (data.img !== Item.DEFAULT_ICON) ) return;
  let icon = { tag: "tag", peculiarity: "peculiarity", weapon: item.system.firearm ? "firearm" : "weapon", armor: "armour", gear: "equipment", career: "career" }[item.type];
  if ( item.type === "focus" ) icon = item.system.isSpell ? "spell" : `skill-${item.system.skill}`;
  if ( (item.type === "tag") && (item.system.key === "paranormal") ) icon = "paranormal";
  if ( icon ) item.updateSource({ img: `systems/${SYSTEM_ID}/assets/icons/${icon}.svg` });
});

/** #Paranormal granted in play: Magic starts at POW × 2. */
Hooks.on("createItem", (item, options, userId) => {
  if ( userId !== game.user.id ) return;
  const actor = item.parent;
  if ( !actor || (item.type !== "tag") || (item.system.key !== "paranormal") || options.comaeLearned ) return;
  if ( actor.system.creation ) return;
  const start = actor.system.pools.pow.max * 2;
  if ( actor.system.skills.magic.value < start ) actor.update({ "system.skills.magic.value": start });
});

/* -------------------------------------------- */
/*  Dice So Nice                                */
/* -------------------------------------------- */

Hooks.once("diceSoNiceReady", dice3d => {
  dice3d.addColorset({
    name: "oddsoot-comae", description: "Odd Soot (Comae)", category: "Odd Soot",
    foreground: "#efe6d0", background: "#16120f", outline: "#3b2f25", edge: "#0b0908", texture: "none", material: "metal"
  }, "default");
});

/* -------------------------------------------- */
/*  Ready                                       */
/* -------------------------------------------- */

Hooks.once("ready", async () => {
  await migrateWorld();
  for ( const c of Conflict.conflicts() ) {
    if ( game.user.isGM || c.combatants.some(x => x.isOwner) ) ConflictBoard.show(c);
  }
});
