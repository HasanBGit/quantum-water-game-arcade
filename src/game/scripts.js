// Conversation helpers that have no browser in them, so they can be tested.
// The conversations themselves are text in src/strings.js (so another language can replace them).
// Every number a helper says is computed here from src/math; none is typed into the text.
import {
  PLAN_COUNT,
  allPlans,
  greedyPlan,
  plansForSlots,
  sqrtPlansForSlots,
  formatBig,
  successProbability,
} from "../math/index.js";
import { billLines } from "./bill.js";

const pct = (p) => `${(p * 100).toFixed(1)}%`;
export const fill = (s, vals) => s.replace(/\{(\w+)\}/g, (_, k) => (k in vals ? vals[k] : `{${k}}`));

/** Slots to switch on for the demonstrations. */
export const DEMO = { block: [0, 0, 1, 1, 1], islands: [1, 0, 1, 0, 1] };

/** Everything the conversation text can name. */
export function dialogueVars(model, slots) {
  const byPrice = model.prices.map((p, i) => i).sort((a, b) => model.prices[a] - model.prices[b] || a - b);
  const cheap = byPrice.slice(0, 3).map((i) => i + 1).sort((a, b) => a - b);
  const top = byPrice[byPrice.length - 1];
  const plans = allPlans(model);
  const block = billLines(model, DEMO.block);
  const islands = billLines(model, DEMO.islands);
  return {
    on: slots.reduce((a, b) => a + (b ? 1 : 0), 0),
    restart: model.restart,
    penalty: model.penalty,
    cheapest: byPrice[0] + 1,
    pmin: model.prices[byPrice[0]],
    priciest: top + 1,
    pmax: model.prices[top],
    cheap: `${cheap.slice(0, -1).join(", ")} and ${cheap[cheap.length - 1]}`,
    n_plans: PLAN_COUNT,
    b24: formatBig(plansForSlots(24)),
    b240: formatBig(plansForSlots(240)),
    s240: formatBig(sqrtPlansForSlots(240)),
    p4: pct(successProbability(1, PLAN_COUNT, 4)),
    p5: pct(successProbability(1, PLAN_COUNT, 5)),
    greedyBill: greedyPlan(model, plans).total,
    blockElec: block.electricity,
    blockBill: block.total,
    islandElec: islands.electricity,
    islandStarts: islands.starts,
    islandBill: islands.total,
  };
}

/**
 * Check that a set of conversations is sound. Returns a list of problems (empty if fine).
 * `vals` are the variables from dialogueVars.
 */
export function checkScripts(scripts, vals) {
  const problems = [];
  for (const [who, script] of Object.entries(scripts)) {
    const ids = Object.keys(script.nodes);
    if (!script.nodes[script.start]) problems.push(`${who}: start "${script.start}" does not exist`);
    const reached = new Set();
    const queue = [script.start];
    while (queue.length) {
      const id = queue.pop();
      if (reached.has(id) || !script.nodes[id]) continue;
      reached.add(id);
      const node = script.nodes[id];
      if (node.next) queue.push(node.next);
      for (const c of node.choices ?? []) if (c.next) queue.push(c.next);
    }
    for (const id of ids) {
      const node = script.nodes[id];
      const where = `${who}.${id}`;
      if (!reached.has(id)) problems.push(`${where}: cannot be reached`);
      if (typeof node.say !== "string" || !node.say.trim()) problems.push(`${where}: no text`);
      else {
        const said = fill(node.say, vals);
        if (/\{\w+\}/.test(said)) problems.push(`${where}: unresolved variable in "${said}"`);
        if (said.length > 230) problems.push(`${where}: ${said.length} characters is too long for the text box`);
      }
      const hasChoices = Array.isArray(node.choices) && node.choices.length > 0;
      if (hasChoices && node.next) problems.push(`${where}: has both choices and next`);
      if (!hasChoices && !node.next && !node.end) problems.push(`${where}: dead end (no choices, next or end)`);
      if (hasChoices) {
        if (node.choices.length < 2 || node.choices.length > 4) problems.push(`${where}: ${node.choices.length} choices (use 2 to 4)`);
        for (const c of node.choices) {
          if (!c.label || c.label.split(/\s+/).length > 15) problems.push(`${where}: choice "${c.label}" is empty or over 15 words`);
          if (!c.end && !script.nodes[c.next]) problems.push(`${where}: choice "${c.label}" goes to a missing node "${c.next}"`);
        }
      }
      if (node.next && !script.nodes[node.next]) problems.push(`${where}: next "${node.next}" is missing`);
    }
  }
  return problems;
}
