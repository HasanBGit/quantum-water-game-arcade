import { test } from "node:test";
import assert from "node:assert/strict";
import { STRINGS } from "../src/strings.js";
import { PRESETS, allPlans, greedyPlan } from "../src/math/index.js";
import { dialogueVars, checkScripts, fill } from "../src/game/scripts.js";

const t = STRINGS.en.game.dialogue;
const vals = dialogueVars(PRESETS.team, [0, 0, 0, 0, 0]);

test("every helper has a conversation, and every conversation is sound", () => {
  const people = STRINGS.en.game.npcs.people.map((p) => p.id);
  for (const id of people) assert.ok(t.scripts[id], `no conversation for ${id}`);
  assert.deepEqual(checkScripts(t.scripts, vals), []);
});

test("the checker really finds problems (a broken script is reported)", () => {
  const broken = {
    x: { start: "hub", nodes: { hub: { say: "Hi {nope}", choices: [{ label: "a", next: "gone" }, { label: "b", end: true }] }, lost: { say: "Nobody reaches me", end: true } } },
  };
  const found = checkScripts(broken, vals).join(" | ");
  assert.match(found, /unresolved variable/);
  assert.match(found, /missing node/);
  assert.match(found, /cannot be reached/);
});

test("the numbers helpers say come from the maths, not from the text", () => {
  const plans = allPlans(PRESETS.team);
  assert.equal(vals.greedyBill, greedyPlan(PRESETS.team, plans).total);
  assert.equal(vals.greedyBill, 19);
  assert.equal(vals.n_plans, 32);
  assert.equal(vals.b24, "16,777,216");
  assert.equal(vals.b240, "1.77 × 10^72");
  assert.equal(vals.s240, "1.33 × 10^36");
  assert.equal(vals.p4, "99.9%");
  assert.equal(vals.p5, "86.0%");
  assert.equal(vals.cheap, "1, 2 and 5");
  assert.equal(vals.blockBill, 21); // slots 3, 4, 5: 7 + 6 + 3 = 16, plus one start of 5
  assert.equal(vals.islandBill, 27); // slots 1, 3, 5: 12, plus three starts of 5
});

test("the helpers' numbers follow the tariff if it changes", () => {
  const other = { ...PRESETS.team, prices: [9, 1, 1, 9, 9], restart: 2 };
  const v = dialogueVars(other, [0, 0, 0, 0, 0]);
  assert.equal(v.restart, 2);
  assert.equal(v.pmin, 1);
  assert.equal(v.pmax, 9);
  assert.equal(fill("restart {restart}", v), "restart 2");
});

test("the truthful statements are present: simulated, no advantage, a loop is faster", () => {
  const all = JSON.stringify(t.scripts.james);
  assert.match(all, /Not for \{n_plans\} plans/);
  assert.match(all, /never claims a quantum advantage/);
  assert.match(all, /Nobody has shown a quantum advantage/);
});
