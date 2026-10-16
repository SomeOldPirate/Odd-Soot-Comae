/**
 * A quick reference for the table: how Odd Soot plays on the Comae Engine, and where each rule
 * lives in Foundry.
 */

import { C, p, ul, table, link } from "./lib.mjs";

/** The book's tables live in a content module, so they are named rather than linked. */
const tbl = name => `<em>${name}</em>`;

const pages = [
  {
    name: "Rolling Dice",
    text: p(
      "Roll d100 equal to or under the skill to succeed. A <strong>Focus</strong> adds +20% when it fits the task: Awareness 50% with //Perception rolls under 70% to notice, 50% for anything else.",
      "<strong>Doubles</strong> (11, 22 … 99) are exceptional: under the skill, something exceptionally good; over it, exceptionally bad. 00 is always exceptionally bad."
    ) + table(["Difficulty", "Modifier"], [["Routine", "No roll"], ["Easy", "+20%"], ["Normal", "—"], ["Hard", "−20%"], ["Very Hard", "−40%"]])
      + p("A helping hand: +10% for one helper with the right skill, +5% more for a second, +2% for a third.",
        "<strong>Opposed rolls</strong>: both roll; the highest success wins. Every roll card has an <em>Oppose</em> button; the contest card that follows lets the Game Master <em>Escalate</em> into an Extended Conflict.",
        "<strong>In Foundry</strong>: click a skill's name to roll it, or a Focus to roll with it. The roll dialog gathers everything that bears on the roll: difficulty, helpers, a showing Peculiarity, a missing #High Society, the Disposition of a targeted NPC, alien penalties.")
  },
  {
    name: "Extended Conflicts",
    text: p(
      "Arguments, chases, searches, locks, journeys and fights are all Extended Conflicts: rounds of opposed rolls, each won by the highest success, the winner dealing damage (1d6, or a weapon's) to one of the loser's Conflict Pools. At zero a participant is out.",
      "Each round: choose the pool and skill; the highest pool acts first and says what they try (and with which Lens); everyone rolls; the best success narrates and rolls damage."
    ) + table(["Static opposition", "Pool", "Rating"], Object.values(C.challenges).map(r => [r.label, r.pool, `${r.skill}%`]))
      + p("The rating says how hard the obstacle is, the pool how long it takes.",
        "<strong>Pushing on</strong>: a pool at zero may be pushed below it, to its full negative value. While any pool is below zero, every skill is −20%, and that pool returns only one point a day. At its full negative value the character falls into a <em>Comae State</em> (or, with the lethal setting, may die). Common and Skilled NPCs cannot push.",
        "<strong>In Foundry</strong>: the Game Master starts a conflict from the combat tracker (<em>New Conflict</em>) with a ready-made template, or by Escalating an opposed roll. The Conflict Board shows both sides; each player rolls for their character there; the Game Master resolves the round, and damage, Lenses, armour, clue thresholds and pushing are applied for them.")
  },
  {
    name: "Lenses",
    text: p("A Lens is the attitude taken in a round of a conflict.")
      + table(["Lens", "Effect"], Object.entries(C.lenses).filter(([k]) => k !== "none").map(([, l]) => [l.label, l.text]))
      + p("Most NPCs do not use Lenses; recurring and Master NPCs often do. Lenses can be turned off in the system settings.")
  },
  {
    name: "Pools, Damage and Luck",
    text: p("Four Conflict Pools: <strong>BODY</strong> (wounds, exhaustion, fights, stealth), <strong>INT</strong> (research, puzzles, searches), <strong>POW</strong> (fear, nerve, luck, magic), <strong>CHA</strong> (persuasion, parties). A night's sleep restores a pool that is zero or above.")
      + table(["Hazard", "Damage"], Object.values(C.hazards).map(h => [h.label, `${h.formula} ${C.pools[h.pool].abbr}${h.note ? ` — ${h.note}` : ""}`]))
      + p("Armour soaks BODY damage from weapons point for point. //Medicine restores 1d4 to a pool above zero, 1 to one below; once per pool a day.",
        "<strong>Luck</strong> (2 Points, 3 with #Auspicious), renewed after each scenario:")
      + ul(Object.values(C.luckUses).map(u => `<strong>${u.label}</strong>: ${u.text}`))
      + p("With the optional rule, Luck may be borrowed down to −2. Each borrowed point is repaid by turning a success into a failure (the <em>Repay</em> button on a roll card). Borrowed Luck does not renew.")
  },
  {
    name: "Creating an Investigator",
    text: ul([
      "A concept, and a career (drop one from the <em>Careers</em> compendium onto the sheet).",
      "Skills: 50%* in one, 30%* in two, 30% in four more; the rest 5%. The three starred places come with a Focus. The sheet's creation mode shows the pyramid as it fills.",
      "Native language is a free Focus: Knowledge //Language.",
      "Pools: 16, 14, 12 and 10 to BODY, INT, POW and CHA, or 2d6+6 each.",
      "Two Tags (roll 1d12, or choose). #Paranormal is the only way to begin with magic.",
      "Two Willpower Focuses: a Verb //Person and a Verb //Circle, rolled on the " + tbl("Willpower Focus: Verb") + " and the " + tbl("Circle Table") + " tables. A second Circle is kept as background.",
      "Two Luck Points.",
      "Knowledge //The Soot cannot be taken at creation."
    ]) + p("<strong>Starting infected</strong>: The Soot at POW, one rolled Peculiarity at 10%, and one extra Focus.",
      "<strong>Growth</strong>: at the end of each session, 1d4+1 to one skill, and a second roll for following a Willpower Focus. Forgo four rolls for a new Focus, six for a new Tag.")
  },
  {
    name: "The Soot",
    text: p(
      "The first time an investigator kills an intelligent being, roll d100 under POW's maximum: if it succeeds, they are infected, and The Soot starts at that value. Every later killing: roll under The Soot, and if it succeeds, roll on the " + tbl("Peculiarity Table") + " (halved the first time).",
      "Peculiarities start at 10% and grow by 10%. Roll for them at the start of a session, highest first, stopping at the first that shows, or when tempted. A showing Peculiarity lowers the skills it affects by its value:"
    ) + table(["Odd Soot's words", "Comae skills"], Object.values(C.groups).map(g => [g.label, g.skills.map(k => C.skills[k].label).join(", ")]))
      + p("Willpower is never lowered: it is what defies them. Defy a Peculiarity for a day at +20% to it; again with Willpower, a step harder each time. Treatment: a month at 100 kr, roll over it; two good months lower it by 10%. At 100% The Soot takes the character.",
        "<strong>In Foundry</strong>: the Soot tab has <em>A Life Taken</em>, the Peculiarity table, the session roll, and Tempted, Defy and Treatment on each Peculiarity. The Game Master's NPC sheet can make an infected NPC of any Phase.")
  },
  {
    name: "Magic",
    text: p(
      "<strong>Magic</strong> is a skill apart, at 0% unless the character has #Paranormal. Alone it covers theory; each spell is a Focus, and casting needs it: roll Magic + 20%.",
      "Casting costs POW: the full cost on a success, half (rounded up) on an exceptional success, 1 on a failure, the full cost and 1d6 more on an exceptional failure. Spend extra POW for range, duration or mass. Short of POW, a caster may push POW below zero (or, by a world setting, pay the rest from BODY).",
      "Resisted spells are opposed by Willpower (Stupor at Very Hard). Damage spells hurt BODY through armour. Healing moves BODY damage from patient to caster.",
      "<strong>Learning</strong> a spell from a written source is an Extended Conflict: Magic (no Focus) and INT against the spell's Complexity (twice its cost) and the writer's craft (30-90%), an hour a round. Win, and the spell is a new Focus and #Paranormal is granted; Magic starts at POW × 2 if lower. Lose, and wait a month.",
      "<strong>In Foundry</strong>: drop a spell from the <em>Spells</em> compendium onto a character to study it (the Game Master starts the conflict), or, as Game Master, to grant it."
    )
  },
  {
    name: "Settings",
    text: ul([
      "<strong>Lenses</strong>: offered in conflicts (on).",
      "<strong>Halved pools are Hard</strong>: Odd Soot's rule that a pool at half or less makes its skills −20% (off).",
      "<strong>Negative Luck</strong>: borrowing Luck to −2 (off).",
      "<strong>Lethal end game</strong>: a pool at its full negative value may kill (on). Off, it only removes the character from the scenario.",
      "<strong>Casting past empty</strong>: push POW below zero, or pay the shortfall from BODY.",
      "<strong>Corruption</strong>: a house rule; an infected caster's exceptional failure tests The Soot as a killing would (off)."
    ])
  }
];

export default [{ name: "Odd Soot on the Comae Engine", pages }];
