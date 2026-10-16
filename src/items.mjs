/**
 * Tags, Focuses, Peculiarities and the armoury, from the system's own tables.
 */

import { C, ICON, p } from "./lib.mjs";

export const tags = Object.entries(C.tags).map(([key, d]) => ({
  name: d.label, type: "tag", img: ICON(key === "paranormal" ? "paranormal" : "tag"),
  system: { key, description: p(d.text) }
}));

export const focuses = [];
for ( const [skill, list] of Object.entries(C.focuses) ) {
  for ( const [key, f] of Object.entries(list) ) {
    if ( skill === "willpower" ) continue;
    focuses.push({
      name: f.label, type: "focus", img: ICON(`skill-${skill}`), folder: C.skills[skill].label,
      system: { skill, key, restricted: !!f.restricted, description: p(f.text, f.adds ? `<em>Takes in Odd Soot's ${f.adds}.</em>` : "") }
    });
  }
}
// The two Willpower Focuses, to be filled in with a verb and a target.
for ( const [key, f] of Object.entries(C.focuses.willpower) ) {
  focuses.push({
    name: `Willpower //${f.label}`, type: "focus", img: ICON("skill-willpower"), folder: "Willpower",
    system: { skill: "willpower", key, description: p(f.text, "+20% to Willpower when acting for it, and a second experience roll for a session spent following it.") }
  });
}

export const peculiarities = [];
for ( const [kind, d] of Object.entries(C.peculiarities) ) {
  if ( kind === "custom" ) continue;
  peculiarities.push({
    name: d.label, type: "peculiarity", img: ICON("peculiarity"), folder: "Investigators",
    system: { kind, value: 10, mode: d.mode, affects: d.affects, showing: d.mode === "always", description: p(d.text,
      "<em>Peculiarities start at 10% and grow in steps of 10%. Defy one for a day at +20% to it; again, with Willpower, a step harder each time. A month of treatment (100 kr): roll over it; two good months in a row lower it by 10%.</em>") }
  });
}
const npcText = {
  Glassman: "Believes their body is made of glass: no handshakes, terror of stumbling, travel only in a padded box.",
  Wolfman: "Believes they are part wolf, in mind only: roams the woods at night, wild in manner, prefers raw meat.",
  Hunger: "A ravenous hunger: always looking for food, soon raiding bins and stealing.",
  Hypochondria: "Certain of having caught every disease, so certain that some mild symptoms appear.",
  "Split Personality": "Several personalities, up to five, sharing no memories; hypnosis can call one forward.",
  "Always On": "One spell is always active, at no cost; but it is erratic, harmful or only works in certain circumstances.",
  Fugue: "An urge to travel, in an amnesiac state; they come to on another continent or world.",
  Amnesia: "Periods of complete amnesia: who they are, where they came from, what they were doing."
};
for ( const [name, text] of Object.entries(npcText) ) {
  peculiarities.push({
    name, type: "peculiarity", img: ICON("peculiarity"), folder: "Infected NPCs",
    system: { kind: "custom", value: 10, mode: "gm", affects: "none", npc: true,
      description: p(text, "<em>Some suffer it constantly and hide it; others only for periods, normal in between.</em>") }
  });
}

const W = (name, damage, focus, range = 0, extra = {}) => ({
  name, type: "weapon", img: ICON(extra.firearm ? "firearm" : "weapon"), folder: extra.folder ?? (range ? "Ranged" : "Melee"),
  system: { damage, focus, range, firearm: !!extra.firearm, equipped: true, price: extra.price ?? "", description: p(extra.text ?? "") }
});
const A = (name, ap, extra = {}) => ({
  name, type: "armor", img: ICON("armour"), folder: "Armour and Shields",
  system: { ap, apFirearms: extra.apFirearms ?? 0, heavy: !!extra.heavy, shield: extra.shield ?? "none", equipped: false, description: p(extra.text ?? "") }
});

export const armoury = [
  W("Unarmed", "1d3", "unarmed", 0, { text: "Fists, feet, elbows." }),
  W("Martial Arts", "1d4", "unarmed", 0, { text: "Trained blows and throws." }),
  W("Impromptu Weapon", "1d4", "melee", 0, { text: "A chair, a bottle, a candlestick." }),
  W("Knife", "1d4", "melee", 0, { text: "A dagger, a scalpel, a sailor's knife." }),
  W("Cudgel", "1d4", "melee", 0, { text: "A club, a cosh, a walking stick with a lead knob." }),
  W("Staff", "1d4", "melee"),
  W("Short Sword", "1d6", "melee", 0, { text: "A cutlass, a sabre, a bayonet fixed to a rifle." }),
  W("Axe", "1d6", "melee", 0, { text: "A hatchet or a woodsman's axe." }),
  W("Long Sword", "1d8", "melee", 0, { text: "Ceremonial now, but sharp." }),
  W("Longbow", "1d6", "ranged", 50, { text: "Still drawn by Skreeder hunters." }),
  W("Pocket Pistol", "1d6", "ranged", 10, { firearm: true, text: "A small firearm: a derringer or a .25 automatic." }),
  W("Service Revolver", "1d8", "ranged", 20, { firearm: true, text: "A regular firearm: a police or army revolver, an automatic pistol." }),
  W("Rifle", "1d10", "ranged", 100, { firearm: true, text: "<strong>An Odd Soot addition</strong>, not in the Comae Engine list: a hunting or service rifle." }),
  W("Small Blaster", "1d8", "ranged", 20, { firearm: true, folder: "Other eras", text: "From the Comae Engine's list, for other settings or strange devices." }),
  W("Heavy Blaster", "1d10", "ranged", 50, { firearm: true, folder: "Other eras", text: "From the Comae Engine's list, for other settings or strange devices." }),
  A("Light Armour", 2, { text: "Leather or synthetic: a heavy coat, a flying jacket." }),
  A("Medium Armour", 3, { text: "Chain or mesh." }),
  A("Heavy Armour", 4, { heavy: true, text: "Metal plate or composite. Move and Awareness −20%." }),
  A("Bullet-Proof Vest", 2, { apFirearms: 4, text: "Composite: 2 armour, 4 against firearms." }),
  A("Small Shield", 0, { shield: "small", text: "The opponent's Combat −20%, in melee only." }),
  A("Large Shield", 0, { shield: "large", text: "The opponent's Combat −20%, melee or ranged." })
];
