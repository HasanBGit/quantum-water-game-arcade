// RPG conversations: a text box along the bottom with the speaker's name, text that types out,
// 2 to 4 replies, and a camera that moves to the speaker (the camera part lives in main.js).
// Text comes from src/strings.js (text.scripts). Effects are named in the text and run by main.js.
//
// Rules taken from what was read about dialogue boxes: bottom anchored, about a fifth of the screen,
// 40 ms per character with longer pauses at punctuation, one press finishes the line and the next
// moves on, replies appear only after the line has finished, at most 4 replies of under 15 words.
import "./dialogue.css";
import { fill } from "./scripts.js";

const CHAR_MS = 40;
const PAUSE = { ".": 250, "!": 250, "?": 250, ",": 150, ";": 150, ":": 150 };

function el(tag, attrs = {}, content) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (content !== undefined) node.textContent = content;
  return node;
}

export function createDialogue({ stage, text, getVars, effects = {}, reduceMotion = false, onTopic = () => {}, onOpen = () => {}, onClose = () => {} }) {
  const ui = text.ui;
  const root = el("section", { id: "dialogue", hidden: "", tabindex: "-1", role: "dialog", "aria-labelledby": "dlg-name" });
  const name = el("div", { id: "dlg-name", class: "dlg-name" });
  const live = el("p", { class: "sr-only", "aria-live": "polite" });
  const line = el("p", { class: "dlg-line", "aria-hidden": "true" });
  const choicesBox = el("div", { class: "dlg-choices", role: "group" });
  const hint = el("p", { class: "dlg-hint" });
  root.append(name, live, line, choicesBox, hint);
  stage.append(root);

  let open = false;
  let speaker = null;
  let script = null;
  let nodeId = "";
  let node = null;
  let full = "";
  let times = [];
  let startAt = 0;
  let ready = false;
  let highlight = 0;
  let buttons = [];
  let raf = 0;

  const visitedNodes = new Set();

  function schedule(str) {
    // The moment each character appears, counted from the start of the line.
    times = [];
    let t = 0;
    for (const ch of str) {
      t += reduceMotion ? 0 : CHAR_MS + (PAUSE[ch] ?? 0);
      times.push(t);
    }
  }

  function runEffect(spec) {
    if (!spec) return;
    const [fn, arg] = spec.split(":");
    if (effects[fn]) effects[fn](arg);
  }

  function showChoices() {
    choicesBox.replaceChildren();
    buttons = [];
    const choices = node.choices ?? [];
    choices.forEach((c, i) => {
      const b = el("button", { type: "button", class: "dlg-choice", "data-i": String(i) });
      b.append(el("span", { class: "num", "aria-hidden": "true" }, String(i + 1)), el("span", {}, c.label));
      b.addEventListener("click", () => choose(i));
      choicesBox.append(b);
      buttons.push(b);
    });
    highlight = 0;
    setHighlight(0);
    hint.textContent = choices.length ? ui.hintChoose : ui.hintNext;
    root.classList.toggle("has-choices", choices.length > 0);
    if (buttons[0]) buttons[0].focus({ preventScroll: true });
  }

  function setHighlight(i) {
    highlight = (i + buttons.length) % Math.max(buttons.length, 1);
    buttons.forEach((b, k) => b.setAttribute("aria-current", String(k === highlight)));
    if (buttons[highlight]) buttons[highlight].focus({ preventScroll: true });
  }

  function finishLine() {
    ready = true;
    line.textContent = full;
    root.classList.toggle("more", Boolean(node.next || node.end));
    showChoices();
  }

  function startNode(id) {
    nodeId = id;
    node = script.nodes[id];
    full = fill(node.say, getVars());
    schedule(full);
    startAt = performance.now();
    ready = false;
    choicesBox.replaceChildren();
    buttons = [];
    root.classList.remove("more", "has-choices");
    hint.textContent = ui.hintNext;
    live.textContent = full; // read out in full, once, instead of letter by letter
    line.textContent = "";
    visitedNodes.add(`${speaker.id}.${id}`);
    runEffect(node.effect);
    onTopic(speaker.id, id, id === script.start);
    if (reduceMotion || full.length === 0) finishLine();
  }

  function loop() {
    if (!open) return;
    if (!ready) {
      const elapsed = performance.now() - startAt;
      let count = 0;
      while (count < times.length && times[count] <= elapsed) count++;
      line.textContent = full.slice(0, count);
      if (count >= full.length) finishLine();
    }
    raf = requestAnimationFrame(loop);
  }

  function choose(i) {
    const c = node.choices?.[i];
    if (!c) return;
    runEffect(c.effect);
    if (c.end) close();
    else startNode(c.next);
  }

  /** E, Space, Enter or a click on the box: finish the line, or move on. */
  function advance() {
    if (!open) return false;
    if (!ready) {
      finishLine();
      return true;
    }
    if (node.choices?.length) choose(highlight);
    else if (node.next) startNode(node.next);
    else close();
    return true;
  }

  function openWith(person) {
    const s = text.scripts[person.id];
    if (!s) return false;
    speaker = person;
    script = s;
    open = true;
    root.hidden = false;
    root.style.setProperty("--who", person.color ?? "#8a5cff");
    name.textContent = `${person.name} · ${person.role}`;
    root.setAttribute("aria-label", fill(ui.label, { name: person.name }));
    document.body.dataset.talking = "1";
    onOpen(person);
    startNode(s.start);
    root.focus({ preventScroll: true });
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
    return true;
  }

  function close() {
    if (!open) return;
    open = false;
    cancelAnimationFrame(raf);
    root.hidden = true;
    delete document.body.dataset.talking;
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    const who = speaker;
    speaker = null;
    onClose(who);
  }

  root.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".dlg-choice")) return;
    advance();
  });

  window.addEventListener("keydown", (e) => {
    if (!open || e.ctrlKey || e.metaKey || e.altKey) return;
    const onChoice = e.target.closest && e.target.closest(".dlg-choice");
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && ready && buttons.length) {
      e.preventDefault();
      setHighlight(highlight + (e.key === "ArrowDown" ? 1 : -1));
    } else if (/^[1-4]$/.test(e.key) && ready && buttons[Number(e.key) - 1]) {
      e.preventDefault();
      choose(Number(e.key) - 1);
    } else if (e.key === "Enter" && !onChoice) {
      e.preventDefault();
      advance();
    }
  });

  return {
    open: openWith,
    close,
    advance,
    get isOpen() {
      return open;
    },
    get speaker() {
      return speaker;
    },
    /** Everything said so far, as "helper.node" keys. */
    visited: () => new Set(visitedNodes),
    debug: () => ({
      open,
      who: speaker ? speaker.id : null,
      node: nodeId,
      typing: open && !ready,
      choices: open && ready ? (node.choices ?? []).length : 0,
      text: open ? full : "",
      shown: open ? line.textContent : "",
      boxHeightShare: open ? +(root.getBoundingClientRect().height / window.innerHeight).toFixed(3) : 0,
    }),
  };
}
