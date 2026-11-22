// The quest log: a short list that checks itself off as the player talks, plays and finishes.
// It watches; it never changes the game. Every check uses numbers from src/math.
import "./dialogue.css";
import { PRESETS, allPlans, greedyPlan } from "../math/index.js";
import { billLines } from "./bill.js";

const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => (k in v ? v[k] : `{${k}}`));
const HELPERS = ["noura", "layla", "faisal", "omar", "james"];

export function createQuest({ stage, text, model = PRESETS.team, onComplete = () => {} }) {
  const greedy = greedyPlan(model, allPlans(model)).total;
  const root = document.createElement("details");
  root.id = "quest";
  root.className = "quest";
  const summary = document.createElement("summary");
  const list = document.createElement("ul");
  root.append(summary, list);
  stage.append(root);

  const tasks = [
    ...HELPERS.map((id) => ({ id, label: text.tasks[id], done: false })),
    { id: "legal", label: text.tasks.legal, done: false },
    { id: "beat", label: fill(text.tasks.beat, { greedy }), done: false },
    { id: "simulate", label: text.tasks.simulate, done: false },
    { id: "result", label: text.tasks.result, done: false },
  ];
  let announced = false;

  function render() {
    const done = tasks.filter((t) => t.done).length;
    summary.textContent = fill(text.summary, { done, total: tasks.length });
    list.replaceChildren(
      ...tasks.map((t) => {
        const li = document.createElement("li");
        li.className = t.done ? "done" : "";
        li.textContent = t.label;
        li.setAttribute("aria-label", `${t.label}${t.done ? ", done" : ""}`);
        return li;
      }),
    );
    root.classList.toggle("complete", done === tasks.length);
    if (done === tasks.length && !announced) {
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
        mark("legal");
        if (b.total < greedy) mark("beat");
      }
    },
    /** The game moved to another screen. */
    phase(phase) {
      root.hidden = phase !== "play" && phase !== "around";
      if (phase === "simulate") mark("simulate");
      if (phase === "result") mark("result");
    },
    done: () => tasks.filter((t) => t.done).map((t) => t.id),
    total: tasks.length,
    debug: () => ({ done: tasks.filter((t) => t.done).map((t) => t.id), total: tasks.length, hidden: root.hidden }),
  };
}
