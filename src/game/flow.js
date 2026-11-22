// The guided game flow: intro, coach while playing, Simulate, Result, and a look around.
// It owns the screens and the player's progress; main.js owns the 3D plant and tells this module
// when the slots change. Every number comes from src/math.
import "./flow.css";
import {
  PRESETS, PLAN_COUNT, allPlans, cheapestPlans, greedyPlan, chosenSlots, indexFromPlan,
  planRound, measure, mean, successProbability, plansForSlots, sqrtPlansForSlots, formatBig,
} from "../math/index.js";
import { billLines, billState } from "./bill.js";
import { siteReport } from "./siteReport.js";

const fill = (s, v = {}) => s.replace(/\{(\w+)\}/g, (_, k) => v[k]);
const pct = (p) => `${(p * 100).toFixed(1)}%`;
const SVG = "http://www.w3.org/2000/svg";

function h(tag, attrs = {}, ...kids) {
  const node = tag.startsWith("svg:") ? document.createElementNS(SVG, tag.slice(4)) : document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) node.setAttribute(k, v);
  for (const kid of kids.flat()) if (kid !== undefined && kid !== null) node.append(kid);
  return node;
}

// Mochi, the cat in a hard hat: the game's guide. Static markup, no user data.
const CAT = {
  happy: `<svg viewBox="0 0 88 104" aria-hidden="true" focusable="false"><path d="M16 52L13 14L36 33Z" fill="#ff9f1c" stroke="#1b1b4b" stroke-width="4.5" stroke-linejoin="round"/><path d="M72 52L75 14L52 33Z" fill="#ff9f1c" stroke="#1b1b4b" stroke-width="4.5" stroke-linejoin="round"/><path d="M19 40L18 25L29 34Z M69 40L70 25L59 34Z" fill="#ff8fa3"/><ellipse cx="44" cy="64" rx="34" ry="30" fill="#ff9f1c" stroke="#1b1b4b" stroke-width="4.5"/><ellipse cx="44" cy="76" rx="18" ry="13" fill="#ffe2b8"/><path d="M30 40h28v-4a14 14 0 0 0-28 0z" fill="#fff" stroke="#1b1b4b" stroke-width="4" stroke-linejoin="round"/><path d="M26 40h36" stroke="#1b1b4b" stroke-width="5" stroke-linecap="round"/><path d="M27 61q5-8 10 0M51 61q5-8 10 0" fill="none" stroke="#1b1b4b" stroke-width="4" stroke-linecap="round"/><path d="M40 67h8l-4 4z" fill="#ff5d73" stroke="#1b1b4b" stroke-width="2" stroke-linejoin="round"/><path d="M44 70q-4 7-10 3M44 70q4 7 10 3" fill="none" stroke="#1b1b4b" stroke-width="3.4" stroke-linecap="round"/><path d="M8 66h14M9 74l13-3M80 66H66M79 74l-13-3" stroke="#1b1b4b" stroke-width="2.4" stroke-linecap="round"/><ellipse cx="22" cy="72" rx="4.5" ry="2.8" fill="#ff5d73" opacity=".5"/><ellipse cx="66" cy="72" rx="4.5" ry="2.8" fill="#ff5d73" opacity=".5"/></svg>`,
  oops: `<svg viewBox="0 0 88 104" aria-hidden="true" focusable="false"><path d="M16 52L13 14L36 33Z" fill="#ff9f1c" stroke="#1b1b4b" stroke-width="4.5" stroke-linejoin="round"/><path d="M72 52L75 14L52 33Z" fill="#ff9f1c" stroke="#1b1b4b" stroke-width="4.5" stroke-linejoin="round"/><path d="M19 40L18 25L29 34Z M69 40L70 25L59 34Z" fill="#ff8fa3"/><ellipse cx="44" cy="64" rx="34" ry="30" fill="#ff9f1c" stroke="#1b1b4b" stroke-width="4.5"/><ellipse cx="44" cy="76" rx="18" ry="13" fill="#ffe2b8"/><path d="M30 40h28v-4a14 14 0 0 0-28 0z" fill="#fff" stroke="#1b1b4b" stroke-width="4" stroke-linejoin="round"/><path d="M26 40h36" stroke="#1b1b4b" stroke-width="5" stroke-linecap="round"/><circle cx="32" cy="61" r="4.6" fill="#1b1b4b"/><circle cx="56" cy="61" r="4.6" fill="#1b1b4b"/><circle cx="33.4" cy="59.6" r="1.6" fill="#fff"/><circle cx="57.4" cy="59.6" r="1.6" fill="#fff"/><path d="M78 40q4 6 0 9q-4-3 0-9z" fill="#8fe3f0" stroke="#1b1b4b" stroke-width="2"/><path d="M40 67h8l-4 4z" fill="#ff5d73" stroke="#1b1b4b" stroke-width="2" stroke-linejoin="round"/><path d="M37 76q7-6 14 0" fill="none" stroke="#1b1b4b" stroke-width="3.4" stroke-linecap="round"/><path d="M8 66h14M9 74l13-3M80 66H66M79 74l-13-3" stroke="#1b1b4b" stroke-width="2.4" stroke-linecap="round"/><ellipse cx="22" cy="72" rx="4.5" ry="2.8" fill="#ff5d73" opacity=".5"/><ellipse cx="66" cy="72" rx="4.5" ry="2.8" fill="#ff5d73" opacity=".5"/></svg>`,
};
const STAR = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z" stroke="#1b1b4b" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
function mascot(cls = "mascot", mood = "happy") {
  const el = h("span", { class: cls });
  el.innerHTML = CAT[mood];
  return el;
}
function star(on, delay = 0) {
  const el = h("span", { class: `star ${on ? "on" : "off"}`, style: `--d:${delay}ms` });
  el.innerHTML = STAR;
  return el;
}
const CONFETTI = ["#ff5d73", "#ff9f1c", "#ffd23f", "#55e07a", "#19c3d6", "#8a5cff"];
function confetti(host, count = 46) {
  const box = h("div", { class: "confetti", "aria-hidden": "true" });
  for (let i = 0; i < count; i++) {
    const p = h("i", {
      style: `left:${Math.random() * 100}%;background:${CONFETTI[i % CONFETTI.length]};--dx:${(Math.random() - 0.5) * 160}px;--r:${Math.random() * 900 - 450}deg;animation-delay:${Math.random() * 600}ms;animation-duration:${1600 + Math.random() * 1400}ms`,
    });
    box.append(p);
  }
  host.append(box);
  setTimeout(() => box.remove(), 4000);
}
function toast(text) {
  const el = h("div", { class: "toast", role: "status" }, text);
  document.getElementById("toasts")?.append(el);
  setTimeout(() => el.remove(), 2200);
}

export function createFlow({ root, model = PRESETS.team, text, reduceMotion, field, narrow = () => false, getSlots, setSlots, onPhase }) {
  const plans = allPlans(model);
  const slotsLabel = (x) => chosenSlots(x).join(", ") || "none";

  // ---- progress
  let phase = "";
  let tried = new Set(); // legal plans the player has made this game
  let bestLegal = null;
  let yourPlan = null; // the plan the player sent to Simulate
  const timers = new Set();
  const every = (fn, ms) => {
    const id = setInterval(fn, ms);
    timers.add(id);
    return id;
  };
  const stopTimers = () => {
    timers.forEach((id) => (clearTimeout(id), clearInterval(id)));
    timers.clear();
  };

  root.replaceChildren();
  const screens = {};
  const section = (name, cls, ...kids) => {
    const el = h("section", { class: `flow-screen ${cls}`, "data-screen": name, hidden: "" }, ...kids);
    screens[name] = el;
    root.append(el);
    return el;
  };

  // ======================================================== intro
  const I = text.intro;
  const startBtn = h("button", { type: "button", class: "primary" }, I.start);
  startBtn.addEventListener("click", () => go("play"));
  section(
    "title",
    "card intro",
    h("div", { class: "bubbles", "aria-hidden": "true" }, [0, 1, 2, 3, 4, 5].map((i) => h("i", { style: `--i:${i}` }))),
    h("div", { class: "hero" }, mascot("mascot big"), h("h2", { id: "intro-title", tabindex: "-1" }, h("span", { class: "q" }, "Quantum"), " Water")),
    h("p", { class: "lead" }, I.lead),
    h("h3", {}, I.howTitle),
    h(
      "ol",
      { class: "how" },
      I.how.map((s, i) => h("li", { class: `lvl lvl${i + 1}` }, h("span", { class: "badge" }, String(i + 1)), h("strong", {}, s.name), h("span", { class: "time" }, s.time), h("p", {}, s.text))),
    ),
    h("p", { class: "note" }, I.honest),
    startBtn,
  );

  // ======================================================== coach (while playing)
  const C = text.coach;
  const pills = text.steps.map((name, i) => h("li", {}, h("span", { class: "n" }, String(i + 1)), ` ${name}`));
  const coachMsg = h("p", { id: "coach-msg", role: "status" });
  const coachTip = h("p", { class: "tip" });
  const coachBest = h("p", { class: "best" });
  const simBtn = h("button", { type: "button", class: "primary", id: "btn-simulate" }, C.simulate);
  const simWhy = h("span", { id: "simulate-why", class: "why" });
  simBtn.setAttribute("aria-describedby", "simulate-why");
  simBtn.addEventListener("click", () => {
    if (simBtn.disabled) return;
    startSimulation(getSlots());
  });
  const coachStep = h("p", { class: "stepof" });
  section(
    "play",
    "coach",
    mascot("mascot coachmascot"),
    coachStep,
    h("ol", { class: "pills", "aria-label": "Steps" }, pills),
    h("p", { class: "goal" }, C.goal),
    coachMsg,
    coachTip,
    coachBest,
    h("div", { class: "row" }, simBtn, simWhy),
  );

  function updateCoach(slots) {
    const b = billLines(model, slots);
    const state = billState(b);
    const legal = state === "ready";
    if (legal) {
      tried.add(indexFromPlan(slots));
      if (bestLegal === null || b.total < bestLegal) {
        if (bestLegal !== null) toast(C.newBest);
        bestLegal = b.total;
      }
    }
    const step = !legal ? 1 : tried.size >= 2 ? 3 : 2;
    pills.forEach((li, i) => {
      li.classList.toggle("current", i + 1 === step);
      li.classList.toggle("done", i + 1 < step);
      if (i + 1 === step) li.setAttribute("aria-current", "step");
      else li.removeAttribute("aria-current");
    });
    coachStep.textContent = fill(text.stepOf, { n: step });
    const v = { n: b.chosen, m: b.required - b.chosen, extra: b.chosen - b.required, total: b.total, r: b.restartEach };
    coachMsg.textContent = state === "empty" ? C.empty : fill(C[state], v);
    coachTip.textContent = legal ? `${fill(C.tip, v)} ${tried.size >= 2 ? C.readyMore : ""}`.trim() : "";
    coachBest.textContent = bestLegal === null ? C.noBest : fill(C.best, { b: bestLegal });
    simBtn.disabled = !legal;
    simWhy.textContent = legal ? "" : C.needThree;
  }

  // ======================================================== simulate
  const S = text.sim;
  // The tanks are in the 3D plant (tankField.js). This is only the heads-up display on top of them.
  const chip = (label) => {
    const dd = h("dd");
    return { dd, el: h("div", { class: "kv" }, h("dt", {}, label), dd) };
  };
  const cBar = chip(S.bar);
  const cCheaper = chip(S.cheaper);
  const cStep = chip("Grover");
  const cChance = chip(S.chance);
  const cClerk = chip(S.clerkTitle);
  const falls = h("p", { class: "falls" });
  const caption = h("p", { class: "caption", role: "status", "aria-live": "polite" });
  const nextBtn = h("button", { type: "button", class: "primary" });
  const autoBtn = h("button", { type: "button", "aria-pressed": "false" }, S.auto);
  const skipBtn = h("button", { type: "button", class: "quiet" }, S.skip);

  section(
    "simulate",
    "simhud",
    h("div", { class: "simtop" }, h("h2", { id: "sim-title", tabindex: "-1" }, S.title), caption, falls),
    h("dl", { class: "chips" }, cBar.el, cCheaper.el, cStep.el, cChance.el, cClerk.el),
    h("div", { class: "row simrow" }, nextBtn, autoBtn, skipBtn),
  );

  // simulation state
  let bar = 0;
  let round = null;
  let s = 0; // Grover steps done this round
  let sub = "idle"; // idle | oracled | measured-found | measured-unlucky | done
  let found = null;
  let auto = false;
  let roundNo = 0;

  // Levels go to the tanks, which ease towards them on their own.
  function show(amps, { marked = false, measuredK = null, meanAt = null } = {}) {
    field.setLevels(amps, {
      marked: marked && round && !round.empty ? new Set(round.marked) : null,
      measured: measuredK,
      meanAt,
    });
  }

  function startClerk() {
    cClerk.dd.textContent = fill(S.clerkChip, { n: 0 });
    field.startClerk({ bar, fast: roundNo > 0, onStep: (n) => (cClerk.dd.textContent = fill(S.clerkChip, { n })) });
  }

  function beginRound(newBar) {
    bar = newBar;
    round = planRound(plans, bar);
    s = 0;
    found = null;
    startClerk();
    roundNo++;
    if (round.empty) {
      sub = "done";
      show(Array(PLAN_COUNT).fill(1 / Math.sqrt(PLAN_COUNT)), { marked: false });
    } else {
      sub = "idle";
      show(round.history[0].amplitudes, { marked: false });
    }
    refresh();
  }

  function refresh() {
    const steps = round && !round.empty ? round.steps : 0;
    const M = round ? round.marked.length : 0;
    cBar.dd.textContent = String(bar);
    cCheaper.dd.textContent = String(M);
    cStep.dd.textContent = round && !round.empty ? fill(S.step, { s, b: steps }) : "-";
    const p = round && !round.empty ? round.history[s].pMarked : 0;
    cChance.dd.textContent = round && !round.empty ? pct(p) : "-";
    falls.textContent =
      round && !round.empty && s === steps && sub === "idle"
        ? fill(S.falls, { p: pct(successProbability(M, PLAN_COUNT, steps + 1)) })
        : "";

    const cap = S.captions;
    const v = { bar, m: M, p: pct(p) };
    let label;
    if (sub === "done") {
      const best = cheapestPlans(plans)[0];
      caption.textContent = M === 0 && bar === yourBill()
        ? cap.doneEmpty
        : fill(cap.done, { bar, slots: slotsLabel(best.x) });
      label = S.next.result;
    } else if (sub === "measured-found") {
      caption.textContent = fill(cap.found, { slots: slotsLabel(found.x), total: found.total });
      label = S.next.lower;
    } else if (sub === "measured-unlucky") {
      caption.textContent = fill(cap.unlucky, { slots: slotsLabel(found.x), total: found.total });
      label = S.next.again;
    } else if (sub === "oracled") {
      caption.textContent = fill(cap.oracle, v);
      label = S.next.reflect;
    } else if (s === 0) {
      caption.textContent = fill(cap.start, v);
      label = S.next.oracle;
    } else if (s < steps) {
      caption.textContent = fill(cap.reflect, v);
      label = S.next.oracle;
    } else {
      caption.textContent = fill(cap.measure, v);
      label = S.next.measure;
    }
    nextBtn.textContent = label;
  }
  const yourBill = () => (yourPlan === null ? -1 : plans[yourPlan].total);

  function next() {
    if (sub === "done") return go("result");
    if (sub === "idle") {
      if (s < round.steps) {
        sub = "oracled";
        const after = round.history[s + 1].afterOracle;
        show(after, { marked: true, meanAt: mean(after) });
      } else {
        const k = measure(round.history[s].amplitudes);
        found = plans[k];
        sub = found.total < bar ? "measured-found" : "measured-unlucky";
        show(round.history[s].amplitudes, { marked: true, measuredK: k });
      }
    } else if (sub === "oracled") {
      s++;
      sub = "idle";
      show(round.history[s].amplitudes, { marked: true });
    } else if (sub === "measured-found") {
      beginRound(found.total);
      return;
    } else if (sub === "measured-unlucky") {
      beginRound(bar);
      return;
    }
    refresh();
  }
  nextBtn.addEventListener("click", () => {
    setAuto(false);
    next();
  });
  skipBtn.addEventListener("click", () => {
    setAuto(false);
    go("result");
  });
  function setAuto(on) {
    auto = on;
    autoBtn.setAttribute("aria-pressed", String(on));
    autoBtn.textContent = on ? S.autoStop : S.auto;
    if (!on) return stopAuto();
    const id = every(() => {
      if (sub === "done" || phase !== "simulate") return setAuto(false);
      next();
    }, 1300);
    autoId = id;
  }
  let autoId = 0;
  function stopAuto() {
    clearInterval(autoId);
    timers.delete(autoId);
  }
  autoBtn.addEventListener("click", () => setAuto(!auto));

  function startSimulation(x) {
    yourPlan = indexFromPlan(x);
    go("simulate");
    setAuto(false);
    roundNo = 0;
    field.show(yourPlan, narrow());
    beginRound(plans[yourPlan].total);
  }

  // ======================================================== result
  const R = text.result;
  const resultBox = section("result", "card result");
  const againBtn = h("button", { type: "button", class: "primary" }, R.again);
  const aroundBtn = h("button", { type: "button" }, R.around);
  againBtn.addEventListener("click", () => {
    tried = new Set();
    bestLegal = null;
    yourPlan = null;
    setSlots([0, 0, 0, 0, 0]);
    go("play");
  });
  aroundBtn.addEventListener("click", () => go("around"));

  // The site report: what each bay is doing in the player's plan, and why it won or lost.
  function siteBlock(mine, best) {
    const W = R.site;
    const rep = siteReport(model, mine, mine.total === best.total ? mine : best);
    const list = (a) => a.join(", ");
    const why = [];
    if (rep.won) {
      why.push(rep.starts ? fill(W.why.startsWon, { s: rep.starts, cold: list(rep.coldSlots), r: model.restart }) : W.why.noStarts);
      why.push(W.why.wonEnd);
    } else {
      const diff = rep.dElectricity > 0 ? fill(W.why.more, { d: rep.dElectricity }) : rep.dElectricity < 0 ? fill(W.why.less, { d: -rep.dElectricity }) : W.why.same;
      why.push(fill(W.why.electricity, { e: mine.electricity, eb: mine.electricity - rep.dElectricity, diff }));
      why.push(fill(W.why.starts, { s: rep.starts, cold: list(rep.coldSlots) || "-", r: model.restart, sb: rep.bestStarts }));
      const v = { off: list(rep.switchOff), on: list(rep.switchOn) };
      if (rep.switchOff.length && rep.switchOn.length) why.push(fill(W.why.fix, v));
      else if (rep.switchOff.length) why.push(fill(W.why.fixOff, v));
      else if (rep.switchOn.length) why.push(fill(W.why.fixOn, v));
    }
    const rows = rep.rows.map((r) => {
      const state = `${r.on ? W.running : W.idle}${r.cold ? `, ${fill(W.rowCold, { r: model.restart })}` : ""}. ${W.tag[r.tag]}.`;
      return h("li", { class: `site-${r.tag}` }, fill(W.row, { n: r.slot, p: r.price, state }));
    });
    const block = h(
      "div",
      { class: `site ${rep.won ? "won" : "lost"}`, role: "group", "aria-label": W.title },
      h("h3", {}, W.title),
      h("p", { class: "verdict" }, rep.won ? W.wonHead : fill(W.lostHead, { d: rep.dTotal })),
      h("ul", { class: "sitewhy" }, why.map((t) => h("li", {}, t))),
      h("ul", { class: "sitelist sr-only" }, rows),
    );
    return { block, rep };
  }

  function buildResult() {
    const mine = plans[yourPlan];
    const best = cheapestPlans(plans)[0];
    const greedy = greedyPlan(model, plans);
    const card = (cls, label, note, p) =>
      h(
        "div",
        { class: `plancard ${cls}` },
        h("h3", {}, label),
        note ? h("p", { class: "cardnote" }, note) : null,
        h("p", { class: "cardbill" }, fill(R.bill, { b: p.total })),
        h("p", {}, fill(R.slots, { s: slotsLabel(p.x) })),
      );
    const greedyNote =
      greedy.total > best.total ? fill(R.greedyLost, { d: greedy.total - best.total }) : "";
    const zoom = R.zoomRows.map((row) => {
      const n = plansForSlots(row.slots);
      return h("tr", {}, h("th", { scope: "row" }, row.label), h("td", {}, `2^${row.slots}`), h("td", {}, formatBig(n)));
    });
    const gap = mine.total - best.total;
    const stars = gap === 0 ? 3 : gap <= 1 ? 2 : 1;
    const site = siteBlock(mine, best);
    resultBox.replaceChildren(
      h("p", { class: "stepof" }, fill(text.stepOf, { n: 3 })),
      h("h2", { id: "result-title", tabindex: "-1" }, R.title),
      h("div", { class: "rating", role: "img", "aria-label": fill(R.starsLabel, { n: stars }) }, [0, 1, 2].map((i) => star(i < stars, 250 + i * 260))),
      h("div", { class: "catrow" }, mascot("mascot catresult", stars === 1 ? "oops" : "happy"), h("p", { class: "rank bubble" }, R.rank[stars - 1])),
      site.block,
      h("div", { class: "cards" }, card("you", R.youLabel, "", mine), card("best", R.bestLabel, "", best), card("greedy", R.greedyLabel, R.greedyNote, greedy)),
      h("p", { class: "honestline", role: "note" }, R.honestShort),
      h(
        "details",
        { class: "more" },
        h("summary", {}, R.connectTitle),
        greedyNote ? h("p", {}, greedyNote) : null,
        h("ol", { class: "learn" }, R.learn.map((t) => h("li", {}, t))),
        h("h3", {}, R.mixTitle),
        h("ul", { class: "mix" }, R.mix.map((t) => h("li", {}, t))),
        h("h3", {}, R.realTitle),
        h("p", {}, R.real),
        h("div", { class: "warn", role: "note" }, h("strong", {}, R.honestTitle), h("p", {}, R.honest)),
        h("h3", {}, R.zoomTitle),
        h("table", { class: "zoom" }, h("tbody", {}, zoom)),
        h("p", {}, fill(R.zoomSqrt, { n: formatBig(sqrtPlansForSlots(240)) })),
      ),
      h("div", { class: "row" }, againBtn, aroundBtn),
    );
    return site.rep;
  }

  // ======================================================== look around
  const backBtn = h("button", { type: "button", class: "primary" }, R.back);
  backBtn.addEventListener("click", () => go("result"));
  section("around", "floating", backBtn);

  // ======================================================== moving between screens
  function go(next) {
    stopTimers();
    auto = false;
    autoBtn.setAttribute("aria-pressed", "false");
    autoBtn.textContent = S.auto;
    phase = next;
    if (next !== "simulate") field.hide();
    let report = null;
    if (next === "result") {
      report = buildResult();
      if (plans[yourPlan].total === cheapestPlans(plans)[0].total && !reduceMotion) confetti(screens.result);
    }
    for (const [name, el] of Object.entries(screens)) el.hidden = name !== next;
    root.dataset.phase = next;
    document.body.dataset.phase = next;
    onPhase(next, report);
    const focusId = { title: "intro-title", simulate: "sim-title", result: "result-title" }[next];
    if (focusId) document.getElementById(focusId).focus({ preventScroll: true });
    else if (next === "play") updateCoach(getSlots());
  }

  return {
    start: (skip) => go(skip ? "play" : "title"),
    onSlots: (slots) => {
      if (phase === "play") updateCoach(slots);
    },
    get phase() {
      return phase;
    },
    // For the automated checks only.
    debug: () => ({ phase, bar, sub, s, steps: round ? round.steps : null, yourPlan, tried: tried.size }),
  };
}
