/**
 * Odd Soot's careers in the Comae Engine's form: three skills (the 50%* and two 30%* places of the
 * pyramid) with a suggested Focus, and two Tags. Drop one on an investigator to take it up.
 */

import { ICON, p } from "./lib.mjs";

const K = (name, skills, tags, kit, note = "", folder = "Odd Soot") => ({
  name, type: "career", img: ICON("career"), folder,
  system: {
    skills: skills.map(([skill, focus = ""]) => ({ skill, focus })), tags, kit,
    description: p(note, "<em>Starting kit: 1d6 × 100 Króna, the career's equipment and a rented room; #Wealth instead brings comfortable means.</em>")
  }
});

export default [
  K("Agent", [["cunning", "Stealth"], ["awareness", "Perception"], ["combat", "Ranged"]], ["Secret Identity", "Membership"], "Papers in two names, a pistol"),
  K("Artist", [["knowledge", "Art & Music"], ["social", "Acting"], ["awareness", "Insight"]], ["Contact", "High Society"], "Tools of the art", "Choose #High Society or #Streetwise."),
  K("Bureaucrat", [["knowledge", "Bureaucracy"], ["tech", "Difference Engines"], ["social", "Influence"]], ["Pass", "Contact"], "A good suit, a ministry pass"),
  K("Colonist", [["tech", "Mechanics"], ["science", "Survival"], ["move", "Brawn"]], ["Headquarters (homestead)", "Gear"], "Tools, a rifle, a homestead far away"),
  K("Criminal", [["cunning", "Lockpicking"], ["combat"], ["move", "Athletics"]], ["Streetwise", "Contact"], "Picks, a knife, a fence"),
  K("Detective", [["awareness", "Perception"], ["combat", "Ranged"], ["social", "Influence"]], ["Pass", "Headquarters"], "Badge or licence, revolver, notebook"),
  K("Dilettante", [["science"], ["social"], ["knowledge", "Research"]], ["Contact", "Wealth"], "Whatever money buys"),
  K("Diplomat", [["social", "Influence"], ["knowledge", "Language"], ["awareness", "Insight"]], ["High Society", "Status"], "Diplomatic papers, fine clothes"),
  K("Engineer", [["tech", "Engineering"], ["science", "Chemistry"], ["knowledge", "Craft"]], ["Gear", "Lab"], "Tool case, slide rule"),
  K("Explorer", [["move", "Athletics"], ["science", "Survival"], ["tech", "Pilot"]], ["Auspicious", "Status"], "Expedition kit, maps, compass"),
  K("Journalist", [["knowledge", "Research"], ["social", "Influence"], ["awareness", "Perception"]], ["Contact", "Pass (Press)"], "Press card, camera, notebook"),
  K("Lawyer", [["knowledge", "Bureaucracy"], ["social", "Oratory"], ["awareness", "Insight"]], ["Status", "High Society"], "Briefcase, law books"),
  K("Librarian", [["knowledge", "Research"], ["knowledge", "Language"], ["awareness", "Perception"]], ["Headquarters (library)", "Contact"], "Keys to the stacks",
    "Knowledge fills two places: give it 50% with //Research, and a second Focus, //Language."),
  K("Physician", [["science", "Medicine"], ["awareness", "Perception"], ["social"]], ["High Society", "Lab"], "Doctor's bag", "//Astrobiology suits a physician who treats aliens."),
  K("Player", [["cunning", "Gambling"], ["social", "Deceit"], ["awareness", "Insight"]], ["Auspicious", "High Society"], "Cards, dice, a lucky charm", "Choose #High Society or #Streetwise."),
  K("Politician", [["social", "Oratory"], ["knowledge", "Bureaucracy"], ["awareness", "Insight"]], ["Status", "Membership (party)"], "A party pin, a following"),
  K("Priest", [["social", "Oratory"], ["knowledge", "Research"], ["willpower"]], ["Membership (church)", "Status"], "Vestments, scripture"),
  K("Scholar", [["knowledge", "Research"], ["knowledge", "Language"], ["social", "Oratory"]], ["Contact", "Lab"], "Books, a university post",
    "Knowledge fills two places: give it 50% with //Research, and a second Focus, //Language."),
  K("Scientist", [["science"], ["awareness", "Perception"], ["tech"]], ["Membership (society)", "Lab"], "Instruments of the field", "Any Science Focus."),
  K("Soldier", [["combat"], ["cunning", "Stealth"], ["move", "Athletics"]], ["Membership (military)", "Gear"], "Service rifle, uniform"),
  K("Writer", [["knowledge", "Research"], ["social", "Influence"], ["awareness", "Perception"]], ["Contact", "Wealth"], "Typewriter, publisher"),
  K("Wittenberg Priest", [["knowledge", "Research"], ["willpower"], ["magic"]], ["Membership (Priests of Wittenberg)", "Paranormal"], "Vestments, a spell of the order",
    "One of the two careers that may begin with magic: #Paranormal takes one of the two Tags.", "With magic"),
  K("Skreeder Shaman", [["science", "Survival"], ["magic"], ["awareness", "Track"]], ["Membership (Skreeder Shamans)", "Paranormal"], "Ritual fetishes, Contact Spirit",
    "One of the two careers that may begin with magic: #Paranormal takes one of the two Tags.", "With magic")
];
