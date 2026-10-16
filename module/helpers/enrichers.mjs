/**
 * Journal links that act: a roll a scenario calls for, and a conflict it sets up.
 *
 *   @Check[awareness:perception|hard]{Awareness //Perception, Hard}
 *   @Check[social:influence]                     (Normal; the label is made up)
 *   @Conflict[searchClues|name=Search the Archives|force=The Labyrinth|rating=normal|clues=8,4]{Search the archives}
 *
 * Anyone may click a check (they roll for their own character, or a controlled token); a conflict is
 * the Game Master's to start.
 * @module oddsoot-comae/helpers/enrichers
 */

import C from "../config.mjs";
import { esc, t } from "./chat.mjs";
import { pickActor } from "../dice/roll.mjs";
import { createConflict } from "../conflict.mjs";

/** "awareness:perception|hard" → { skill, focus, difficulty } */
function parseCheck(text) {
  const [what, difficulty = "normal"] = text.split("|").map(s => s.trim());
  const [skill, focus = ""] = what.split(":").map(s => s.trim());
  return { skill, focus, difficulty: C.difficulties[difficulty] ? difficulty : "normal" };
}

/** The label a check shows if none is given: "Awareness //Perception (Hard)". */
function checkLabel({ skill, focus, difficulty }) {
  const s = C.skills[skill]?.label ?? skill;
  const f = focus ? (C.focuses[skill]?.[focus]?.label ?? focus) : "";
  const d = difficulty !== "normal" ? ` (${C.difficulties[difficulty].label})` : "";
  return `${s}${f ? ` //${f}` : ""}${d}`;
}

/** "searchClues|name=…|clues=8,4" → { preset, overrides } */
function parseConflict(text) {
  const [preset, ...rest] = text.split("|").map(s => s.trim());
  const overrides = {};
  for ( const part of rest ) {
    const i = part.indexOf("=");
    if ( i > 0 ) overrides[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return { preset: C.conflictPresets[preset] ? preset : "custom", overrides };
}

function link({ kind, data, label, icon, title }) {
  const a = document.createElement("a");
  a.className = `oc-enricher oc-enricher--${kind}`;
  a.dataset.ocKind = kind;
  for ( const [k, v] of Object.entries(data) ) a.dataset[k] = typeof v === "string" ? v : JSON.stringify(v);
  a.dataset.tooltip = title;
  a.innerHTML = `<i class="${icon}"></i> ${esc(label)}`;
  return a;
}

export function registerEnrichers() {
  CONFIG.TextEditor.enrichers.push(
    {
      id: "comaeCheck",
      pattern: /@Check\[([^\]]+)\](?:\{([^}]+)\})?/g,
      enricher: async match => {
        const check = parseCheck(match[1]);
        if ( !C.skills[check.skill] ) return null;
        return link({ kind: "check", data: { skill: check.skill, focus: check.focus, difficulty: check.difficulty },
          label: match[2] ?? checkLabel(check), icon: "fa-solid fa-dice-d10", title: t("COMAE.Enricher.check") });
      }
    },
    {
      id: "comaeConflict",
      pattern: /@Conflict\[([^\]]+)\](?:\{([^}]+)\})?/g,
      enricher: async match => {
        const { preset, overrides } = parseConflict(match[1]);
        const label = match[2] ?? overrides.name ?? C.conflictPresets[preset].label;
        return link({ kind: "conflict", data: { preset, overrides }, label,
          icon: "fa-solid fa-scale-unbalanced", title: t("COMAE.Enricher.conflict") });
      }
    }
  );

  document.body.addEventListener("click", async event => {
    const a = event.target.closest("a.oc-enricher");
    if ( !a ) return;
    event.preventDefault();
    event.stopPropagation();
    if ( a.dataset.ocKind === "check" ) return onCheck(a.dataset);
    if ( a.dataset.ocKind === "conflict" ) return onConflict(a.dataset);
  });
}

async function onCheck({ skill, focus, difficulty }) {
  const actor = await pickActor({ title: t("COMAE.Enricher.who") });
  if ( !actor ) return ui.notifications.warn(t("COMAE.Oppose.noActor"));
  const f = focus ? actor.system.focuses.find(i => (i.system.skill === skill)
    && ((i.system.key === focus) || i.name.toLowerCase().startsWith(focus.toLowerCase()))) : null;
  return actor.rollSkill(skill, { focusId: f?.id, spec: { difficulty } });
}

async function onConflict({ preset, overrides }) {
  if ( !game.user.isGM ) return ui.notifications.warn(t("COMAE.Conflict.gmOnly"));
  return createConflict({ preset, overrides: JSON.parse(overrides || "{}") });
}

