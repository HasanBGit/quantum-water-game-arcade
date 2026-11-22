// The bill for a set of on/off slots, as separate lines, so the screen can show every number.
// All arithmetic comes from src/math (the same code the maths page uses).
import { evaluate, chosenSlots, REQUIRED } from "../math/index.js";

export function billLines(model, x) {
  const e = evaluate(model, x);
  const slots = chosenSlots(x);
  return {
    slots,
    prices: slots.map((s) => model.prices[s - 1]),
    electricity: e.electricity,
    chosen: e.chosen,
    starts: e.starts,
    restartEach: model.restart,
    restartCost: e.restartCost,
    saving: e.saving,
    penaltyWeight: model.penalty,
    penalty: e.penalty,
    total: e.total,
    required: REQUIRED,
  };
}

/** Slots (counted from 1) that must start cold: on, with the previous slot off. The pump is off before slot 1. */
export function startSlots(x) {
  return x.flatMap((flag, t) => (flag && (t === 0 || !x[t - 1]) ? [t + 1] : []));
}

/** Slots that became a cold start when the plan changed from `before` to `after`. */
export function newStarts(before, after) {
  const was = new Set(startSlots(before));
  return startSlots(after).filter((s) => !was.has(s));
}

/** Which of the five states the bill panel is in. */
export function billState(lines) {
  if (lines.chosen === 0) return "empty";
  if (lines.chosen < lines.required) return "partial";
  if (lines.chosen > lines.required) return "over";
  return "ready";
}
