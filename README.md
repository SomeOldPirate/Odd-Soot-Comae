# Odd Soot (Comae Engine)

Mystery and investigation in an alternate 1920s where humanity has reached the stars and an alien
plague of the mind called The Soot is spreading, played on Clarence Redd's **Comae Engine**
(FrostByte Books) for Foundry VTT V14.

Version 2 is a rebuild from scratch of version 1 (Foundry 12-13), following the *Odd Soot × Comae
Engine adaptation report*: Comae's rules throughout, with Odd Soot's setting, The Soot and its magic
carried across.

## What it does

- **Case-file sheets.** Four Conflict Pools as gauges that sink below zero when pushed; the nine
  skills with their Focuses pinned beneath; a creation mode that draws the skill pyramid as it
  fills; Tags as luggage labels (#Contact and #Lab call with a halving chance); Willpower Focuses as
  typed lines (Protect //Sibling) that The Soot can corrupt; The Soot creeping across the page.
- **The roll dialog** gathers everything that bears on a roll: Focus, difficulty (Routine to Very
  Hard), helping hands, a Willpower Focus, showing Peculiarities (ticked for the skills they lower),
  a missing #High Society or #Streetwise, #Status and #Pass, a targeted NPC's Social Disposition,
  alien contexts and Strangeness (one step off for //Culture, //Astrobiology or //The Soot), and
  the −20% of a pushed pool or heavy armour.
- **Roll cards**: doubles are exceptional; *Flip* spends Luck; *Repay* turns a success into a
  failure to pay back borrowed Luck; *Oppose* lets anyone roll against it, and the contest card
  lets the Game Master *Escalate* into an Extended Conflict.
- **Every message in the theme**: speech, emotes, whispers, plain dice rolls and roll-table draws
  are typed on the same paper slips as the system's own cards.
- **Extended Conflicts** on a Conflict Board: templates for Persuade, Journey on Foot, Pick a Lock,
  Search for Clues (with clue thresholds), Melee and Firearm Combat, Dinner Party, Decipher a
  Manuscript, Use an Unfamiliar Device, Use a Difference Engine, Learn a Spell, Poker, Chase and
  Sneak. Players roll their own; the Game Master resolves. Lenses (Aggressive, Cautious, Clever,
  Covert, Flamboyant, Quick) are applied, armour soaks blows, the fallen may *Push on*, and Luck
  can cut a blow to 1.
- **Magic**: a skill apart, locked until #Paranormal; spells are Focuses cast at Magic + 20%,
  paid from POW (half on an exceptional success, 1 on a failure, the cost and 1d6 on an exceptional
  failure), pushing POW below zero or paying from BODY by setting. Resisted spells offer a Resist
  roll; damage and healing spells have their buttons. Dropping a spell on a character starts the
  *Learn a Spell* conflict (or the Game Master grants it), and winning grants the Focus, #Paranormal
  and Magic at POW × 2.
- **The Soot**: *A Life Taken* tests infection (under POW's maximum) or The Soot; the Peculiarity
  table (halved the first time) adds or worsens Peculiarities; session and daily rolls (highest
  first, stopping at the first that shows), temptation, defiance and treatment; Fatigue lowers
  BODY's maximum.
- **NPCs**: tiers (Common, Skilled, Master; only Masters push), a Code Block generator (with the Dark
  Triad for antagonists), and infected NPCs made to a Phase's recipe.
- **Growth**: end of session (a second experience roll for following a Willpower Focus, and an
  upkeep checklist), 1d4+1 improvements, rolls banked toward a Focus (4) or a Tag (6); end of
  scenario renews Luck.
- **Journal links that act**: `@Check[awareness:perception|hard]` makes a link that rolls that skill,
  Focus and difficulty for whoever clicks it (their character, a controlled token, or the Game Master's
  choice); `@Conflict[searchClues|name=…|force=…|rating=normal|clues=8,4]` opens the conflict setup
  with a scenario's choices filled in (Game Master only).
- **Compendiums**: a reference journal, the 13 Tags, the setting's Focuses, 23 careers (drop one on
  an investigator to take it up), 22 spells, the Peculiarities and an armoury.

## The books' tables

The system does not include the Odd Soot rulebook's word-lists and tables: the Willpower Focus and
Circle tables, the Code Block generator (Personality, Dark Triad, Motivation, Recent Event), the
Peculiarity table's rows, NPC Peculiarities, phobias, obsessions and bad health. Without them:

- the *roll a Willpower Focus* and *roll a Code Block* buttons are hidden; write them in by hand;
- a result of 01-29 on the Peculiarity table asks which Peculiarity takes hold, instead of rolling it;
- a new Phobia, Obsession or Bad Physical Health is left for you to name.

A content module for owners of the book can supply them at `init`, after the system's own `init`
has set `CONFIG.COMAE`: fill the arrays `willpowerVerbs`, `willpowerPersons`, `circleTable`,
`personalities`, `darkTriad`, `motivations`, `recentEvents`, `npcPeculiarities`, `phobias`,
`obsessions` and `healthLocations` (their shapes are described in `module/config.mjs`), and give each
entry of `peculiarities` its d100 rows as `low` and `high`.

## Settings

Lenses (on) · Halved pools are Hard, Odd Soot's rule (off) · Negative Luck (off) · Lethal end game
(on) · Casting past empty: push POW or pay from BODY · Corruption, a house rule (off).

## Readings

Where the books are silent or the report left a choice, the system reads them like this:

1. A pool at zero or above refills with a night's sleep; below zero it climbs a point a day.
2. Cautious halves damage rounding up; Aggressive (and Clever's second option) keeps the higher of
   two damage rolls.
3. Two equal successful rolls tie: nobody gains ground that round.
4. Armour soaks BODY damage in Melee and Firearm conflicts and from weapons, not in other BODY
   conflicts (a journey, a lock).
5. Covert may strike any pool; Flamboyant the main pool or CHA.
6. In a Dinner Party each investigator's roll is matched against the party's alone.
7. The first roll on the Peculiarity table is halved whenever there is no Peculiarity to worsen.
8. Defying a Peculiarity: the first time is free (+20% to it for the day); after that Willpower at
   Normal, then Hard, then Very Hard.
9. Farsight (a secret spell) always costs its full POW, as Odd Soot says.
10. Healing is bought point by point: each BODY moved costs 1 POW.
11. Studying a spell with no Magic yet rolls as though Magic were POW × 2.

## Upgrading

**From 2.1.** The *Tables* compendium is gone (see *The books' tables* above). Tables already
imported into a world stay there.

**From version 1.** Version 2 needs Foundry V14. Worlds from version 1 are migrated when the Game Master loads them:
skills, pools, Luck and The Soot carry over; free-text Tags become Tag items; Focus, weapon, armour
and Peculiarity items are reshaped; an NPC's rank becomes its tier and its three bare skill values
are kept in its notes (they named no skills).

## Development

    node tools/test-rules.mjs     # the rules, against the books' numbers
    node tools/check-i18n.mjs     # every COMAE.* key is in lang/en.json
    node tools/build-packs.mjs    # compendiums from src/ (needs Foundry's classic-level)

Pack sources are in `src/`. Don't build packs while a world on this system is open.
