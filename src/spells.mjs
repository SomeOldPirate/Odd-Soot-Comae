/**
 * The spells of Odd Soot as Magic Focuses: costs, ranges and durations as printed, described
 * briefly. POW pays for them; Complexity (twice the cost) is the pool to beat when learning one.
 */

import { ICON, p } from "./lib.mjs";

const S = (name, cost, range, duration, text, o = {}) => ({
  name, type: "focus", img: ICON("spell"), folder: o.folder ?? "Magic chapter",
  system: {
    skill: "magic", restricted: true, source: o.source ?? "Odd Soot, Magic",
    spell: { cost, costText: o.costText ?? "", range, duration, resist: o.resist ?? "none", effect: o.effect ?? "none",
      formula: o.formula ?? "", scalable: o.scalable ?? true, secret: !!o.secret },
    description: p(text, o.note ? `<em>${o.note}</em>` : "")
  }
});

export default [
  S("Detect Magic", 1, "10 m", "1 round", "Senses magic within range: where it is and how strong. Nothing about what it does."),
  S("Healing", 1, "Touch", "Until next damage", "Moves BODY damage from the patient onto the caster, point for point, a minute per point. Works on a patient below zero; cannot take the caster below zero.",
    { costText: "1 POW per BODY point", effect: "heal" }),
  S("Mind's Hand", 3, "10 m", "1 round", "Moves an object without touching it, 5 metres a round. It cannot be used to hurt.", { costText: "3 POW per SIZ 1 moved" }),
  S("Psychometry", 3, "10 m", "1 minute", "Fragmentary visions of what has passed around an object or a place. The Game Master decides how much is seen.", { costText: "3 POW per week back" }),
  S("Solidify", 3, "10 m", "1 round", "Turns a liquid solid: stand on water, carry it like a stone, or lock an opponent's limb, interrupting what they do. A solidified limb strikes for 1d4+2 with 4 armour. Held on living tissue for over two minutes, it risks lasting harm.",
    { costText: "3 POW per 0.1 m²" }),
  S("Merge", 3, "Touch", "1 round", "Fuses two objects into one. Not living tissue."),
  S("Liquid Light", 3, "10 m", "1 round", "A 20 × 20 cm patch of air that bends light like a mirror: look round corners, throw sunlight into a dark room or someone's eyes. More POW, more mirrors."),
  S("Pocket", 3, "Touch", "1 round", "Hides a small object (up to SIZ 5) in a fold of space-time, where only Detect Magic can find it. It returns where it vanished, or beside the caster for 1 POW more. Not life-forms.",
    { costText: "+1 POW for it to reappear by the caster" }),
  S("Tunnelling", 5, "Touch", "1 round", "Opens a passage through solid matter. Anything still inside when it closes is stuck: 1 BODY, doubling each round.", { costText: "5 POW per round" }),
  S("Slow Down", 5, "10 m", "1 round", "Slows one person or object to a tenth of its speed. A slowed bullet does no damage; a slowed person moves half a metre a round.", { resist: "willpower" }),
  S("Explosive Unfold", 5, "10 m", "Instant", "A blast of unfolding dimensions: 1d6 BODY to everyone within a metre (2d6 to objects), less further out. Those who see it coming may evade with Move.",
    { effect: "damage", formula: "1d6", resist: "move" }),
  S("Infect", 5, "Touch", "Permanent", "Plants The Soot. An uninfected victim's Soot starts at POW × 2; an infected one's rises 10%. A rare and terrible spell.", { scalable: false }),
  S("Send", 5, "10 m", "1 round", "Sends one sentence, a thought or a feeling, to one mind in range, seen or not.", { costText: "5 POW per extra sentence or receiver" }),
  S("Unfire", 5, "10 m", "Permanent", "Sucks the heat from a small fire, which vanishes into a black point at its heart.", { costText: "5 POW per 0.5 m²" }),
  S("Contact the Dead", 10, "10 m", "15 minutes", "Speaks with the spirit of the dead, who must answer truthfully; easiest within a day of death. The Priests of Wittenberg teach it only within the order.",
    { costText: "+2 POW per day dead" }),
  S("Farsight", 15, "—", "1 hour trance", "Sees other times and places, often the future: vague, one possible future among many. The caster lies in trance an hour. The Game Master rolls in secret, and the full cost is always paid.",
    { scalable: false, secret: true, note: "15 POW will often need pushing." }),
  S("Contact Spirit", 5, "10 m", "15 minutes", "A Skreeder shaman's call to the spirits, who may grant a Luck Point, a bonus of 10-30% later, or a warning. Ritual adds +10% per 10 minutes, to +30%.",
    { folder: "Skreeder Shamans", source: "Odd Soot, Skreeder Shamans" }),
  S("Illusion", 1, "10 m", "1 minute", "A false sight, sound or smell. Anyone who doubts it rolls Willpower against the caster's Magic //Illusion.",
    { folder: "The Wayward Patient", source: "The Wayward Patient", costText: "+1 POW per extra sense; 2 if it moves", resist: "disbelieve" }),
  S("Eyes in a Jar", 3, "10 km", "10 seconds", "Sees through prepared animal eyes kept in a jar, wherever they are taken.", { folder: "The Wayward Patient", source: "The Wayward Patient" }),
  S("Stupor", 5, "Touch", "1d4 hours", "Puts the victim into a stupor. Needs a potion a day in the brewing. Resisted with Willpower at Very Hard.",
    { folder: "The Wayward Patient", source: "The Wayward Patient", resist: "willpowerVeryHard", scalable: false }),
  S("Dream Projector", 5, "2 × 2 m", "1 minute", "Projects a dream into the waking world. Weapons have half effect against its figures.", { folder: "The Wayward Patient", source: "The Wayward Patient" }),
  S("Create Portal", 10, "10 m", "1 round to open", "Opens a portal through custom-built machinery. Spotting one takes a Hard Awareness //Perception roll.",
    { folder: "The Wayward Patient", source: "The Wayward Patient", costText: "+5 POW to move the machine" })
];
