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
  const MISS_LIMIT = 2; // this many wrong tries in a row, with no right move between, sends the player back to the tracker
  let misses = 0;
  let prev = [0, 0, 0, 0, 0];
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
    talked(helperId) {
      if (!HELPERS.includes(helperId)) return false;
      // asking Lina "why" before the obvious plan was tried is a wrong step; the other helpers are always fine
      if (NEEDS_GREEDY.has(helperId) && !done.has("greedy")) {
        misses += 1;
        return false;
      }
      return mark(helperId);
    },
    /** The open task the player has missed {MISS_LIMIT} times in a row, or null. Only the two plan tasks can be missed. */
    offTrack: () => (misses >= MISS_LIMIT ? MAIN.find((id) => !done.has(id)) : null),
    slots(slots) {
      const b = billLines(model, slots);
      let changed = false;
      const open = MAIN.find((id) => !done.has(id));
      const was = prev;
      prev = slots.map((v) => (v ? 1 : 0));
      const flipped = prev.map((v, i) => (v !== was[i] ? i : -1)).filter((i) => i >= 0);
      if (open === "greedy") {
        // wrong: a plan slot switched off or an expensive slot switched on; right: the opposite
        const wrong = flipped.some((i) => (prev[i] ? !greedyP.x[i] : Boolean(greedyP.x[i])));
        const right = flipped.some((i) => (prev[i] ? Boolean(greedyP.x[i]) : !greedyP.x[i]));
        if (wrong) misses += 1;
        else if (right) misses = 0;
      } else if (open === "layla") {
        // nothing to judge in the plan while the next step is to talk
      } else if (open === "beat") {
        // wrong: a full 3-slot plan that costs the obvious plan's bill or more
        if (flipped.length && b.chosen === b.required && b.total >= greedyP.total) misses += 1;
        else if (b.chosen === b.required && b.total < greedyP.total) misses = 0;
      } else misses = 0;
      if (b.chosen === b.required) {
        if (slots.every((v, i) => Boolean(v) === Boolean(greedyP.x[i]))) changed = mark("greedy") || changed;
        if (b.total < greedyP.total) changed = mark("beat") || changed;
      }
      return changed;
    },
    phase(phase) {
      let changed = false;
      // pressing Simulate while an earlier step is still open is a wrong step
      if (phase === "simulate" && !done.has("simulate") && MAIN.find((id) => !done.has(id)) !== "simulate") misses += 1;
      else if (phase === "play") misses = 0;
      if (phase === "simulate") changed = mark("simulate");
      if (phase === "result") changed = mark("result") || changed;
      return changed;
    },
  };
}
