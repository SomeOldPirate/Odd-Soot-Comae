#!/usr/bin/env node
/**
 * Build the system's compendium packs from src/.
 *
 *   node tools/build-packs.mjs
 *
 * Writes each pack under packs/ as a LevelDB database, with the classic-level that ships with
 * Foundry (FOUNDRY_PATH, default ~/foundryvtt). Refuses to write on a duplicate id, a missing image
 * or a link to nothing. Do not run it while a world on this system is open: Foundry holds the packs.
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { rm, mkdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { id, SYSTEM_ID } from "../src/lib.mjs";
import { tags, focuses, peculiarities, armoury } from "../src/items.mjs";
import spells from "../src/spells.mjs";
import careers from "../src/careers.mjs";
import journal from "../src/journal.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const foundryPath = process.env.FOUNDRY_PATH ?? path.join(os.homedir(), "foundryvtt");
const { ClassicLevel } = createRequire(path.join(foundryPath, "package.json"))("classic-level");
const manifest = JSON.parse(await readFile(path.join(root, "system.json"), "utf8"));

const PACKS = {
  reference: ["JournalEntry", journal], tags: ["Item", tags], focuses: ["Item", focuses], careers: ["Item", careers],
  spells: ["Item", spells], peculiarities: ["Item", peculiarities], armoury: ["Item", armoury]
};
const COLLECTION = { Item: "items", Actor: "actors", RollTable: "tables", JournalEntry: "journal" };

const now = Date.now();
const stats = () => ({
  coreVersion: manifest.compatibility.verified, systemId: SYSTEM_ID, systemVersion: manifest.version,
  createdTime: now, modifiedTime: now, lastModifiedBy: null, compendiumSource: null, duplicateSource: null, exportSource: null
});

const problems = [];
const seen = new Set();
const docIds = new Set();
const images = new Set();
const claim = (docId, where) => {
  if ( !/^[A-Za-z0-9]{16}$/.test(docId) ) problems.push(`${where}: bad id "${docId}"`);
  if ( seen.has(docId) ) problems.push(`${where}: duplicate id "${docId}"`);
  seen.add(docId);
};
const finish = (doc, sort) => {
  doc.sort ??= sort * 100;
  doc.flags ??= {};
  doc._stats = stats();
  if ( doc.img ) images.add(doc.img);
  return doc;
};

const output = {};
for ( const [pack, [type, docs]] of Object.entries(PACKS) ) {
  const out = { primary: [], embedded: {}, folders: [] };
  output[pack] = out;
  const folderIds = {};
  docs.forEach(d => {
    if ( !d.folder || folderIds[d.folder] ) return;
    const fid = id(pack, "folder", d.folder);
    claim(fid, `${pack}/folder ${d.folder}`);
    folderIds[d.folder] = fid;
    out.folders.push(finish({ _id: fid, name: d.folder, type, folder: null, sorting: "m", color: null, description: "" }, out.folders.length));
  });
  docs.forEach((src, i) => {
    const doc = structuredClone(src);
    doc._id = id(pack, doc.name);
    claim(doc._id, `${pack}/${doc.name}`);
    docIds.add(doc._id);
    doc.folder = doc.folder ? folderIds[doc.folder] : null;
    doc.ownership = { default: 0 };
    if ( type === "Item" ) doc.effects = [];
    if ( type === "RollTable" ) {
      const results = doc.results;
      doc.results = [];
      out.embedded["tables.results"] ??= [];
      results.forEach((r, j) => {
        r._id = id(pack, doc.name, "result", j);
        claim(r._id, `${pack}/${doc.name}/result ${j}`);
        r.flags = {};
        r._stats = stats();
        doc.results.push(r._id);
        out.embedded["tables.results"].push([`${doc._id}.${r._id}`, r]);
      });
    }
    if ( type === "JournalEntry" ) {
      const pages = doc.pages;
      doc.pages = [];
      doc.categories = [];
      out.embedded["journal.pages"] ??= [];
      pages.forEach((pg, j) => {
        const page = {
          _id: id(pack, doc.name, "page", pg.name), name: pg.name, type: "text",
          title: { show: true, level: 1 }, text: { content: pg.text, format: 1 },
          src: null, system: {}, image: {}, video: { controls: true, volume: 0.5 },
          sort: (j + 1) * 100000, ownership: { default: -1 }, flags: {}, category: null, _stats: stats()
        };
        claim(page._id, `${pack}/${doc.name}/${pg.name}`);
        doc.pages.push(page._id);
        out.embedded["journal.pages"].push([`${doc._id}.${page._id}`, page]);
      });
    }
    out.primary.push(finish(doc, i));
  });
}

for ( const img of images ) {
  const file = img.startsWith(`systems/${SYSTEM_ID}/`) ? path.join(root, img.slice(`systems/${SYSTEM_ID}/`.length)) : path.join(foundryPath, "public", img);
  if ( !existsSync(file) ) problems.push(`missing image: ${img}`);
}
const text = JSON.stringify(output);
for ( const [, ref] of text.matchAll(/Compendium\.([\w-]+\.[\w-]+\.\w+\.[A-Za-z0-9]{16})/g) ) {
  const [sys, pack, , docId] = ref.split(".");
  if ( (sys !== SYSTEM_ID) || !output[pack] || !docIds.has(docId) ) problems.push(`broken link: ${ref}`);
}
if ( problems.length ) {
  console.error(problems.join("\n"));
  process.exit(1);
}

for ( const [pack, out] of Object.entries(output) ) {
  const type = PACKS[pack][0];
  const dir = path.join(root, "packs", pack);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const db = new ClassicLevel(dir, { keyEncoding: "utf8", valueEncoding: "json" });
  const level = name => db.sublevel(name, { keyEncoding: "utf8", valueEncoding: "json" });
  const batch = [];
  for ( const f of out.folders ) batch.push({ type: "put", sublevel: level("folders"), key: f._id, value: f });
  for ( const d of out.primary ) batch.push({ type: "put", sublevel: level(COLLECTION[type]), key: d._id, value: d });
  for ( const [name, rows] of Object.entries(out.embedded) ) {
    const sub = level(name);
    for ( const [key, value] of rows ) batch.push({ type: "put", sublevel: sub, key, value });
  }
  await db.batch(batch);
  await db.compactRange("\x00", "￿");
  await db.close();
  const embedded = Object.values(out.embedded).reduce((n, r) => n + r.length, 0);
  console.log(`${pack}: ${out.primary.length} ${type} documents, ${out.folders.length} folders, ${embedded} embedded`);
}
