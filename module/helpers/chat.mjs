/**
 * Chat cards: typed slips and stamped results. Building them, posting them, and wiring
 * their buttons.
 * @module oddsoot-comae/helpers/chat
 */

import C, { SYSTEM_ID } from "../config.mjs";

const { renderTemplate } = foundry.applications.handlebars;

const CARD = `systems/${SYSTEM_ID}/templates/chat/card.hbs`;

/** Card button handlers, registered by the modules that own them. */
const HANDLERS = {};

/**
 * Register a handler for a card button.
 * @param {string} action
 * @param {(message: ChatMessage, button: HTMLElement, event: Event) => Promise<any>} fn
 */
export function registerCardAction(action, fn) {
  HANDLERS[action] = fn;
}

/** Shorthand for localisation. */
export const t = (key, data) => data ? game.i18n.format(key, data) : game.i18n.localize(key);

/** Escape user text. */
export const esc = s => foundry.utils.escapeHTML(String(s ?? ""));

/** Display a d100 result as it reads on the dice. */
export const d100Text = n => (n === 100 ? "00" : String(n).padStart(2, "0"));

/** The stamp for a level of success. */
export function stamp(level) {
  const l = C.results[level];
  return l ? { key: l.key, label: l.label } : null;
}

/**
 * Render and post a card.
 * @param {object} card                    Template data.
 * @param {object} [options]
 * @param {Actor} [options.actor]          Who the card speaks for.
 * @param {Roll[]} [options.rolls]         Rolls to attach (for 3D dice and the dice sound).
 * @param {object} [options.flags]         More system flags.
 * @param {string} [options.messageMode]   A key of CONFIG.ChatMessage.modes.
 * @param {string[]} [options.whisper]
 * @returns {Promise<ChatMessage>}
 */
export async function postCard(card, { actor = null, rolls = [], flags = {}, messageMode, whisper } = {}) {
  const content = await renderCard(card, actor);
  const data = {
    content,
    speaker: ChatMessage.getSpeaker({ actor }),
    flags: { [SYSTEM_ID]: { actorUuid: actor?.uuid ?? null, card, ...flags } }
  };
  if ( rolls.length ) { data.rolls = rolls; data.sound = CONFIG.sounds.dice; }
  if ( whisper?.length ) data.whisper = whisper;
  const options = messageMode ? { messageMode } : {};
  return ChatMessage.create(data, options);
}

/** @returns {Promise<string>} */
export function renderCard(card, actor = null) {
  return renderTemplate(CARD, { img: actor?.img, ...card });
}

/**
 * Re-render a card already posted.
 * @param {ChatMessage} message
 * @param {object} changes
 * @param {object} [flags]
 */
export async function updateCard(message, changes, flags = {}) {
  const card = { ...(message.getFlag(SYSTEM_ID, "card") ?? {}), ...changes };
  const actor = await actorOf(message);
  const content = await renderCard(card, actor);
  return message.update({ content, [`flags.${SYSTEM_ID}`]: { card, ...flags } });
}

/** @returns {Promise<Actor|null>} */
export async function actorOf(message) {
  const uuid = message.getFlag(SYSTEM_ID, "actorUuid");
  return uuid ? fromUuid(uuid) : null;
}

/**
 * Has some later message answered this one (with Luck, a defence, damage)?
 * @param {string} messageId
 * @param {string} [as]        The kind of answer: "luck", "oppose", "damage", "resist", "repay".
 */
export function answered(messageId, as) {
  return game.messages.some(m => {
    const f = m.flags?.[SYSTEM_ID];
    return f && (f.answers === messageId) && (!as || (f.answerKind === as));
  });
}

/**
 * Follow a roll through any Luck spent on it, to its final form.
 * @param {ChatMessage} message
 * @returns {ChatMessage}
 */
export function latest(message) {
  let current = message;
  for ( let i = 0; i < 10; i++ ) {
    const next = game.messages.find(m => {
      const f = m.flags?.[SYSTEM_ID];
      return f && (f.answers === current.id) && ["luck", "repay"].includes(f.answerKind);
    });
    if ( !next ) break;
    current = next;
  }
  return current;
}

/* -------------------------------------------- */
/*  Rendering                                   */
/* -------------------------------------------- */

/**
 * Wire up a rendered message. Buttons say who may press them with data-oc-who:
 * "owner" (of the card's actor), "target" (owner of the actor in data-oc-target), "gm" or "all".
 * @param {ChatMessage} message
 * @param {HTMLElement} html
 */
export function onRenderChatMessage(message, html) {
  const card = html.querySelector?.(".oc-card");
  if ( !card ) return;
  html.classList.add("oc-message");
  const flags = message.flags?.[SYSTEM_ID] ?? {};
  const actor = flags.actorUuid ? fromUuidSync(flags.actorUuid) : null;
  const superseded = answered(message.id, "luck") || answered(message.id, "repay");
  if ( superseded ) card.classList.add("is-superseded");

  for ( const button of card.querySelectorAll("[data-oc-action]") ) {
    if ( superseded || !mayPress(button, message, actor) ) { button.remove(); continue; }
    button.addEventListener("click", event => onCardAction(event, message));
  }
  for ( const bar of card.querySelectorAll(".oc-card__buttons") ) if ( !bar.children.length ) bar.remove();
}

/** May this user press this button now? */
function mayPress(button, message, actor) {
  const { ocWho: who, ocOnce: once, ocTarget: targetUuid } = button.dataset;
  if ( once && answered(message.id, once) ) return false;
  if ( game.user.isGM ) return true;
  switch ( who ) {
    case "gm": return false;
    case "owner": return !!actor?.isOwner;
    case "target": {
      const target = targetUuid ? fromUuidSync(targetUuid) : null;
      return !!(target?.isOwner);
    }
    default: return true;
  }
}

async function onCardAction(event, message) {
  event.preventDefault();
  const button = event.currentTarget;
  if ( button.disabled ) return;
  const fn = HANDLERS[button.dataset.ocAction];
  if ( !fn ) return;
  button.disabled = true;
  try { await fn(message, button, event); }
  catch ( err ) { console.error(err); ui.notifications.error(err.message); }
  finally { button.disabled = false; }
}

/**
 * When an answer arrives, take the answered buttons off the earlier card for everyone.
 * @param {ChatMessage} message
 */
export function onCreateChatMessage(message) {
  const f = message.flags?.[SYSTEM_ID];
  if ( !f?.answers ) return;
  const el = document.querySelectorAll(`[data-message-id="${f.answers}"] .oc-card`);
  for ( const card of el ) {
    const superseded = ["luck", "repay"].includes(f.answerKind);
    if ( superseded ) card.classList.add("is-superseded");
    const selector = superseded ? "[data-oc-action]" : `[data-oc-once="${f.answerKind}"]`;
    for ( const b of card.querySelectorAll(selector) ) b.remove();
    for ( const bar of card.querySelectorAll(".oc-card__buttons") ) if ( !bar.children.length ) bar.remove();
  }
}
