/** Every COMAE.* key used in code and templates must exist in lang/en.json. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lang = JSON.parse(fs.readFileSync(path.join(root, "lang/en.json"), "utf8"));
const has = key => key.split(".").reduce((o, k) => (o && typeof o === "object") ? o[k] : undefined, lang) !== undefined;
const files = [];
const walk = d => { for ( const f of fs.readdirSync(d) ) { const p = path.join(d, f); if ( fs.statSync(p).isDirectory() ) walk(p); else if ( /\.(mjs|hbs)$/.test(f) ) files.push(p); } };
walk(path.join(root, "module")); walk(path.join(root, "templates"));
const missing = new Set();
for ( const f of files ) {
  const src = fs.readFileSync(f, "utf8");
  for ( const m of src.matchAll(/["'`](COMAE\.[A-Za-z0-9_.]+?)["'`]/g) ) {
    const key = m[1].replace(/\.$/, "");
    if ( key.includes("${") ) continue;
    if ( !has(key) ) missing.add(`${key}  (${path.relative(root, f)})`);
  }
}
console.log(missing.size ? [...missing].join("\n") : "All keys present.");
process.exitCode = missing.size ? 1 : 0;
