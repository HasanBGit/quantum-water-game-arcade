// Prints the cost table and the Grover numbers for each preset.
import {
  PRESETS,
  allPlans,
  cheapestPlans,
  greedyPlan,
  markedIndices,
  theta,
  successProbability,
  bestSteps,
  PLAN_COUNT,
} from "../src/math/index.js";

for (const preset of Object.values(PRESETS)) {
  const plans = allPlans(preset);
  const best = cheapestPlans(plans)[0];
  const greedy = greedyPlan(preset, plans);
  console.log(`\n=== ${preset.id} tariff: prices ${preset.prices.join(", ")} | restart ${preset.restart} | saving ${preset.adjacentSaving} | penalty ${preset.penalty} ===`);
  console.log("legal plans, cheapest first:");
  console.log("  slots      electricity  starts  total");
  for (const p of plans.filter((q) => q.legal).sort((a, b) => a.total - b.total || a.k - b.k)) {
    const tag = p === best ? "  <- cheapest" : p === greedy ? "  <- greedy" : "";
    console.log(`  ${p.slots.join(",").padEnd(9)}  ${String(p.electricity).padStart(11)}  ${String(p.starts).padStart(6)}  ${String(p.total).padStart(5)}${tag}`);
  }
  const all = plans.map((p) => p.total);
  console.log(`all 32 plans: min ${Math.min(...all)}, max ${Math.max(...all)}`);
  const bar = greedy.total;
  const M = markedIndices(plans, bar).length;
  console.log(`bar = greedy plan (${bar}): ${M} plan(s) cheaper, theta ${theta(M, PLAN_COUNT).toFixed(4)}, best steps ${bestSteps(M, PLAN_COUNT)}`);
  console.log("success % after 0..5 steps:", [0, 1, 2, 3, 4, 5].map((k) => (successProbability(M, PLAN_COUNT, k) * 100).toFixed(1)).join(", "));
}
