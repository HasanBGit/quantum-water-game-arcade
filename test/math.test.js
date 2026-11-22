import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PRESETS,
  PLAN_COUNT,
  allPlans,
  cheapestPlans,
  greedyPlan,
  indexFromPlan,
  planFromIndex,
  markedIndices,
  theta,
  successProbability,
  bestSteps,
  groverByHand,
  plansForSlots,
  sqrtPlansForSlots,
  formatBig,
} from "../src/math/index.js";

const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} is not within ${tol} of ${b}`);
const key = (p) => p.slots.join(",");

test("plan index and flags convert both ways", () => {
  for (let k = 0; k < PLAN_COUNT; k++) assert.equal(indexFromPlan(planFromIndex(k)), k);
  assert.deepEqual(planFromIndex(7), [1, 1, 1, 0, 0]); // slots 1, 2, 3
});

test("team tariff: the ten legal plans match the team document", () => {
  const plans = allPlans(PRESETS.team);
  assert.equal(plans.length, 32);
  // [slots, electricity, starts, total]
  const doc = [
    ["1,2,3", 13, 1, 18],
    ["1,2,5", 9, 2, 19],
    ["1,4,5", 11, 2, 21],
    ["3,4,5", 16, 1, 21],
    ["1,2,4", 12, 2, 22],
    ["2,3,4", 17, 1, 22],
    ["2,4,5", 13, 2, 23],
    ["2,3,5", 14, 2, 24],
    ["1,3,4", 15, 2, 25],
    ["1,3,5", 12, 3, 27],
  ];
  const legal = plans.filter((p) => p.legal);
  assert.equal(legal.length, 10);
  for (const [slots, electricity, starts, total] of doc) {
    const p = legal.find((q) => key(q) === slots);
    assert.ok(p, `plan ${slots} missing`);
    assert.equal(p.electricity, electricity, `${slots} electricity`);
    assert.equal(p.starts, starts, `${slots} starts`);
    assert.equal(p.total, total, `${slots} total`);
  }
});

test("team tariff: optimum is 18, greedy is 19, nothing illegal beats the optimum", () => {
  const plans = allPlans(PRESETS.team);
  const best = cheapestPlans(plans);
  assert.equal(best.length, 1);
  assert.equal(key(best[0]), "1,2,3");
  assert.equal(best[0].total, 18);
  assert.ok(best[0].legal);
  const greedy = greedyPlan(PRESETS.team, plans);
  assert.equal(key(greedy), "1,2,5");
  assert.equal(greedy.total, 19);
});

test("team tariff: bar 19 marks one plan, and the success curve matches the document", () => {
  const plans = allPlans(PRESETS.team);
  const marked = markedIndices(plans, 19);
  assert.equal(marked.length, 1);
  near(theta(1, 32), 0.1777, 0.0001);
  const pct = [0, 1, 2, 3, 4, 5].map((k) => successProbability(1, 32, k) * 100);
  const expected = [3.1, 25.8, 60.2, 89.7, 99.9, 86.0];
  pct.forEach((v, i) => near(v, expected[i], 0.06));
  assert.equal(bestSteps(1, 32), 4);
});

test("team tariff: when the bar is the optimum, nothing is marked and the search stops", () => {
  const plans = allPlans(PRESETS.team);
  assert.equal(markedIndices(plans, 18).length, 0);
  assert.equal(successProbability(0, 32, 3), 0);
  assert.equal(bestSteps(0, 32), null);
});

test("notebook tariff: costs run 3 to 36, ten legal plans, optimum 3, greedy is already optimal", () => {
  const plans = allPlans(PRESETS.notebook);
  const totals = plans.map((p) => p.total);
  assert.equal(Math.min(...totals), 3);
  assert.equal(Math.max(...totals), 36);
  assert.equal(plans.filter((p) => p.legal).length, 10);
  const best = cheapestPlans(plans);
  assert.equal(best.length, 1);
  assert.deepEqual(best[0].x, [0, 1, 1, 1, 0]);
  assert.equal(greedyPlan(PRESETS.notebook, plans).total, 3);
  // Worked examples from notebook section 3.1.
  assert.equal(plans[indexFromPlan([0, 1, 1, 1, 0])].total, 3);
  assert.equal(plans[indexFromPlan([0, 0, 0, 0, 0])].total, 36);
  assert.equal(plans[indexFromPlan([0, 1, 1, 0, 0])].total, 6);
});

test("notebook tariff: bar 6 and bar 5 match the notebook text", () => {
  const plans = allPlans(PRESETS.notebook);
  assert.equal(markedIndices(plans, 6).length, 2);
  near(theta(2, 32), 0.253, 0.001);
  near(successProbability(2, 32, 1), 0.473, 0.001);
  near(successProbability(2, 32, 3), 0.961, 0.001);
  near(successProbability(2, 32, 4), 0.582, 0.001);
  assert.equal(bestSteps(2, 32), 3);
  assert.equal(markedIndices(plans, 5).length, 1);
  assert.equal(bestSteps(1, 32), 4);
});

test("by-hand amplitudes agree with the closed formula and stay normalised", () => {
  for (const preset of Object.values(PRESETS)) {
    const totals = allPlans(preset).map((p) => p.total);
    for (const bar of [5, 6, 19, 21, 25]) {
      const { markedCount, history } = groverByHand(totals, bar, 6);
      for (const h of history) {
        const norm = h.amplitudes.reduce((s, v) => s + v * v, 0);
        near(norm, 1, 1e-9);
        near(h.pMarked, successProbability(markedCount, 32, h.step), 1e-9);
      }
    }
  }
});

test("four plans, one marked: one step finds it with certainty (notebook 3.3)", () => {
  const { history } = groverByHand([5, 5, 5, 0], 1, 1);
  history[1].amplitudes.forEach((v, i) => near(v, i === 3 ? 1 : 0, 1e-12));
});

test("plan counts grow as 2^n and are shown exactly", () => {
  assert.equal(plansForSlots(5), 32n);
  assert.equal(plansForSlots(24), 16777216n);
  assert.equal(formatBig(plansForSlots(24)), "16,777,216");
  assert.equal(formatBig(plansForSlots(240)), "1.77 × 10^72");
  assert.equal(formatBig(sqrtPlansForSlots(240)), "1.33 × 10^36");
  assert.equal(sqrtPlansForSlots(5), null);
});
