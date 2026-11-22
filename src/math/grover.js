// Grover search on the 32 plans, as plain arithmetic (notebook equations 3-8).
// "Marked" means: cheaper than the bar y.

/** Indices of plans cheaper than the bar. */
export function markedIndices(plans, bar) {
  return plans.filter((p) => p.total < bar).map((p) => p.k);
}

/** sin(theta) = sqrt(M / N)   (equation 7) */
export function theta(M, N) {
  return Math.asin(Math.sqrt(M / N));
}

/** P(marked after k steps) = sin^2((2k + 1) * theta)   (equation 7) */
export function successProbability(M, N, k) {
  if (M === 0) return 0;
  return Math.sin((2 * k + 1) * theta(M, N)) ** 2;
}

/** Best step count, about pi / (4 theta) - 1/2   (equation 8). Null if nothing is marked. */
export function bestSteps(M, N) {
  if (M === 0) return null;
  return Math.max(0, Math.round(Math.PI / (4 * theta(M, N)) - 0.5));
}

/**
 * Amplitudes after each Grover step, by hand: flip the sign of marked plans,
 * then mirror every amplitude about the average (a -> 2*mean - a).
 * history[0] is the equal start; history[s] is after s full steps.
 */
export function groverByHand(totals, bar, steps) {
  const N = totals.length;
  const marked = totals.map((c) => c < bar);
  let a = Array(N).fill(1 / Math.sqrt(N));
  const snapshot = (step, afterOracle) => ({
    step,
    amplitudes: a.slice(),
    afterOracle,
    pMarked: a.reduce((sum, v, i) => sum + (marked[i] ? v * v : 0), 0),
  });
  const history = [snapshot(0, null)];
  for (let s = 1; s <= steps; s++) {
    a = a.map((v, i) => (marked[i] ? -v : v));
    const afterOracle = a.slice();
    const mean = a.reduce((x, y) => x + y, 0) / N;
    a = a.map((v) => 2 * mean - v);
    history.push(snapshot(s, afterOracle));
  }
  return { markedCount: marked.filter(Boolean).length, history };
}
