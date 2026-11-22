import test from "node:test";
import assert from "node:assert/strict";
import { PRESETS, allPlans, cheapestPlans, greedyPlan } from "../src/math/index.js";
import { createQuestState } from "../src/game/questState.js";

const model = PRESETS.team;
const plans = allPlans(model);
const GREEDY = greedyPlan(model, plans).x; // slots 1, 2, 5 = 19, the obvious plan
const BEST = cheapestPlans(plans)[0].x; // slots 1, 2, 3 = 18

test("the path starts with the obvious (wrong) plan", () => {
  const q = createQuestState(model);
  assert.equal(q.next(), "greedy");
  assert.deepEqual(q.greedySlots(), [1, 2, 5]);
});

test("the path goes: obvious plan, Layla, cheaper plan, simulate, result", () => {
  const q = createQuestState(model);
  const seen = [q.next()];
  q.slots(GREEDY);
  seen.push(q.next());
  q.talked("layla");
  seen.push(q.next());
  q.slots(BEST);
  seen.push(q.next());
  q.phase("simulate");
  seen.push(q.next());
  q.phase("result");
  seen.push(q.next());
  assert.deepEqual(seen, ["greedy", "layla", "beat", "simulate", "result", null]);
});

test("finding the best plan first counts, but the tracker still asks for the obvious plan and Layla", () => {
  const q = createQuestState(model);
  q.slots(BEST);
  q.talked("layla");
  assert.equal(q.isDone("beat"), true); // real progress is counted
  assert.equal(q.isDone("layla"), false); // Layla's "why" needs the obvious plan first
  assert.equal(q.next(), "greedy");
  q.slots(GREEDY);
  assert.equal(q.next(), "layla");
  q.talked("layla");
  assert.equal(q.next(), "simulate");
});

test("choosing a good plan and simulating counts both, even without the obvious plan", () => {
  const q = createQuestState(model);
  q.slots(BEST);
  q.phase("simulate");
  assert.deepEqual(q.doneIds(), ["beat", "simulate"]);
});

test("an illegal plan (5 slots on) ticks nothing, and the other helpers never block the path", () => {
  const q = createQuestState(model);
  q.slots([1, 1, 1, 1, 1]);
  assert.deepEqual(q.doneIds(), []);
  q.talked("james");
  q.talked("noura");
  assert.equal(q.next(), "greedy");
  assert.deepEqual(q.doneIds(), ["noura", "james"]);
});

test("the coach step follows the quest: 1 obvious plan, 2 Layla and cheaper plan, 3 simulate and result", () => {
  const q = createQuestState(model);
  const steps = [q.step()];
  q.slots(GREEDY);
  steps.push(q.step());
  q.talked("layla");
  steps.push(q.step());
  q.slots(BEST);
  steps.push(q.step());
  q.phase("simulate");
  steps.push(q.step());
  q.phase("result");
  steps.push(q.step());
  assert.deepEqual(steps, [1, 2, 2, 3, 3, 3]);
});

test("simulating without asking Layla still moves the coach to step 3", () => {
  const q = createQuestState(model);
  q.slots(GREEDY);
  q.slots(BEST);
  q.phase("simulate");
  assert.equal(q.isDone("layla"), false);
  assert.equal(q.step(), 3);
});
