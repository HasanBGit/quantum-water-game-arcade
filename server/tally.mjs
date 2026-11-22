// The room's votes, turned into numbers. No network, no browser: easy to test.
import { PRESETS, allPlans, cheapestPlans, greedyPlan, indexFromPlan } from "../src/math/index.js";

const FLAGS = 5;

/** Accepts { voter, slots: [0|1 x5] } and returns { voter, x } or null. */
export function validVote(body) {
  if (!body || typeof body !== "object") return null;
  const voter = typeof body.voter === "string" ? body.voter.trim().slice(0, 64) : "";
  if (!voter) return null;
  const slots = body.slots;
  if (!Array.isArray(slots) || slots.length !== FLAGS) return null;
  if (!slots.every((v) => v === 0 || v === 1)) return null;
  return { voter, x: slots.slice() };
}

/** What the big screen shows. `votes` is a Map of voter id to { x }. */
export function summarize(votes, model = PRESETS.team) {
  const plans = allPlans(model);
  const best = cheapestPlans(plans)[0];
  const greedy = greedyPlan(model, plans);
  const bills = new Map();
  for (const p of plans) if (p.legal) bills.set(p.total, 0);
  let legal = 0;
  let foundBest = 0;
  let pickedObvious = 0;
  for (const v of votes.values()) {
    const p = plans[indexFromPlan(v.x)];
    if (!p.legal) continue;
    legal++;
    bills.set(p.total, (bills.get(p.total) ?? 0) + 1);
    if (p.k === best.k) foundBest++;
    if (p.k === greedy.k) pickedObvious++;
  }
  return {
    voters: votes.size,
    legal,
    foundBest,
    pickedObvious,
    best: { bill: best.total, slots: best.slots },
    obvious: { bill: greedy.total, slots: greedy.slots },
    bills: [...bills.entries()].sort((a, b) => a[0] - b[0]).map(([bill, count]) => ({ bill, count })),
  };
}
