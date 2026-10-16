/**
 * Investigators and NPCs: rolling their skills, draining and refilling their pools, The Soot and
 * its Peculiarities, growth between sessions.
 * @module oddsoot-comae/documents/actor
 */

import C, { SYSTEM_ID } from "../config.mjs";
import * as R from "../rules.mjs";
import { promptRoll } from "../dice/roll-dialog.mjs";
import { rollD100, rollTitle, spendLuck, registerRollKind, pickActor } from "../dice/roll.mjs";
import { castSpell } from "../dice/magic.mjs";
import { postCard, t, esc, d100Text, registerCardAction, actorOf } from "../helpers/chat.mjs";

const { DialogV2 } = foundry.applications.api;
const { FormDataExtended } = foundry.applications.ux;

export default class ComaeActor extends Actor {

  /** @inheritdoc */
  async _preCreate(data, options, user) {
    if ( (await super._preCreate(data, options, user)) === false ) return false;
    const update = {};
    if ( !data.img || (data.img === Actor.DEFAULT_ICON) ) update.img = `systems/${SYSTEM_ID}/assets/icons/${this.type === "npc" ? "npc" : "character"}.svg`;
    if ( this.type === "character" ) {
      Object.assign(update, { "prototypeToken.actorLink": true, "prototypeToken.disposition": CONST.TOKEN_DISPOSITIONS.FRIENDLY });
    }
    // Every investigator starts with their native language as a Focus.
    if ( (this.type === "character") && !this.items.size ) {
      update.items = [{ name: C.nativeLanguage, type: "focus", img: `systems/${SYSTEM_ID}/assets/icons/skill-knowledge.svg`,
        system: { skill: "knowledge", key: "language", description: `<p>${C.focuses.knowledge.language.text}</p>` } }];
    }
    update["prototypeToken.bar1.attribute"] = "pools.body";
    update["prototypeToken.bar2.attribute"] = "pools.pow";
    this.updateSource(update);
  }

  /* -------------------------------------------- */
  /*  Rolling                                     */
  /* -------------------------------------------- */

  /**
   * Roll a skill, perhaps with a Focus.
   * @param {string} skill
   * @param {object} [options]
   * @param {string} [options.focusId]
   * @param {string} [options.title]
   * @param {object} [options.spec]     More for the roll dialog.
   */
  async rollSkill(skill, { focusId, title, spec = {} } = {}) {
    if ( (skill === "magic") && this.system.skills.magic.locked ) return ui.notifications.warn(t("COMAE.Magic.locked"));
    const choice = await promptRoll(this, { title: title ?? t("COMAE.Roll.titleFor", { name: this.name }), skill, focusId, ...spec });
    if ( !choice ) return null;
    return rollD100({
      actor: this, kind: "skill", title: rollTitle(choice), base: choice.base, target: choice.routine ? null : choice.target,
      notes: choice.notes, context: { skill: choice.skill, focusId: choice.focusId, focusKey: this.items.get(choice.focusId)?.system.key ?? null }
    });
  }

  /** Roll whatever an item stands for. */
  async rollItem(item) {
    switch ( item.type ) {
      case "focus":
        if ( item.system.isSpell ) return castSpell(this, item);
        return this.rollSkill(item.system.skill, { focusId: item.system.isDrive ? undefined : item.id,
          spec: item.system.isDrive ? { lockSkill: true } : {} });
      case "weapon": {
        const focus = this.system.focuses.find(f => (f.system.skill === "combat") && (f.system.key === item.system.focus));
        return this.rollSkill("combat", { focusId: focus?.id, title: item.name });
      }
      case "peculiarity": return this.temptPeculiarity(item);
      case "tag": return item.system.callable ? this.callTag(item) : item.sheet.render(true);
      default: return item.sheet.render(true);
    }
  }

  /* -------------------------------------------- */
  /*  Pools                                       */
  /* -------------------------------------------- */

  /**
   * Take damage to a pool.
   * @param {string} pool
   * @param {number} amount
   * @param {object} [o]
   * @param {boolean} [o.armour]     Worn armour soaks it (BODY only).
   * @param {boolean} [o.firearm]    Bullet-proof armour counts double.
   * @param {boolean} [o.push]       The character presses on past zero.
   * @param {boolean} [o.silent]     Post no card.
   * @param {string} [o.source]
   * @returns {Promise<object>}
   */
  async takeDamage(pool, amount, { armour = false, firearm = false, push = false, silent = false, source = "" } = {}) {
    const p = this.system.pools[pool];
    const ap = (armour && (pool === "body")) ? (firearm ? this.system.armour.apFirearms : this.system.armour.ap) : 0;
    const taken = R.soak(amount, ap);
    const before = p.value;
    const pressing = this.system.canPush && (push || (before < 0));
    const floor = pressing ? -p.max : 0;
    const after = Math.max(floor, before - taken);
    await this.update({ [`system.pools.${pool}.value`]: after });
    const out = { pool, amount, ap, taken: before - after, before, after, zero: after <= 0, comae: R.inComae(after, p.max) };
    if ( !silent ) await this.#damageCard(out, source);
    return out;
  }

  /** The card for damage taken, with Luck to soften it. */
  async #damageCard(d, source) {
    const abbr = C.pools[d.pool].abbr;
    const notes = [];
    if ( d.ap ) notes.push(t("COMAE.Damage.soaked", { n: d.ap }));
    if ( d.comae ) notes.push(t(game.settings.get(SYSTEM_ID, "lethal") ? "COMAE.Damage.dead" : "COMAE.Damage.comae", { name: esc(this.name) }));
    else if ( d.after < 0 ) notes.push(t("COMAE.Damage.pushed"));
    else if ( d.zero ) notes.push(t("COMAE.Damage.zero", { name: esc(this.name), pool: abbr }));
    const buttons = [];
    if ( (this.type === "character") && (d.taken > 1) ) {
      buttons.push({ action: "luckReduce", label: t("COMAE.Luck.reduce"), icon: "fa-solid fa-clover", who: "owner", once: "luck",
        data: { pool: d.pool, refund: d.taken - 1 } });
    }
    return postCard({
      kind: "damage", kicker: source || t("COMAE.Damage.kicker"), title: t("COMAE.Damage.title", { name: this.name, n: d.taken, pool: abbr }),
      rows: [{ label: abbr, value: `${d.before} → ${d.after} / ${this.system.pools[d.pool].max}` }], notes, buttons
    }, { actor: this });
  }

  /** Restore points to a pool, up to its maximum. */
  async restorePool(pool, n) {
    const p = this.system.pools[pool];
    const value = Math.min(p.max, p.value + n);
    await this.update({ [`system.pools.${pool}.value`]: value });
    return value;
  }

  /** A good night's sleep. */
  async sleep() {
    const update = {};
    const lines = [];
    for ( const [key, p] of Object.entries(this.system.pools) ) {
      const v = R.recover(p.value, p.max);
      if ( v !== p.value ) { update[`system.pools.${key}.value`] = v; lines.push(`${C.pools[key].abbr} ${p.value} → ${v}`); }
    }
    // A new day: defiance runs out and the daily Peculiarities are rolled again.
    const pecs = this.system.peculiarities.filter(x => x.system.defy.count || x.system.defy.boost);
    if ( pecs.length ) await this.updateEmbeddedDocuments("Item", pecs.map(x => ({ _id: x.id, "system.defy.count": 0, "system.defy.boost": 0 })));
    await this.update(update);
    await postCard({ kind: "rest", kicker: t("COMAE.Rest.kicker"), title: t("COMAE.Rest.title", { name: this.name }),
      notes: lines.length ? lines : [t("COMAE.Rest.nothing")] }, { actor: this });
    if ( this.system.peculiarities.some(x => x.system.mode === "daily") ) await this.rollPeculiarities("day");
  }

  /** Apply a hazard from the list, or plain damage. */
  async hazard() {
    const options = Object.entries(C.hazards).map(([k, h]) => `<option value="${k}">${h.label} — ${h.formula} ${C.pools[h.pool].abbr}</option>`).join("");
    const pools = Object.entries(C.pools).map(([k, p]) => `<option value="${k}">${p.abbr}</option>`).join("");
    const data = await DialogV2.prompt({
      window: { title: t("COMAE.Damage.hazardTitle", { name: this.name }), icon: "fa-solid fa-house-crack" },
      classes: [SYSTEM_ID, "oc-dialog"],
      content: `<div class="form-group"><label>${t("COMAE.Damage.hazard")}</label><select name="hazard"><option value="">${t("COMAE.Damage.plain")}</option>${options}</select></div>
        <div class="oc-roll__row"><div class="form-group"><label>${t("COMAE.Damage.formula")}</label><input type="text" name="formula" placeholder="1d6"></div>
        <div class="form-group"><label>${t("COMAE.Damage.pool")}</label><select name="pool">${pools}</select></div></div>
        <label class="oc-check"><input type="checkbox" name="armour"> ${t("COMAE.Damage.armour")}</label>
        <label class="oc-check"><input type="checkbox" name="push"> ${t("COMAE.Damage.push")}</label>`,
      ok: { label: t("COMAE.Damage.apply"), icon: "fa-solid fa-burst", callback: (e, b) => new FormDataExtended(b.form).object },
      rejectClose: false
    });
    if ( !data ) return;
    const h = C.hazards[data.hazard];
    const formula = data.formula || h?.formula || "1d6";
    const pool = h?.pool ?? data.pool;
    const roll = await new Roll(formula).evaluate();
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: this }), flavor: `${h?.label ?? t("COMAE.Damage.plain")}${h?.note ? ` — ${h.note}` : ""}` });
    return this.takeDamage(pool, roll.total, { armour: !!data.armour, push: !!data.push, source: h?.label });
  }

  /* -------------------------------------------- */
  /*  Luck                                        */
  /* -------------------------------------------- */

  /** Spend Luck on something other than dice. */
  async useLuck(use) {
    if ( use === "refresh" ) {
      const low = Object.entries(this.system.pools).filter(([, p]) => p.value < 1);
      if ( !low.length ) return ui.notifications.info(t("COMAE.Luck.nothingLow"));
      const pool = low.length === 1 ? low[0][0] : await DialogV2.prompt({
        window: { title: C.luckUses.refresh.label },
        classes: [SYSTEM_ID, "oc-dialog"],
        content: `<div class="form-group"><label>${t("COMAE.Damage.pool")}</label><select name="p">${low.map(([k, p]) => `<option value="${k}">${C.pools[k].abbr} (${p.value})</option>`).join("")}</select></div>`,
        ok: { callback: (e, b) => b.form.elements.p.value }, rejectClose: false
      });
      if ( !pool || !(await spendLuck(this)) ) return;
      await this.update({ [`system.pools.${pool}.value`]: 1 });
    } else if ( !(await spendLuck(this)) ) return;
    return postCard({ kind: "luck", kicker: t("COMAE.Luck.title"), title: C.luckUses[use].label, notes: [C.luckUses[use].text] }, { actor: this });
  }

  /** The end of a scenario: Luck renews unless it was borrowed; Contacts and Labs answer again. */
  async endScenario() {
    const update = {};
    const luck = this.system.luck;
    if ( luck && (luck.value >= 0) ) update["system.luck.value"] = luck.max;
    await this.update(update);
    const tags = this.system.tags.filter(tg => tg.system.uses);
    if ( tags.length ) await this.updateEmbeddedDocuments("Item", tags.map(tg => ({ _id: tg.id, "system.uses": 0 })));
    return postCard({ kind: "luck", kicker: t("COMAE.Scenario.kicker"), title: t("COMAE.Scenario.title", { name: this.name }),
      notes: [luck && (luck.value < 0) ? t("COMAE.Scenario.indebted") : t("COMAE.Scenario.renewed", { n: luck?.max ?? 0 })] }, { actor: this });
  }

  /* -------------------------------------------- */
  /*  Tags                                        */
  /* -------------------------------------------- */

  /** Call upon a Contact or a Lab: certain at first, half as likely each time after. */
  async callTag(tag) {
    const def = tag.system.def;
    if ( def?.call === "gm" ) {
      return postCard({ kind: "tag", kicker: t("COMAE.Tag.call"), title: tag.system.label, notes: [t("COMAE.Tag.gmDecides")] }, { actor: this });
    }
    const chance = R.callChance(tag.system.uses);
    const roll = await new Roll("1d100").evaluate();
    const ok = (chance >= 100) || (roll.total <= chance);
    await tag.update({ "system.uses": tag.system.uses + 1 });
    return postCard({
      kind: "tag", kicker: t("COMAE.Tag.call"), title: tag.system.label,
      die: { value: d100Text(roll.total), target: chance }, stamp: ok ? { key: "success", label: t("COMAE.Tag.answers") } : { key: "failure", label: t("COMAE.Tag.silent") },
      notes: [t("COMAE.Tag.next", { n: R.callChance(tag.system.uses) })]
    }, { actor: this, rolls: [roll] });
  }

  /* -------------------------------------------- */
  /*  The Soot                                    */
  /* -------------------------------------------- */

  /** A life taken. The first may infect (roll under POW); after that The Soot may stir. */
  async recordKill() {
    const sys = this.system;
    const ok = await DialogV2.confirm({
      window: { title: t("COMAE.Soot.killTitle"), icon: "fa-solid fa-skull" },
      classes: [SYSTEM_ID, "oc-dialog"],
      content: `<p>${t(sys.soot.infected ? "COMAE.Soot.killInfected" : "COMAE.Soot.killClean", { name: esc(this.name) })}</p>`,
      rejectClose: false
    });
    if ( !ok ) return null;
    await this.update({ "system.soot.kills": sys.soot.kills + 1 });
    return this.sootCheck(t("COMAE.Soot.kicker"));
  }

  /**
   * Test against The Soot: infection for the clean (under POW max), a Peculiarity roll for the
   * infected (under The Soot).
   * @param {string} kicker
   */
  async sootCheck(kicker) {
    const sys = this.system;
    const roll = await new Roll("1d100").evaluate();
    const value = roll.total;
    if ( !sys.soot.infected ) {
      const pow = sys.pools.pow.max;
      const infected = value <= pow;
      if ( infected ) await this.update({ "system.soot.infected": true, "system.soot.value": Math.min(100, pow) });
      return postCard({
        kind: "soot", kicker, title: t(infected ? "COMAE.Soot.infected" : "COMAE.Soot.spared"),
        die: { value: d100Text(value), target: pow },
        stamp: infected ? { key: "soot", label: t("COMAE.Soot.stampInfected") } : { key: "spared", label: t("COMAE.Soot.stampSpared") },
        notes: [t(infected ? "COMAE.Soot.infectedText" : "COMAE.Soot.sparedText", { name: esc(this.name), pow })]
      }, { actor: this, rolls: [roll] });
    }
    const soot = sys.soot.value;
    const worse = value <= soot;
    await postCard({
      kind: "soot", kicker, title: t(worse ? "COMAE.Soot.stirs" : "COMAE.Soot.quiet"),
      die: { value: d100Text(value), target: soot },
      stamp: worse ? { key: "soot", label: t("COMAE.Soot.stampStirs") } : { key: "spared", label: t("COMAE.Soot.stampQuiet") },
      notes: [t(worse ? "COMAE.Soot.stirsText" : "COMAE.Soot.quietText", { name: esc(this.name) })]
    }, { actor: this, rolls: [roll] });
    if ( worse ) return this.rollPeculiarityTable();
    return null;
  }

  /**
   * Roll on the Peculiarity table. The first roll is halved: our reading is, whenever there is
   * none to worsen.
   */
  async rollPeculiarityTable({ first } = {}) {
    const pecs = this.items.filter(i => (i.type === "peculiarity") && !i.system.npc);
    first ??= !pecs.length;
    const roll = await new Roll("1d100").evaluate();
    const res = R.peculiarityTable(roll.total, first);
    const notes = [];
    const rolls = [roll];
    if ( first ) notes.push(t("COMAE.Soot.halved", { from: d100Text(roll.total), to: d100Text(res.roll) }));
    let title;
    if ( res.kind === "soot" ) {
      const inc = await new Roll("1d4+1").evaluate();
      rolls.push(inc);
      const value = Math.min(100, this.system.soot.value + inc.total);
      await this.update({ "system.soot.value": value });
      title = t("COMAE.Soot.deepens", { n: inc.total });
      notes.push(t("COMAE.Soot.nowAt", { value }));
      if ( value >= 100 ) notes.push(t("COMAE.Soot.lost", { name: esc(this.name) }));
    } else if ( res.kind === "raise" ) {
      if ( !pecs.length ) {
        title = t("COMAE.Soot.raiseNone");
      } else {
        const target = pecs.length === 1 ? pecs[0] : await this.#choosePeculiarity(pecs);
        const value = Math.min(100, target.system.value + 10);
        await target.update({ "system.value": value });
        title = t("COMAE.Soot.raised", { name: target.name, value });
      }
    } else {
      res.key ??= await this.#choosePeculiarityKind();
      const def = C.peculiarities[res.key];
      const existing = pecs.find(p => p.system.kind === res.key);
      if ( existing ) {
        const value = Math.min(100, existing.system.value + 10);
        await existing.update({ "system.value": value });
        title = t("COMAE.Soot.raised", { name: existing.name, value });
      } else {
        const item = await this.createPeculiarity(res.key);
        title = t("COMAE.Soot.gained", { name: item.name });
        if ( def.corrupts ) notes.push(t("COMAE.Soot.corruptNote"));
      }
    }
    return postCard({ kind: "soot", kicker: t("COMAE.Soot.tableKicker"), title,
      die: { value: d100Text(res.roll) }, notes }, { actor: this, rolls });
  }

  /** Give the actor a Peculiarity of a kind, preferring the system compendium's copy. */
  async createPeculiarity(kind) {
    const def = C.peculiarities[kind];
    const pack = game.packs.get(`${SYSTEM_ID}.peculiarities`);
    let data = null;
    if ( pack ) {
      const index = await pack.getIndex({ fields: ["system.kind"] });
      const entry = index.find(e => e.system?.kind === kind);
      if ( entry ) data = (await pack.getDocument(entry._id)).toObject();
    }
    data ??= { name: def.label, type: "peculiarity", system: { kind, mode: def.mode, affects: def.affects, description: `<p>${def.text}</p>` } };
    data.system.value = 10;
    // Phobias and Obsessions are rolled for their object, when a content module supplies the lists.
    const pick = list => list[Math.floor(Math.random() * list.length)] ?? "";
    if ( def.spec === "phobia" ) data.system.spec = pick(C.phobias);
    if ( def.spec === "obsession" ) data.system.spec = pick(C.obsessions);
    if ( def.spec === "health" ) {
      const d20 = Math.ceil(Math.random() * 20);
      data.system.spec = R.tableRow(C.healthLocations, d20)?.label ?? "";
    }
    if ( data.system.spec ) data.name = `${data.name} (${data.system.spec.replace(/ \(.*$/, "")})`;
    const [item] = await this.createEmbeddedDocuments("Item", [data]);
    return item;
  }

  /** Choose the Peculiarity gained, when the table's rows are not loaded. */
  async #choosePeculiarityKind() {
    const kinds = Object.entries(C.peculiarities).filter(([k]) => k !== "custom");
    const key = await DialogV2.prompt({
      window: { title: t("COMAE.Soot.gainWhich") },
      classes: [SYSTEM_ID, "oc-dialog"],
      content: `<div class="form-group"><select name="k">${kinds.map(([k, d]) => `<option value="${k}">${esc(d.label)}</option>`).join("")}</select></div>`,
      ok: { callback: (e, b) => b.form.elements.k.value }, rejectClose: false
    });
    return C.peculiarities[key] ? key : "custom";
  }

  async #choosePeculiarity(pecs) {
    const id = await DialogV2.prompt({
      window: { title: t("COMAE.Soot.raiseWhich") },
      classes: [SYSTEM_ID, "oc-dialog"],
      content: `<div class="form-group"><select name="p">${pecs.map(p => `<option value="${p.id}">${esc(p.name)} (${p.system.value}%)</option>`).join("")}</select></div>`,
      ok: { callback: (e, b) => b.form.elements.p.value }, rejectClose: false
    });
    return this.items.get(id) ?? pecs[0];
  }

  /**
   * Roll the Peculiarities due: at the start of a session (or a day), highest first, stopping at the
   * first that shows.
   * @param {"session"|"day"} when
   */
  async rollPeculiarities(when = "session") {
    const modes = when === "day" ? ["daily"] : ["session", "both"];
    const due = this.system.peculiarities.filter(p => modes.includes(p.system.mode)).sort((a, b) => b.system.effective - a.system.effective);
    if ( !due.length ) return null;
    const updates = due.map(p => ({ _id: p.id, "system.showing": false }));
    const rolls = [];
    const lines = [];
    let fired = null;
    for ( const p of due ) {
      const roll = await new Roll("1d100").evaluate();
      rolls.push(roll);
      const shows = roll.total <= p.system.effective;
      lines.push(`${esc(p.name)} ${p.system.effective}%: ${d100Text(roll.total)} — ${t(shows ? "COMAE.Peculiarity.shows" : "COMAE.Peculiarity.stays")}`);
      if ( shows ) { fired = p; updates.find(u => u._id === p.id)["system.showing"] = true; break; }
    }
    await this.updateEmbeddedDocuments("Item", updates);
    return postCard({
      kind: "soot", kicker: t(when === "day" ? "COMAE.Peculiarity.dayKicker" : "COMAE.Peculiarity.sessionKicker"),
      title: fired ? t("COMAE.Peculiarity.firedTitle", { name: fired.name }) : t("COMAE.Peculiarity.quietTitle"), notes: lines
    }, { actor: this, rolls });
  }

  /** Tempted, or under pressure: roll under the Peculiarity to give in. */
  async temptPeculiarity(pec) {
    const roll = await new Roll("1d100").evaluate();
    const gives = roll.total <= pec.system.effective;
    if ( gives ) await pec.update({ "system.showing": true });
    return postCard({
      kind: "soot", kicker: t("COMAE.Peculiarity.temptKicker"), title: t(gives ? "COMAE.Peculiarity.givesIn" : "COMAE.Peculiarity.resists", { name: pec.name }),
      die: { value: d100Text(roll.total), target: pec.system.effective },
      stamp: gives ? { key: "soot", label: t("COMAE.Peculiarity.stampShows") } : { key: "spared", label: t("COMAE.Peculiarity.stampHolds") },
      notes: pec.system.spec ? [esc(pec.system.spec)] : []
    }, { actor: this, rolls: [roll] });
  }

  /**
   * Defy a Peculiarity for the day. The first time costs only +20% to it; after that Willpower,
   * a step harder each time (a fitting Willpower Focus helps).
   */
  async defyPeculiarity(pec) {
    const d = pec.system.defy;
    if ( d.count === 0 ) {
      await pec.update({ "system.defy.count": 1, "system.defy.boost": 20, "system.showing": false });
      return postCard({ kind: "soot", kicker: t("COMAE.Peculiarity.defyKicker"), title: t("COMAE.Peculiarity.defied", { name: pec.name }),
        notes: [t("COMAE.Peculiarity.defiedText", { value: pec.system.value + 20 })] }, { actor: this });
    }
    const difficulty = R.defyDifficulty(d.count + 1);
    const choice = await promptRoll(this, { title: t("COMAE.Peculiarity.defyTitle", { name: pec.name }), skill: "willpower", lockSkill: true, difficulty, noRoutine: true });
    if ( !choice ) return null;
    const res = await rollD100({ actor: this, kind: "skill", title: rollTitle(choice), kicker: t("COMAE.Peculiarity.defyKicker"),
      base: choice.base, target: choice.target, notes: choice.notes, context: { skill: "willpower" } });
    if ( R.isSuccess(res.level) ) return pec.update({ "system.defy.count": d.count + 1, "system.defy.boost": d.boost + 20, "system.showing": false });
    return pec.update({ "system.defy.count": 0, "system.defy.boost": 0, "system.showing": true });
  }

  /** A month of treatment: roll over the Peculiarity; two good months in a row lower it by 10%. */
  async treatPeculiarity(pec) {
    const roll = await new Roll("1d100").evaluate();
    const works = roll.total > pec.system.value;
    const streak = works ? pec.system.treatment.streak + 1 : 0;
    const update = { "system.treatment.streak": streak >= C.treatment.streak ? 0 : streak };
    let title = t(works ? "COMAE.Peculiarity.treatGood" : "COMAE.Peculiarity.treatBad");
    if ( works && (streak >= C.treatment.streak) ) {
      update["system.value"] = Math.max(0, pec.system.value - C.treatment.step);
      title = t("COMAE.Peculiarity.treatLowered", { name: pec.name, value: update["system.value"] });
    }
    await pec.update(update);
    return postCard({
      kind: "soot", kicker: t("COMAE.Peculiarity.treatKicker"), title,
      die: { value: d100Text(roll.total), target: pec.system.value },
      notes: [t("COMAE.Peculiarity.treatText", { name: esc(pec.name), cost: C.treatment.cost })]
    }, { actor: this, rolls: [roll] });
  }

  /* -------------------------------------------- */
  /*  Growth                                      */
  /* -------------------------------------------- */

  /** The end of a session: an experience roll, a second for following a Willpower Focus, and upkeep. */
  async endSession() {
    const xp = this.system.xp;
    const gained = 1 + (xp.followed ? 1 : 0);
    await this.update({ "system.xp.rolls": xp.rolls + gained, "system.xp.followed": false });
    return postCard({
      kind: "growth", kicker: t("COMAE.Growth.sessionKicker"), title: t("COMAE.Growth.sessionTitle", { name: this.name, n: gained }),
      notes: [t("COMAE.Growth.upkeep1"), t("COMAE.Growth.upkeep2"), t("COMAE.Growth.upkeep3"), t("COMAE.Growth.upkeep4")]
    }, { actor: this });
  }

  /** Spend an experience roll: 1d4+1 on one skill. */
  async improve(skill) {
    const xp = this.system.xp;
    if ( xp.rolls < 1 ) return ui.notifications.warn(t("COMAE.Growth.none"));
    if ( (skill === "magic") && this.system.skills.magic.locked ) return ui.notifications.warn(t("COMAE.Magic.locked"));
    const roll = await new Roll("1d4+1").evaluate();
    const from = this.system.skills[skill].value;
    await this.update({ [`system.skills.${skill}.value`]: from + roll.total, "system.xp.rolls": xp.rolls - 1 });
    return postCard({ kind: "growth", kicker: t("COMAE.Growth.kicker"), title: t("COMAE.Growth.improved", { skill: C.skills[skill].label, n: roll.total }),
      total: roll.total, formula: roll.formula, rows: [{ label: C.skills[skill].label, value: `${from}% → ${from + roll.total}%` }] },
    { actor: this, rolls: [roll] });
  }

  /** Forgo an experience roll toward a new Focus (4) or Tag (6). */
  async bankRoll() {
    const xp = this.system.xp;
    if ( xp.rolls < 1 ) return ui.notifications.warn(t("COMAE.Growth.none"));
    return this.update({ "system.xp.rolls": xp.rolls - 1, "system.xp.banked": xp.banked + 1 });
  }

  /** Spend banked rolls on a Focus or a Tag. */
  async buyWithBanked(what) {
    const cost = C.costs[what];
    if ( this.system.xp.banked < cost ) return ui.notifications.warn(t("COMAE.Growth.notEnough", { n: cost }));
    const created = what === "focus" ? await this.chooseFocus() : await this.chooseTag({ exclude: ["paranormal"] });
    if ( created ) await this.update({ "system.xp.banked": this.system.xp.banked - cost });
    return created;
  }

  /** Pick a Focus from the setting's list and add it. */
  async chooseFocus({ skill } = {}) {
    const groups = Object.entries(C.focuses).filter(([k]) => !["willpower"].includes(k) && (!skill || k === skill)).map(([k, list]) => {
      const opts = Object.entries(list).filter(([key]) => !this.system.focuses.some(f => f.system.key === key && f.system.skill === k))
        .map(([key, f]) => `<option value="${k}.${key}">${C.skills[k].label} //${f.label}${f.restricted ? " ✱" : ""}</option>`).join("");
      return `<optgroup label="${C.skills[k].label}">${opts}</optgroup>`;
    }).join("");
    const data = await DialogV2.prompt({
      window: { title: t("COMAE.Focus.choose"), icon: "fa-solid fa-crosshairs" },
      classes: [SYSTEM_ID, "oc-dialog"],
      content: `<div class="form-group"><label>${t("COMAE.Focus.label")}</label><select name="f">${groups}</select></div>
        <div class="form-group"><label>${t("COMAE.Focus.custom")}</label><input type="text" name="custom" placeholder="${t("COMAE.Focus.customHint")}"></div>
        <p class="hint">${t("COMAE.Focus.restrictedHint")}</p>`,
      ok: { label: t("COMAE.Focus.add"), callback: (e, b) => new FormDataExtended(b.form).object }, rejectClose: false
    });
    if ( !data?.f ) return null;
    const [sk, key] = data.f.split(".");
    const def = C.focuses[sk][key];
    const name = data.custom?.trim() || def.label;
    const [item] = await this.createEmbeddedDocuments("Item", [{ name, type: "focus", img: `systems/${SYSTEM_ID}/assets/icons/skill-${sk}.svg`,
      system: { skill: sk, key, restricted: !!def.restricted, description: `<p>${def.text}</p>` } }]);
    return item;
  }

  /** Pick a Tag and add it. */
  async chooseTag({ exclude = [] } = {}) {
    const owned = new Set(this.system.tags.map(tg => tg.system.key));
    const opts = Object.entries(C.tags).filter(([k]) => !owned.has(k) && !exclude.includes(k))
      .map(([k, d]) => `<option value="${k}">#${d.label}</option>`).join("");
    const data = await DialogV2.prompt({
      window: { title: t("COMAE.Tag.choose"), icon: "fa-solid fa-hashtag" },
      classes: [SYSTEM_ID, "oc-dialog"],
      content: `<div class="form-group"><label>${t("COMAE.Tag.label")}</label><select name="k">${opts}</select></div>
        <div class="form-group"><label>${t("COMAE.Tag.detail")}</label><input type="text" name="detail" placeholder="${t("COMAE.Tag.detailHint")}"></div>`,
      ok: { label: t("COMAE.Tag.add"), callback: (e, b) => new FormDataExtended(b.form).object }, rejectClose: false
    });
    if ( !data?.k ) return null;
    const [item] = await this.createEmbeddedDocuments("Item", [tagData(data.k, data.detail)]);
    return item;
  }

  /* -------------------------------------------- */
  /*  Creation                                    */
  /* -------------------------------------------- */

  /** Roll the four pools: 2d6+6 each. */
  async rollPools() {
    const update = {};
    const rolls = [];
    const lines = [];
    for ( const key of Object.keys(C.pools) ) {
      const roll = await new Roll(C.poolDice).evaluate();
      rolls.push(roll);
      update[`system.pools.${key}.max`] = roll.total;
      update[`system.pools.${key}.value`] = roll.total;
      lines.push(`${C.pools[key].abbr} ${roll.total}`);
    }
    await this.update(update);
    return postCard({ kind: "growth", kicker: t("COMAE.Creation.kicker"), title: t("COMAE.Creation.rolledPools", { name: this.name }), notes: lines },
      { actor: this, rolls });
  }

  /** Roll a Willpower Focus: a verb and a person, or a verb and a Circle. */
  async rollDrive(kind = "person") {
    if ( !canRollDrive() ) return;
    const verbRoll = await new Roll("1d10").evaluate();
    const objRoll = await new Roll(kind === "circle" ? "1d100" : "1d10").evaluate();
    const verb = C.willpowerVerbs[verbRoll.total - 1];
    const target = kind === "circle" ? R.tableRow(C.circleTable, objRoll.total).name : C.willpowerPersons[objRoll.total - 1];
    await this.createEmbeddedDocuments("Item", [{ name: `${verb} //${target}`, type: "focus", img: `systems/${SYSTEM_ID}/assets/icons/skill-willpower.svg`,
      system: { skill: "willpower", key: kind, verb, target } }]);
    return postCard({ kind: "growth", kicker: t("COMAE.Drive.kicker"), title: `${verb} //${target}`,
      notes: [t(kind === "circle" ? "COMAE.Drive.circleNote" : "COMAE.Drive.personNote")] }, { actor: this, rolls: [verbRoll, objRoll] });
  }

  /**
   * Take up a career: its three skills at 50/30/30 with their Focuses, and its two Tags.
   * @param {Item} career
   */
  async applyCareer(career) {
    const sys = career.system;
    const lines = sys.skills.map((s, i) => `<li>${C.skills[s.skill].label} ${C.pyramid[i]?.value ?? 30}%${s.focus ? ` //${esc(s.focus)}` : ""}</li>`).join("");
    const ok = await DialogV2.confirm({
      window: { title: t("COMAE.Career.applyTitle", { name: career.name }), icon: "fa-solid fa-briefcase" },
      classes: [SYSTEM_ID, "oc-dialog"],
      content: `<p>${t("COMAE.Career.applyText")}</p><ul>${lines}</ul><p>${sys.tags.map(x => `#${esc(x)}`).join(", ")}</p>`,
      rejectClose: false
    });
    if ( !ok ) return;
    const update = { "system.details.career": career.name };
    const items = [];
    const placed = new Set();
    sys.skills.forEach((s, i) => {
      // A skill named twice (a Librarian's Knowledge) keeps its higher place and gains a second Focus.
      if ( !placed.has(s.skill) ) update[`system.skills.${s.skill}.value`] = C.pyramid[i]?.value ?? 30;
      placed.add(s.skill);
      if ( !s.focus ) return;
      const key = Object.entries(C.focuses[s.skill] ?? {}).find(([, f]) => f.label.toLowerCase() === s.focus.toLowerCase())?.[0] ?? "";
      if ( this.system.focuses.some(f => f.system.skill === s.skill && f.name === s.focus) ) return;
      const def = C.focuses[s.skill]?.[key];
      items.push({ name: s.focus, type: "focus", img: `systems/${SYSTEM_ID}/assets/icons/skill-${s.skill}.svg`,
        system: { skill: s.skill, key, description: def ? `<p>${def.text}</p>` : "" } });
    });
    const owned = new Set(this.system.tags.map(tg => tg.system.key));
    for ( const tag of sys.tags ) {
      const [, label, detail] = tag.match(/^#?([^(]+?)\s*(?:\((.*)\))?$/) ?? [];
      const key = Object.entries(C.tags).find(([, d]) => d.label.toLowerCase() === String(label).toLowerCase())?.[0];
      if ( key && !owned.has(key) ) items.push(tagData(key, detail ?? ""));
    }
    await this.update(update);
    if ( items.length ) await this.createEmbeddedDocuments("Item", items);
  }

  /* -------------------------------------------- */
  /*  NPCs                                        */
  /* -------------------------------------------- */

  /** Set an NPC to a tier's standard values, on the skills chosen. */
  async applyTier(tier, skills) {
    const def = C.tiers[tier];
    const update = { "system.tier": tier };
    Object.keys(C.pools).forEach((k, i) => {
      update[`system.pools.${k}.max`] = def.pools[i];
      update[`system.pools.${k}.value`] = def.pools[i];
    });
    for ( const k of C.skillOrder ) update[`system.skills.${k}.value`] = C.skillFloor;
    skills.forEach((k, i) => { if ( k ) update[`system.skills.${k}.value`] = def.skills[i]; });
    return this.update(update);
  }

  /** Roll a Code Block. Antagonists take one Personality and one Dark Triad trait. */
  async rollCodeBlock({ antagonist = false } = {}) {
    if ( !canRollCodeBlock() ) return;
    const d = f => new Roll(f).evaluate();
    const [p1, p2, disp, mot, ev] = await Promise.all([d("1d20"), d("1d20"), d("1d100"), d("1d20"), d("1d20")]);
    const personality = antagonist
      ? `${C.personalities[p1.total - 1]}, ${R.pairRow(C.darkTriad, p2.total)}`
      : [...new Set([C.personalities[p1.total - 1], C.personalities[p2.total - 1]])].join(", ");
    const e = R.pairRow(C.recentEvents, ev.total);
    const event = `${e.type}: ${ev.total % 2 ? e.loss : e.gain}`;
    await this.update({ "system.codeBlock": {
      personality, disposition: R.dispositionFor(disp.total), motivation: R.pairRow(C.motivations, mot.total), event
    } });
  }

  /** Make an infected NPC of a phase, following the Phase recipe. */
  async infectNpc(phase) {
    const recipe = C.sootPhases[phase];
    const update = { "system.soot.phase": phase, "system.soot.infected": true };
    // The Phase suggests a tier; an NPC already above it stays there.
    const order = Object.keys(C.tiers);
    if ( recipe.tier && (order.indexOf(recipe.tier) > order.indexOf(this.system.tier)) ) update["system.tier"] = recipe.tier;
    const d20 = async () => (await new Roll("1d20").evaluate()).total;
    if ( phase === 1 ) update["system.soot.value"] = 20;
    if ( phase >= 2 ) {
      // Dark Triad traits, when a content module supplies the table.
      const traits = [];
      const n = Math.min(phase === 2 ? 1 : phase === 3 ? 2 : 3, new Set(C.darkTriad).size);
      while ( traits.length < n ) {
        const tr = R.pairRow(C.darkTriad, await d20());
        if ( !traits.includes(tr) ) traits.push(tr);
      }
      if ( traits.length ) update["system.codeBlock.personality"] = traits.join(", ");
      if ( phase === 2 ) update["system.codeBlock.motivation"] = (await d20()) <= 10 ? "Expertise" : "Order and Logic";
      if ( phase >= 3 ) update["system.codeBlock.disposition"] = (await d20()) <= 10 ? "unfriendly" : "malicious";
      update["system.soot.value"] = Math.min(100, 30 + (phase * 15));
    }
    await this.update(update);
    if ( phase === 1 && !this.system.peculiarities.length ) {
      const roll = await new Roll("1d100").evaluate();
      const res = R.peculiarityTable(roll.total, true);
      const kinds = Object.keys(C.peculiarities).filter(k => k !== "custom");
      const key = res.kind !== "peculiarity" ? "paranoia" : (res.key ?? kinds[Math.floor(Math.random() * kinds.length)]);
      const item = await this.createPeculiarity(key);
      await item.update({ "system.value": 10 * Math.ceil(Math.random() * 3) });
    }
    if ( phase === 3 && !this.system.paranormal ) await this.createEmbeddedDocuments("Item", [tagData("paranormal")]);
    return postCard({ kind: "soot", kicker: t("COMAE.Soot.npcKicker"), title: `${this.name}: ${recipe.label}`, notes: [recipe.recipe] }, { actor: this });
  }
}

/** Whether a content module has supplied the Willpower Focus and Circle tables. */
export const canRollDrive = () => !!(C.willpowerVerbs.length && C.willpowerPersons.length && C.circleTable.length);

/** Whether a content module has supplied the Code Block tables. */
export const canRollCodeBlock = () => !!(C.personalities.length && C.darkTriad.length && C.motivations.length && C.recentEvents.length);

/** The data for a Tag item. */
export function tagData(key, detail = "") {
  const def = C.tags[key];
  return {
    name: def?.label ?? key, type: "tag", img: `systems/${SYSTEM_ID}/assets/icons/${key === "paranormal" ? "paranormal" : "tag"}.svg`,
    system: { key, detail, description: def ? `<p>${def.text}</p>` : "" }
  };
}

/* -------------------------------------------- */
/*  Card Actions                                */
/* -------------------------------------------- */

/** A skill roll; a success with //Medicine can treat a pool. */
registerRollKind("skill", {
  buttons(result, context) {
    if ( (context.focusKey !== "medicine") || !R.isSuccess(result.level) ) return [];
    return [{ action: "treat", label: t("COMAE.Medicine.treat"), icon: "fa-solid fa-kit-medical", who: "owner", once: "treat",
      tooltip: t("COMAE.Medicine.hint") }];
  }
});

/** Luck: the damage from one roll becomes 1. */
registerCardAction("luckReduce", async (message, button) => {
  const actor = await actorOf(message);
  if ( !actor ) return;
  if ( !(await spendLuck(actor)) ) return;
  const pool = button.dataset.pool;
  await actor.restorePool(pool, Number(button.dataset.refund) || 0);
  return postCard({ kind: "luck", kicker: t("COMAE.Luck.title"), title: C.luckUses.reduce.label,
    notes: [t("COMAE.Luck.reduced", { name: esc(actor.name), pool: C.pools[pool].abbr })] },
  { actor, flags: { answers: message.id, answerKind: "luck" } });
});

/** //Medicine: 1d4 to a pool above zero, 1 below it. */
registerCardAction("treat", async message => {
  const healer = await actorOf(message);
  const targets = [...game.user.targets].map(tk => tk.actor).filter(Boolean);
  const patient = targets[0] ?? await pickActor() ?? healer;
  if ( !patient ) return;
  const pools = Object.entries(patient.system.pools).map(([k, p]) => `<option value="${k}">${C.pools[k].abbr} ${p.value}/${p.max}</option>`).join("");
  const pool = await DialogV2.prompt({
    window: { title: t("COMAE.Medicine.title", { name: patient.name }), icon: "fa-solid fa-kit-medical" },
    classes: [SYSTEM_ID, "oc-dialog"],
    content: `<div class="form-group"><label>${t("COMAE.Damage.pool")}</label><select name="p">${pools}</select></div><p class="hint">${t("COMAE.Medicine.once")}</p>`,
    ok: { label: t("COMAE.Medicine.treat"), callback: (e, b) => b.form.elements.p.value }, rejectClose: false
  });
  if ( !pool ) return;
  const before = patient.system.pools[pool].value;
  let n = 1;
  let roll = null;
  if ( before > 0 ) { roll = await new Roll("1d4").evaluate(); n = roll.total; }
  if ( patient.isOwner ) await patient.restorePool(pool, n);
  else ui.notifications.warn(t("COMAE.Medicine.notOwner"));
  return postCard({ kind: "rest", kicker: t("COMAE.Medicine.kicker"), title: t("COMAE.Medicine.done", { name: patient.name, n, pool: C.pools[pool].abbr }),
    notes: [t("COMAE.Medicine.by", { name: esc(healer?.name ?? "") })] }, { actor: healer, rolls: roll ? [roll] : [], flags: { answers: message.id, answerKind: "treat" } });
});
