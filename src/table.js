// Stage 1 check page: the cost table and the search numbers, straight from src/math.
import {
  PRESETS,
  PLAN_COUNT,
  allPlans,
  cheapestPlans,
  greedyPlan,
  markedIndices,
  theta,
  successProbability,
  bestSteps,
  plansForSlots,
  sqrtPlansForSlots,
  formatBig,
} from "./math/index.js";
import { STRINGS } from "./strings.js";

const t = STRINGS.en;
const fill = (text, values) => text.replace(/\{(\w+)\}/g, (_, name) => values[name]);

function el(tag, text, attrs = {}) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  return node;
}

function table(headers, rows, rowClasses = []) {
  const tbl = el("table");
  const head = el("tr");
  headers.forEach((h) => head.append(el("th", h, { scope: "col" })));
  tbl.append(head);
  rows.forEach((row, i) => {
    const tr = el("tr");
    if (rowClasses[i]) tr.className = rowClasses[i];
    row.forEach((cell) => {
      const td = el("td", typeof cell === "object" ? cell.text : String(cell));
      if (typeof cell === "object" && cell.tag) td.append(el("span", cell.tag, { class: "tag" }));
      tr.append(td);
    });
    tbl.append(tr);
  });
  return tbl;
}

const state = { preset: "team", yourIndex: null };

function render() {
  const app = document.getElementById("app");
  app.replaceChildren();
  const model = PRESETS[state.preset];
  const plans = allPlans(model);
  const best = cheapestPlans(plans)[0];
  const greedy = greedyPlan(model, plans);
  const legal = plans.filter((p) => p.legal).sort((a, b) => a.total - b.total || a.k - b.k);
  if (state.yourIndex === null || !plans[state.yourIndex].legal) state.yourIndex = greedy.k;
  const yours = plans[state.yourIndex];

  app.append(el("h1", t.title), el("p", t.intro, { class: "note" }));

  // Tariff
  const presetLabel = el("label", t.tariff, { for: "preset" });
  const presetSelect = el("select", undefined, { id: "preset" });
  presetSelect.append(
    new Option(t.presetTeam, "team", false, state.preset === "team"),
    new Option(t.presetNotebook, "notebook", false, state.preset === "notebook"),
  );
  presetSelect.addEventListener("change", () => {
    state.preset = presetSelect.value;
    state.yourIndex = null;
    render();
    document.getElementById("preset").focus();
  });
  app.append(presetLabel, presetSelect);
  app.append(
    el("p", `${t.prices}: ${model.prices.join(", ")}`, { class: "note" }),
    el("p", `${t.restart}: ${model.restart}. ${t.saving}: ${model.adjacentSaving}. ${t.penalty}: ${model.penalty}.`, { class: "note" }),
  );

  // Cost table
  app.append(el("h2", t.legalPlans));
  const rows = legal.map((p) => [
    { text: p.slots.join(", "), tag: p === best ? t.cheapest : p === greedy ? t.greedy : "" },
    p.electricity,
    p.starts,
    p.total,
  ]);
  const classes = legal.map((p) => (p === best ? "cheapest" : p === greedy ? "greedy" : ""));
  app.append(table([t.colSlots, t.colElectricity, t.colStarts, t.colTotal], rows, classes));
  const totals = plans.map((p) => p.total);
  app.append(el("p", fill(t.allPlansNote, { min: Math.min(...totals), max: Math.max(...totals) }), { class: "note" }));

  // Search numbers
  app.append(el("h2", t.searchTitle));
  const yourLabel = el("label", t.yourPlan, { for: "your-plan" });
  const yourSelect = el("select", undefined, { id: "your-plan" });
  legal.forEach((p) => yourSelect.append(new Option(`${p.slots.join(", ")} (${p.total})`, String(p.k), false, p.k === state.yourIndex)));
  yourSelect.addEventListener("change", () => {
    state.yourIndex = Number(yourSelect.value);
    render();
    document.getElementById("your-plan").focus();
  });
  app.append(yourLabel, yourSelect);

  const M = markedIndices(plans, yours.total).length;
  app.append(el("p", `${t.bar}: ${yours.total}. ${t.cheaperCount}: ${M}.`, { class: "note" }));
  if (M === 0) {
    app.append(el("p", t.nothingCheaper));
  } else {
    app.append(el("p", `${t.theta}: ${theta(M, PLAN_COUNT).toFixed(4)}. ${t.bestSteps}: ${bestSteps(M, PLAN_COUNT)}.`, { class: "note" }));
    const ks = [0, 1, 2, 3, 4, 5, 6];
    app.append(
      table(
        [t.stepsHeader, t.chance],
        ks.map((k) => [k, `${(successProbability(M, PLAN_COUNT, k) * 100).toFixed(1)}%`]),
      ),
    );
  }

  // Scale
  app.append(el("h2", t.scaleTitle));
  const scaleRows = [5, 24, 240].map((n) => [
    fill(t.scaleRow, { slots: n }),
    formatBig(plansForSlots(n)),
    sqrtPlansForSlots(n) === null ? "" : formatBig(sqrtPlansForSlots(n)),
  ]);
  app.append(table(["", "2^n", t.scaleSqrt], scaleRows));
}

render();
