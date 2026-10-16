/**
 * One sheet for every kind of item, each with its own body: a typed index card.
 * @module oddsoot-comae/apps/item-sheet
 */

import C, { SYSTEM_ID } from "../config.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;
const { TextEditor } = foundry.applications.ux;

const labels = obj => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v.label ?? v]));

export default class ComaeItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  /** @inheritdoc */
  static DEFAULT_OPTIONS = {
    classes: [SYSTEM_ID, "oc-sheet", "oc-item"],
    position: { width: 540, height: "auto" },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      roll: ComaeItemSheet.#onRoll,
      addCareerSkill: ComaeItemSheet.#onAddCareerSkill,
      removeCareerSkill: ComaeItemSheet.#onRemoveCareerSkill
    }
  };

  /** @inheritdoc */
  static PARTS = {
    sheet: { template: `systems/${SYSTEM_ID}/templates/item/item-sheet.hbs`, scrollable: [".oc-item__body"] }
  };

  /** A spell or a Willpower Focus says so in its title. */
  get title() {
    const item = this.document;
    let kind = game.i18n.localize(`TYPES.Item.${item.type}`);
    if ( item.type === "focus" && item.system.isSpell ) kind = game.i18n.localize("COMAE.Item.spellShort");
    if ( item.type === "focus" && item.system.isDrive ) kind = game.i18n.localize("COMAE.Item.drive");
    return `${kind}: ${item.name}`;
  }

  /** @inheritdoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = this.document;
    const sys = item.system;
    const skills = Object.fromEntries([...C.skillOrder, "magic"].map(k => [k, C.skills[k].label]));
    let kindLabel = game.i18n.localize(`TYPES.Item.${item.type}`);
    if ( item.type === "focus" ) kindLabel = sys.isSpell ? game.i18n.localize("COMAE.Item.spell") : sys.isDrive ? game.i18n.localize("COMAE.Item.drive") : kindLabel;
    Object.assign(context, {
      item, system: sys, source: item._source.system, fields: sys.schema.fields, editable: this.isEditable,
      typeLabel: kindLabel, body: `systems/${SYSTEM_ID}/templates/item/${item.type}.hbs`, owned: !!item.parent,
      skills, nineSkills: Object.fromEntries(C.skillOrder.map(k => [k, C.skills[k].label])),
      focusKeys: item.type === "focus" ? { "": "—", ...labels(C.focuses[sys.skill] ?? {}) } : {},
      driveKinds: labels(C.focuses.willpower),
      verbs: C.willpowerVerbs, persons: C.willpowerPersons, circles: C.circleTable.map(c => c.name),
      resists: C.spellResist, spellEffects: C.spellEffects,
      tagKeys: { custom: game.i18n.localize("COMAE.Tag.custom"), ...Object.fromEntries(Object.entries(C.tags).map(([k, v]) => [k, `#${v.label}`])) },
      tagDef: item.type === "tag" ? C.tags[sys.key] : null,
      peculiarityKinds: labels(C.peculiarities), peculiarityModes: C.peculiarityModes, peculiarityAffects: labels(C.peculiarityAffects),
      weaponFocuses: C.weaponFocuses, shields: labels(C.shields),
      careerSkills: item.type === "career" ? sys.skills.map((s, i) => ({ ...s, i, slot: C.pyramid[i]?.value ?? 30 })) : [],
      careerTags: item.type === "career" ? sys.tags.join(", ") : "",
      enrichedDescription: await TextEditor.implementation.enrichHTML(sys.description ?? "", { relativeTo: item, secrets: item.isOwner }),
      canRoll: !!item.parent && ["focus", "weapon", "peculiarity", "tag"].includes(item.type)
    });
    return context;
  }

  /** @inheritdoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
    this.element.classList.add(`oc-item--${this.document.type}`);
    if ( this.document.type === "focus" ) this.element.dataset.focusSkill = this.document.system.skill;
    if ( !this.isEditable ) return;
    for ( const input of this.element.querySelectorAll("[data-career]") ) input.addEventListener("change", ev => this.#onCareerChange(ev));
    this.element.querySelector("[data-career-tags]")?.addEventListener("change", ev => {
      ev.stopPropagation();
      const tags = ev.currentTarget.value.split(",").map(s => s.trim()).filter(Boolean);
      this.document.update({ "system.tags": tags });
    });
  }

  /** @inheritdoc */
  _prepareSubmitData(event, form, formData, updateData) {
    const data = super._prepareSubmitData(event, form, formData, updateData);
    // A career's skill rows are saved by their own handler.
    if ( this.document.type === "career" ) delete data.system?.skills;
    return data;
  }

  async #onCareerChange(event) {
    event.stopPropagation();
    const input = event.currentTarget;
    const [i, field] = input.dataset.career.split(":");
    const skills = this.document.system.toObject().skills;
    skills[Number(i)][field] = input.value;
    return this.document.update({ "system.skills": skills });
  }

  static async #onAddCareerSkill() {
    const skills = this.document.system.toObject().skills;
    if ( skills.length >= 3 ) return;
    skills.push({ skill: "awareness", focus: "" });
    return this.document.update({ "system.skills": skills });
  }

  static async #onRemoveCareerSkill(event, target) {
    const skills = this.document.system.toObject().skills;
    skills.splice(Number(target.dataset.index), 1);
    return this.document.update({ "system.skills": skills });
  }

  static async #onRoll() {
    const item = this.document;
    if ( item.parent ) return item.parent.rollItem(item);
  }
}
