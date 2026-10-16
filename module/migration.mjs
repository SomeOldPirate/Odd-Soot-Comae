/**
 * Bringing a world from version 1 (Foundry 12-13) into version 2. The data models reshape what they
 * can as documents load; what needs new documents (Tags typed as text) is done here, once, by the
 * Game Master.
 * @module oddsoot-comae/migration
 */

import C, { SYSTEM_ID } from "./config.mjs";
import { tagData } from "./documents/actor.mjs";

export const MIGRATION_VERSION = "2.0.0";

/** Turn version 1's free-text Tags into Tag items, and keep its NPC skill values in the notes. */
export async function migrateWorld() {
  if ( !game.user.isGM ) return;
  const last = game.settings.get(SYSTEM_ID, "migrated");
  const actors = [...game.actors, ...game.scenes.contents.flatMap(s => s.tokens.contents.filter(tk => !tk.actorLink && tk.actor).map(tk => tk.actor))];
  const pending = actors.filter(a => a.system.legacy);
  if ( !pending.length ) {
    if ( last !== MIGRATION_VERSION ) await game.settings.set(SYSTEM_ID, "migrated", MIGRATION_VERSION);
    return;
  }
  ui.notifications.info(game.i18n.format("COMAE.Migration.start", { n: pending.length }));
  for ( const actor of pending ) {
    try {
      const legacy = JSON.parse(actor.system.legacy);
      const items = [];
      const update = { "system.legacy": "" };
      if ( legacy.tags ) {
        for ( const raw of String(legacy.tags).split(/[,;#\n]+/).map(s => s.trim()).filter(Boolean) ) {
          const [, label, detail] = raw.match(/^([^(]+?)\s*(?:\((.*)\))?$/) ?? [null, raw, ""];
          const key = Object.entries(C.tags).find(([, d]) => d.label.toLowerCase() === label.toLowerCase())?.[0];
          items.push(key ? tagData(key, detail ?? "") : { name: label, type: "tag", system: { key: "custom", detail: detail ?? "" } });
        }
      }
      if ( legacy.skills ) {
        update["system.notes"] = `${actor.system.notes ?? ""}<p><em>${game.i18n.format("COMAE.Migration.npcSkills", { skills: legacy.skills.join("%, ") })}%</em></p>`;
      }
      if ( items.length ) await actor.createEmbeddedDocuments("Item", items);
      await actor.update(update);
    } catch ( err ) {
      console.error(`${SYSTEM_ID} | Migration failed for ${actor.name}`, err);
    }
  }
  await game.settings.set(SYSTEM_ID, "migrated", MIGRATION_VERSION);
  ui.notifications.info(game.i18n.localize("COMAE.Migration.done"));
}
