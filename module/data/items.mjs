/**
 * Focuses (and the spells and Willpower Focuses that are Focuses too), Tags, Peculiarities,
 * careers and the things investigators carry.
 * @module oddsoot-comae/data/items
 */

import C from "../config.mjs";
import * as R from "../rules.mjs";

const { SchemaField, NumberField, StringField, HTMLField, BooleanField, ArrayField } = foundry.data.fields;

const int = (initial, opts = {}) => new NumberField({ required: true, nullable: false, integer: true, initial, ...opts });
const skillChoices = () => [...C.skillOrder, "magic"];

class ComaeItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return { description: new HTMLField({ initial: "" }) };
  }
}

/* -------------------------------------------- */

/**
 * A Focus: +20% to its skill when it applies. A Magic Focus is a spell, and casting needs it.
 * A Willpower Focus is a driving force: a verb and a person or Circle.
 */
export class FocusData extends ComaeItemData {

  static defineSchema() {
    return {
      ...super.defineSchema(),
      skill: new StringField({ initial: "awareness", choices: skillChoices }),
      key: new StringField({ initial: "" }),
      restricted: new BooleanField({ initial: false }),
      // Willpower
      verb: new StringField({ initial: "" }),
      target: new StringField({ initial: "" }),
      corrupted: new BooleanField({ initial: false }),
      corruptVerb: new StringField({ initial: "" }),
      // Magic
      spell: new SchemaField({
        cost: int(1, { min: 0 }),
        costText: new StringField({ initial: "" }),
        range: new StringField({ initial: "" }),
        duration: new StringField({ initial: "" }),
        resist: new StringField({ initial: "none", choices: Object.keys(C.spellResist) }),
        effect: new StringField({ initial: "none", choices: Object.keys(C.spellEffects) }),
        formula: new StringField({ initial: "" }),
        scalable: new BooleanField({ initial: true }),
        secret: new BooleanField({ initial: false })
      }),
      source: new StringField({ initial: "" })
    };
  }

  get isSpell() { return this.skill === "magic"; }
  get isDrive() { return this.skill === "willpower"; }

  /** @inheritdoc */
  prepareDerivedData() {
    const name = this.parent.name;
    this.skillLabel = C.skills[this.skill]?.label ?? "";
    if ( this.isDrive ) {
      const kind = this.key === "circle" ? "circle" : "person";
      this.kind = kind;
      const verb = this.corrupted && this.corruptVerb ? this.corruptVerb : this.verb;
      this.phrase = this.verb || this.target ? `${verb || "…"} //${this.target || C.focuses.willpower[kind].label}` : name;
    } else {
      this.phrase = `${this.skillLabel} //${name}`;
    }
    if ( this.isSpell ) this.spell.complexity = R.complexity(this.spell.cost);
  }

  /** Version 1: associatedSkill, and weapon fields on Focuses. */
  static migrateData(source) {
    if ( "associatedSkill" in source ) {
      const key = String(source.associatedSkill).toLowerCase();
      if ( [...C.skillOrder, "magic"].includes(key) ) source.skill ??= key;
      delete source.associatedSkill;
    }
    for ( const k of ["isWeapon", "damageBonus"] ) delete source[k];
    return super.migrateData(source);
  }

  /** The value of the Focus on its actor: the skill + 20%. */
  get value() {
    const s = this.parent.actor?.system.skills?.[this.skill];
    return s ? s.value + C.focusBonus : C.focusBonus;
  }
}

/* -------------------------------------------- */

/** A Tag: an advantage won earlier in life. */
export class TagData extends ComaeItemData {

  static defineSchema() {
    return {
      ...super.defineSchema(),
      key: new StringField({ initial: "custom" }),
      detail: new StringField({ initial: "" }),
      uses: int(0, { min: 0 })
    };
  }

  /** @inheritdoc */
  prepareDerivedData() {
    const def = C.tags[this.key];
    this.def = def ?? null;
    this.callable = !!def?.call;
    this.chance = def?.call === true ? R.callChance(this.uses) : null;
    this.label = `#${this.parent.name}${this.detail ? ` (${this.detail})` : ""}`;
  }
}

/* -------------------------------------------- */

/** A Peculiarity of The Soot. */
export class PeculiarityData extends ComaeItemData {

  static defineSchema() {
    return {
      ...super.defineSchema(),
      kind: new StringField({ initial: "custom", choices: Object.keys(C.peculiarities) }),
      value: int(10, { min: 0, max: 100 }),
      mode: new StringField({ initial: "tempt", choices: Object.keys(C.peculiarityModes) }),
      affects: new StringField({ initial: "none", choices: Object.keys(C.peculiarityAffects) }),
      showing: new BooleanField({ initial: false }),
      spec: new StringField({ initial: "" }),
      defy: new SchemaField({ count: int(0, { min: 0 }), boost: int(0, { min: 0 }) }),
      treatment: new SchemaField({ streak: int(0, { min: 0 }) }),
      npc: new BooleanField({ initial: false })
    };
  }

  /** @inheritdoc */
  prepareDerivedData() {
    this.effective = Math.min(100, this.value + this.defy.boost);
    this.groups = C.peculiarityAffects[this.affects]?.groups ?? [];
    if ( this.mode === "always" ) this.showing = true;
  }

  /** Does it lower this skill when it shows? */
  affectsSkill(key) {
    if ( key === "willpower" ) return false;
    const group = C.skills[key]?.group;
    return !!group && this.groups.includes(group);
  }

  /** Version 1 had severity, active and triggered. */
  static migrateData(source) {
    if ( "severity" in source ) { source.value ??= source.severity; delete source.severity; }
    if ( "triggered" in source ) { source.showing ??= source.triggered; delete source.triggered; }
    if ( "active" in source ) delete source.active;
    return super.migrateData(source);
  }
}

/* -------------------------------------------- */

export class WeaponData extends ComaeItemData {

  static defineSchema() {
    return {
      ...super.defineSchema(),
      damage: new StringField({ initial: "1d6" }),
      focus: new StringField({ initial: "melee", choices: Object.keys(C.weaponFocuses) }),
      range: int(0, { min: 0 }),
      firearm: new BooleanField({ initial: false }),
      bonus: int(0, { min: 0, max: 3 }),
      equipped: new BooleanField({ initial: true }),
      price: new StringField({ initial: "" })
    };
  }

  /** @inheritdoc */
  prepareDerivedData() {
    this.formula = this.bonus ? `${this.damage}+${this.bonus}` : this.damage;
    this.rangeText = this.range ? `@ ${this.range} m` : "";
  }

  /** Version 1: range was free text and the skill a key. */
  static migrateData(source) {
    if ( typeof source.range === "string" ) {
      const n = parseInt(source.range);
      source.focus ??= Number.isFinite(n) || /near|far|range/i.test(source.range) ? "ranged" : "melee";
      source.range = Number.isFinite(n) ? n : 0;
    }
    if ( "associatedSkill" in source ) delete source.associatedSkill;
    if ( "skillMalus" in source ) delete source.skillMalus;
    return super.migrateData(source);
  }
}

/* -------------------------------------------- */

export class ArmorData extends ComaeItemData {

  static defineSchema() {
    return {
      ...super.defineSchema(),
      ap: int(2, { min: 0 }),
      apFirearms: int(0, { min: 0 }),
      heavy: new BooleanField({ initial: false }),
      shield: new StringField({ initial: "none", choices: Object.keys(C.shields) }),
      equipped: new BooleanField({ initial: false }),
      price: new StringField({ initial: "" })
    };
  }

  /** Version 1: a numeric penalty. */
  static migrateData(source) {
    if ( typeof source.penalty === "number" ) {
      source.heavy ??= source.penalty > 0;
      delete source.penalty;
    }
    return super.migrateData(source);
  }
}

/* -------------------------------------------- */

export class GearData extends ComaeItemData {

  static defineSchema() {
    return {
      ...super.defineSchema(),
      quantity: int(1, { min: 0 }),
      price: new StringField({ initial: "" })
    };
  }
}

/* -------------------------------------------- */

/** A career: three skills with suggested Focuses, two Tags and a kit. Drop it on an investigator. */
export class CareerData extends ComaeItemData {

  static defineSchema() {
    return {
      ...super.defineSchema(),
      skills: new ArrayField(new SchemaField({
        skill: new StringField({ initial: "awareness", choices: skillChoices }),
        focus: new StringField({ initial: "" })
      }), { initial: [] }),
      tags: new ArrayField(new StringField(), { initial: [] }),
      kit: new StringField({ initial: "" })
    };
  }
}
