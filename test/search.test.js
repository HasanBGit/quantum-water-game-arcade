import { test } from "node:test";
import assert from "node:assert/strict";
import { PRESETS, allPlans, planRound, measure, mean, cheapestPlans } from "../src/math/index.js";

const plans = allPlans(PRESETS.team);

test("bar 19 marks one plan, 4 steps, 99.9 percent", () => {
  const r = planRound(plans, 19);
  assert.equal(r.marked.length, 1);
  assert.equal(r.steps, 4);
  assert.equal(r.history.length, 5);
  assert.ok(Math.abs(r.history[4].pMarked - 0.999) < 0.001);
});

test("a bar nobody beats gives an empty round (the search stops)", () => {
  const r = planRound(plans, 18);
  assert.equal(r.empty, true);
  assert.equal(r.marked.length, 0);
});

test("measure follows the amplitudes", () => {
  const amps = [0, 0, 1, 0];
  assert.equal(measure(amps, () => 0.5), 2);
  assert.equal(measure([0.6, 0.8], () => 0.9), 1); // 0.36 then 0.64: 0.9 falls in the second
  assert.equal(measure([0.6, 0.8], () => 0.2), 0);
});

test("reflection keeps the mean line: marked flip, mean rises", () => {
  const r = planRound(plans, 25);
  const afterOracle = r.history[1].afterOracle;
  assert.ok(mean(afterOracle) < mean(r.history[0].amplitudes));
});

test("repeating measure and lowering the bar always ends at the cheapest plan", () => {
  for (const start of [90, 51, 30, 25, 21]) {
    let bar = start;
    for (let guard = 0; guard < 40; guard++) {
      const round = planRound(plans, bar);
      if (round.empty) break;
      const last = round.history[round.history.length - 1].amplitudes;
      let k = measure(last);
      let tries = 0;
      while (!(plans[k].total < bar) && tries++ < 200) k = measure(last);
      bar = plans[k].total;
    }
    assert.equal(bar, cheapestPlans(plans)[0].total);
  }
});
