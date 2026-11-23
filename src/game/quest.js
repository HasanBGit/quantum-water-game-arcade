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

  // While the obvious-plan task is open, say which slots to switch on, how many are right, and which one is wrong.
  let lastSlots = [0, 0, 0, 0, 0];
  const greedyDetail = () => {
    const want = state.greedySlots();
    const price = (n) => model.prices[n - 1];
    const list = [...want].sort((a, b) => price(a) - price(b)).map((n) => fill(text.slotPrice, { n, p: price(n) })).join(text.sep);
    const k = want.filter((n) => lastSlots[n - 1]).length;
    const wrong = lastSlots.map((v, i) => (v && !want.includes(i + 1) ? i + 1 : 0)).filter(Boolean)[0];
    return wrong ? fill(text.greedyWrong, { n: wrong, p: price(wrong) }) : fill(text.greedyHint, { list, k });
  };
  const nextLine = () => {
    const current = main.find((x) => !x.done);
    if (!current) return text.complete;
    const line = fill(text.next, { task: current.label });
    // After 2 wrong tries in a row: say so, point at the tracker, and say exactly what to do
    if (state.offTrack()) {
      const fix = current.id === "greedy" ? greedyDetail() : current.id === "layla" ? text.laylaHint : fill(text.beatHint, { greedy });
      return `${text.offTrack} ${line}. ${fix}`;
    }
    return current.id === "greedy" ? `${line}. ${greedyDetail()}` : line;
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
    onChange(nextLine(), state.step());
    if (done === main.length && !announced) {
      announced = true;
      onComplete(text.complete);
    }
  }
  render();

  return {
    /** A helper's conversation reached a topic (not just the greeting). */
    talked(helperId) {
      const wasOff = Boolean(state.offTrack());
      const ticked = state.talked(helperId);
      const off = Boolean(state.offTrack());
      root.classList.toggle("offtrack", off);
      if (off && !wasOff) root.open = true;
      if (ticked || off !== wasOff) render();
    },
    /** The player's slots changed. */
    slots(slots) {
      lastSlots = slots.slice();
      // re-draw on every press while the obvious plan is the open task, so "k of 3" and the wrong-slot note stay current
      const wasGreedy = state.next() === "greedy";
      const wasOff = Boolean(state.offTrack());
      const ticked = state.slots(slots);
      const off = Boolean(state.offTrack());
      if (off && !wasOff) root.open = true; // show the full list so the player can see where they are
      root.classList.toggle("offtrack", off);
      if (ticked || wasGreedy || off !== wasOff || off || state.next() === "beat") render();
    },
    /** The game moved to another screen. */
    phase(phase) {
      root.hidden = phase !== "play" && phase !== "around";
      const wasOff = Boolean(state.offTrack());
      const ticked = state.phase(phase);
      const off = Boolean(state.offTrack());
      root.classList.toggle("offtrack", off);
      if (off && !wasOff && phase === "play") root.open = true;
      if (ticked || off !== wasOff) render();
    },
    /** The line for the current task, e.g. "Next: Press Simulate and watch the search". */
    nextLine,
    /** The coach step (1 to 3) the quest is in. */
    step: () => state.step(),
    /** The id of the first task not done yet, or null when all are. */
    next: () => state.next(),
    /** The slots (1 to 5) the obvious plan switches on. */
    greedySlots: () => state.greedySlots(),
    done: () => state.doneIds(),
    total: main.length,
    debug: () => ({ done: state.doneIds(), total: main.length, hidden: root.hidden }),
  };
}
