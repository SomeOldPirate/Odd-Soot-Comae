/**
 * Investigators and the people (and things) they meet.
 * @module oddsoot-comae/data/actors
 */

import C from "../config.mjs";
import * as R from "../rules.mjs";

const { SchemaField, NumberField, StringField, HTMLField, BooleanField } = foundry.data.fields;

const int = (initial, opts = {}) => new NumberField({ required: true, nullable: false, integer: true, initial, ...opts });

function skillsField() {
  const out = {};
  for ( const key of [...C.skillOrder, "magic"] ) {
    out[key] = new SchemaField({ value: int(key === "magic" ? 0 : C.skillFloor, { min: 0, max: 200 }) });
  }
  return new SchemaField(out);
}

function poolsField(values) {
  const out = {};
  Object.keys(C.pools).forEach((key, i) => {
    out[key] = new SchemaField({ value: int(values[i]), max: int(values[i], { min: 0, max: 999 }) });
  });
  return new SchemaField(out);
}

/** What every actor shares: skills, pools, The Soot, notes. */
class ComaeActorData extends foundry.abstract.TypeDataModel {

  static defineSchema() {
    return {
      skills: skillsField(),
      soot: new SchemaField({
        value: int(0, { min: 0, max: 100 }),
        infected: new BooleanField({ initial: false }),
        kills: int(0, { min: 0 }),
        phase: int(0, { min: 0, max: 5 })
      }),
      notes: new HTMLField({ initial: "" }),
      /** Data carried over from version 1 until the world migration has turned it into documents. */
      legacy: new StringField({ initial: "" })
    };
  }

  /** May this actor push its pools below zero? */
  get canPush() {
    return true;
  }

  /** @inheritdoc */
  prepareDerivedData() {
    const items = this.parent.items;
    this.tags = items.filter(i => i.type === "tag");
    this.focuses = items.filter(i => i.type === "focus");
    this.peculiarities = items.filter(i => i.type === "peculiarity");
    this.paranormal = this.tags.some(t => t.system.key === "paranormal");

    // Showing Fatigue wears BODY's maximum down.
    const fatigue = this.peculiarities.filter(p => p.system.showing && C.peculiarities[p.system.kind]?.fatigue)
      .reduce((n, p) => n + R.fatigueBody(p.system.effective), 0);
    for ( const [key, p] of Object.entries(this.pools) ) {
      p.base = p.max;
      if ( (key === "body") && fatigue ) p.max = Math.max(1, p.max - fatigue);
      p.floor = R.poolFloor(p.max, this.canPush);
      p.pushed = p.value < 0;
      p.comae = R.inComae(p.value, p.max);
      p.halved = R.isHalved(p.value, p.max);
    }
    this.fatigueBody = fatigue;
    this.pushed = R.isPushed(this.pools);
    this.comae = Object.values(this.pools).some(p => p.comae);

    // Armour: the best of each kind worn, and the Heavy penalty on Move and Awareness.
    const worn = items.filter(i => (i.type === "armor") && i.system.equipped);
    this.armour = {
      ap: Math.max(0, ...worn.map(a => a.system.ap)),
      apFirearms: Math.max(0, ...worn.map(a => Math.max(a.system.ap, a.system.apFirearms))),
      heavy: worn.some(a => a.system.heavy),
      shield: worn.find(a => a.system.shield !== "none")?.system.shield ?? "none"
    };

    // Each skill: its own value and the standing modifiers on it.
    for ( const [key, s] of Object.entries(this.skills) ) {
      const def = C.skills[key];
      s.key = key;
      s.label = def.label;
      s.group = def.group;
      s.mods = [];
      if ( this.pushed ) s.mods.push({ label: "Pushed", value: C.pushPenalty });
      if ( this.armour.heavy && ["move", "awareness"].includes(key) ) s.mods.push({ label: "Heavy armour", value: -20 });
      s.effective = Math.max(0, s.value + s.mods.reduce((n, m) => n + m.value, 0));
      s.focuses = this.focuses.filter(f => f.system.skill === key);
    }
    this.skills.magic.locked = !this.paranormal && !this.skills.magic.value;

    const phase = R.sootPhase(this.soot.value, this.soot.phase);
    this.soot.phaseKey = phase;
    this.soot.phaseLabel = C.sootPhases[phase]?.label ?? "";
    this.soot.showing = this.soot.infected || (this.soot.value > 0);
  }

  /** Version 1 kept skills as {value, hasFocus} and a few fields elsewhere. */
  static migrateData(source) {
    if ( source.skills ) {
      for ( const s of Object.values(source.skills) ) {
        if ( s && (typeof s === "object") && ("hasFocus" in s) ) delete s.hasFocus;
      }
    }
    return super.migrateData(source);
  }
}

/* -------------------------------------------- */

export class CharacterData extends ComaeActorData {

  static defineSchema() {
    return {
      ...super.defineSchema(),
      details: new SchemaField({
        concept: new StringField({ initial: "" }),
        career: new StringField({ initial: "" }),
        species: new StringField({ initial: "Human" }),
        homeworld: new StringField({ initial: "" }),
        age: new StringField({ initial: "" }),
        circleNote: new StringField({ initial: "" }),
        wealth: new StringField({ initial: "" })
      }),
      pools: poolsField([10, 10, 10, 10]),
      luck: new SchemaField({ value: int(C.luck.start, { min: C.luck.floor, max: 9 }) }),
      xp: new SchemaField({
        rolls: int(0, { min: 0 }),
        banked: int(0, { min: 0 }),
        followed: new BooleanField({ initial: false })
      }),
      creation: new BooleanField({ initial: true })
    };
  }

  /** @inheritdoc */
  prepareDerivedData() {
    super.prepareDerivedData();
    this.luck.max = this.tags.some(t => C.tags[t.system.key]?.luck) ? C.luck.auspicious : C.luck.start;
    const nine = Object.fromEntries(C.skillOrder.map(k => [k, this.skills[k].value]));
    if ( this.paranormal ) nine.magic = this.skills.magic.value;
    this.pyramid = R.pyramidCheck(nine);
  }

  /** Version 1: concept, tags and notes sat at the top level. */
  static migrateData(source) {
    if ( typeof source.concept === "string" ) {
      source.details ??= {};
      source.details.concept ??= source.concept;
      delete source.concept;
    }
    if ( typeof source.tags === "string" ) {
      if ( source.tags.trim() ) source.legacy = JSON.stringify({ tags: source.tags });
      delete source.tags;
    }
    if ( source.luck && ("max" in source.luck) ) delete source.luck.max;
    // Version 1 had no infected flag: a Soot value meant infection.
    if ( source.soot && ("label" in source.soot) ) {
      if ( (source.soot.value > 0) && !("infected" in source.soot) ) source.soot.infected = true;
      delete source.soot.label;
    }
    return super.migrateData(source);
  }
}

/* -------------------------------------------- */

export class NpcData extends ComaeActorData {

  static defineSchema() {
    return {
      ...super.defineSchema(),
      tier: new StringField({ initial: "common", choices: Object.keys(C.tiers) }),
      details: new SchemaField({
        role: new StringField({ initial: "" }),
        species: new StringField({ initial: "Human" })
      }),
      pools: poolsField(C.tiers.common.pools),
      codeBlock: new SchemaField({
        personality: new StringField({ initial: "" }),
        disposition: new StringField({ initial: "neutral", choices: Object.keys(C.dispositions) }),
        motivation: new StringField({ initial: "" }),
        event: new StringField({ initial: "" })
      }),
      /** A thing rather than a person: a storm, a lock, a manuscript. */
      obstacle: new BooleanField({ initial: false })
    };
  }

  /** Only Masters push their pools. */
  get canPush() {
    return C.tiers[this.tier]?.push ?? false;
  }

  /** @inheritdoc */
  prepareDerivedData() {
    super.prepareDerivedData();
    this.disposition = C.dispositions[this.codeBlock.disposition] ?? C.dispositions.neutral;
    // The three skills that make this NPC.
    this.topSkills = C.skillOrder.map(k => this.skills[k]).filter(s => s.value > C.skillFloor)
      .sort((a, b) => b.value - a.value).slice(0, 3);
  }

  /** Version 1: rank, three bare skill values, a codeblock and details.notes. */
  static migrateData(source) {
    if ( typeof source.rank === "string" ) {
      source.tier ??= source.rank;
      delete source.rank;
    }
    const s = source.skills;
    if ( s && (typeof s.primary === "number") ) {
      source.legacy = JSON.stringify({ skills: [s.primary, s.secondary, s.tertiary] });
      delete s.primary; delete s.secondary; delete s.tertiary;
    }
    if ( source.codeblock ) {
      const cb = source.codeblock;
      const disp = String(cb.disposition ?? "neutral").toLowerCase().split(/\s/)[0];
      source.codeBlock ??= {
        personality: cb.personality ?? "", motivation: cb.motivation ?? "", event: cb.event ?? "",
        disposition: C.dispositions[disp] ? disp : "neutral"
      };
      delete source.codeblock;
    }
    if ( source.details && ("notes" in source.details) ) {
      source.notes ??= source.details.notes;
      delete source.details.notes;
    }
    return super.migrateData(source);
  }
}
