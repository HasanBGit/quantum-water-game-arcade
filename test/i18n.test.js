import { test } from "node:test";
import assert from "node:assert/strict";
import { STRINGS } from "../src/strings.js";
import { AR } from "../src/strings.ar.js";
import { pickLang, gameStrings } from "../src/i18n.js";
import { PRESETS } from "../src/math/index.js";
import { dialogueVars, checkScripts } from "../src/game/scripts.js";

/** Every leaf of a tree as "a.b[0].c": value. */
function leaves(node, path = "", out = {}) {
  if (typeof node === "string") out[path] = node;
  else if (Array.isArray(node)) node.forEach((v, i) => leaves(v, `${path}[${i}]`, out));
  else if (node && typeof node === "object") for (const [k, v] of Object.entries(node)) leaves(v, path ? `${path}.${k}` : k, out);
  else out[path] = node;
  return out;
}
const holes = (s) => (typeof s === "string" ? (s.match(/\{\w+\}/g) ?? []).sort().join(",") : "");
const en = leaves(STRINGS.en.game);
const ar = leaves(AR.game);
const STAYS_THE_SAME = /(\.id|\.color|\.slots|\.start|\.next|\.effect|\.end)$|^$/; // ids, colours, numbers and script links are not text

test("every English string has an Arabic one (add the Arabic when you add English)", () => {
  const missing = Object.keys(en).filter((k) => !(k in ar));
  assert.deepEqual(missing, []);
  const extra = Object.keys(ar).filter((k) => !(k in en));
  assert.deepEqual(extra, []);
});

test("Arabic strings keep exactly the same placeholders as English", () => {
  const bad = Object.keys(en).filter((k) => typeof en[k] === "string" && holes(en[k]) !== holes(ar[k]));
  assert.deepEqual(bad.map((k) => `${k}: ${en[k]}  VS  ${ar[k]}`), []);
});

test("Arabic text really is Arabic (not left in English by mistake)", () => {
  const arabic = /[؀-ۿ]/;
  const notArabic = Object.keys(ar).filter((k) => typeof ar[k] === "string" && !STAYS_THE_SAME.test(k) && !arabic.test(ar[k]));
  assert.deepEqual(notArabic.map((k) => `${k}: ${ar[k]}`), []);
});

test("the Arabic conversations are sound and every number resolves", () => {
  const t = gameStrings("ar");
  const vals = dialogueVars(PRESETS.team, [0, 0, 0, 0, 0]);
  assert.deepEqual(checkScripts(t.dialogue.scripts, vals), []);
  assert.equal(Object.keys(t.dialogue.scripts).sort().join(), Object.keys(STRINGS.en.game.dialogue.scripts).sort().join());
});

test("the honest statements survive translation: numbers 32, 12 qubits, 2^120 and 2^240 are unchanged", () => {
  const all = JSON.stringify(AR.game);
  assert.match(all, /32/);
  assert.match(all, /12 كيوبت/);
  assert.match(all, /2\^120/);
  assert.match(all, /2\^240/);
});

test("language choice: the address wins, then the saved choice, then English", () => {
  assert.equal(pickLang("?lang=ar", "en"), "ar");
  assert.equal(pickLang("?lang=en", "ar"), "en");
  assert.equal(pickLang("", "ar"), "ar");
  assert.equal(pickLang("", ""), "en");
  assert.equal(pickLang("?lang=fr", ""), "en");
});

test("anything not translated falls back to English instead of being blank", () => {
  assert.equal(gameStrings("en").bill.title, "Today's bill");
  assert.notEqual(gameStrings("ar").bill.title, "Today's bill");
  assert.ok(gameStrings("ar").quality.label);
});
