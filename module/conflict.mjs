/**
 * Extended Conflicts: arguments, chases, locks, manuscripts, poker games and fights, rolled round by
 * round against one Conflict Pool. A conflict is a Combat encounter flagged as such, so every
 * client sees it and players roll for themselves. People fight with their own pools; a force that
 * is not a person (a lock, a storm, a dinner party) keeps its pool on the board.
 * @module oddsoot-comae/conflict
 */

import C, { SYSTEM_ID } from "./config.mjs";
import * as R from "./rules.mjs";
import { promptRoll } from "./dice/roll-dialog.mjs";
import { rollD100, registerRollKind, rollTitle } from "./dice/roll.mjs";
import { payCost, grantSpell } from "./dice/magic.mjs";
import { postCard, registerCardAction, t, esc, d100Text } from "./helpers/chat.mjs";

const { DialogV2 } = foundry.applications.api;
const { renderTemplate } = foundry.applications.handlebars;
const { FormDataExtended } = foundry.applications.ux;

/** Is this encounter an extended conflict? */
export const isConflict = combat => !!combat?.getFlag(SYSTEM_ID, "conflict");

/** The terms of a conflict. */
export const conflictOf = combat => combat?.getFlag(SYSTEM_ID, "conflict") ?? null;

/** A participant's state. */
export const stateOf = combatant => combatant.getFlag(SYSTEM_ID, "cp") ?? {};

/** Every encounter that is a conflict. */
export const conflicts = () => game.combats.filter(isConflict);

/** A participant's pool in this conflict: their own, or the force's. */
export function poolOf(combatant, conflict) {
  const st = stateOf(combatant);
  if ( st.obstacle || !combatant.actor ) return { value: st.pool?.value ?? 0, max: st.pool?.max ?? 0, obstacle: true };
  const p = combatant.actor.system.pools[conflict.pool];
  return { value: p.value, max: p.max, obstacle: false };
}

/** Who is still in? */
export const activeParticipants = combat => combat.combatants.filter(c => {
  const st = stateOf(c);
  return !st.out && !st.withdrawn;
});

/** Are these two on opposite sides? */
export function opponents(a, b, conflict) {
  if ( a.id === b.id ) return false;
  if ( conflict.freeForAll ) return true;
  return stateOf(a).side !== stateOf(b).side;
}

const freshState = side => ({
  side, roll: null, out: false, withdrawn: false, pushing: false, nextMod: 0, clever: false, targetId: null
});

/* -------------------------------------------- */
/*  Setting Up                                  */
/* -------------------------------------------- */

/**
 * The Game Master starts a conflict.
 * @param {object} [o]
 * @param {string} [o.preset]      A key of C.conflictPresets.
 * @param {Actor[]} [o.actors]     Actors to take part, ticked.
 * @param {object} [o.spell]       A spell to be learned (Learn a Spell).
 * @param {object} [o.overrides]   Fields to fill in over the preset's (a scenario's own conflict):
 *                                 name, skills, round, damage, mode, pool, force, rating, forcePool,
 *                                 forceSkill, clues.
 */
export async function createConflict({ preset = "custom", actors = [], spell = null, overrides = {} } = {}) {
  if ( !game.user.isGM ) return ui.notifications.warn(t("COMAE.Conflict.gmOnly"));

  // Candidates: those asked for, selected tokens, then player characters.
  const seen = new Set();
  const list = [];
  const push = (actor, token = null, checked = false) => {
    if ( !actor || seen.has(actor.uuid) ) return;
    seen.add(actor.uuid);
    list.push({ actor, token, checked });
  };
  for ( const a of actors ) push(a, null, true);
  if ( canvas.ready ) for ( const tk of canvas.tokens.controlled ) push(tk.actor, tk.document, true);
  for ( const a of game.actors.filter(x => x.type === "character").sort((x, y) => x.name.localeCompare(y.name)) ) push(a, null, !actors.length && a.hasPlayerOwner);
  const candidates = list.map((c, i) => ({
    i, name: c.token?.name ?? c.actor.name, img: c.actor.img, checked: c.checked,
    side: c.actor.type === "character" ? "pc" : "opp", actor: c.actor, token: c.token
  }));

  const content = await renderTemplate(`systems/${SYSTEM_ID}/templates/apps/conflict-setup.hbs`, {
    presets: Object.entries(C.conflictPresets).map(([key, p]) => ({ key, label: p.label, selected: key === preset })),
    pools: Object.fromEntries(Object.entries(C.pools).map(([k, p]) => [k, `${p.abbr} — ${p.use}`])),
    modes: C.damageModes,
    challenges: Object.entries(C.challenges).map(([key, r]) => ({ key, label: `${r.label} — ${r.pool} / ${r.skill}%` })),
    puzzles: Object.entries(C.spellPuzzles).map(([k, v]) => ({ key: k, label: `${k}% — ${v}` })),
    candidates, spell, lensesDefault: game.settings.get(SYSTEM_ID, "lenses"),
    spellPool: spell ? R.complexity(spell.system?.spell?.cost ?? 1) : null
  });

  const data = await DialogV2.prompt({
    window: { title: t("COMAE.Conflict.setupTitle"), icon: "fa-solid fa-scale-unbalanced" },
    classes: [SYSTEM_ID, "oc-dialog", "oc-conflict-setup"],
    position: { width: 640 },
    content,
    ok: { label: t("COMAE.Conflict.begin"), icon: "fa-solid fa-play", callback: (e, b) => new FormDataExtended(b.form).object },
    render: (event, dialog) => activateSetup(dialog.element, { spell, overrides }),
    rejectClose: false
  });
  if ( !data ) return null;

  const p = C.conflictPresets[data.preset] ?? C.conflictPresets.custom;
  const conflict = {
    name: data.name || p.label, preset: data.preset, pool: data.pool || p.pool, skills: data.skills ?? "",
    round: data.round ?? "", damage: data.damage || "1d6", mode: data.mode || "single",
    freeForAll: data.mode === "all", lenses: !!data.lenses, partial: !!p.partial, note: p.note ?? "", weapons: !!p.weapons,
    clues: [...new Set(String(data.clues ?? "").split(/[,;\s]+/).filter(x => x.trim() !== "").map(Number).filter(Number.isFinite))].sort((a, b) => b - a),
    learn: p.learn && spell ? spell : null
  };

  const combat = await getDocumentClass("Combat").create({ scene: null, active: false, round: 0, flags: { [SYSTEM_ID]: { conflict } } });
  // Activating separately (rather than creating it active) keeps the combat tracker happy.
  await combat.activate();

  const combatants = [];
  for ( const c of candidates ) {
    if ( !data[`take.${c.i}`] ) continue;
    const side = conflict.freeForAll ? foundry.utils.randomID() : (data[`side.${c.i}`] || c.side);
    combatants.push({
      actorId: c.actor.id, tokenId: c.token?.id ?? null, sceneId: c.token?.parent?.id ?? null,
      name: c.name, img: c.actor.img, initiative: c.actor.system.pools[conflict.pool].value, hidden: false,
      flags: { [SYSTEM_ID]: { cp: freshState(side) } }
    });
  }
  if ( data.obstacleName ) {
    const r = C.challenges[data.obstacleRating] ?? C.challenges.normal;
    const pool = Number(data.obstaclePool) || r.pool;
    const skill = Number(data.obstacleSkill) || r.skill;
    combatants.push(obstacleData(data.obstacleName, pool, skill));
  }
  if ( combatants.length ) await combat.createEmbeddedDocuments("Combatant", combatants);
  await combat.startCombat();
  await postCard({
    kind: "conflict", kicker: t("COMAE.Conflict.kicker"), title: conflict.name,
    rows: [
      { label: t("COMAE.Conflict.skills"), value: conflict.skills || "—" },
      { label: t("COMAE.Conflict.pool"), value: C.pools[conflict.pool].abbr },
      { label: t("COMAE.Conflict.damage"), value: `${conflict.damage} — ${C.damageModes[conflict.mode]}` },
      { label: t("COMAE.Conflict.roundLength"), value: conflict.round || "—" }
    ],
    notes: [conflict.note, t("COMAE.Conflict.beginText")].filter(Boolean)
  });
  return combat;
}

/** A force that is not a person: a lock, a storm, a manuscript, a dinner party. */
export function obstacleData(name, pool, skill, img) {
  return {
    name, img: img || `systems/${SYSTEM_ID}/assets/icons/obstacle.svg`, initiative: pool, hidden: false,
    flags: { [SYSTEM_ID]: { cp: { ...freshState("opp"), obstacle: true, skill, pool: { value: pool, max: pool } } } }
  };
}

/** Fill the setup form from a preset. */
function activateSetup(root, { spell, overrides = {} }) {
  const form = root.querySelector("form");
  if ( !form || form.dataset.ocBound ) return;
  form.dataset.ocBound = "1";
  const set = (name, value) => {
    const el = form.elements[name];
    if ( !el ) return;
    if ( el.type === "checkbox" ) el.checked = !!value; else el.value = value ?? "";
  };
  const apply = () => {
    const p = C.conflictPresets[form.elements.preset.value];
    if ( !p ) return;
    set("name", p.label === "Custom" ? "" : (p.learn && spell ? `${p.label}: ${spell.name}` : p.label));
    set("skills", p.skills); set("round", p.round); set("damage", p.damage); set("mode", p.mode); set("pool", p.pool);
    const obstacle = form.querySelector(".oc-setup__obstacle");
    obstacle?.classList.toggle("is-suggested", !!p.static);
    form.querySelector(".oc-setup__clues")?.classList.toggle("is-hidden", !p.clues);
    form.querySelector(".oc-setup__note").textContent = p.note ?? "";
    if ( p.static && !form.elements.obstacleName.value ) {
      const name = p.learn && spell ? spell.name : t(`COMAE.Conflict.forceNames.${form.elements.preset.value}`);
      set("obstacleName", name.startsWith("COMAE.") ? t("COMAE.Conflict.obstacleDefault") : name);
      set("obstacleRating", p.static);
      const r = C.challenges[p.static];
      set("obstaclePool", p.learn && spell ? R.complexity(spell.system?.spell?.cost ?? 1) : r.pool);
      set("obstacleSkill", r.skill);
    }
  };
  form.elements.preset.addEventListener("change", () => { set("obstacleName", ""); apply(); });
  form.elements.obstacleRating?.addEventListener("change", ev => {
    const r = C.challenges[ev.currentTarget.value];
    if ( r ) { set("obstaclePool", r.pool); set("obstacleSkill", r.skill); }
  });
  form.elements.puzzle?.addEventListener("change", ev => set("obstacleSkill", ev.currentTarget.value));
  apply();

  // A scenario's own conflict, over the preset.
  const o = overrides;
  for ( const k of ["name", "skills", "round", "damage", "mode", "pool", "clues"] ) if ( o[k] !== undefined ) set(k, o[k]);
  if ( o.rating && C.challenges[o.rating] ) {
    set("obstacleRating", o.rating);
    set("obstaclePool", C.challenges[o.rating].pool);
    set("obstacleSkill", C.challenges[o.rating].skill);
  }
  if ( o.force !== undefined ) set("obstacleName", o.force);
  if ( o.forcePool !== undefined ) set("obstaclePool", o.forcePool);
  if ( o.forceSkill !== undefined ) set("obstacleSkill", o.forceSkill);
  if ( o.clues !== undefined ) form.querySelector(".oc-setup__clues")?.classList.remove("is-hidden");
  if ( o.note ) form.querySelector(".oc-setup__note").textContent = o.note;
}

/* -------------------------------------------- */
/*  Rolling                                     */
/* -------------------------------------------- */

/** The skills a conflict names, as keys, in order. */
function namedSkills(text) {
  const out = [];
  for ( const [key, s] of Object.entries(C.skills) ) {
    const i = String(text ?? "").toLowerCase().indexOf(s.label.toLowerCase());
    if ( i >= 0 ) out.push([i, key]);
  }
  return out.sort((a, b) => a[0] - b[0]).map(x => x[1]);
}

/**
 * Roll for a participant this round.
 * @param {Combat} combat
 * @param {Combatant} combatant
 */
export async function rollParticipant(combat, combatant) {
  const conflict = conflictOf(combat);
  const st = stateOf(combatant);
  const context = { combatId: combat.id, combatantId: combatant.id, round: combat.round };
  const kicker = t("COMAE.Conflict.rollKicker", { name: conflict.name, round: combat.round });

  if ( st.obstacle ) {
    const notes = st.nextMod ? [`${st.nextMod > 0 ? "+" : ""}${st.nextMod}% ${t("COMAE.Conflict.lastRound")}`] : [];
    return rollD100({ actor: null, kind: "conflict", kicker, title: combatant.name, base: st.skill,
      target: Math.max(0, st.skill + (st.nextMod || 0)), notes, context });
  }

  const actor = combatant.actor;
  if ( !actor ) return null;
  const pool = poolOf(combatant, conflict);
  const fixed = [];
  if ( st.nextMod ) fixed.push({ label: t("COMAE.Conflict.lastRound"), value: st.nextMod });
  if ( game.settings.get(SYSTEM_ID, "halving") && R.isHalved(pool.value, pool.max) ) fixed.push({ label: t("COMAE.Conflict.halved"), value: -20 });

  // Weapons, for a fight; where the blow lands, for the Covert and Flamboyant Lenses.
  const weapons = actor.items.filter(i => (i.type === "weapon") && i.system.equipped);
  const weaponHtml = (conflict.pool === "body") ? `<div class="form-group"><label>${t("COMAE.Conflict.weapon")}</label><select name="weapon">
      <option value="">${t("COMAE.Conflict.noWeapon", { formula: conflict.damage })}</option>
      ${weapons.map((w, i) => `<option value="${w.id}" ${conflict.weapons && !i ? "selected" : ""}>${esc(w.name)} (${w.system.formula}${w.system.range ? ` @ ${w.system.range} m` : ""})</option>`).join("")}</select></div>` : "";
  const poolHtml = conflict.lenses ? `<div class="form-group"><label>${t("COMAE.Conflict.targetPool")}</label><select name="targetPool">
      <option value="">${C.pools[conflict.pool].abbr} (${t("COMAE.Conflict.mainPool")})</option>
      ${Object.entries(C.pools).filter(([k]) => k !== conflict.pool).map(([k, p]) => `<option value="${k}">${p.abbr}</option>`).join("")}</select>
      <p class="hint">${t("COMAE.Conflict.targetPoolHint")}</p></div>` : "";
  const cleverHtml = st.clever ? `<div class="form-group"><label>${t("COMAE.Conflict.clever")}</label><select name="clever">
      <option value="plus">${t("COMAE.Conflict.cleverPlus")}</option><option value="double">${t("COMAE.Conflict.cleverDouble")}</option></select></div>` : "";

  const named = namedSkills(conflict.skills);
  // Studying a spell with no Magic yet: roll as if Magic were POW × 2.
  let skills;
  if ( conflict.learn ) {
    skills = [...C.skillOrder, "magic"];
    const m = actor.system.skills.magic.value;
    const start = actor.system.pools.pow.max * 2;
    if ( m < start ) fixed.push({ label: t("COMAE.Conflict.noMagicYet"), value: start - m, skill: "magic" });
  }
  const choice = await promptRoll(actor, {
    title: t("COMAE.Conflict.rollTitle", { name: conflict.name }), skill: conflict.learn ? "magic" : (named[0] ?? "awareness"), skills,
    lens: conflict.lenses && !st.clever, fixed, noRoutine: true, allowSpells: true,
    extra: weaponHtml + poolHtml + cleverHtml
  });
  if ( !choice ) return null;
  let target = choice.target;
  const notes = [...choice.notes];
  const clever = st.clever ? (choice.data.clever || "plus") : null;
  if ( clever === "plus" ) { target += 20; notes.push(`+20% ${t("COMAE.Conflict.clever")}`); }
  const weapon = actor.items.get(choice.data.weapon);
  let targetPool = choice.data.targetPool || null;
  if ( targetPool && (choice.lens === "flamboyant") && (targetPool !== "cha") ) targetPool = "cha";
  if ( targetPool && !["covert", "flamboyant"].includes(choice.lens) ) targetPool = null;
  if ( choice.lens !== "none" ) notes.push(`<em>${C.lenses[choice.lens].label}</em>: ${C.lenses[choice.lens].text}`);
  return rollD100({ actor, kind: "conflict", kicker, title: rollTitle(choice), base: choice.base, target, notes,
    context: { ...context, skill: choice.skill, focusId: choice.focusId, lens: choice.lens, clever,
      formula: weapon?.system.formula ?? null, weapon: weapon?.name ?? null, firearm: !!weapon?.system.firearm, targetPool } });
}

registerRollKind("conflict", {
  opposable: false,
  /** Write the result onto the participant (again, if Luck changed it); a spell costs its POW. */
  async after(message, result, context, actor, o) {
    const combat = game.combats.get(context.combatId);
    const c = combat?.combatants.get(context.combatantId);
    if ( !c?.isOwner ) return;
    const st = stateOf(c);
    await c.setFlag(SYSTEM_ID, "cp", { ...st, roll: {
      value: result.value, level: result.level, target: result.target, title: message.flags[SYSTEM_ID].input.title,
      round: context.round, messageId: message.id, lens: context.lens ?? "none", clever: context.clever ?? null,
      formula: context.formula, weapon: context.weapon, firearm: context.firearm, targetPool: context.targetPool
    } });
    const focus = actor?.items.get(context.focusId);
    if ( focus?.system.isSpell && !(o?.answer && ["luck", "repay"].includes(o.answer.kind)) ) {
      const cost = R.castCost(result.level, focus.system.spell.cost);
      await payCost(actor, cost.cost);
    }
  }
});

/* -------------------------------------------- */
/*  Resolving                                   */
/* -------------------------------------------- */

/** Roll a participant's damage, through their Lens. */
async function rollDamage(st, conflict, rolls) {
  const formula = st.roll.formula || conflict.damage || "1d6";
  const twice = (st.roll.lens === "aggressive") || (st.roll.clever === "double");
  const results = [];
  for ( let i = 0; i < (twice ? 2 : 1); i++ ) {
    const r = await new Roll(formula).evaluate();
    rolls.push(r);
    results.push(r.total);
  }
  return R.lensDamage(st.roll.lens, results);
}

/**
 * The Game Master resolves the round: the highest successful roll wins and deals damage, through
 * any Lens; pools fall; the emptied are out.
 * @param {Combat} combat
 */
export async function resolveRound(combat) {
  if ( !game.user.isGM ) return;
  const conflict = conflictOf(combat);
  const active = activeParticipants(combat);
  const rolled = active.filter(c => stateOf(c).roll);
  if ( !rolled.length ) return ui.notifications.warn(t("COMAE.Conflict.nobodyRolled"));

  const rolls = [];
  const lines = [];
  const hits = [];                  // {victim, amount, pool, armour, firearm}
  const next = new Map();           // combatant id -> modifier next round
  const bank = new Set();           // won with the Clever Lens
  const addNext = (id, n) => next.set(id, (next.get(id) ?? 0) + n);

  for ( const c of active ) {
    const r = stateOf(c).roll;
    const lens = r && (r.lens !== "none") ? ` · ${C.lenses[r.lens]?.label}` : "";
    lines.push(r ? `${esc(c.name)}: ${d100Text(r.value)} / ${r.target}% — ${C.results[r.level].label}${lens}` : `${esc(c.name)}: ${t("COMAE.Conflict.didNotRoll")}`);
  }

  /** The winner of an exchange strikes. */
  const strike = async (winner, victims) => {
    const wst = stateOf(winner);
    const lens = wst.roll.lens;
    if ( lens === "clever" ) {
      bank.add(winner.id);
      lines.push(t("COMAE.Conflict.cleverWin", { name: esc(winner.name) }));
      return;
    }
    if ( ["covert", "flamboyant"].includes(lens) ) for ( const v of victims ) addNext(v.id, -20);
    if ( !victims.length ) return;
    const amount = await rollDamage(wst, conflict, rolls);
    for ( const v of victims ) {
      const pool = (!stateOf(v).obstacle && wst.roll.targetPool) ? wst.roll.targetPool : conflict.pool;
      // Armour soaks the blows of a fight, or of a weapon, not the wear of a journey.
      hits.push({ victim: v, amount, pool, armour: !!(wst.roll.formula || conflict.weapons), firearm: !!wst.roll.firearm, from: winner });
    }
  };

  let title;
  if ( conflict.mode === "roller" ) {
    // Each roller against the opposition, one exchange apiece.
    const forces = rolled.filter(c => stateOf(c).side === "opp");
    const force = forces[0];
    const rollers = rolled.filter(c => stateOf(c).side !== "opp");
    let wins = 0;
    for ( const pc of rollers ) {
      if ( !force ) break;
      const out = R.highestSuccess([pc, force].map(c => ({ id: c.id, value: stateOf(c).roll.value, level: stateOf(c).roll.level })));
      if ( out.winner === pc.id ) { wins++; await strike(pc, [force]); }
      else if ( out.winner === force.id ) await strike(force, [pc]);
    }
    title = t("COMAE.Conflict.exchanges", { n: wins, total: rollers.length });
  } else {
    const out = R.highestSuccess(rolled.map(c => ({ id: c.id, value: stateOf(c).roll.value, level: stateOf(c).roll.level })));
    if ( out.winner ) {
      const winner = combat.combatants.get(out.winner);
      let victims;
      if ( conflict.mode === "all" ) victims = active.filter(c => c.id !== winner.id);
      else if ( conflict.mode === "side" ) victims = active.filter(c => opponents(winner, c, conflict));
      else {
        const wst = stateOf(winner);
        const chosen = wst.targetId ? combat.combatants.get(wst.targetId) : null;
        const valid = chosen && active.includes(chosen) && opponents(winner, chosen, conflict);
        victims = valid ? [chosen] : active.filter(c => opponents(winner, c, conflict)).slice(0, 1);
      }
      await strike(winner, victims);
      title = t("COMAE.Conflict.wins", { name: winner.name });
      // A journey: a success that is not the best still wears the way down.
      if ( conflict.partial && stateOf(winner).obstacle ) {
        for ( const id of out.succeeded.filter(x => x !== winner.id) ) {
          const c = combat.combatants.get(id);
          if ( !c || stateOf(c).obstacle ) continue;
          const r = await new Roll("1d3").evaluate();
          rolls.push(r);
          hits.push({ victim: winner, amount: r.total, pool: conflict.pool, armour: false, from: c });
          lines.push(t("COMAE.Conflict.partial", { name: esc(c.name), n: r.total }));
        }
      }
    } else if ( out.tie.length ) title = t("COMAE.Conflict.tie");
    else title = t("COMAE.Conflict.nothing");
  }

  // Covert and Flamboyant losers are badly placed next round.
  for ( const c of rolled ) {
    const r = stateOf(c).roll;
    if ( ["covert", "flamboyant"].includes(r.lens) && !hits.some(h => h.from.id === c.id) && !bank.has(c.id) ) addNext(c.id, -20);
    if ( r.lens === "quick" ) lines.push(t("COMAE.Conflict.quick", { name: esc(c.name) }));
  }

  // Apply.
  const buttons = [];
  const obstaclePools = new Map();
  for ( const h of hits ) {
    const v = h.victim;
    const vst = stateOf(v);
    if ( vst.obstacle || !v.actor ) {
      const before = obstaclePools.get(v.id) ?? vst.pool.value;
      const after = Math.max(0, before - h.amount);
      obstaclePools.set(v.id, after);
      lines.push(t("COMAE.Conflict.hitForce", { from: esc(h.from.name), name: esc(v.name), n: h.amount, value: after }));
      for ( const n of conflict.clues ?? [] ) {
        if ( (before > n) && (after <= n) ) lines.push(`<strong>${t("COMAE.Conflict.clue", { n })}</strong>`);
      }
      continue;
    }
    const res = await v.actor.takeDamage(h.pool, h.amount, { armour: h.armour && (h.pool === "body"), firearm: h.firearm, push: vst.pushing, silent: true });
    const abbr = C.pools[h.pool].abbr;
    lines.push(t("COMAE.Conflict.hit", { from: esc(h.from.name), name: esc(v.name), n: res.taken, pool: abbr, value: res.after })
      + (res.ap ? ` ${t("COMAE.Damage.soaked", { n: res.ap })}` : ""));
    if ( res.comae ) lines.push(`<strong>${t(game.settings.get(SYSTEM_ID, "lethal") ? "COMAE.Damage.dead" : "COMAE.Damage.comae", { name: esc(v.name) })}</strong>`);
    if ( (v.actor.type === "character") && (res.taken > 1) ) {
      buttons.push({ action: "luckReduceFor", label: t("COMAE.Luck.reduceFor", { name: v.name }), icon: "fa-solid fa-clover", who: "target",
        target: v.actor.uuid, once: `luck-${v.id}`, data: { pool: h.pool, refund: res.taken - 1, combatant: v.id } });
    }
  }

  const updates = [];
  for ( const c of combat.combatants ) {
    const st = stateOf(c);
    const state = { ...st, roll: null, nextMod: next.get(c.id) ?? 0, clever: bank.has(c.id) };
    let value;
    if ( obstaclePools.has(c.id) ) { state.pool = { ...st.pool, value: obstaclePools.get(c.id) }; value = state.pool.value; }
    else value = poolOf(c, conflict).value;
    if ( !st.out && !st.withdrawn && (value <= 0) && !(st.pushing && c.actor && !R.inComae(value, c.actor.system.pools[conflict.pool].max)) ) {
      state.out = true;
      lines.push(t(st.obstacle ? "COMAE.Conflict.forceOut" : "COMAE.Conflict.isOut", { name: esc(c.name) }));
    }
    updates.push({ _id: c.id, initiative: value, [`flags.${SYSTEM_ID}.cp`]: state });
  }
  await combat.updateEmbeddedDocuments("Combatant", updates);

  // A spell learned when its Complexity is worn away.
  if ( conflict.learn ) {
    const beaten = combat.combatants.filter(c => stateOf(c).obstacle).every(c => stateOf(c).out);
    if ( beaten ) {
      for ( const c of combat.combatants.filter(x => !stateOf(x).obstacle && !stateOf(x).out && x.actor) ) await grantSpell(c.actor, conflict.learn);
    }
  }

  // Is it decided?
  const left = activeParticipants(combat);
  const sides = new Set(left.map(c => conflict.freeForAll ? c.id : stateOf(c).side));
  if ( sides.size <= 1 ) lines.push(left.length ? t("COMAE.Conflict.decided", { names: left.map(c => esc(c.name)).join(", ") }) : t("COMAE.Conflict.allOut"));

  await postCard({ kind: "conflict", kicker: t("COMAE.Conflict.roundKicker", { name: conflict.name, round: combat.round }), title, notes: lines, buttons },
    { rolls });
  await combat.update({ round: combat.round + 1 });
}

/** Luck after a conflict round: one victim's damage becomes 1. */
registerCardAction("luckReduceFor", async (message, button) => {
  const actor = await fromUuid(button.dataset.ocTarget);
  if ( !actor ) return;
  const { spendLuck } = await import("./dice/roll.mjs");
  if ( !(await spendLuck(actor)) ) return;
  await actor.restorePool(button.dataset.pool, Number(button.dataset.refund) || 0);
  return postCard({ kind: "luck", kicker: t("COMAE.Luck.title"), title: C.luckUses.reduce.label,
    notes: [t("COMAE.Luck.reduced", { name: esc(actor.name), pool: C.pools[button.dataset.pool].abbr })] },
  { actor, flags: { answers: message.id, answerKind: `luck-${button.dataset.combatant}` } });
});

/**
 * End the conflict.
 * @param {Combat} combat
 */
export async function endConflict(combat) {
  if ( !game.user.isGM ) return;
  const conflict = conflictOf(combat);
  const left = activeParticipants(combat).map(c => esc(c.name));
  const notes = [left.length ? t("COMAE.Conflict.standing", { names: left.join(", ") }) : t("COMAE.Conflict.allOut")];
  if ( conflict.learn && !combat.combatants.filter(c => stateOf(c).obstacle).every(c => stateOf(c).out) ) notes.push(t("COMAE.Conflict.learnFailed"));
  if ( combat.combatants.some(c => c.actor?.system.pushed) ) notes.push(t("COMAE.Conflict.pushedAfter"));
  await postCard({ kind: "conflict", kicker: t("COMAE.Conflict.kicker"), title: t("COMAE.Conflict.ended", { name: conflict.name }), notes });
  return combat.delete();
}

/** Add a force to an existing conflict. */
export async function addObstacle(combat) {
  const ratings = Object.entries(C.challenges).map(([k, r]) => `<option value="${k}" ${k === "normal" ? "selected" : ""}>${r.label} (${r.pool} / ${r.skill}%)</option>`).join("");
  const data = await DialogV2.prompt({
    window: { title: t("COMAE.Conflict.addObstacle"), icon: "fa-solid fa-dungeon" },
    classes: [SYSTEM_ID, "oc-dialog"],
    content: `<div class="form-group"><label>${t("COMAE.Conflict.obstacleName")}</label><input type="text" name="name" value="${t("COMAE.Conflict.obstacleDefault")}"></div>
      <div class="form-group"><label>${t("COMAE.Conflict.rating")}</label><select name="rating">${ratings}</select></div>`,
    ok: { label: t("COMAE.Conflict.add"), callback: (e, b) => new FormDataExtended(b.form).object },
    rejectClose: false
  });
  if ( !data ) return;
  const r = C.challenges[data.rating];
  return combat.createEmbeddedDocuments("Combatant", [obstacleData(data.name, r.pool, r.skill)]);
}

/** Add an actor (dropped on the board) to a conflict. */
export async function addParticipant(combat, actor, token = null) {
  const conflict = conflictOf(combat);
  const side = conflict.freeForAll ? foundry.utils.randomID() : (actor.type === "character" ? "pc" : "opp");
  return combat.createEmbeddedDocuments("Combatant", [{
    actorId: actor.id, tokenId: token?.id ?? null, sceneId: token?.parent?.id ?? null, name: token?.name ?? actor.name,
    img: actor.img, initiative: actor.system.pools[conflict.pool].value, flags: { [SYSTEM_ID]: { cp: freshState(side) } }
  }]);
}

/** Press on past zero: the pool may fall below it, at −20% to everything. */
export async function pushOn(combat, combatant) {
  const actor = combatant.actor;
  if ( !actor?.system.canPush ) return ui.notifications.warn(t("COMAE.Conflict.cannotPush"));
  const st = stateOf(combatant);
  await combatant.setFlag(SYSTEM_ID, "cp", { ...st, pushing: true, out: false });
  return postCard({ kind: "conflict", kicker: conflictOf(combat).name, title: t("COMAE.Conflict.pushesOn", { name: combatant.name }),
    notes: [t("COMAE.Conflict.pushText")] }, { actor });
}

/** Escalate a lost opposed roll into a conflict. */
registerCardAction("escalate", async message => {
  const c = message.getFlag(SYSTEM_ID, "contest");
  const actors = (await Promise.all([c?.a, c?.b].filter(Boolean).map(u => fromUuid(u)))).filter(Boolean);
  return createConflict({ actors });
});
