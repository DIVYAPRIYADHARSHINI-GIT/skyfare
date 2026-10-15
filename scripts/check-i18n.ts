// Reports missing / unknown translation keys and placeholder mismatches
// for every language against English.   npm run check:i18n
import en from "../src/i18n/messages/en.ts";
import { LOCALES } from "../src/i18n/config.ts";

// Keys that intentionally stay English everywhere (PDF ticket uses built-in Latin fonts).
const ENGLISH_ONLY = (k: string) => k.startsWith("ticket.") || k === "app.name";
const enKeys = Object.keys(en).filter((k) => !ENGLISH_ONLY(k));
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

let problems = 0;
for (const l of LOCALES) {
  if (l.code === "en") continue;
  const mod = await import(`../src/i18n/messages/${l.code}.ts`);
  const msgs = mod.default as Record<string, string>;
  const missing = enKeys.filter((k) => !(k in msgs));
  const unknown = Object.keys(msgs).filter((k) => !(k in en));
  const badPh = Object.keys(msgs).filter((k) => k in en && placeholders(msgs[k]) !== placeholders((en as Record<string, string>)[k]));
  const status = missing.length + unknown.length + badPh.length === 0 ? "OK" : "ISSUES";
  console.log(`${l.code.padEnd(3)} ${l.english.padEnd(10)} ${Object.keys(msgs).length}/${enKeys.length} keys  ${status}`);
  if (missing.length) console.log("   missing:", missing.join(", "));
  if (unknown.length) console.log("   unknown:", unknown.join(", "));
  if (badPh.length) console.log("   placeholder mismatch:", badPh.join(", "));
  problems += missing.length + unknown.length + badPh.length;
}
if (problems) {
  console.error(`\n${problems} i18n problem(s) found.`);
  process.exit(1);
}
console.log("\nAll languages complete.");
