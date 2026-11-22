import { test } from "node:test";
import assert from "node:assert/strict";
import { PRESETS, allPlans, planFromIndex, PLAN_COUNT } from "../src/math/index.js";
import { billLines, startSlots, newStarts, billState } from "../src/game/bill.js";

test("the bill matches the cost table for all 32 plans, line by line", () => {
  for (const preset of Object.values(PRESETS)) {
    const plans = allPlans(preset);
    for (let k = 0; k < PLAN_COUNT; k++) {
      const b = billLines(preset, planFromIndex(k));
      const p = plans[k];
      assert.equal(b.total, p.total, `${preset.id} plan ${k} total`);
      assert.equal(b.electricity, p.electricity, `${preset.id} plan ${k} electricity`);
      assert.equal(b.starts, p.starts, `${preset.id} plan ${k} starts`);
      assert.equal(b.electricity, b.prices.reduce((a, c) => a + c, 0), `${preset.id} plan ${k} price terms add up`);
      assert.equal(b.total, b.electricity + b.restartCost - b.saving + b.penalty, `${preset.id} plan ${k} lines add up`);
      assert.equal(b.restartCost, b.starts * preset.restart);
      assert.equal(b.penalty, preset.penalty * (b.chosen - 3) ** 2);
    }
  }
});

test("team tariff examples from the spec: empty plan costs the penalty, best plan costs 18", () => {
  assert.equal(billLines(PRESETS.team, [0, 0, 0, 0, 0]).total, 90);
  const best = billLines(PRESETS.team, [1, 1, 1, 0, 0]);
  assert.equal(best.total, 18);
  assert.deepEqual(best.prices, [2, 4, 7]);
  assert.equal(best.starts, 1);
  const greedy = billLines(PRESETS.team, [1, 1, 0, 0, 1]);
  assert.equal(greedy.total, 19);
  assert.equal(greedy.starts, 2);
});

test("cold starts: a slot starts cold when it is on and the previous slot is off", () => {
  assert.deepEqual(startSlots([1, 1, 1, 0, 0]), [1]);
  assert.deepEqual(startSlots([1, 1, 0, 0, 1]), [1, 5]);
  assert.deepEqual(startSlots([0, 1, 0, 1, 0]), [2, 4]);
  assert.deepEqual(startSlots([0, 0, 0, 0, 0]), []);
});

test("newStarts lists the slots that just became cold starts", () => {
  assert.deepEqual(newStarts([0, 0, 0, 0, 0], [1, 0, 0, 0, 0]), [1]);
  assert.deepEqual(newStarts([1, 1, 0, 0, 0], [1, 1, 1, 0, 0]), []); // joins the run: no new start
  assert.deepEqual(newStarts([1, 1, 1, 0, 0], [1, 0, 1, 0, 0]), [3]); // switching slot 2 off makes slot 3 start cold
  assert.deepEqual(newStarts([1, 0, 1, 0, 0], [1, 1, 1, 0, 0]), []);
});

test("bill states: empty, partial, ready, over", () => {
  const s = (x) => billState(billLines(PRESETS.team, x));
  assert.equal(s([0, 0, 0, 0, 0]), "empty");
  assert.equal(s([1, 0, 0, 0, 0]), "partial");
  assert.equal(s([1, 1, 0, 0, 0]), "partial");
  assert.equal(s([1, 1, 1, 0, 0]), "ready");
  assert.equal(s([1, 1, 1, 1, 0]), "over");
});
