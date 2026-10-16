/**
 * The tables of Odd Soot on the Comae Engine: skills and their Focuses, Conflict Pools, Tags,
 * Lenses, challenge ratings, the Soot and its Peculiarities, NPC tiers and the Code Block
 * generator. Kept free of Foundry so that the rules and the pack builder can read it too.
 * @module oddsoot-comae/config
 */

export const SYSTEM_ID = "oddsoot-comae";

const C = {};

/* -------------------------------------------- */
/*  Conflict Pools                              */
/* -------------------------------------------- */

C.pools = {
  body: { label: "Body", abbr: "BODY", use: "Wounds, exhaustion, chases, stealth and fights" },
  int: { label: "Intelligence", abbr: "INT", use: "Research, puzzles, searches and strange machines" },
  pow: { label: "Power", abbr: "POW", use: "Fear, nerve, luck and magic" },
  cha: { label: "Charisma", abbr: "CHA", use: "Arguments, parties, persuasion and performance" }
};

/** The values handed out at creation, or rolled with 2d6+6. */
C.poolArray = [16, 14, 12, 10];
C.poolDice = "2d6+6";

/* -------------------------------------------- */
/*  Skills and Focuses                          */
/* -------------------------------------------- */

/**
 * The nine skills, and Magic outside them. `group` is the Odd Soot skill group a Peculiarity or an
 * alien penalty refers to; Willpower belongs to none, because it is used to defy them.
 */
C.skills = {
  awareness: { label: "Awareness", group: "senses", text: "The senses, noticing, reading people, tracking." },
  combat: { label: "Combat", group: "physical", text: "Any physical violence: brawls, blades, firearms, artillery, explosives." },
  cunning: { label: "Cunning", group: "physical", text: "Sneaking and hiding, locks, pockets, cards and forged papers." },
  knowledge: { label: "Knowledge", group: "mental", text: "Languages, archives, cultures, bureaucracy, trade, the arts." },
  move: { label: "Move", group: "physical", text: "Running, climbing, swimming, riding, dancing and lifting." },
  science: { label: "Science", group: "mental", text: "The natural sciences, medicine, navigation and survival." },
  social: { label: "Social", group: "social", text: "Persuasion, lies, oratory, bribes and acting a part." },
  tech: { label: "Tech", group: "mental", text: "Machines and devices: using, mending and building them, and driving or piloting." },
  willpower: { label: "Willpower", group: null, text: "Nerve and grit: resisting a speaker, keeping calm, defying a Peculiarity." },
  magic: { label: "Magic", group: "mental", magic: true, text: "Luminarian theory: recognising magic, reading fons mercurialis, learning spells. Casting needs the spell as a Focus." }
};

/** The nine of the skill pyramid; Magic stands apart. */
C.skillOrder = ["awareness", "combat", "cunning", "knowledge", "move", "science", "social", "tech", "willpower"];

/** The skill pyramid with Focus rules: the three marked slots each come with a Focus. */
C.pyramid = [
  { value: 50, focus: true }, { value: 30, focus: true }, { value: 30, focus: true },
  { value: 30 }, { value: 30 }, { value: 30 }, { value: 30 }
];
C.skillFloor = 5;
C.focusBonus = 20;

/** Odd Soot's skill groups, as Comae skills. */
C.groups = {
  physical: { label: "Physical skills", skills: ["move", "combat", "cunning"] },
  mental: { label: "Mental skills", skills: ["knowledge", "science", "tech", "magic"] },
  social: { label: "Social skills", skills: ["social"] },
  senses: { label: "The senses", skills: ["awareness"] }
};

/**
 * The Focus list, tailored to Odd Soot. `restricted` Focuses cannot be taken at creation.
 * `adds` names the Odd Soot skills a Focus takes in.
 */
C.focuses = {
  awareness: {
    insight: { label: "Insight", text: "Read a person's intentions and feelings; spot a lie told by //Influence or //Deceit." },
    perception: { label: "Perception", text: "Notice the small things: a scent, a scuff mark, a hidden door, a clue." },
    track: { label: "Track", text: "Find and follow trails, footprints and likely hiding places." }
  },
  combat: {
    gunnery: { label: "Gunnery", text: "Cannon and artillery, fixed or mounted on vehicles and ships." },
    melee: { label: "Melee", text: "Fighting hand to hand with a weapon: knives, clubs, swords, bayonets." },
    ranged: { label: "Ranged", text: "Pistols, revolvers, rifles, shotguns, bows and thrown weapons." },
    unarmed: { label: "Unarmed", text: "Fists, feet, holds and throws." }
  },
  cunning: {
    gambling: { label: "Gambling", text: "Cards, dice and roulette, played well enough to win." },
    lockpicking: { label: "Lockpicking", text: "Opening locks without the key, with or without proper tools." },
    sleight: { label: "Sleight", text: "Picking pockets, palming objects, a card up the sleeve." },
    stealth: { label: "Stealth", text: "Hiding and moving unseen; opposed by //Perception." },
    forgery: { label: "Forgery", text: "Counterfeit papers, signatures and seals.", adds: "Forgery" }
  },
  knowledge: {
    artMusic: { label: "Art & Music", text: "Making, performing and judging art and music, photography included.", adds: "Art, Musicianship" },
    bureaucracy: { label: "Bureaucracy", text: "Offices, permits and politics: finding the way through red tape.", adds: "Bureaucracy, Politics" },
    commerce: { label: "Commerce", text: "Knowing goods and their worth; haggling." },
    craft: { label: "Craft", text: "Making things by hand: carpentry, metalwork, tailoring." },
    language: { label: "Language", text: "Speaking, reading and writing a tongue. Everyone has their native language; Menaryan is the trade tongue of Comae Space." },
    research: { label: "Research", text: "Digging facts out of archives, libraries and records." },
    culture: { label: "Culture", text: "The customs of one species (Luminarian, Aygaan, Eldirerrr, Nuveri, Sumsum, Skreeder). Removes one step of alien penalty in their company.", adds: "Culture" },
    theSoot: { label: "The Soot", text: "What is known of the disease, its stains, its phases and its victims. Never taken at creation: it is learned the hard way.", restricted: true, adds: "Knowledge (The Soot)" },
    history: { label: "History", text: "The past of Doggerland, Eorthe and the worlds beyond the unfolding." }
  },
  move: {
    acrobatics: { label: "Acrobatics", text: "Tumbling, balance and landing well; also moving in zero gravity.", adds: "Acrobatics, Zero G" },
    athletics: { label: "Athletics", text: "Climbing, jumping and running, and lasting at it.", adds: "Athletics, Endurance" },
    brawn: { label: "Brawn", text: "Lifting, throwing, forcing and breaking." },
    dancing: { label: "Dancing", text: "The dances of the day, and a feel for the music." },
    ride: { label: "Ride", text: "Riding, and the care of the animals ridden." },
    swim: { label: "Swim", text: "Swimming in any water and weather; a little diving." }
  },
  science: {
    astronomy: { label: "Astronomy", text: "Stars, moons and comets; calculating celestial events." },
    chemistry: { label: "Chemistry", text: "Identifying and making chemicals; working a laboratory." },
    medicine: { label: "Medicine", text: "First aid, psychology and medicine. A success restores 1d4 to a Conflict Pool above zero, or 1 below it; once per pool a day.", adds: "First Aid, Medicine" },
    navigation: { label: "Navigation", text: "Finding the way on land, underground, at sea and between the stars.", adds: "Navigation, Astrogation" },
    survival: { label: "Survival", text: "Living off the land for a week: shelter, water, food." },
    astrobiology: { label: "Astrobiology", text: "Alien life and alien bodies. Removes one step of penalty from medicine on aliens.", adds: "Science (Astrobiology)" }
  },
  social: {
    acting: { label: "Acting", text: "Playing a part on stage or off, with voice, gesture, make-up and dress.", adds: "Acting, Disguise" },
    deceit: { label: "Deceit", text: "Lying without being caught." },
    influence: { label: "Influence", text: "Persuading one person: guards, clerks, doormen, lovers.", adds: "Influence, Seduction" },
    oratory: { label: "Oratory", text: "Persuading a crowd: speeches, sermons, juries." }
  },
  tech: {
    differenceEngines: { label: "Difference Engines", text: "Programming and repairing the great calculating engines of the age.", adds: "Difference Engines" },
    comms: { label: "Comms", text: "Wireless, telegraph and telephone, used and mended under pressure." },
    engineering: { label: "Engineering", text: "Large structures: how they are built, how strong they are, where they will fail." },
    mechanics: { label: "Mechanics", text: "Mechanical and electrical equipment, engines and vacuum suits.", adds: "Mechanics, Electronics, Vacc Suit" },
    pilot: { label: "Pilot", text: "Vehicles of the age: motorcars, boats, aeroplanes, dirigibles and starships.", adds: "Drive, Boating, Seamanship, Pilot" },
    sensors: { label: "Sensors", text: "Radar and detection apparatus. Rare in the 1920s." }
  },
  willpower: {
    person: { label: "Person", text: "A driving force aimed at someone: Protect //Sibling, Avenge //Partner." },
    circle: { label: "Circle", text: "A driving force aimed at a Circle: Be Loyal to //University, Fear //Prison." }
  }
};

/** Native language is a Focus every character starts with. */
C.nativeLanguage = "Native Tongue";

/* -------------------------------------------- */
/*  Rolls                                       */
/* -------------------------------------------- */

C.difficulties = {
  routine: { label: "Routine", mod: null, hint: "Succeeds" },
  easy: { label: "Easy", mod: 20, hint: "+20%" },
  normal: { label: "Normal", mod: 0, hint: "" },
  hard: { label: "Hard", mod: -20, hint: "−20%" },
  veryHard: { label: "Very Hard", mod: -40, hint: "−40%" }
};
C.difficultyOrder = ["routine", "easy", "normal", "hard", "veryHard"];

/** A helping hand: the first helper adds 10%, the second 5%, the third 2%. */
C.helpers = [10, 5, 2];

/** Results, worst to best. */
C.results = {
  0: { key: "fumble", label: "Exceptional Failure", short: "Disaster" },
  1: { key: "failure", label: "Failure", short: "Failure" },
  2: { key: "success", label: "Success", short: "Success" },
  3: { key: "critical", label: "Exceptional Success", short: "Exceptional" }
};

/** The penalty on every skill while any pool is below zero. */
C.pushPenalty = -20;

/* -------------------------------------------- */
/*  Lenses                                      */
/* -------------------------------------------- */

C.lenses = {
  none: { label: "No Lens", mod: 0, text: "A plain roll." },
  aggressive: { label: "Aggressive", mod: -20, text: "−20%. Roll damage twice, keep the higher." },
  cautious: { label: "Cautious", mod: 20, text: "+20%, but deal only half damage." },
  clever: { label: "Clever", mod: 0, text: "Observe: win and deal no damage, but next round take +20% or roll damage twice. Lose and take damage as usual." },
  covert: { label: "Covert", mod: 0, skill: "cunning", text: "Roll Cunning instead. Win: damage any pool, opponent −20% next round. Lose: you are −20% next round." },
  flamboyant: { label: "Flamboyant", mod: 0, secondary: true, text: "Roll a showy secondary skill. Win: damage the main pool or CHA, opponent −20% next round. Lose: you are −20% next round." },
  quick: { label: "Quick", mod: -20, text: "−20%, and a second action (not a second attack) this round." }
};

/* -------------------------------------------- */
/*  Extended Conflicts                          */
/* -------------------------------------------- */

/** Ratings for an opposing force that is not a person. Heroic and Impossible only lengthen the pool. */
C.challenges = {
  easy: { label: "Easy", pool: 5, skill: 30 },
  normal: { label: "Normal", pool: 10, skill: 50 },
  hard: { label: "Hard", pool: 15, skill: 70 },
  veryHard: { label: "Very Hard", pool: 20, skill: 90 },
  heroic: { label: "Heroic", pool: 25, skill: 90 },
  impossible: { label: "Impossible", pool: 30, skill: 90 }
};

/** Who takes the damage when a round is won. */
C.damageModes = {
  single: "The winner strikes one opponent",
  side: "The whole losing side takes it",
  all: "Every other participant takes it",
  roller: "Only the loser who rolled takes it"
};

/**
 * Conflicts from the Comae Engine and Odd Soot, ready to run.
 * `static`: suggest a static opposition; `clues`: offer clue thresholds; `partial`: a success that
 * is not the best still wears the opposition down by 1d3 (journeys); `learn`: learning a spell.
 */
C.conflictPresets = {
  custom: { label: "Custom", pool: "cha", skills: "", round: "", damage: "1d6", mode: "single" },
  persuade: { label: "Persuade", pool: "cha", skills: "Social //Influence //Oratory //Deceit, Awareness //Insight", round: "2 minutes", damage: "1d6", mode: "side",
    lenses: { aggressive: "Open threats; their Disposition will suffer for it.", clever: "Study them first: learn their Motivation or Personality.", covert: "Veiled threats and insinuation, which invite the same back.", flamboyant: "A torrent of flattery and fine words.", quick: "No small talk: straight at the weak spot." } },
  journey: { label: "Journey on Foot", pool: "body", skills: "Move //Athletics", round: "6 hours", damage: "1d6", mode: "side", static: "normal", partial: true,
    note: "The terrain's pool is the distance (5 points a day); its rating is the going: 30% plains, 50% hills or forest, 70% mountains or wetland; +20% bad weather, −20% a road. Roll twice a day for the group. Sleep restores BODY; without a camp or a //Survival roll, only half." },
  pickLock: { label: "Pick a Lock", pool: "body", skills: "Cunning //Lockpicking", round: "2 minutes", damage: "1d6", mode: "single", static: "normal",
    lenses: { aggressive: "Opened, but plainly forced.", cautious: "Silent and unmarked, but slower.", clever: "Study the mechanism first.", quick: "Two rolls a round." } },
  searchClues: { label: "Search for Clues", pool: "int", skills: "Awareness //Perception", round: "5-20 minutes", damage: "1d6", mode: "side", static: "normal", clues: true,
    note: "Searchers take turns rolling and share the INT damage; divide the time by the number of searchers." },
  melee: { label: "Melee Combat", pool: "body", skills: "Combat //Melee //Unarmed", round: "5 seconds", damage: "1d6", mode: "single", weapons: true,
    note: "Zero BODY is a non-lethal defeat. Below zero, things get serious." },
  firearms: { label: "Firearm Combat", pool: "body", skills: "Combat //Ranged", round: "5 seconds", damage: "1d6", mode: "single", weapons: true,
    note: "Shooting at someone in cover: −20% to −100%. Suppressive fire: −40%. Quick Lens to shoot from cover: the enemy is at −40%." },
  dinner: { label: "Dinner Party", pool: "cha", skills: "Social //Influence //Oratory //Deceit, Awareness //Insight", round: "20-30 minutes", damage: "1d6", mode: "roller", static: "normal", clues: true,
    note: "The party has one collective pool. Lose a roll and only you lose CHA; at zero you are asked to leave. It ends after 2-6 hours whatever the pools." },
  manuscript: { label: "Decipher a Manuscript", pool: "int", skills: "Knowledge //Language //Research", round: "1 day", damage: "1d6", mode: "single", static: "normal", clues: true,
    note: "A fons mercurialis is Normal (10/50%); the writings of the infected at least Hard (15/70%). Defeat: try again in a month." },
  device: { label: "Use an Unfamiliar Device", pool: "int", skills: "Tech //Mechanics //Engineering", round: "1 hour", damage: "1d6", mode: "single", static: "normal",
    note: "Complexity as pool: simple 5, multi-part 10, complex 15, incomprehensible 20+; +5 if magic is built in. Strangeness or the inventor's Soot add penalty steps." },
  engine: { label: "Use a Difference Engine", pool: "int", skills: "Tech //Difference Engines", round: "1 hour", damage: "1d6", mode: "single", static: "normal" },
  learnSpell: { label: "Learn a Spell", pool: "int", skills: "Magic", round: "1 hour", damage: "1d6", mode: "single", static: "normal", learn: true,
    note: "The spell's Complexity (twice its POW cost) is the pool; the writer's craft, 30% to 90%, is the rating. Win and the spell is learned as a Focus." },
  poker: { label: "Poker Game", pool: "pow", skills: "Cunning //Gambling", round: "15 minutes", damage: "1d6", mode: "all", freeForAll: true,
    note: "Casual players 5/30%, regulars 10/50%, professionals 15/70%. Cheating with //Sleight: +10%." },
  chase: { label: "Chase", pool: "body", skills: "Move //Athletics, Tech //Pilot", round: "10 seconds", damage: "1d6", mode: "single" },
  sneak: { label: "Sneak Past", pool: "body", skills: "Cunning //Stealth vs Awareness //Perception", round: "1-5 minutes", damage: "1d6", mode: "single" }
};

/** The writer's craft, for learning a spell. */
C.spellPuzzles = { 30: "A simple puzzle", 50: "A puzzle of normal complexity", 70: "A complex puzzle", 90: "A master's multi-layered puzzle" };

/* -------------------------------------------- */
/*  Damage and Hazards                          */
/* -------------------------------------------- */

C.hazards = {
  falling: { label: "Falling (per 5 m)", pool: "body", formula: "1d6", note: "1d3 with a successful Move roll." },
  fireSmall: { label: "Fire: small (per 5 s)", pool: "body", formula: "1d4" },
  fireMedium: { label: "Fire: burning car (per 5 s)", pool: "body", formula: "1d8" },
  fireLarge: { label: "Fire: room ablaze (per 5 s)", pool: "body", formula: "2d8" },
  poisonMild: { label: "Poison: mild (6/30%)", pool: "body", formula: "1d4", note: "Only if the poison wins an opposed roll against Move, without a Focus." },
  poisonMedium: { label: "Poison: medium (11/50%)", pool: "body", formula: "1d6", note: "Only if the poison wins an opposed roll against Move, without a Focus." },
  poisonStrong: { label: "Poison: strong (16/70%)", pool: "body", formula: "1d8", note: "Only if the poison wins an opposed roll against Move, without a Focus." },
  crash: { label: "Crashing (per 25 km/h)", pool: "body", formula: "1d6", note: "1d3 with a successful Move roll." },
  fearMild: { label: "Fear: unsettling", pool: "pow", formula: "1d4", note: "Roll Willpower to resist the urge to flee." },
  fearBad: { label: "Fear: shocking", pool: "pow", formula: "1d6", note: "Roll Willpower to resist the urge to flee." },
  fearGory: { label: "Fear: horrifying", pool: "pow", formula: "1d10", note: "Roll Willpower to resist the urge to flee." },
  suffocation: { label: "Suffocation (per minute)", pool: "body", formula: "1d6", note: "After the first minute. Unconscious at zero." },
  dehydration: { label: "Dehydration (per 6 hours)", pool: "body", formula: "1d4", note: "After 12 hours without water." },
  hunger: { label: "Hunger (per day)", pool: "body", formula: "1d4", note: "After 48 hours without food." },
  labour: { label: "Strenuous labour (per hour)", pool: "body", formula: "1d4", note: "After 4 hours. Roll Willpower each hour not to give up." }
};

/* -------------------------------------------- */
/*  Luck                                        */
/* -------------------------------------------- */

C.luck = { start: 2, auspicious: 3, floor: -2 };
C.luckUses = {
  flip: { label: "Flip the Dice", text: "Swap the digits of a d100 roll." },
  reduce: { label: "Reduce Damage", text: "Damage from one roll becomes 1." },
  appear: { label: "Timely Appearance", text: "A Contact turns up." },
  found: { label: "Look What I Found", text: "Find a small piece of equipment." },
  refresh: { label: "Refreshed", text: "Bring one Conflict Pool back up to 1." }
};

/* -------------------------------------------- */
/*  Tags                                        */
/* -------------------------------------------- */

/**
 * Comae's twelve Tags read through the setting, and #Paranormal.
 * `call`: a request whose chance halves with each use in a scenario. `lacking`: Social is −20% in
 * that circle without the Tag. `bonus`: Social +20% where it counts. `luck`: Luck Points.
 */
C.tags = {
  contact: { label: "Contact", d12: 1, call: true, text: "Someone to ask: an old friend, a colleague, an informant, a professor. The first meeting in a scenario is certain; each further one is half as likely (50%, 25%, 13%…). What they know may be useless, biased or false." },
  highSociety: { label: "High Society", d12: 2, lacking: "Among the upper classes", text: "At home among Doggerland's moneyed class and in a star-liner's first class. Without it, Social is −20% among them. Takes the place of Odd Soot's Courtesy." },
  lab: { label: "Lab", d12: 3, call: true, text: "Access to a laboratory and a discreet, knowledgeable assistant. The first request in a scenario is granted; each further one is half as likely." },
  pass: { label: "Pass", d12: 4, bonus: "A borderline case for the Pass", text: "Papers that open doors: a press card, a police badge, a university pass. Not every door, not every time; in borderline cases, +20% to Social." },
  streetwise: { label: "Streetwise", d12: 5, lacking: "In criminal circles", text: "At home in Glimminge's Haga district and on the docks: whom to ask, where to buy. Without it, Social is −20% in criminal circles." },
  wealth: { label: "Wealth", d12: 6, text: "A fine house or apartment, good clothes, good food; perhaps a motorcar, an ageing butler or a plot of land. Takes the place of the starting cash roll." },
  membership: { label: "Membership", d12: 7, call: "gm", text: "A member of an organisation that may answer a call for help, if not always promptly: the Priests of Wittenberg, the Solipsists, The Colloquium, Glimminge University, the Skreeder Shamans." },
  status: { label: "Status", d12: 8, bonus: "They know who you are", text: "A name that opens mouths: a famous artist, an envoy, a respected scientist. Social +20% with those who know of it." },
  gear: { label: "Gear", d12: 9, text: "Advanced or experimental equipment: a weapon with +1 to +3 damage, a smaller camera, a faster engine. Beware the bugs." },
  secretIdentity: { label: "Secret Identity", d12: 10, text: "A second self that only a few know of." },
  headquarters: { label: "Headquarters", d12: 11, text: "A base of operations: an office, a back room at the institute, a cabin in the woods." },
  auspicious: { label: "Auspicious", d12: 12, luck: 3, text: "Fate smiles: three Luck Points instead of two, renewed to three." },
  paranormal: { label: "Paranormal", magic: true, text: "Touched by the Luminarian art. Needed for Magic above 0%: at creation it lets Magic take a place in the pyramid; in play it comes with the first spell learned, and Magic starts at POW × 2." }
};

/** New Focus and new Tag costs, in experience rolls. */
C.costs = { focus: 4, tag: 6 };

/* -------------------------------------------- */
/*  Willpower Focuses                           */
/* -------------------------------------------- */

/**
 * The book's Willpower Focus and Circle tables. The system ships them empty; a content module may
 * fill them at init (see the README). While empty, the roll buttons are hidden.
 * willpowerVerbs, willpowerPersons: 1d10 lists. circleTable: [{ low, high, name }] on 1d100.
 */
C.willpowerVerbs = [];
C.willpowerPersons = [];
C.circleTable = [];

/* -------------------------------------------- */
/*  NPCs and Code Blocks                        */
/* -------------------------------------------- */

C.tiers = {
  common: { label: "Common", skills: [50, 30, 30], pools: [6, 6, 8, 10], push: false, hint: "No Tags beyond the Code Block. Cannot push its pools." },
  skilled: { label: "Skilled", skills: [70, 50, 50], pools: [6, 8, 10, 12], push: false, hint: "One Tag, perhaps one Focus. Cannot push its pools." },
  master: { label: "Master", skills: [90, 70, 70], pools: [10, 12, 14, 16], push: true, hint: "Several Tags, some unique; one to three Focuses. May push its pools." }
};

/** Social Disposition: the bonus or penalty to the characters' social skills, and a d100 reaction. */
C.dispositions = {
  affectionate: { label: "Affectionate", mod: 40, low: 1, high: 10 },
  friendly: { label: "Friendly", mod: 20, low: 11, high: 40 },
  neutral: { label: "Neutral", mod: 0, low: 41, high: 60 },
  unfriendly: { label: "Unfriendly", mod: -20, low: 61, high: 75 },
  malicious: { label: "Malicious", mod: -40, low: 76, high: 100 }
};

/**
 * The Code Block generator's tables, shipped empty for a content module to fill. personalities: a
 * 1d20 list. darkTriad, motivations: 1d20 read in pairs. recentEvents: [{ type, gain, loss }] in pairs.
 */
C.personalities = [];
C.darkTriad = [];
C.motivations = [];
C.recentEvents = [];

/* -------------------------------------------- */
/*  The Soot                                    */
/* -------------------------------------------- */

/** The five phases, and how to run an infected NPC in each. */
C.sootPhases = {
  0: { label: "Uninfected" },
  1: { label: "Phase 1: the first stains", tier: "common", recipe: "An ordinary person with stains and one Peculiarity at 10-30%. Soot about 20%." },
  2: { label: "Phase 2: voices and experiments", tier: "skilled", recipe: "One Dark Triad trait. Motivation: Expertise or Order and Logic." },
  3: { label: "Phase 3: the disease decides", tier: "skilled", recipe: "Two Dark Triad traits; Unfriendly or Malicious. Often #Paranormal." },
  4: { label: "Phase 4: the schemer", tier: "master", recipe: "Dark Triad throughout, followers, unique Tags. May push its pools." },
  5: { label: "Phase 5: a living heap of soot", tier: null, recipe: "No Code Block: an environmental hazard." }
};

/** When a Peculiarity is rolled for. */
C.peculiarityModes = {
  session: "At the start of each session",
  daily: "At the start of each day",
  tempt: "When tempted or under pressure",
  both: "Each session, and when tempted",
  always: "Always",
  gm: "When the Game Master decides"
};

/** Which skill groups a showing Peculiarity lowers. */
C.peculiarityAffects = {
  none: { label: "No skill penalty", groups: [] },
  all: { label: "All skills but Willpower", groups: ["physical", "mental", "social", "senses"] },
  allButSocial: { label: "All but social skills", groups: ["physical", "mental", "senses"] },
  physical: { label: "Physical skills", groups: ["physical"] },
  mental: { label: "Mental skills", groups: ["mental"] },
  social: { label: "Social skills", groups: ["social"] },
  senses: { label: "Awareness", groups: ["senses"] }
};

/**
 * The Peculiarities and their Comae reading. A content module may give each its d100 rows on the
 * Peculiarity table as `low`/`high`; without them a Peculiarity rolled for is chosen instead.
 */
C.peculiarities = {
  drugAddiction: { label: "Drug Addiction", affects: "allButSocial", mode: "both", text: "Intoxicated, every skill but Social is lowered by the value. Roll at the start of a session, or when tempted (the penalty then lasts 1d3 scenes)." },
  memoryLoss: { label: "Memory Loss", affects: "none", mode: "session", text: "Roll at the start of a session. If it comes into play, the GM finds a moment of forgetfulness that twists the case, without making it unsolvable." },
  fatigue: { label: "Fatigue", affects: "social", mode: "session", fatigue: true, text: "Roll at the start of a session. While it shows, Social is lowered by the value and BODY's maximum by 1 for every 10%." },
  corruptedPassion: { label: "Corrupted Focus", affects: "none", mode: "gm", corrupts: true, text: "A Willpower Focus twists: Protect //Sibling becomes Control //Sibling. Its +20% now serves only the twisted version, and the GM decides when it takes hold." },
  phobia: { label: "Phobia", affects: "all", mode: "tempt", spec: "phobia", text: "Facing the thing feared, roll under the value: every skill is lowered by it. Harder if the situation is especially demanding." },
  violent: { label: "Violent", affects: "none", mode: "tempt", text: "Under stress, roll under the value or turn to violence: threats first, then a scuffle." },
  sleepless: { label: "Sleepless", affects: "mental", mode: "daily", text: "Roll each morning: a bad night lowers mental skills by the value. Optionally, roll to nod off when nothing is happening." },
  compulsiveLying: { label: "Compulsive Lying", affects: "none", mode: "tempt", text: "Under pressure, roll under the value and the player must tell a lie that suits the moment." },
  gameAddiction: { label: "Game Addiction", affects: "none", mode: "tempt", text: "Tempted by a game, roll under the value to give in. The value also tells how deep it runs: 01-33 wealth halved, 34-66 in debt, 67-00 hunted by creditors." },
  cleptomania: { label: "Cleptomania", affects: "none", mode: "tempt", text: "In a tempting place (a fine shop, a rich home, a museum) roll under the value to pocket something." },
  badHealth: { label: "Bad Physical Health", affects: "physical", mode: "session", spec: "health", text: "A troubled part of the body (roll on the Bad Health table). Roll each session or day: skills that use that part are lowered by the value." },
  obsession: { label: "Obsession", affects: "none", mode: "tempt", spec: "obsession", text: "Meeting the object of the obsession, roll under the value and drop everything to pursue it." },
  paranoia: { label: "Paranoia", affects: "mental", mode: "session", text: "Certain of being watched. Roll each session or day: mental skills are lowered by the value." },
  hygiene: { label: "Lack of Personal Hygiene", affects: "social", mode: "always", text: "Unkempt, unwashed, unpleasant. Social is always lowered by the value." },
  custom: { label: "Other", affects: "none", mode: "tempt", text: "" }
};

/**
 * The Soot's sub-tables, shipped empty for a content module to fill. npcPeculiarities:
 * [{ low, high, name }] on 1d100. phobias, obsessions: lists. healthLocations: [{ low, high, label }] on 1d20.
 */
C.npcPeculiarities = [];
C.phobias = [];
C.obsessions = [];
C.healthLocations = [];

/** Treating a Peculiarity: a month of treatment. */
C.treatment = { cost: 100, streak: 2, step: 10 };

/* -------------------------------------------- */
/*  Weapons and Armour                          */
/* -------------------------------------------- */

C.weaponFocuses = { melee: "Melee", unarmed: "Unarmed", ranged: "Ranged", gunnery: "Gunnery" };

C.shields = {
  none: { label: "None", mod: 0 },
  small: { label: "Small shield", mod: -20, melee: true },
  large: { label: "Large shield", mod: -20 }
};

/* -------------------------------------------- */
/*  Spells                                      */
/* -------------------------------------------- */

/** How a spell is resisted. */
C.spellResist = {
  none: "Not resisted",
  willpower: "Willpower, opposed",
  willpowerVeryHard: "Willpower at Very Hard, opposed",
  move: "Move to evade, if aware",
  disbelieve: "Willpower to disbelieve"
};

/** What a spell does when it lands, for the card. */
C.spellEffects = { none: "Narrative", damage: "Damages BODY", heal: "Heals BODY" };

/** The cost of a spell by result: success full, exceptional half, failure 1, disaster full + 1d6. */
C.castCosts = { backlash: "1d6" };

/** Where the cost goes when POW runs dry. */
C.overflow = { push: "Push POW below zero", body: "Pay the shortfall from BODY" };

C.currency = { label: "Króna", abbr: "kr" };

export default C;
