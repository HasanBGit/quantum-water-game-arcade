import test from "node:test";
import assert from "node:assert/strict";
import { PRESETS, allPlans, cheapestPlans, greedyPlan } from "../src/math/index.js";
import { siteReport } from "../src/game/siteReport.js";

const model = PRESETS.team;
const plans = allPlans(model);
const best = cheapestPlans(plans)[0]; // slots 1, 2, 3 = 18
const greedy = greedyPlan(model, plans); // slots 1, 2, 5 = 19

test("the cheapest plan matches itself in every bay", () => {
  const r = siteReport(model, best, best);
  assert.equal(r.won, true);
  assert.equal(r.dTotal, 0);
  assert.deepEqual(r.rows.map((x) => x.tag), ["match", "match", "match", "idle", "idle"]);
  assert.deepEqual(r.coldSlots, [1]); // one run of three slots: one cold start
});

test("the greedy plan loses by one restart, and the report says which slot to swap", () => {
  const r = siteReport(model, greedy, best);
  assert.equal(r.won, false);
  assert.equal(r.dTotal, 1);
  assert.deepEqual(r.coldSlots, [1, 5]); // slots 1-2 run together, slot 5 starts again
  assert.deepEqual(r.switchOff, [5]);
  assert.deepEqual(r.switchOn, [3]);
  assert.equal(r.starts, 2);
  assert.equal(r.bestStarts, 1);
  assert.equal(r.dElectricity, greedy.electricity - best.electricity);
});

test("a cold start is only a bay that is on after an off bay", () => {
  const r = siteReport(model, plans[0b01110], best); // slots 2, 3, 4
  assert.deepEqual(r.coldSlots, [2]);
  assert.equal(r.rows[1].cold, true);
  assert.equal(r.rows[2].cold, false);
});

test("bill difference in the report equals the difference between the plans", () => {
  for (const mine of plans.filter((p) => p.legal)) {
    const r = siteReport(model, mine, best);
    assert.equal(r.dTotal, mine.total - best.total);
    assert.equal(r.won, mine.total === best.total);
  }
});
