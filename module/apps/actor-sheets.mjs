/**
 * The investigator's case file and the Game Master's NPC cards.
 * The case file is typed up on cream paper; the nine skills stand as a pyramid in creation, their
 * Focuses pinned beneath them; The Soot spreads in from the edges as the disease takes hold.
 * @module oddsoot-comae/apps/actor-sheets
 */

import C, { SYSTEM_ID } from "../config.mjs";
import * as R from "../rules.mjs";
import { spendLuck } from "../dice/roll.mjs";
import { postDamageRoll, onSpellDropped } from "../dice/magic.mjs";
import { tagData, canRollDrive, canRollCodeBlock } from "../documents/actor.mjs";
import { t, esc } from "../helpers/chat.mjs";

const { HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
const { TextEditor } = foundry.applications.ux;

const T = `systems/${SYSTEM_ID}/templates/actor`;

/* -------------------------------------------- */
/*  Shared                                      */
/* -------------------------------------------- */

class ComaeActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  /** @inheritdoc */
  static DEFAULT_OPTIONS = {
    classes: [SYSTEM_ID, "oc-sheet"],
    form: { submitOnChange: true, closeOnSubmit: false },
    window: { resizable: true },
    actions: {
      rollSkill: ComaeActorSheet.#onRollSkill,
      rollItem: ComaeActorSheet.#onRollItem,
      itemEdit: ComaeActorSheet.#onItemEdit,
      itemDelete: ComaeActorSheet.#onItemDelete,
      addFocus: ComaeActorSheet.#onAddFocus,
      addTag: ComaeActorSheet.#onAddTag,
      itemCreate: ComaeActorSheet.#onItemCreate,
      weaponDamage: ComaeActorSheet.#onWeaponDamage,
      equip: ComaeActorSheet.#onEquip,
      sleep: ComaeActorSheet.#onSleep,
      hazard: ComaeActorSheet.#onHazard,
      recordKill: ComaeActorSheet.#onRecordKill,
      peculiarityTable: ComaeActorSheet.#onPeculiarityTable,
      sessionRoll: ComaeActorSheet.#onSessionRoll,
      showing: ComaeActorSheet.#onShowing,
      tempt: ComaeActorSheet.#onTempt,
      defy: ComaeActorSheet.#onDefy,
      treat: ComaeActorSheet.#onTreat,
      callTag: ComaeActorSheet.#onCallTag,
      corrupt: ComaeActorSheet.#onCorrupt
    }
  };

  /** @inheritdoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.document;
    const sys = actor.system;
    const sorted = list => [...list].sort((a, b) => (a.sort - b.sort) || a.name.localeCompare(b.name));
    const byType = type => sorted(actor.items.filter(i => i.type === type));

    const skillRow = key => {
      const s = sys.skills[key];
      return {
        key, label: s.label, value: s.value, effective: s.effective, modified: s.effective !== s.value,
        mods: s.mods.map(m => `${m.label} ${m.value}%`).join(", "), icon: `skill-${key}`, group: s.group,
        text: C.skills[key].text, locked: !!s.locked,
        focuses: sorted(s.focuses.filter(f => !f.system.isDrive && !f.system.isSpell)).map(f => ({
          id: f.id, name: f.name, value: s.effective + C.focusBonus, restricted: f.system.restricted
        }))
      };
    };

    Object.assign(context, {
      actor, system: sys, source: actor._source.system, fields: sys.schema.fields, editable: this.isEditable, isGM: game.user.isGM,
      pools: Object.entries(sys.pools).map(([key, p]) => ({
        key, ...C.pools[key], value: p.value, max: p.max, base: p.base, pushed: p.pushed, comae: p.comae,
        fatigued: (key === "body") && (p.max !== p.base),
        // A giant's pool is shown as a scale of 40 pips.
        pips: pipRow(p.value, p.max)
      })),
      skills: C.skillOrder.map(skillRow),
      magic: skillRow("magic"),
      tags: byType("tag").map(tg => ({ id: tg.id, name: tg.name, img: tg.img, label: tg.system.label, key: tg.system.key,
        text: tg.system.def?.text ?? "", callable: tg.system.callable, chance: tg.system.chance, gmCall: tg.system.def?.call === "gm" })),
      drives: sorted(sys.focuses.filter(f => f.system.isDrive)).map(f => ({ id: f.id, phrase: f.system.phrase, kind: f.system.kind,
        kindLabel: C.focuses.willpower[f.system.kind]?.label ?? "", corrupted: f.system.corrupted, value: sys.skills.willpower.effective + C.focusBonus })),
      spells: sorted(sys.focuses.filter(f => f.system.isSpell)).map(f => ({ id: f.id, name: f.name, img: f.img, sp: f.system.spell,
        resist: C.spellResist[f.system.spell.resist], value: sys.skills.magic.effective + C.focusBonus })),
      peculiarities: sorted(sys.peculiarities).sort((a, b) => b.system.effective - a.system.effective).map(p => ({
        id: p.id, name: p.name, system: p.system, effective: p.system.effective,
        modeLabel: C.peculiarityModes[p.system.mode], affectsLabel: C.peculiarityAffects[p.system.affects]?.label,
        boosted: p.system.defy.boost > 0, always: p.system.mode === "always"
      })),
      weapons: byType("weapon").map(w => ({ id: w.id, name: w.name, img: w.img, system: w.system,
        focus: C.weaponFocuses[w.system.focus], value: sys.skills.combat.effective + (sys.focuses.some(f => f.system.skill === "combat" && f.system.key === w.system.focus) ? C.focusBonus : 0) })),
      armour: byType("armor").map(a => ({ id: a.id, name: a.name, img: a.img, system: a.system, shield: C.shields[a.system.shield]?.label })),
      gear: byType("gear"),
      soot: { value: sys.soot.value, infected: sys.soot.infected, kills: sys.soot.kills, phaseLabel: sys.soot.phaseLabel, lost: sys.soot.value >= 100 },
      armourText: sys.armour.ap ? (sys.armour.apFirearms > sys.armour.ap ? `${sys.armour.ap} (${sys.armour.apFirearms})` : String(sys.armour.ap)) : "—",
      enrichedNotes: await TextEditor.implementation.enrichHTML(sys.notes, { relativeTo: actor, secrets: actor.isOwner })
    });
    return context;
  }

  /** @inheritdoc */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    if ( context.tabs?.[partId] ) context.tab = context.tabs[partId];
    return context;
  }

  /** @inheritdoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
    const sys = this.document.system;
    // The Soot creeps across the page as it grows.
    this.element.style.setProperty("--oc-soot-level", String((sys.soot.value ?? 0) / 100));
    this.element.classList.toggle("is-infected", !!sys.soot.infected || (sys.soot.value > 0));
    this.element.classList.toggle("is-pushed", !!sys.pushed);
    if ( !this.isEditable ) return;
    for ( const input of this.element.querySelectorAll("[data-item-field]") ) {
      input.addEventListener("change", ev => this.#onItemFieldChange(ev));
    }
  }

  /** An item's own field, edited on the actor's sheet. */
  async #onItemFieldChange(event) {
    event.stopPropagation();
    const input = event.currentTarget;
    const item = this.document.items.get(input.closest("[data-item-id]")?.dataset.itemId ?? input.dataset.itemId);
    if ( !item ) return;
    let value = input.type === "checkbox" ? input.checked : input.value;
    if ( input.type === "number" ) value = Number(value) || 0;
    return item.update({ [input.dataset.itemField]: value });
  }

  /* -------------------------------------------- */
  /*  Drag and Drop                               */
  /* -------------------------------------------- */

  /** @inheritdoc */
  async _onDropItem(event, item) {
    const actor = this.document;
    if ( !actor.isOwner ) return null;
    if ( item.parent === actor ) return super._onDropItem(event, item);
    // A career is taken up, not carried.
    if ( item.type === "career" ) return actor.type === "character" ? actor.applyCareer(item) : null;
    // A Tag or Focus already held is not added twice.
    if ( (item.type === "tag") && (item.system.key !== "custom") && actor.system.tags.some(tg => tg.system.key === item.system.key) ) {
      ui.notifications.info(t("COMAE.Sheet.haveIt", { name: item.name }));
      return null;
    }
    if ( (item.type === "focus") && actor.system.focuses.some(f => (f.name === item.name) && (f.system.skill === item.system.skill)) ) {
      ui.notifications.info(t("COMAE.Sheet.haveIt", { name: item.name }));
      return null;
    }
    // A spell must be learned (or granted).
    if ( (item.type === "focus") && item.system.isSpell && (actor.type === "character") ) return onSpellDropped(actor, item.toObject());
    return super._onDropItem(event, item);
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  #item(target) {
    return this.document.items.get(target.closest("[data-item-id]")?.dataset.itemId);
  }

  static async #onRollSkill(event, target) {
    return this.document.rollSkill(target.dataset.skill);
  }

  static async #onRollItem(event, target) {
    const item = this.#item(target);
    if ( item ) return this.document.rollItem(item);
  }

  static async #onItemEdit(event, target) {
    return this.#item(target)?.sheet.render({ force: true });
  }

  static async #onItemDelete(event, target) {
    const item = this.#item(target);
    if ( !item ) return;
    const ok = await DialogV2.confirm({
      window: { title: t("COMAE.Sheet.deleteTitle") }, content: `<p>${t("COMAE.Sheet.deleteText", { name: esc(item.name) })}</p>`, rejectClose: false
    });
    if ( ok ) return item.delete();
  }

  static async #onAddFocus(event, target) {
    return this.document.chooseFocus({ skill: target.dataset.skill });
  }

  static async #onAddTag(event, target) {
    if ( target.dataset.random ) {
      const roll = await new Roll("1d12").evaluate();
      const key = Object.entries(C.tags).find(([, d]) => d.d12 === roll.total)?.[0];
      await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: this.document }), flavor: t("COMAE.Tag.rolled", { name: C.tags[key].label }) });
      if ( this.document.system.tags.some(tg => tg.system.key === key) ) return ui.notifications.info(t("COMAE.Sheet.haveIt", { name: C.tags[key].label }));
      return this.document.createEmbeddedDocuments("Item", [tagData(key)]);
    }
    return this.document.chooseTag({ exclude: this.document.system.creation ? [] : ["paranormal"] });
  }

  static async #onItemCreate(event, target) {
    const type = target.dataset.type;
    const data = { name: t(`COMAE.New.${type}`), type, img: `systems/${SYSTEM_ID}/assets/icons/${{ weapon: "weapon", armor: "armour", gear: "equipment", peculiarity: "peculiarity", tag: "tag" }[type] ?? "focus"}.svg`, system: {} };
    if ( type === "spell" ) Object.assign(data, { type: "focus", img: `systems/${SYSTEM_ID}/assets/icons/spell.svg`, system: { skill: "magic" } });
    if ( type === "drive" ) {
      const kind = target.dataset.kind ?? "person";
      Object.assign(data, { type: "focus", name: t(`COMAE.Drive.new.${kind}`), img: `systems/${SYSTEM_ID}/assets/icons/skill-willpower.svg`,
        system: { skill: "willpower", key: kind } });
    }
    const [item] = await this.document.createEmbeddedDocuments("Item", [data]);
    return item?.sheet.render({ force: true });
  }

  static async #onWeaponDamage(event, target) {
    const w = this.#item(target);
    if ( w ) return postDamageRoll({ actor: this.document, formula: w.system.formula, title: w.name, firearm: w.system.firearm });
  }

  static async #onEquip(event, target) {
    const i = this.#item(target);
    if ( i ) return i.update({ "system.equipped": !i.system.equipped });
  }

  static async #onSleep() { return this.document.sleep(); }
  static async #onHazard() { return this.document.hazard(); }
  static async #onRecordKill() { return this.document.recordKill(); }
  static async #onPeculiarityTable() { return this.document.rollPeculiarityTable(); }
  static async #onSessionRoll() { return this.document.rollPeculiarities("session"); }

  /** Show or hide a Peculiarity; hiding it also ends any defiance. */
  static async #onShowing(event, target) {
    const p = this.#item(target);
    if ( !p || (p.system.mode === "always") ) return;
    const on = !p.system.showing;
    const update = { "system.showing": on };
    if ( !on ) Object.assign(update, { "system.defy.count": 0, "system.defy.boost": 0 });
    return p.update(update);
  }

  static async #onTempt(event, target) { const p = this.#item(target); if ( p ) return this.document.temptPeculiarity(p); }
  static async #onDefy(event, target) { const p = this.#item(target); if ( p ) return this.document.defyPeculiarity(p); }
  static async #onTreat(event, target) { const p = this.#item(target); if ( p ) return this.document.treatPeculiarity(p); }
  static async #onCallTag(event, target) { const tg = this.#item(target); if ( tg ) return this.document.callTag(tg); }

  /** Twist a Willpower Focus (Corrupted Focus), or set it straight. */
  static async #onCorrupt(event, target) {
    const f = this.#item(target);
    if ( !f ) return;
    if ( f.system.corrupted ) return f.update({ "system.corrupted": false });
    const verb = await DialogV2.prompt({
      window: { title: t("COMAE.Drive.corruptTitle"), icon: "fa-solid fa-heart-crack" },
      classes: [SYSTEM_ID, "oc-dialog"],
      content: `<p>${t("COMAE.Drive.corruptText", { phrase: esc(f.system.phrase) })}</p>
        <div class="form-group"><label>${t("COMAE.Drive.corruptVerb")}</label><input type="text" name="v" value="${esc(f.system.corruptVerb || "Control")}"></div>`,
      ok: { callback: (e, b) => b.form.elements.v.value }, rejectClose: false
    });
    if ( verb ) return f.update({ "system.corrupted": true, "system.corruptVerb": verb });
  }
}

/* -------------------------------------------- */
/*  The Investigator                            */
/* -------------------------------------------- */

export class CharacterSheet extends ComaeActorSheet {

  /** @inheritdoc */
  static DEFAULT_OPTIONS = {
    classes: ["oc-character"],
    position: { width: 900, height: 940 },
    window: { icon: "fa-solid fa-folder-open" },
    actions: {
      luck: CharacterSheet.#onLuck,
      luckUse: CharacterSheet.#onLuckUse,
      toggleCreation: CharacterSheet.#onToggleCreation,
      rollPools: CharacterSheet.#onRollPools,
      improve: CharacterSheet.#onImprove,
      bank: CharacterSheet.#onBank,
      buy: CharacterSheet.#onBuy,
      endSession: CharacterSheet.#onEndSession,
      endScenario: CharacterSheet.#onEndScenario,
      rollDrive: CharacterSheet.#onRollDrive
    }
  };

  /** @inheritdoc */
  static PARTS = {
    header: { template: `${T}/character-header.hbs` },
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    skills: { template: `${T}/tab-skills.hbs`, scrollable: [""] },
    bonds: { template: `${T}/tab-bonds.hbs`, scrollable: [""] },
    soot: { template: `${T}/tab-soot.hbs`, scrollable: [""] },
    magic: { template: `${T}/tab-magic.hbs`, scrollable: [""] },
    gear: { template: `${T}/tab-gear.hbs`, scrollable: [""] },
    notes: { template: `${T}/tab-notes.hbs`, scrollable: [""] }
  };

  /** @inheritdoc */
  static TABS = {
    primary: {
      tabs: [
        { id: "skills", icon: "fa-solid fa-list-check" },
        { id: "bonds", icon: "fa-solid fa-hashtag" },
        { id: "soot", icon: "fa-solid fa-virus" },
        { id: "magic", icon: "fa-solid fa-circle-nodes" },
        { id: "gear", icon: "fa-solid fa-suitcase" },
        { id: "notes", icon: "fa-solid fa-book-open" }
      ],
      initial: "skills",
      labelPrefix: "COMAE.Tab"
    }
  };

  /** @inheritdoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const sys = this.document.system;
    context.creation = sys.creation;
    context.xp = sys.xp;
    context.costs = C.costs;
    context.canImprove = this.isEditable && (sys.xp.rolls > 0);
    context.luck = luckCoins(sys.luck);
    context.luckUses = Object.entries(C.luckUses).filter(([k]) => k !== "flip").map(([key, u]) => ({ key, ...u }));
    context.careers = await careerNames();
    if ( sys.creation ) context.pyramid = pyramidView(sys);
    context.personDrive = context.drives.some(d => d.kind === "person");
    context.canRollDrive = canRollDrive();
    context.circleDrive = context.drives.some(d => d.kind === "circle");
    return context;
  }

  /** Click a coin to spend Luck; click a spent one to restore it. */
  static async #onLuck(event, target) {
    const actor = this.document;
    if ( target.dataset.state === "full" ) return spendLuck(actor);
    return actor.update({ "system.luck.value": Math.min(actor.system.luck.max, actor.system.luck.value + 1) });
  }

  static async #onLuckUse(event, target) { return this.document.useLuck(target.dataset.use); }
  static async #onToggleCreation() { return this.document.update({ "system.creation": !this.document.system.creation }); }
  static async #onRollPools() {
    const ok = await DialogV2.confirm({ window: { title: t("COMAE.Creation.rollPools") }, content: `<p>${t("COMAE.Creation.rollPoolsText")}</p>`, rejectClose: false });
    if ( ok ) return this.document.rollPools();
  }
  static async #onImprove(event, target) { return this.document.improve(target.dataset.skill); }
  static async #onBank() { return this.document.bankRoll(); }
  static async #onBuy(event, target) { return this.document.buyWithBanked(target.dataset.what); }
  static async #onEndSession() { return this.document.endSession(); }
  static async #onEndScenario() { return this.document.endScenario(); }
  static async #onRollDrive(event, target) { return this.document.rollDrive(target.dataset.kind); }
}

/** Up to 40 pips for a pool; a larger pool is scaled down to fit. */
export function pipRow(value, max) {
  const n = Math.min(Math.max(max, 1), 40);
  const scale = max > 40 ? max / 40 : 1;
  return Array.from({ length: n }, (_, i) => ({ on: (i * scale) < value, neg: (i * scale) < -value }));
}

/** Luck as clovers: spent ones dull, borrowed ones red. */
function luckCoins(luck) {
  const coins = [];
  for ( let i = 1; i <= luck.max; i++ ) coins.push({ state: i <= luck.value ? "full" : "spent" });
  for ( let i = 1; i <= -luck.value; i++ ) coins.push({ state: "owed" });
  return { coins, value: luck.value, max: luck.max };
}

/** The skill pyramid as it stands: which slots the skills fill, and what is left. */
function pyramidView(sys) {
  const keys = [...C.skillOrder, ...(sys.paranormal ? ["magic"] : [])];
  // Skills with Focuses take the starred places first.
  const placed = keys.map(k => ({ key: k, label: C.skills[k].label, value: sys.skills[k].value,
    focused: sys.skills[k].focuses.some(f => !f.system.isDrive && !f.system.isSpell && (f.system.key !== "language" || f.name !== C.nativeLanguage)) }))
    .filter(s => s.value > C.skillFloor).sort((a, b) => (b.value - a.value) || (b.focused - a.focused));
  const slots = C.pyramid.map(p => ({ ...p, skill: null }));
  const extra = [];
  for ( const s of placed ) {
    const slot = slots.find(x => !x.skill && (x.value === s.value) && (!!x.focus === s.focused))
      ?? slots.find(x => !x.skill && (x.value === s.value));
    if ( slot ) slot.skill = s;
    else extra.push(s);
  }
  return {
    rows: [slots.slice(0, 1), slots.slice(1, 3), slots.slice(3)],
    extra, ok: sys.pyramid.ok && !extra.length, poolSum: Object.values(sys.pools).reduce((n, p) => n + p.base, 0)
  };
}

/** Career names for the career field: the system's careers compendium, if there is one. */
async function careerNames() {
  const pack = game.packs.get(`${SYSTEM_ID}.careers`);
  if ( !pack ) return [];
  const index = await pack.getIndex();
  return index.map(e => e.name).sort();
}

/* -------------------------------------------- */
/*  NPCs                                        */
/* -------------------------------------------- */

export class NpcSheet extends ComaeActorSheet {

  /** @inheritdoc */
  static DEFAULT_OPTIONS = {
    classes: ["oc-npc"],
    position: { width: 720, height: 820 },
    window: { icon: "fa-solid fa-id-card" },
    actions: {
      applyTier: NpcSheet.#onApplyTier,
      rollCodeBlock: NpcSheet.#onRollCodeBlock,
      infect: NpcSheet.#onInfect
    }
  };

  /** @inheritdoc */
  static PARTS = {
    sheet: { template: `${T}/npc.hbs`, scrollable: [".oc-npc__body"] }
  };

  /** @inheritdoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const sys = this.document.system;
    Object.assign(context, {
      tiers: Object.fromEntries(Object.entries(C.tiers).map(([k, v]) => [k, v.label])),
      tierHint: C.tiers[sys.tier]?.hint,
      suggestedTier: C.tiers[R.tierOf(sys.topSkills[0]?.value ?? 0)]?.label,
      dispositions: Object.fromEntries(Object.entries(C.dispositions).map(([k, v]) => [k, `${v.label}${v.mod ? ` (${v.mod > 0 ? "+" : ""}${v.mod}%)` : ""}`])),
      phases: Object.fromEntries(Object.entries(C.sootPhases).map(([k, v]) => [k, v.label])),
      phaseRecipe: C.sootPhases[sys.soot.phaseKey]?.recipe ?? "",
      topKeys: new Set(sys.topSkills.map(s => s.key)),
      canRollCodeBlock: canRollCodeBlock()
    });
    context.skills.forEach(s => { s.top = context.topKeys.has(s.key); });
    return context;
  }

  /** Set the NPC to Common, Skilled or Master on three skills. */
  static async #onApplyTier() {
    const sys = this.document.system;
    const opts = sel => C.skillOrder.map(k => `<option value="${k}" ${k === sel ? "selected" : ""}>${C.skills[k].label}</option>`).join("");
    const top = sys.topSkills.map(s => s.key);
    const tiers = Object.entries(C.tiers).map(([k, v]) => `<option value="${k}" ${k === sys.tier ? "selected" : ""}>${v.label} — ${v.skills.join("/")}%, ${v.pools.join("/")}</option>`).join("");
    const data = await DialogV2.prompt({
      window: { title: t("COMAE.Npc.applyTier"), icon: "fa-solid fa-layer-group" },
      classes: [SYSTEM_ID, "oc-dialog"],
      content: `<div class="form-group"><label>${t("COMAE.Npc.tier")}</label><select name="tier">${tiers}</select></div>
        <div class="form-group"><label>${t("COMAE.Npc.primary")}</label><select name="s0">${opts(top[0] ?? "awareness")}</select></div>
        <div class="form-group"><label>${t("COMAE.Npc.secondary")}</label><select name="s1">${opts(top[1] ?? "social")}</select></div>
        <div class="form-group"><label>${t("COMAE.Npc.tertiary")}</label><select name="s2">${opts(top[2] ?? "combat")}</select></div>
        <p class="hint">${t("COMAE.Npc.applyTierHint")}</p>`,
      ok: { label: t("COMAE.Npc.apply"), callback: (e, b) => new foundry.applications.ux.FormDataExtended(b.form).object },
      rejectClose: false
    });
    if ( data ) return this.document.applyTier(data.tier, [data.s0, data.s1, data.s2]);
  }

  static async #onRollCodeBlock(event, target) {
    return this.document.rollCodeBlock({ antagonist: !!target.dataset.antagonist });
  }

  static async #onInfect() {
    const opts = [1, 2, 3, 4, 5].map(n => `<option value="${n}">${C.sootPhases[n].label}</option>`).join("");
    const phase = await DialogV2.prompt({
      window: { title: t("COMAE.Soot.npcTitle"), icon: "fa-solid fa-virus" },
      classes: [SYSTEM_ID, "oc-dialog"],
      content: `<div class="form-group"><label>${t("COMAE.Soot.phase")}</label><select name="p">${opts}</select></div><p class="hint">${t("COMAE.Soot.npcHint")}</p>`,
      ok: { callback: (e, b) => Number(b.form.elements.p.value) }, rejectClose: false
    });
    if ( phase ) return this.document.infectNpc(phase);
  }
}
