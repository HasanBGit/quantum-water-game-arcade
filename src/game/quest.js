// The quest log: a short list that checks itself off as the player talks, plays and finishes.
// It watches; it never changes the game. Every check uses numbers from src/math.
import "./dialogue.css";
import { PRESETS, allPlans, greedyPlan } from "../math/index.js";
import { billLines } from "./bill.js";

const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => (k in v ? v[k] : `{${k}}`));
const HELPERS = ["noura", "layla", "faisal", "omar", "james"];

export function createQuest({ stage, text, model = PRESETS.team, onComplete = () => {} }) {
  const greedyP = greedyPlan(model, allPlans(model));
  const greedy = greedyP.total;
  const greedyX = greedyP.x;
  const root = document.createElement("details");
  root.id = "quest";
  root.className = "quest";
  const summary = document.createElement("summary");
  const list = document.createElement("ul");
  root.append(summary, list);
  stage.append(root);

  // The path: try the obvious plan (the 3 cheapest slots, which is the wrong one), see why it costs more, find a
  // cheaper plan, then simulate and read the result. The other helpers are optional extras and are not counted.
  const task = (id, label, optional = false) => ({ id, label, optional, done: false });
  const tasks = [
    task("greedy", text.tasks.greedy),
    task("layla", text.tasks.layla),
    task("beat", fill(text.tasks.beat, { greedy })),
    task("simulate", text.tasks.simulate),
    task("result", text.tasks.result),
    task("noura", text.tasks.noura, true),
    task("faisal", text.tasks.faisal, true),
    task("omar", text.tasks.omar, true),
    task("james", text.tasks.james, true),
  ];
  const main = tasks.filter((x) => !x.optional);
  let announced = false;

  function render() {
    const done = main.filter((t) => t.done).length;
    const current = main.find((x) => !x.done);
    const line = document.createElement("span");
    line.className = "next";
    line.textContent = current ? fill(text.next, { task: current.label }) : text.complete;
    const count = document.createElement("small");
    count.textContent = fill(text.summary, { done, total: main.length });
    summary.replaceChildren(line, count);
    list.replaceChildren(
      ...tasks.map((t) => {
        const li = document.createElement("li");
        li.className = [t.done ? "done" : t === current ? "current" : "", t.optional ? "optional" : ""].join(" ").trim();
        li.textContent = t.label;
        if (t.optional) {
          const tag = document.createElement("em");
          tag.textContent = text.optional;
          li.append(" ", tag);
        }
        li.setAttribute("aria-label", `${t.label}${t.done ? ", done" : ""}`);
        return li;
      }),
    );
    root.classList.toggle("complete", done === main.length);
    if (done === main.length && !announced) {
      announced = true;
      onComplete(text.complete);
    }
  }
  const mark = (id) => {
    const t = tasks.find((x) => x.id === id);
    if (t && !t.done) {
      t.done = true;
      render();
    }
  };
  render();

  return {
    /** A helper's conversation reached a topic (not just the greeting). */
    talked: (helperId) => HELPERS.includes(helperId) && mark(helperId),
    /** The player's slots changed. */
    slots(slots) {
      const b = billLines(model, slots);
      if (b.chosen === b.required) {
        if (slots.every((v, i) => Boolean(v) === Boolean(greedyX[i]))) mark("greedy");
        if (b.total < greedy) mark("beat");
      }
    },
    /** The game moved to another screen. */
    phase(phase) {
      root.hidden = phase !== "play" && phase !== "around";
      if (phase === "simulate") mark("simulate");
      if (phase === "result") mark("result");
    },
    /** The id of the first task not done yet, or null when all are. */
    next: () => (main.find((x) => !x.done) || {}).id || null,
    /** The slots (1 to 5) the obvious plan switches on. */
    greedySlots: () => greedyX.map((v, i) => (v ? i + 1 : 0)).filter(Boolean),
    done: () => tasks.filter((t) => t.done).map((t) => t.id),
    total: main.length,
    debug: () => ({ done: tasks.filter((t) => t.done).map((t) => t.id), total: tasks.length, hidden: root.hidden }),
  };
}
