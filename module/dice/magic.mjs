/**
 * Luminarian magic: casting a spell Focus, paying for it from POW, and learning new spells from a
 * fons mercurialis. Also the damage cards that spells and weapons share.
 * @module oddsoot-comae/dice/magic
 */

import C, { SYSTEM_ID } from "../config.mjs";
import * as R from "../rules.mjs";
import { promptRoll } from "./roll-dialog.mjs";
import { rollD100, registerRollKind, pickActor } from "./roll.mjs";
import { postCard, registerCardAction, t, esc, actorOf } from "../helpers/chat.mjs";

const { DialogV2 } = foundry.applications.api;

/**
 * Cast a spell: Magic + 20% with the spell as Focus.
 * @param {Actor} actor
 * @param {Item} focus      A Magic Focus.
 * @param {object} [options]
 * @param {boolean} [options.inConflict]   Return the choice instead of rolling (the conflict rolls).
 */
export async function castSpell(actor, focus) {
  if ( actor.system.skills.magic.locked ) return ui.notifications.warn(t("COMAE.Magic.locked"));
  const sp = focus.system.spell;
  const extra = sp.scalable
    ? `<div class="form-group oc-roll__extra"><label>${t(sp.effect === "heal" ? "COMAE.Magic.healPoints" : "COMAE.Magic.extra")}</label>
       <input type="number" name="extra" value="0" min="0"><p class="hint">${esc(sp.costText || t("COMAE.Magic.extraHint"))}</p></div>`
    : "";
  const choice = await promptRoll(actor, {
    title: t("COMAE.Magic.castTitle", { name: focus.name }), skill: "magic", lockSkill: true, focusId: focus.id, onlyFocus: true,
    noRoutine: true, extra
  });
  if ( !choice ) return null;
  if ( choice.focusId !== focus.id ) return ui.notifications.warn(t("COMAE.Magic.needFocus"));
  const add = Math.max(0, Number(choice.data.extra) || 0);
  // Healing is bought point by point; other spells take extra POW on top of their cost.
  const heal = sp.effect === "heal" ? Math.max(1, add) : 0;
  const cost = heal ? heal * Math.max(1, sp.cost) : sp.cost + add;
  // Common and Skilled NPCs cannot push past empty.
  const pools = actor.system.pools;
  if ( !actor.system.canPush && (game.settings.get(SYSTEM_ID, "magicOverflow") === "push") && (pools.pow.value < cost) ) {
    return ui.notifications.warn(t("COMAE.Magic.tooLittle", { name: actor.name, n: cost }));
  }
  return rollD100({
    actor, kind: "cast", title: focus.name, kicker: t("COMAE.Magic.castKicker"),
    base: choice.base, target: choice.target, notes: choice.notes,
    messageMode: sp.secret ? "blind" : undefined,
    context: { focusId: focus.id, cost, effect: sp.effect, formula: sp.formula, resist: sp.resist, heal, fullCost: sp.secret }
  });
}

/* -------------------------------------------- */
/*  Paying                                      */
/* -------------------------------------------- */

/**
 * Pay a magical cost from POW, by the world's rule for running dry.
 * @param {Actor} actor
 * @param {number} cost
 * @returns {Promise<{pow: number, body: number, short: number}>}   What was taken from each.
 */
export async function payCost(actor, cost) {
  const p = actor.system.pools;
  const res = R.payPow({ pow: p.pow.value, powMax: p.pow.max, body: p.body.value, cost,
    overflow: game.settings.get(SYSTEM_ID, "magicOverflow"), canPush: actor.system.canPush });
  await actor.update({ "system.pools.pow.value": res.pow, "system.pools.body.value": res.body });
  return { pow: p.pow.value - res.pow, body: p.body.value - res.body, short: res.short };
}

/** Give back what a casting cost (when Luck changes its result). */
async function refund(actor, charged) {
  if ( !charged ) return;
  const p = actor.system.pools;
  await actor.update({
    "system.pools.pow.value": Math.min(p.pow.max, p.pow.value + (charged.pow ?? 0)),
    "system.pools.body.value": Math.min(p.body.max, p.body.value + (charged.body ?? 0))
  });
}

registerRollKind("cast", {
  opposable: false,

  rows(result, context) {
    const c = R.castCost(result.level, context.cost);
    if ( context.fullCost ) c.cost = Math.max(c.cost, context.cost);
    return [{ label: t("COMAE.Magic.cost"), value: `${c.cost} POW${c.backlash ? ` + ${C.castCosts.backlash}` : ""}`, strong: true }];
  },

  buttons(result, context) {
    if ( !R.isSuccess(result.level) ) return [];
    const out = [];
    if ( (context.effect === "damage") && context.formula ) {
      out.push({ action: "spellDamage", label: t("COMAE.Magic.damage", { formula: context.formula }), icon: "fa-solid fa-burst", who: "owner", once: "damage" });
    }
    if ( context.effect === "heal" ) {
      out.push({ action: "spellHeal", label: t("COMAE.Magic.heal", { n: context.heal }), icon: "fa-solid fa-hand-holding-medical", who: "owner", once: "heal" });
    }
    if ( context.resist && (context.resist !== "none") ) {
      const skill = context.resist === "move" ? "move" : "willpower";
      out.push({ action: "oppose", label: t("COMAE.Magic.resist"), icon: "fa-solid fa-shield-halved", who: "all", once: "oppose",
        tooltip: C.spellResist[context.resist], data: { skill, difficulty: context.resist === "willpowerVeryHard" ? "veryHard" : "normal" } });
    }
    return out;
  },

  /** Charge the caster; a re-roll by Luck refunds the earlier charge first. */
  async after(message, result, context, actor, o) {
    if ( !actor?.isOwner ) return;
    if ( o?.answer && ["luck", "repay"].includes(o.answer.kind) ) {
      await refund(actor, game.messages.get(o.answer.id)?.getFlag(SYSTEM_ID, "charged"));
    }
    const c = R.castCost(result.level, context.cost);
    // A secret spell (Farsight) always takes its full cost.
    let cost = context.fullCost ? Math.max(c.cost, context.cost) : c.cost;
    const notes = [];
    let roll = null;
    if ( c.backlash ) {
      roll = await new Roll(C.castCosts.backlash).evaluate();
      cost += roll.total;
      notes.push(t("COMAE.Magic.backlash", { n: roll.total }));
    }
    const paid = await payCost(actor, cost);
    await message.setFlag(SYSTEM_ID, "charged", paid);
    if ( paid.body ) notes.push(t("COMAE.Magic.fromBody", { n: paid.body }));
    if ( paid.short ) notes.push(t("COMAE.Magic.short", { n: paid.short }));
    if ( actor.system.pools.pow.value < 0 ) notes.push(t("COMAE.Magic.pushed"));
    if ( notes.length || roll ) {
      await postCard({ kind: "cast", kicker: t("COMAE.Magic.costKicker"), title: t("COMAE.Magic.paid", { n: cost, name: actor.name }), notes },
        { actor, rolls: roll ? [roll] : [] });
    }
    // House rule: an infected caster's disaster may feed The Soot.
    if ( (result.level === 0) && actor.system.soot.infected && game.settings.get(SYSTEM_ID, "corruption") ) {
      await actor.sootCheck(t("COMAE.Magic.corruption"));
    }
  }
});

/* -------------------------------------------- */
/*  Damage and Healing                          */
/* -------------------------------------------- */

/**
 * Roll damage and post it, with a button to apply it to whoever is targeted.
 * @param {object} o
 * @param {Actor} o.actor
 * @param {string} o.formula
 * @param {string} [o.pool="body"]
 * @param {string} o.title
 * @param {boolean} [o.armour=true]
 * @param {boolean} [o.firearm=false]
 * @param {object} [o.answer]
 */
export async function postDamageRoll({ actor, formula, pool = "body", title, armour = true, firearm = false, answer = null }) {
  const roll = await new Roll(formula).evaluate();
  const flags = answer ? { answers: answer.id, answerKind: answer.kind } : {};
  return postCard({
    kind: "damage", kicker: t("COMAE.Damage.rollKicker"), title, total: roll.total, formula: roll.formula,
    notes: [armour && pool === "body" ? t("COMAE.Damage.armourNote") : t("COMAE.Damage.noArmourNote")],
    buttons: [{ action: "applyDamage", label: t("COMAE.Damage.applyTargets"), icon: "fa-solid fa-crosshairs", who: "all",
      data: { amount: roll.total, pool, armour: armour ? 1 : 0, firearm: firearm ? 1 : 0 } }]
  }, { actor, rolls: [roll], flags });
}

registerCardAction("applyDamage", async (message, button) => {
  const d = button.dataset;
  const targets = [...game.user.targets].map(tk => tk.actor).filter(a => a?.isOwner);
  if ( !targets.length ) return ui.notifications.warn(t("COMAE.Damage.noTargets"));
  for ( const a of targets ) {
    await a.takeDamage(d.pool, Number(d.amount), { armour: d.armour === "1", firearm: d.firearm === "1", source: message.flags[SYSTEM_ID]?.card?.title });
  }
});

registerCardAction("spellDamage", async message => {
  const actor = await actorOf(message);
  const f = message.flags[SYSTEM_ID];
  return postDamageRoll({ actor, formula: f.context.formula, title: f.input.title, armour: true, answer: { id: message.id, kind: "damage" } });
});

/** Healing moves BODY damage from the patient to the caster, point for point. */
registerCardAction("spellHeal", async message => {
  const caster = await actorOf(message);
  const f = message.flags[SYSTEM_ID];
  const targets = [...game.user.targets].map(tk => tk.actor).filter(Boolean);
  const patient = targets[0] ?? await pickActor({ exclude: caster?.uuid });
  if ( !caster || !patient ) return;
  const pb = patient.system.pools.body;
  const wanted = Math.min(f.context.heal, pb.max - pb.value);
  const n = Math.max(0, Math.min(wanted, caster.system.pools.body.value));
  if ( !patient.isOwner ) return ui.notifications.warn(t("COMAE.Medicine.notOwner"));
  await patient.restorePool("body", n);
  await caster.update({ "system.pools.body.value": caster.system.pools.body.value - n });
  return postCard({ kind: "cast", kicker: t("COMAE.Magic.castKicker"), title: t("COMAE.Magic.healed", { name: patient.name, n }),
    notes: [t("COMAE.Magic.healTransfer", { name: esc(caster.name), n })] }, { actor: caster, flags: { answers: message.id, answerKind: "heal" } });
});

/* -------------------------------------------- */
/*  Learning                                    */
/* -------------------------------------------- */

/**
 * Give an actor a spell: the Focus, #Paranormal if they lacked it, and Magic at POW × 2 if lower.
 * @param {Actor} actor
 * @param {object} spellData   Item data for the spell Focus.
 */
export async function grantSpell(actor, spellData) {
  const data = foundry.utils.deepClone(spellData);
  delete data._id;
  const items = [data];
  if ( !actor.system.paranormal ) {
    const { tagData } = await import("../documents/actor.mjs");
    items.push(tagData("paranormal"));
  }
  await actor.createEmbeddedDocuments("Item", items, { comaeLearned: true });
  // A spell learned (or granted) in play: Magic starts at POW × 2 if it was lower.
  const start = actor.system.pools.pow.max * 2;
  if ( actor.system.skills.magic.value < start ) await actor.update({ "system.skills.magic.value": start });
  return postCard({ kind: "cast", kicker: t("COMAE.Magic.learnKicker"), title: t("COMAE.Magic.learned", { name: actor.name, spell: data.name }),
    notes: [t("COMAE.Magic.learnedText", { n: actor.system.skills.magic.value })] }, { actor });
}

/**
 * Ask to study a spell from a written source: the Game Master starts the conflict.
 * @param {Actor} actor
 * @param {object} spellData
 */
export async function requestStudy(actor, spellData) {
  if ( game.user.isGM ) {
    const { createConflict } = await import("../conflict.mjs");
    return createConflict({ preset: "learnSpell", actors: [actor], spell: spellData });
  }
  return postCard({
    kind: "cast", kicker: t("COMAE.Magic.learnKicker"), title: t("COMAE.Magic.studyRequest", { name: actor.name, spell: spellData.name }),
    rows: [{ label: t("COMAE.Magic.complexity"), value: String(R.complexity(spellData.system?.spell?.cost ?? 1)) }],
    buttons: [{ action: "beginStudy", label: t("COMAE.Magic.beginStudy"), icon: "fa-solid fa-book-open", who: "gm", once: "study" }]
  }, { actor, flags: { spell: spellData } });
}

registerCardAction("beginStudy", async message => {
  const actor = await actorOf(message);
  const spell = message.getFlag(SYSTEM_ID, "spell");
  if ( !actor || !spell ) return;
  const { createConflict } = await import("../conflict.mjs");
  await createConflict({ preset: "learnSpell", actors: [actor], spell });
  return postCard({ kind: "cast", kicker: t("COMAE.Magic.learnKicker"), title: t("COMAE.Magic.studyBegins", { spell: spell.name }) },
    { actor, flags: { answers: message.id, answerKind: "study" } });
});

/** Dropping a spell on a character: study it, or (Game Master) simply grant it. */
export async function onSpellDropped(actor, spellData) {
  const sys = actor.system;
  if ( sys.creation && sys.paranormal ) return actor.createEmbeddedDocuments("Item", [spellData]);
  const buttons = [{ action: "study", label: t("COMAE.Magic.study"), icon: "fa-solid fa-book-open", default: true }];
  if ( game.user.isGM ) buttons.push({ action: "grant", label: t("COMAE.Magic.grant"), icon: "fa-solid fa-wand-sparkles" });
  const choice = await DialogV2.wait({
    window: { title: spellData.name, icon: "fa-solid fa-book-skull" },
    classes: [SYSTEM_ID, "oc-dialog"],
    content: `<p>${t("COMAE.Magic.dropText", { name: esc(actor.name), spell: esc(spellData.name), n: R.complexity(spellData.system?.spell?.cost ?? 1) })}</p>`,
    buttons, rejectClose: false
  });
  if ( choice === "study" ) return requestStudy(actor, spellData);
  if ( choice === "grant" ) return grantSpell(actor, spellData);
  return null;
}
