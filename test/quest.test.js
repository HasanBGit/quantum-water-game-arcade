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

test("two wrong tries in a row send the player back to the open task; a right move clears it", () => {
  const q = createQuestState(model);
  q.slots([0, 0, 1, 0, 0]); // slot 3 is not one of the 3 cheapest
  assert.equal(q.offTrack(), null);
  q.slots([0, 0, 1, 1, 0]); // slot 4 is not either
  assert.equal(q.offTrack(), "greedy");
  q.slots([0, 0, 1, 0, 0]); // switching a wrong slot off is a right move
  assert.equal(q.offTrack(), null);
});

test("two full plans that are not cheaper than the obvious plan send the player back to the cheaper-plan task", () => {
  const q = createQuestState(model);
  q.slots(GREEDY);
  q.talked("layla");
  q.slots([1, 0, 1, 0, 1]); // islands: dearer
  assert.equal(q.offTrack(), null);
  q.slots([0, 1, 0, 1, 1]);
  assert.equal(q.offTrack(), "beat");
  q.slots(BEST);
  assert.equal(q.offTrack(), null);
});

test("asking Lina before the obvious plan, or pressing Simulate too early, counts as wrong steps", () => {
  const q = createQuestState(model);
  q.talked("layla");
  assert.equal(q.offTrack(), null);
  q.phase("simulate");
  assert.equal(q.offTrack(), "greedy");
  q.phase("play");
  assert.equal(q.offTrack(), null);
  q.talked("noura"); // optional helpers are never wrong
  assert.equal(q.offTrack(), null);
});
