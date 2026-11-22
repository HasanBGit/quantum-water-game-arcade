// One round of the quantum-style search, for the Simulate screen. Plain code, no browser.
// A round fixes a bar (the cost to beat), runs the best number of Grover steps, then measures.
import { bestSteps, groverByHand, markedIndices } from "./grover.js";

/** Everything one round needs: who is marked, how many steps, the amplitudes after every step. */
export function planRound(plans, bar) {
  const totals = plans.map((p) => p.total);
  const marked = markedIndices(plans, bar);
  const steps = bestSteps(marked.length, plans.length);
  if (steps === null) return { bar, marked, steps: 0, history: [], empty: true };
  return { bar, marked, steps, history: groverByHand(totals, bar, steps).history, empty: false };
}

/** Pick a plan index with chance amplitude^2. `rand` returns a number in [0, 1). */
export function measure(amplitudes, rand = Math.random) {
  let r = rand();
  for (let i = 0; i < amplitudes.length; i++) {
    r -= amplitudes[i] ** 2;
    if (r < 0) return i;
  }
  return amplitudes.length - 1;
}

/** The mean of a list of numbers (the line the reflection mirrors about). */
export const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
