// The quest log: a short list that checks itself off as the player talks, plays and finishes.
// It watches; it never changes the game. Every check uses numbers from src/math.
import "./dialogue.css";
import { PRESETS } from "../math/index.js";
import { createQuestState } from "./questState.js";

const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => (k in v ? v[k] : `{${k}}`));

export function createQuest({ stage, text, model = PRESETS.team, onComplete = () => {}, onChange = () => {} }) {
  const state = createQuestState(model);
  const greedy = state.greedyTotal;
  const root = document.createElement("details");
  root.id = "quest";
  root.className = "quest";
  const summary = document.createElement("summary");
  const list = document.createElement("ul");
  root.append(summary, list);
  stage.append(root);

  const label = (id) => (id === "beat" ? fill(text.tasks.beat, { greedy }) : text.tasks[id]);
  const tasks = [...state.main.map((id) => ({ id, optional: false })), ...state.optional.map((id) => ({ id, optional: true }))].map((t) => ({
    ...t,
    label: label(t.id),
    get done() {
      return state.isDone(t.id);
    },
  }));
  const main = tasks.filter((x) => !x.optional);
  let announced = false;

  const nextLine = () => {
    const current = main.find((x) => !x.done);
    return current ? fill(text.next, { task: current.label }) : text.complete;
  };

  function render() {
    const done = main.filter((t) => t.done).length;
    const current = main.find((x) => !x.done);
    const line = document.createElement("span");
    line.className = "next";
    line.textContent = nextLine();
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
    onChange(nextLine());
    if (done === main.length && !announced) {
      announced = true;
      onComplete(text.complete);
    }
  }
  render();

  return {
    /** A helper's conversation reached a topic (not just the greeting). */
    talked: (helperId) => state.talked(helperId) && render(),
    /** The player's slots changed. */
    slots: (slots) => state.slots(slots) && render(),
    /** The game moved to another screen. */
    phase(phase) {
      root.hidden = phase !== "play" && phase !== "around";
      if (state.phase(phase)) render();
    },
    /** The line for the current task, e.g. "Next: Press Simulate and watch the search". */
    nextLine,
    /** The id of the first task not done yet, or null when all are. */
    next: () => state.next(),
    /** The slots (1 to 5) the obvious plan switches on. */
    greedySlots: () => state.greedySlots(),
    done: () => state.doneIds(),
    total: main.length,
    debug: () => ({ done: state.doneIds(), total: main.length, hidden: root.hidden }),
  };
}
