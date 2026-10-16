/**
 * The Conflict Board: both sides of an extended conflict, their pools draining (and, for those who
 * push on, sinking below zero), and the round's rolls laid out like cards on a table.
 * @module oddsoot-comae/apps/conflict-board
 */

import C, { SYSTEM_ID } from "../config.mjs";
import * as R from "../rules.mjs";
import * as X from "../conflict.mjs";
import { d100Text, t } from "../helpers/chat.mjs";
import { pipRow } from "./actor-sheets.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;
const { TextEditor } = foundry.applications.ux;

export default class ConflictBoard extends HandlebarsApplicationMixin(ApplicationV2) {

  constructor(combat, options = {}) {
    super({ id: `oc-conflict-${combat.id}`, ...options });
    this.combat = combat;
  }

  /** @inheritdoc */
  static DEFAULT_OPTIONS = {
    classes: [SYSTEM_ID, "oc-board"],
    position: { width: 780, height: "auto" },
    window: { resizable: true, icon: "fa-solid fa-scale-unbalanced", title: "COMAE.Conflict.title" },
    actions: {
      roll: ConflictBoard.#onRoll,
      resolve: ConflictBoard.#onResolve,
      end: ConflictBoard.#onEnd,
      addObstacle: ConflictBoard.#onAddObstacle,
      withdraw: ConflictBoard.#onWithdraw,
      nudge: ConflictBoard.#onNudge,
      clearRoll: ConflictBoard.#onClearRoll,
      remove: ConflictBoard.#onRemove,
      revive: ConflictBoard.#onRevive,
      push: ConflictBoard.#onPush,
      showMessage: ConflictBoard.#onShowMessage
    }
  };

  /** @inheritdoc */
  static PARTS = {
    board: { template: `systems/${SYSTEM_ID}/templates/apps/conflict-board.hbs` }
  };

  /** One board per conflict. */
  static show(combat) {
    const existing = foundry.applications.instances.get(`oc-conflict-${combat.id}`);
    if ( existing ) return existing.render({ force: true });
    return new this(combat).render({ force: true });
  }

  /** @inheritdoc */
  get title() {
    return X.conflictOf(this.combat)?.name ?? t("COMAE.Conflict.title");
  }

  /** @inheritdoc */
  async _prepareContext() {
    const combat = this.combat;
    const conflict = X.conflictOf(combat) ?? {};
    const isGM = game.user.isGM;
    const active = X.activeParticipants(combat);
    // Initiative: the highest pool acts (and describes its move) first.
    const all = combat.combatants.contents.sort((a, b) => X.poolOf(b, conflict).value - X.poolOf(a, conflict).value);

    const card = c => {
      const st = X.stateOf(c);
      const pool = X.poolOf(c, conflict);
      const roll = st.roll;
      const canAct = c.isOwner && !st.out && !st.withdrawn;
      const opps = active.filter(o => X.opponents(c, o, conflict));
      const thresholds = (st.obstacle ? (conflict.clues ?? []) : []).map(n => ({ n, found: pool.value <= n }));
      return {
        id: c.id, name: c.name, img: c.img || c.actor?.img, isOwner: c.isOwner, obstacle: !!st.obstacle,
        pool, out: !!st.out, withdrawn: !!st.withdrawn, pushing: !!st.pushing, comae: !pool.obstacle && R.inComae(pool.value, pool.max),
        halved: game.settings.get(SYSTEM_ID, "halving") && R.isHalved(pool.value, pool.max),
        pips: pipRow(pool.value, pool.max),
        thresholds,
        poolLabel: st.obstacle ? `${st.skill}%` : C.pools[conflict.pool]?.abbr,
        roll: roll ? { value: d100Text(roll.value), target: roll.target, level: C.results[roll.level].key,
          label: C.results[roll.level].short, title: roll.title, messageId: roll.messageId,
          lens: roll.lens && roll.lens !== "none" ? C.lenses[roll.lens]?.label : null, weapon: roll.weapon } : null,
        canRoll: canAct && !roll, canClear: isGM && !!roll,
        nextMod: st.nextMod || 0, clever: !!st.clever,
        canPush: c.isOwner && st.out && !st.withdrawn && !st.obstacle && !!c.actor?.system.canPush && (pool.value <= 0) && !R.inComae(pool.value, pool.max),
        target: (conflict.mode === "single") && canAct && (opps.length > 1) ? {
          options: opps.map(o => ({ id: o.id, name: o.name, selected: o.id === st.targetId }))
        } : null
      };
    };

    let sides;
    if ( conflict.freeForAll ) sides = [{ key: "all", label: t("COMAE.Conflict.atTable"), cards: all.map(card) }];
    else sides = [
      { key: "pc", label: t("COMAE.Conflict.sidePC"), cards: all.filter(c => X.stateOf(c).side === "pc").map(card) },
      { key: "opp", label: t("COMAE.Conflict.sideOpp"), cards: all.filter(c => X.stateOf(c).side !== "pc").map(card) }
    ];

    const rolled = active.filter(c => X.stateOf(c).roll).length;
    return {
      conflict, isGM, round: combat.round, sides,
      poolText: C.pools[conflict.pool]?.abbr ?? "", modeText: C.damageModes[conflict.mode] ?? "",
      progress: { rolled, total: active.length, all: active.length && (rolled === active.length) },
      lenses: conflict.lenses ? Object.values(C.lenses).filter(l => l.label !== C.lenses.none.label) : null
    };
  }

  /** @inheritdoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
    for ( const sel of this.element.querySelectorAll("select[data-target-for]") ) {
      sel.addEventListener("change", ev => {
        const c = this.combat.combatants.get(ev.currentTarget.dataset.targetFor);
        if ( c ) c.setFlag(SYSTEM_ID, "cp", { ...X.stateOf(c), targetId: ev.currentTarget.value || null });
      });
    }
    if ( game.user.isGM && !this.#dropBound ) {
      this.#dropBound = true;
      this.element.addEventListener("dragover", ev => ev.preventDefault());
      this.element.addEventListener("drop", this.#onDrop.bind(this));
    }
  }

  #dropBound = false;

  async #onDrop(event) {
    const data = TextEditor.implementation.getDragEventData(event);
    if ( data.type !== "Actor" ) return;
    const actor = await fromUuid(data.uuid);
    if ( actor ) await X.addParticipant(this.combat, actor);
  }

  #combatant(target) {
    return this.combat.combatants.get(target.closest("[data-combatant-id]")?.dataset.combatantId);
  }

  static async #onRoll(event, target) {
    const c = this.#combatant(target);
    if ( c ) await X.rollParticipant(this.combat, c);
  }

  static async #onResolve() {
    await X.resolveRound(this.combat);
  }

  static async #onEnd() {
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: t("COMAE.Conflict.endTitle") }, content: `<p>${t("COMAE.Conflict.endText")}</p>`, rejectClose: false
    });
    if ( ok ) await X.endConflict(this.combat);
  }

  static async #onAddObstacle() {
    await X.addObstacle(this.combat);
  }

  static async #onWithdraw(event, target) {
    const c = this.#combatant(target);
    if ( !c ) return;
    const st = X.stateOf(c);
    await c.setFlag(SYSTEM_ID, "cp", { ...st, withdrawn: !st.withdrawn });
  }

  /** The Game Master's thumb on the scale: ±20% next round. */
  static async #onNudge(event, target) {
    const c = this.#combatant(target);
    if ( !c ) return;
    const st = X.stateOf(c);
    const n = Number(target.dataset.n);
    await c.setFlag(SYSTEM_ID, "cp", { ...st, nextMod: (st.nextMod || 0) === n ? 0 : n });
  }

  static async #onClearRoll(event, target) {
    const c = this.#combatant(target);
    if ( c ) await c.setFlag(SYSTEM_ID, "cp", { ...X.stateOf(c), roll: null });
  }

  static async #onRemove(event, target) {
    const c = this.#combatant(target);
    if ( c ) await c.delete();
  }

  static async #onRevive(event, target) {
    const c = this.#combatant(target);
    if ( c ) await c.setFlag(SYSTEM_ID, "cp", { ...X.stateOf(c), out: false, withdrawn: false });
  }

  static async #onPush(event, target) {
    const c = this.#combatant(target);
    if ( c ) await X.pushOn(this.combat, c);
  }

  static #onShowMessage(event, target) {
    document.querySelector(`#chat [data-message-id="${target.dataset.messageId}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

/* -------------------------------------------- */
/*  Keeping boards fresh                        */
/* -------------------------------------------- */

function refresh(combat) {
  const app = foundry.applications.instances.get(`oc-conflict-${combat?.id}`);
  if ( app?.rendered ) app.render();
}

/** Boards of conflicts an actor takes part in follow its pools. */
function refreshForActor(actor) {
  for ( const combat of X.conflicts() ) {
    if ( combat.combatants.some(c => c.actor === actor || c.actorId === actor.id) ) refresh(combat);
  }
}

export function registerBoardHooks() {
  Hooks.on("createCombat", combat => { if ( X.isConflict(combat) && game.user.isGM ) ConflictBoard.show(combat); });
  Hooks.on("updateCombat", combat => refresh(combat));
  Hooks.on("createCombatant", c => {
    refresh(c.parent);
    if ( X.isConflict(c.parent) && c.isOwner && !game.user.isGM ) ConflictBoard.show(c.parent);
  });
  Hooks.on("updateCombatant", c => refresh(c.parent));
  Hooks.on("deleteCombatant", c => refresh(c.parent));
  Hooks.on("updateActor", actor => refreshForActor(actor));
  Hooks.on("deleteCombat", combat => foundry.applications.instances.get(`oc-conflict-${combat.id}`)?.close());
}
