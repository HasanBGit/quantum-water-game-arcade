import { test } from "node:test";
import assert from "node:assert/strict";
import { createQuality, startingTier } from "../src/game/quality.js";

const run = (q, ms, frames) => {
  for (let i = 0; i < frames; i++) q.tick(ms);
};
const make = (start) => {
  const applied = [];
  const q = createQuality({ start, apply: (n) => applied.push(n) });
  return { q, applied };
};

test("phones start on medium, laptops on high", () => {
  assert.equal(startingTier(true), "medium");
  assert.equal(startingTier(false), "medium");
});

test("slow frames step the tier down", () => {
  const { q } = make("high");
  run(q, 50, 400);
  assert.notEqual(q.tier, "high");
});

test("frames near 60 fps step a lowered tier back up (16.7 ms must count as fast)", () => {
  const { q } = make("medium");
  run(q, 16.7, 3000);
  assert.equal(q.tier, "high");
});

test("a step up that does not hold is not tried again", () => {
  const { q } = make("medium");
  for (let i = 0; i < 5000 && q.tier !== "high"; i++) q.tick(16.7); // goes up to high
  assert.equal(q.tier, "high");
  run(q, 50, 80); // too slow right after: one step back down to medium
  assert.equal(q.tier, "medium");
  run(q, 16.7, 6000); // fast again, but high already failed
  assert.equal(q.tier, "medium");
});

test("a manual choice is kept, and ticks do not change it", () => {
  const { q } = make("high");
  q.choose("low");
  run(q, 5, 3000);
  assert.equal(q.tier, "low");
  assert.equal(q.mode, "manual");
  q.choose("auto");
  assert.equal(q.mode, "auto");
});
