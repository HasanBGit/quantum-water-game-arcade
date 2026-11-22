// The bill slip: every number of the cost formula, with the player's own numbers filled in.
import { billLines, billState } from "./bill.js";

const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k]);

export function createBillPanel({ root, model, text, onToggle }) {
  root.replaceChildren();
  const el = (tag, attrs = {}, content) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (content !== undefined) node.textContent = content;
    return node;
  };

  const summary = el("summary");
  const title = el("h2", { id: "bill-title" }, text.title);
  const rows = {};
  const list = el("dl");
  const addRow = (key, label, cls = "") => {
    const row = el("div", { class: `line ${cls}`.trim() });
    const dt = el("dt", {}, label);
    const dd = el("dd", { id: `bill-${key}` });
    row.append(dt, dd);
    list.append(row);
    rows[key] = dd;
  };
  addRow("electricity", text.electricity);
  addRow("restarts", text.restarts);
  addRow("penalty", text.penalty);
  addRow("total", text.total, "total");

  const rule = el("p", { class: "rule" }, fill(text.rule, { n: 3 }));
  const message = el("p", { id: "bill-message", role: "status" });
  const slotsBox = el("div", { class: "slots", role: "group", "aria-label": text.slotsLabel });
  const buttons = model.prices.map((price, i) => {
    const b = el("button", { type: "button", "aria-pressed": "false", "data-slot-button": String(i + 1) });
    b.append(el("span", {}, `${text.slot} ${i + 1}`), el("span", { class: "price" }, fill(text.price, { p: price })));
    b.addEventListener("click", () => onToggle(i));
    slotsBox.append(b);
    return b;
  });
  const body = el("div", { class: "body" });
  body.append(title, list, rule, message, slotsBox);
  root.append(summary, body);

  let last = "";
  function update(x) {
    const b = billLines(model, x);
    const state = billState(b);
    rows.electricity.textContent = b.prices.length ? `${b.prices.join(" + ")} = ${b.electricity}` : `${text.none} = 0`;
    rows.restarts.textContent = `${b.starts} × ${b.restartEach} = ${b.restartCost}`;
    rows.penalty.textContent = `${b.penaltyWeight} × (${b.chosen} − ${b.required})² = ${b.penalty}`;
    rows.total.textContent = String(b.total);
    message.textContent = fill(text.state[state], { n: b.chosen, m: b.required - b.chosen, r: b.restartEach, extra: b.chosen - b.required });
    message.dataset.state = state;
    summary.textContent = fill(text.summary, { total: b.total, n: b.chosen, need: b.required });
    buttons.forEach((btn, i) => btn.setAttribute("aria-pressed", String(Boolean(x[i]))));
    const key = `${b.total}|${b.chosen}`;
    if (key !== last && last !== "") {
      rows.total.classList.remove("changed");
      void rows.total.offsetWidth; // restart the short highlight
      rows.total.classList.add("changed");
    }
    last = key;
  }
  return { update, buttons };
}
