// The pump-scheduling problem, as plain numbers. No 3D, no browser.
//
// A plan is five on/off flags x[0..4]. Bit t of the plan index k is slot t,
// so k = 7 means slots 1, 2, 3 (counting from 1 for display).
//
// cost(x) = sum(price_t * x_t)
//         + restart * starts(x)
//         - adjacentSaving * adjacentPairs(x)
//         + penalty * (chosen(x) - 3)^2
// starts(x) = chosen(x) - adjacentPairs(x)

export const N_SLOTS = 5;
export const REQUIRED = 3;
export const PLAN_COUNT = 2 ** N_SLOTS;

export const PRESETS = {
  // Team document: restart cost 5, penalty 10.
  team: {
    id: "team",
    prices: [2, 4, 7, 6, 3],
    restart: 5,
    adjacentSaving: 0,
    penalty: 10,
  },
  // Notebook 09: back-to-back slots save 1, penalty 4. Same formula with
  // restart 0 and adjacentSaving 1.
  notebook: {
    id: "notebook",
    prices: [4, 2, 1, 2, 5],
    restart: 0,
    adjacentSaving: 1,
    penalty: 4,
  },
};

export function planFromIndex(k) {
  return Array.from({ length: N_SLOTS }, (_, t) => (k >> t) & 1);
}

export function indexFromPlan(x) {
  return x.reduce((k, flag, t) => k | (flag << t), 0);
}

/** Slot numbers counted from 1, for display. */
export function chosenSlots(x) {
  return x.flatMap((flag, t) => (flag ? [t + 1] : []));
}

export function evaluate(model, x) {
  const chosen = x.reduce((a, b) => a + b, 0);
  let adjacent = 0;
  for (let t = 0; t < N_SLOTS - 1; t++) if (x[t] && x[t + 1]) adjacent++;
  const starts = chosen - adjacent;
  const electricity = x.reduce((sum, flag, t) => sum + flag * model.prices[t], 0);
  const restartCost = model.restart * starts;
  const saving = model.adjacentSaving * adjacent;
  const penalty = model.penalty * (chosen - REQUIRED) ** 2;
  return {
    chosen,
    adjacent,
    starts,
    electricity,
    restartCost,
    saving,
    penalty,
    total: electricity + restartCost - saving + penalty,
    legal: chosen === REQUIRED,
  };
}

/** All 32 plans, in index order. */
export function allPlans(model) {
  return Array.from({ length: PLAN_COUNT }, (_, k) => {
    const x = planFromIndex(k);
    return { k, x, slots: chosenSlots(x), ...evaluate(model, x) };
  });
}

/** Cheapest plan(s) over all 32 (ties are all returned). */
export function cheapestPlans(plans) {
  const min = Math.min(...plans.map((p) => p.total));
  return plans.filter((p) => p.total === min);
}

/** The intuitive pick: the three cheapest slots by price (ties: earlier slot). */
export function greedyPlan(model, plans) {
  const order = model.prices
    .map((price, t) => ({ price, t }))
    .sort((a, b) => a.price - b.price || a.t - b.t)
    .slice(0, REQUIRED);
  const x = Array(N_SLOTS).fill(0);
  for (const { t } of order) x[t] = 1;
  return plans[indexFromPlan(x)];
}
