// The order of the quest, with no screen code so it can be tested. The path is:
//   1 try the obvious plan (the 3 cheapest slots; it is the wrong one), 2 ask Layla why it costs more,
//   3 find a cheaper plan, 4 simulate, 5 see the result. The other helpers are optional and never block anything.
// Asking Layla only counts once the obvious plan has been tried. Everything else ticks when the player does it,
// in any order, so the count always shows real progress; next() still points at the first task left.
import { PRESETS, allPlans, greedyPlan } from "../math/index.js";
import { billLines } from "./bill.js";

export const HELPERS = ["noura", "layla", "faisal", "omar", "james"];
const NEEDS_GREEDY = new Set(["layla"]); // asking why the obvious plan costs more only makes sense after seeing it

export function createQuestState(model = PRESETS.team) {
  const greedyP = greedyPlan(model, allPlans(model));
  const done = new Set();
  const MAIN = ["greedy", "layla", "beat", "simulate", "result"];
  const OPTIONAL = ["noura", "faisal", "omar", "james"];

  /** Returns true if this call newly ticked the task. */
  function mark(id) {
    if (done.has(id)) return false;
    if (NEEDS_GREEDY.has(id) && !done.has("greedy")) return false;
    done.add(id);
    return true;
  }

  return {
    greedyTotal: greedyP.total,
    main: MAIN,
    optional: OPTIONAL,
    isDone: (id) => done.has(id),
    doneIds: () => [...MAIN, ...OPTIONAL].filter((id) => done.has(id)),
    /** The first main task not done yet, or null. */
    next: () => MAIN.find((id) => !done.has(id)) || null,
    /** Which of the coach's three steps the quest is in: 1 Choose (obvious plan), 2 Improve (Layla, cheaper plan), 3 Simulate. */
    step() {
      if (done.has("simulate") || done.has("result")) return 3; // simulating skips ahead even if a helper was not asked
      const n = MAIN.find((id) => !done.has(id));
      return n === "greedy" ? 1 : n === "layla" || n === "beat" ? 2 : 3;
    },
    /** The slots (1 to 5) the obvious plan switches on. */
    greedySlots: () => greedyP.x.map((v, i) => (v ? i + 1 : 0)).filter(Boolean),
    talked: (helperId) => HELPERS.includes(helperId) && mark(helperId),
    slots(slots) {
      const b = billLines(model, slots);
      let changed = false;
      if (b.chosen === b.required) {
        if (slots.every((v, i) => Boolean(v) === Boolean(greedyP.x[i]))) changed = mark("greedy") || changed;
        if (b.total < greedyP.total) changed = mark("beat") || changed;
      }
      return changed;
    },
    phase(phase) {
      let changed = false;
      if (phase === "simulate") changed = mark("simulate");
      if (phase === "result") changed = mark("result") || changed;
      return changed;
    },
  };
}
