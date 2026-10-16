/**
 * Helpers for the system's own compendium content: stable ids and a little HTML.
 */

import { createHash } from "node:crypto";
import C, { SYSTEM_ID } from "../module/config.mjs";

export { C, SYSTEM_ID };

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** A stable 16-character document id made from the given words. */
export function id(...parts) {
  const hash = createHash("sha256").update(parts.join("|")).digest();
  let out = "";
  for ( let i = 0; i < 16; i++ ) out += ALPHABET[hash[i] % 62];
  return out;
}

export const uuid = (pack, type, name) => `Compendium.${SYSTEM_ID}.${pack}.${type}.${id(pack, name)}`;
export const link = (pack, type, name, label = name) => `@UUID[${uuid(pack, type, name)}]{${label}}`;
export const ICON = name => `systems/${SYSTEM_ID}/assets/icons/${name}.svg`;

/** Paragraphs; a string that is already a block passes through. */
export function p(...paras) {
  const block = /^<(p|ul|ol|table|h\d|div|blockquote)[\s>]/;
  return paras.filter(Boolean).map(s => (block.test(s) ? s : `<p>${s}</p>`)).join("");
}
export const ul = items => `<ul>${items.map(i => `<li>${i}</li>`).join("")}</ul>`;
export function table(head, rows) {
  return `<table><thead><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}
