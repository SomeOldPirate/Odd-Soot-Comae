/**
 * The roll dialog: which skill, which Focus, and what makes it harder or easier.
 * @module oddsoot-comae/dice/roll-dialog
 */

import C, { SYSTEM_ID } from "../config.mjs";
import * as R from "../rules.mjs";

const { DialogV2 } = foundry.applications.api;
const { renderTemplate } = foundry.applications.handlebars;
const { FormDataExtended } = foundry.applications.ux;
const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
const t = (k, d) => (d ? game.i18n.format(k, d) : game.i18n.localize(k));
const signed = n => (n > 0 ? `+${n}` : `${n}`);

/** Alien contexts and Strangeness, as steps of difficulty that a matching Focus takes off. */
const ALIEN = {
  none: { steps: 0, label: "COMAE.Roll.alien.none" },
  culture: { steps: 1, label: "COMAE.Roll.alien.culture", negate: ["culture"] },
  medicine: { steps: 2, label: "COMAE.Roll.alien.medicine", negate: ["astrobiology"] },
  strange: { steps: 1, label: "COMAE.Roll.alien.strange", negate: ["culture", "theSoot"] },
  veryStrange: { steps: 2, label: "COMAE.Roll.alien.veryStrange", negate: ["culture", "theSoot"] }
};

/**
 * @typedef {object} RollSpec
 * @property {string} title               What is attempted.
 * @property {string} [skill]             The skill to start from.
 * @property {string[]} [skills]          Skills to choose between (all nine and Magic if omitted).
 * @property {string} [focusId]           A Focus to start with.
 * @property {boolean} [onlyFocus]        Offer that Focus alone (a spell being cast).
 * @property {boolean} [lockSkill]        No choice of skill (a spell, a weapon).
 * @property {boolean} [lens]             Offer a Lens.
 * @property {string} [difficulty]        Start from this difficulty.
 * @property {{label: string, value: number}[]} [fixed]   Modifiers that simply apply (the conflict's edge).
 * @property {string} [extra]             More HTML for the form.
 * @property {boolean} [noRoutine]        Routine makes no sense here (an opposed roll, a conflict).
 */

/**
 * Ask how the roll is made.
 * @param {Actor} actor
 * @param {RollSpec} spec
 * @returns {Promise<object|null>}
 */
export async function promptRoll(actor, spec) {
  const sys = actor.system;
  const keys = spec.skills ?? [...C.skillOrder, ...(sys.skills.magic.locked ? [] : ["magic"])];
  const skill = keys.includes(spec.skill) ? spec.skill : keys[0];

  const focuses = sys.focuses.filter(f => !f.system.isDrive).map(f => ({
    id: f.id, skill: f.system.skill, label: f.name, key: f.system.key, spell: f.system.isSpell
  }));
  const drives = sys.focuses.filter(f => f.system.isDrive).map(f => ({
    id: f.id, label: f.system.phrase, corrupted: f.system.corrupted
  }));

  // Peculiarities that are showing; ticked by the skill they lower.
  const pecs = sys.peculiarities.filter(p => p.system.showing && p.system.groups.length).map(p => ({
    id: p.id, name: p.name, value: p.system.effective, groups: p.system.groups
  }));

  // Tags that bear on social rolls.
  const owned = new Set(sys.tags.map(tg => tg.system.key));
  const tagMods = [];
  for ( const [key, def] of Object.entries(C.tags) ) {
    if ( def.lacking && !owned.has(key) ) tagMods.push({ key, label: `${def.lacking} — ${t("COMAE.Roll.lacking", { tag: def.label })}`, value: -20 });
    if ( def.bonus && owned.has(key) ) tagMods.push({ key, label: `${def.bonus} (#${def.label})`, value: 20 });
  }

  // The Disposition of a targeted NPC.
  let disposition = null;
  const target = [...game.user.targets].map(tk => tk.actor).find(a => a?.type === "npc" && !a.system.obstacle);
  if ( target && target.system.disposition.mod ) {
    disposition = { name: target.name, label: target.system.disposition.label, value: target.system.disposition.mod };
  }

  const ctx = { actor, spec, keys, focuses, drives, pecs, tagMods, disposition };
  const content = await renderTemplate(`systems/${SYSTEM_ID}/templates/dialog/roll.hbs`, {
    spec, skill,
    skills: keys.map(k => ({ key: k, label: `${C.skills[k].label} (${sys.skills[k].effective}%)`, selected: k === skill })),
    difficulties: C.difficultyOrder.filter(k => !(spec.noRoutine && k === "routine")).map(k => ({
      key: k, label: C.difficulties[k].label, hint: C.difficulties[k].hint, checked: k === (spec.difficulty ?? "normal")
    })),
    lenses: spec.lens ? Object.entries(C.lenses).map(([key, l]) => ({ key, label: l.label, text: l.text })) : null,
    alien: Object.entries(ALIEN).map(([key, a]) => ({ key, label: t(a.label) })),
    drives, pecs, tagMods, disposition, fixed: spec.fixed ?? [],
    standing: [...C.skillOrder, "magic"].includes(skill) ? sys.skills[skill].mods : []
  });

  return DialogV2.wait({
    window: { title: spec.title, icon: "fa-solid fa-dice-d10" },
    classes: [SYSTEM_ID, "oc-dialog", "oc-roll-dialog"],
    position: { width: 500 },
    content,
    buttons: [{
      action: "roll", label: t("COMAE.Roll.roll"), icon: "fa-solid fa-dice-d10", default: true,
      callback: (event, button) => compute(button.form, ctx)
    }],
    render: (event, dialog) => activate(dialog.element, ctx),
    rejectClose: false
  });
}

/* -------------------------------------------- */

/** Work out the target and the notes from the form. */
function compute(form, ctx) {
  const { actor, spec, focuses, drives, pecs, tagMods, disposition } = ctx;
  const sys = actor.system;
  const data = new FormDataExtended(form).object;
  const skill = data.skill || spec.skill;
  const s = sys.skills[skill];
  const notes = [];
  const mods = [];
  const add = (value, label) => { if ( !value ) return; mods.push(value); notes.push(`${signed(value)}% ${label}`); };

  for ( const m of s.mods ) add(m.value, m.label);
  for ( const f of spec.fixed ?? [] ) if ( !f.skill || (f.skill === skill) ) add(f.value, f.label);

  const focus = focuses.find(f => (f.id === data.focus) && (f.skill === skill)) ?? null;
  if ( focus ) notes.push(`+${C.focusBonus}% //${esc(focus.label)}`);

  const lens = data.lens && C.lenses[data.lens] ? data.lens : "none";
  if ( lens !== "none" ) add(C.lenses[lens].mod, t("COMAE.Roll.lensNote", { lens: C.lenses[lens].label }));

  for ( const d of drives ) if ( data[`drive.${d.id}`] ) add(C.focusBonus, `//${esc(d.label)}`);
  for ( const p of pecs ) if ( data[`pec.${p.id}`] ) add(-p.value, esc(p.name));
  for ( const m of tagMods ) if ( data[`tag.${m.key}`] ) add(m.value, esc(m.label));
  if ( disposition && data.disposition ) add(disposition.value, `${esc(disposition.name)} (${disposition.label})`);

  // Alien contexts: steps of −20%, one step off for the matching Focus.
  const alien = ALIEN[data.alien] ?? ALIEN.none;
  let steps = alien.steps;
  if ( steps && focus && alien.negate?.includes(focus.key) ) steps -= 1;
  if ( steps ) add(-20 * steps, t(alien.label));

  const free = Number(data.mod) || 0;
  if ( free ) add(free, t("COMAE.Roll.other"));

  const helpers = Number(data.helpers) || 0;
  if ( helpers ) notes.push(`+${R.helperBonus(helpers)}% ${t("COMAE.Roll.helpersNote", { n: helpers })}`);

  const difficulty = data.difficulty || "normal";
  if ( !["normal", "routine"].includes(difficulty) ) notes.unshift(`${C.difficulties[difficulty].label} ${C.difficulties[difficulty].hint}`);
  const target = R.rollTarget({ skill: s.value, focus: !!focus, difficulty, helpers, mods });
  return {
    skill, focusId: focus?.id ?? null, focusLabel: focus?.label ?? null, lens, difficulty, target,
    routine: target === null, notes, data, base: s.value + (focus ? C.focusBonus : 0)
  };
}

/** Keep the form honest: Focuses follow the skill, the target follows everything. */
function activate(root, ctx) {
  const form = root.querySelector("form");
  if ( !form || form.dataset.ocBound ) return;
  form.dataset.ocBound = "1";
  const out = form.querySelector(".oc-roll__target");
  const focusSel = form.elements.focus;

  const fillFocuses = () => {
    const skill = form.elements.skill?.value ?? ctx.spec.skill;
    const list = ctx.spec.onlyFocus ? ctx.focuses.filter(f => f.id === ctx.spec.focusId)
      : ctx.focuses.filter(f => (f.skill === skill) && (!f.spell || ctx.spec.allowSpells));
    const keep = focusSel.value || ctx.spec.focusId || "";
    focusSel.innerHTML = `<option value="">${t("COMAE.Roll.noFocus")}</option>`
      + list.map(f => `<option value="${f.id}" ${f.id === keep ? "selected" : ""}>//${esc(f.label)} (+${C.focusBonus}%)</option>`).join("");
    focusSel.closest(".form-group").classList.toggle("is-empty", !list.length);
    // Peculiarities that lower this skill are ticked, the rest not.
    for ( const p of ctx.pecs ) {
      const box = form.elements[`pec.${p.id}`];
      if ( box ) box.checked = skill !== "willpower" && p.groups.includes(C.skills[skill]?.group);
    }
    form.querySelector(".oc-roll__drives")?.classList.toggle("is-hidden", skill !== "willpower");
    form.querySelector(".oc-roll__social")?.classList.toggle("is-hidden", skill !== "social");
  };
  const refresh = () => {
    const r = compute(form, ctx);
    if ( out ) out.textContent = r.routine ? t("COMAE.Roll.routineShort") : `${r.target}%`;
  };
  form.elements.skill?.addEventListener("change", () => { focusSel.value = ""; fillFocuses(); refresh(); });
  // The Covert Lens is rolled on Cunning.
  form.elements.lens?.addEventListener("change", ev => {
    const lens = C.lenses[ev.currentTarget.value];
    if ( lens?.skill && form.elements.skill && ctx.keys.includes(lens.skill) ) {
      form.elements.skill.value = lens.skill;
      focusSel.value = "";
      fillFocuses();
    }
  });
  form.addEventListener("change", refresh);
  form.addEventListener("input", refresh);
  fillFocuses();
  refresh();
}
