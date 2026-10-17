/**
 * Rolling the percentile dice, reading them, opposing them, and twisting fate with Luck.
 * @module oddsoot-comae/dice/roll
 */

import C, { SYSTEM_ID } from "../config.mjs";
import * as R from "../rules.mjs";
import { postCard, registerCardAction, d100Text, stamp, t, esc, answered, latest } from "../helpers/chat.mjs";
import { promptRoll } from "./roll-dialog.mjs";

/**
 * What each kind of roll adds to its card, and does once rolled (or rolled again by Luck).
 * @type {Record<string, {rows?: Function, buttons?: Function, after?: Function, opposable?: boolean}>}
 */
export const ROLL_KINDS = {};

/** Register a kind of roll. */
export function registerRollKind(kind, def) {
  ROLL_KINDS[kind] = def;
}

/**
 * @typedef {object} D100Options
 * @property {Actor|null} actor
 * @property {string} title
 * @property {string} [kicker]
 * @property {number|null} target      null for Routine.
 * @property {number} [base]
 * @property {string[]} [notes]
 * @property {string} [kind="skill"]
 * @property {object} [context]
 * @property {number} [value]          A result already decided (by Luck).
 * @property {Roll} [roll]
 * @property {number} [forceLevel]     A result imposed (repaying borrowed Luck).
 * @property {{id: string, kind: string}} [answer]
 * @property {string} [luckNote]
 * @property {string} [messageMode]
 */

/**
 * Roll, read and post.
 * @param {D100Options} o
 */
export async function rollD100(o) {
  const kind = o.kind ?? "skill";
  const def = ROLL_KINDS[kind] ?? {};
  const context = o.context ?? {};

  // Routine: no dice.
  if ( o.target === null ) {
    const result = { value: null, level: 2, target: null, routine: true };
    const message = await postCard({
      kind, kicker: o.kicker ?? t(`COMAE.Card.kind.${kind}`), title: o.title,
      stamp: { key: "success", label: t("COMAE.Roll.routineStamp") }, notes: [t("COMAE.Roll.routineText"), ...(o.notes ?? [])],
      rows: def.rows ? await def.rows(result, context, o.actor) : [],
      buttons: def.buttons ? await def.buttons(result, context, o.actor) : []
    }, { actor: o.actor, flags: { kind, result, context } });
    if ( def.after ) await def.after(message, result, context, o.actor);
    return { message, ...result };
  }

  let roll = o.roll ?? null;
  let value = o.value;
  if ( value === undefined ) {
    roll = await new Roll("1d100").evaluate();
    value = roll.total;
  }
  const level = o.forceLevel ?? R.resultLevel(value, o.target);
  const result = { value, level, target: o.target, base: o.base ?? o.target, exceptional: R.isDouble(value) };

  const actor = o.actor;
  const luck = actor?.system.luck;
  const isLuckAnswer = ["luck", "repay"].includes(o.answer?.kind);
  const buttons = [...(def.buttons ? await def.buttons(result, context, actor) : [])];
  if ( actor && luck && !isLuckAnswer ) {
    buttons.push({ action: "luckFlip", label: t("COMAE.Luck.flip"), icon: "fa-solid fa-arrow-right-arrow-left", who: "owner", once: "luck",
      tooltip: t("COMAE.Luck.flipHint", { to: d100Text(R.flipDigits(value)) }) });
    if ( (luck.value < 0) && R.isSuccess(level) ) {
      buttons.push({ action: "luckRepay", label: t("COMAE.Luck.repay"), icon: "fa-solid fa-hand-holding-dollar", who: "owner", once: "luck",
        tooltip: t("COMAE.Luck.repayHint") });
    }
  }
  // A roll can be opposed once: a Luck answer carries the offer on if nobody has taken it up.
  const rootId = o.answer && isLuckAnswer ? rootOf(game.messages.get(o.answer.id) ?? { flags: {} }).id : null;
  const opposed = rootId ? chainIds(game.messages.get(rootId)).some(id => answered(id, "oppose")) : false;
  if ( (def.opposable !== false) && !context.opposes && !opposed ) {
    buttons.push({ action: "oppose", label: t("COMAE.Oppose.button"), icon: "fa-solid fa-people-arrows", who: "all", once: "oppose",
      tooltip: t("COMAE.Oppose.hint") });
  }

  const card = {
    kind,
    kicker: o.kicker ?? t(`COMAE.Card.kind.${kind}`),
    title: o.title,
    die: { value: d100Text(value), target: o.target, exceptional: result.exceptional },
    stamp: stamp(level),
    notes: o.notes ?? [],
    luckNote: o.luckNote ?? "",
    rows: def.rows ? await def.rows(result, context, actor) : [],
    buttons
  };
  const flags = { kind, result, context, input: {
    title: o.title, kicker: o.kicker ?? null, base: o.base ?? o.target, target: o.target, notes: o.notes ?? []
  } };
  if ( o.answer ) Object.assign(flags, { answers: o.answer.id, answerKind: o.answer.kind });

  const message = await postCard(card, { actor, rolls: roll ? [roll] : [], flags, messageMode: o.messageMode });
  if ( def.after ) await def.after(message, result, context, actor, o);

  // A roll in a contest, rolled again by Luck: the contest is decided anew.
  if ( isLuckAnswer ) await recontest(message);
  return { message, ...result };
}

/** The first roll of a chain of Luck answers. */
export function rootOf(message) {
  let current = message;
  for ( let i = 0; i < 10; i++ ) {
    const f = current.flags?.[SYSTEM_ID];
    if ( !f || !["luck", "repay"].includes(f.answerKind) ) break;
    const prev = game.messages.get(f.answers);
    if ( !prev ) break;
    current = prev;
  }
  return current;
}

/** The ids of a roll and every Luck answer that followed it. */
export function chainIds(root) {
  const ids = [];
  let current = root;
  for ( let i = 0; current && (i < 10); i++ ) {
    ids.push(current.id);
    current = game.messages.find(m => {
      const f = m.flags?.[SYSTEM_ID];
      return f && (f.answers === current.id) && ["luck", "repay"].includes(f.answerKind);
    });
  }
  return ids;
}

/* -------------------------------------------- */
/*  Luck                                        */
/* -------------------------------------------- */

/** Can this actor spend a Luck Point? Borrowing below zero is a world setting. */
export function canSpendLuck(actor) {
  const floor = game.settings.get(SYSTEM_ID, "negativeLuck") ? C.luck.floor : 0;
  return actor.system.luck.value > floor;
}

/**
 * Spend a Luck Point, or say why not.
 * @param {Actor} actor
 */
export async function spendLuck(actor) {
  if ( !canSpendLuck(actor) ) {
    ui.notifications.warn(t("COMAE.Luck.none", { name: actor.name }));
    return false;
  }
  const value = actor.system.luck.value - 1;
  await actor.update({ "system.luck.value": value });
  if ( value < 0 ) ui.notifications.info(t("COMAE.Luck.borrowed", { name: actor.name }));
  return true;
}

/** Post a roll again with a new result. */
async function reissue(message, { value, roll = null, how, kind = "luck", forceLevel }) {
  const f = message.flags[SYSTEM_ID];
  const actor = await fromUuid(f.actorUuid);
  if ( !actor ) return;
  if ( answered(message.id, "luck") || answered(message.id, "repay") ) return ui.notifications.warn(t("COMAE.Luck.once"));
  const i = f.input;
  return rollD100({
    actor, kind: f.kind, title: i.title, kicker: i.kicker ?? undefined, base: i.base, target: i.target, notes: i.notes,
    context: f.context, value, roll, forceLevel, answer: { id: message.id, kind }, luckNote: how,
    messageMode: message.blind ? "blind" : (message.whisper.length ? "gm" : undefined)
  });
}

registerCardAction("luckFlip", async message => {
  const actor = await fromUuid(message.flags[SYSTEM_ID].actorUuid);
  if ( !actor || !(await spendLuck(actor)) ) return;
  const old = message.flags[SYSTEM_ID].result.value;
  const value = R.flipDigits(old);
  return reissue(message, { value, how: t("COMAE.Luck.flipped", { from: d100Text(old), to: d100Text(value) }) });
});

/** Borrowed Luck comes back: a success turned to failure restores one point. */
registerCardAction("luckRepay", async message => {
  const actor = await fromUuid(message.flags[SYSTEM_ID].actorUuid);
  if ( !actor || (actor.system.luck.value >= 0) ) return;
  await actor.update({ "system.luck.value": actor.system.luck.value + 1 });
  const value = message.flags[SYSTEM_ID].result.value;
  return reissue(message, { value, kind: "repay", forceLevel: 1, how: t("COMAE.Luck.repaid") });
});

/* -------------------------------------------- */
/*  Opposed Rolls                               */
/* -------------------------------------------- */

/**
 * The actor this user rolls for: a controlled token, their character, or (for the Game Master)
 * a choice.
 */
export async function pickActor({ exclude, title } = {}) {
  const controlled = canvas.ready ? canvas.tokens.controlled.map(tk => tk.actor).filter(a => a && a.isOwner && a.uuid !== exclude) : [];
  if ( controlled.length ) return controlled[0];
  if ( !game.user.isGM && game.user.character && (game.user.character.uuid !== exclude) ) return game.user.character;
  const owned = game.actors.filter(a => a.isOwner && (a.uuid !== exclude) && !a.system.obstacle);
  if ( !owned.length ) return null;
  if ( owned.length === 1 ) return owned[0];
  const options = owned.sort((a, b) => a.name.localeCompare(b.name)).map(a => `<option value="${a.uuid}">${esc(a.name)}</option>`).join("");
  const uuid = await foundry.applications.api.DialogV2.prompt({
    window: { title: title ?? t("COMAE.Oppose.who") },
    classes: [SYSTEM_ID, "oc-dialog"],
    content: `<div class="form-group"><label>${t("COMAE.Oppose.actor")}</label><select name="a">${options}</select></div>`,
    ok: { label: t("COMAE.Roll.roll"), callback: (e, b) => b.form.elements.a.value },
    rejectClose: false
  });
  return uuid ? fromUuid(uuid) : null;
}

registerCardAction("oppose", async (message, button) => {
  const f = message.flags[SYSTEM_ID];
  const actor = await pickActor({ exclude: f.actorUuid });
  if ( !actor ) return ui.notifications.warn(t("COMAE.Oppose.noActor"));
  const first = latest(message);
  const skill = button.dataset.skill;
  const choice = await promptRoll(actor, {
    title: t("COMAE.Oppose.title", { title: first.flags[SYSTEM_ID].input?.title ?? "" }),
    skill, lockSkill: !!skill, difficulty: button.dataset.difficulty, noRoutine: true
  });
  if ( !choice ) return;
  return rollD100({
    actor, kind: "oppose", title: rollTitle(choice), base: choice.base, target: choice.target, notes: choice.notes,
    kicker: t("COMAE.Oppose.kicker", { name: message.speaker.alias ?? "" }),
    context: { opposes: message.id, skill: choice.skill, focusId: choice.focusId }, answer: { id: message.id, kind: "oppose" }
  });
});

/** "Awareness //Perception" */
export function rollTitle(choice) {
  const label = C.skills[choice.skill]?.label ?? "";
  return choice.focusLabel ? `${label} //${choice.focusLabel}` : label;
}

registerRollKind("oppose", {
  opposable: false,
  async after(message, result, context) {
    if ( !context.opposes ) return;
    const first = game.messages.get(context.opposes);
    if ( first ) await postContest(first, message);
  }
});

/** If a rolled-again message was part of a contest, decide the contest again. */
async function recontest(message) {
  const root = rootOf(message);
  const f = root.flags[SYSTEM_ID];
  if ( f?.context?.opposes ) {
    const first = game.messages.get(f.context.opposes);
    if ( first ) return postContest(first, root);
  }
  const ids = chainIds(root);
  const opposer = game.messages.find(m => ids.includes(m.flags?.[SYSTEM_ID]?.context?.opposes));
  if ( opposer ) return postContest(root, opposer);
}

/**
 * Compare two rolls: the highest success wins.
 * @param {ChatMessage} aMessage   The first roll (or the start of its Luck chain).
 * @param {ChatMessage} bMessage   The opposing roll (or the start of its chain).
 */
export async function postContest(aMessage, bMessage) {
  const a = latest(rootOf(aMessage));
  const b = latest(rootOf(bMessage));
  const fa = a.flags[SYSTEM_ID]; const fb = b.flags[SYSTEM_ID];
  const nameA = a.speaker.alias ?? "?"; const nameB = b.speaker.alias ?? "?";
  const out = R.highestSuccess([
    { id: "a", value: fa.result.value ?? 0, level: fa.result.level },
    { id: "b", value: fb.result.value ?? 0, level: fb.result.level }
  ]);
  let title;
  if ( out.winner ) title = t("COMAE.Oppose.wins", { name: out.winner === "a" ? nameA : nameB });
  else if ( out.tie.length ) title = t("COMAE.Oppose.tie");
  else title = t("COMAE.Oppose.neither");
  const line = (name, f) => ({ label: name, value: `${f.result.value === null ? "—" : d100Text(f.result.value)} / ${f.result.target ?? "—"}% · ${C.results[f.result.level].label}`,
    strong: false });
  const rows = [line(nameA, fa), line(nameB, fb)];
  if ( out.winner ) rows[out.winner === "a" ? 0 : 1].strong = true;
  return postCard({
    kind: "contest", kicker: t("COMAE.Oppose.contest"), title, rows,
    notes: out.winner ? [] : [t(out.tie.length ? "COMAE.Oppose.tieText" : "COMAE.Oppose.neitherText")],
    buttons: [{ action: "escalate", label: t("COMAE.Oppose.escalate"), icon: "fa-solid fa-scale-unbalanced", who: "gm", once: "escalate",
      tooltip: t("COMAE.Oppose.escalateHint") }]
  }, { flags: { contest: { a: fa.actorUuid, b: fb.actorUuid, skill: fa.context?.skill ?? null } } });
}

/* -------------------------------------------- */
/*  Plain Rolls                                 */
/* -------------------------------------------- */

/**
 * Roll a formula to chat under a heading.
 * @param {string|Roll} formula   A formula, or a Roll already evaluated.
 * @param {object} [o]
 */
export async function rollFormula(formula, { actor = null, title = "", kicker = "", notes = [], buttons = [], flags = {} } = {}) {
  const roll = formula instanceof Roll ? formula : await new Roll(formula).evaluate();
  const message = await postCard({ kind: "formula", kicker, title, total: roll.total, formula: roll.formula, notes, buttons },
    { actor, rolls: [roll], flags });
  return { roll, message };
}
