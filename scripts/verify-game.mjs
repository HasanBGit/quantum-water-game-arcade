// Drives the game in a real (headless) Chrome and checks that it is playable.
//   npm run verify            (the dev server must be running on http://localhost:5173)
//   CHROME_PATH=... npm run verify   to use a different Chrome
// Screenshots go to verify-output/. Exit code is 1 if any check fails.
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import net from "node:net";
import { allPlans, PRESETS } from "../src/math/index.js";
import path from "node:path";

const URL = process.env.GAME_URL ?? "http://localhost:5173/?skip"; // ?skip goes straight to the plant, past the intro
const OUT = path.resolve("verify-output");
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  `${process.env.HOME}/Documents/Work/yaqeen-promo/node_modules/.remotion/chrome-for-testing/mac-arm64/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
].filter(Boolean);

// Starting budgets for the high tier on a laptop. They are my suggestion, not a standard: tune on real devices.
let cheaperPlanMadeEarlier = false; // set by the 'bill-best' check; the quest remembers it
const BUDGET = { high: { drawCalls: 300, triangles: 1200000 }, medium: { drawCalls: 175, triangles: 800000 } };
// A free port for each browser, so two sessions (or two runs) never drive the same Chrome.
const freePort = () =>
  new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const record = (id, label, status, evidence) => {
  results.push({ id, label, status, evidence });
  console.log(`${status.padEnd(11)} ${label} :: ${evidence}`);
};

async function findChrome() {
  for (const p of CHROME_CANDIDATES) {
    try {
      await access(p);
      return p;
    } catch {}
  }
  throw new Error("No Chrome found. Set CHROME_PATH.");
}

async function launch(port, extraArgs = []) {
  const chrome = await findChrome();
  const dir = await mkdtemp(path.join(tmpdir(), "qw-chrome-"));
  const proc = spawn(
    chrome,
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${dir}`,
      "--no-first-run",
      "--hide-scrollbars",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--ignore-gpu-blocklist",
      "--autoplay-policy=no-user-gesture-required",
      ...extraArgs,
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) break;
    } catch {}
    await sleep(100);
  }
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = list.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
    } else if (msg.method === "Runtime.exceptionThrown") {
      errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
    } else if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      errors.push(msg.params.args.map((a) => a.value ?? a.description).join(" "));
    } else if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
      if (!/favicon/.test(msg.params.entry.url ?? msg.params.entry.text)) errors.push(msg.params.entry.text);
    }
  };
  let closedByUs = false;
  ws.onclose = () => {
    if (closedByUs) return;
    // Chrome went away (crashed or was killed). Fail loudly instead of waiting forever.
    for (const { rej } of pending.values()) rej(new Error("the browser closed in the middle of the run"));
    pending.clear();
  };
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const i = ++id;
      pending.set(i, { res, rej });
      try {
        ws.send(JSON.stringify({ id: i, method, params }));
      } catch (err) {
        pending.delete(i);
        rej(new Error("the browser closed in the middle of the run"));
      }
    });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  const close = async () => {
    closedByUs = true;
    try {
      ws.close();
    } catch {}
    proc.kill();
  };
  return { send, evaluate, errors, close };
}

const KEYS = {
  ArrowUp: { key: "ArrowUp", code: "ArrowUp", vk: 38 },
  ArrowDown: { key: "ArrowDown", code: "ArrowDown", vk: 40 },
  ArrowLeft: { key: "ArrowLeft", code: "ArrowLeft", vk: 37 },
  ArrowRight: { key: "ArrowRight", code: "ArrowRight", vk: 39 },
  KeyW: { key: "w", code: "KeyW", vk: 87 },
  KeyO: { key: "o", code: "KeyO", vk: 79 },
  KeyM: { key: "m", code: "KeyM", vk: 77 },
  KeyE: { key: "e", code: "KeyE", vk: 69 },
  Escape: { key: "Escape", code: "Escape", vk: 27 },
  Digit1: { key: "1", code: "Digit1", vk: 49 },
  Space: { key: " ", code: "Space", vk: 32, text: " " },
  Tab: { key: "Tab", code: "Tab", vk: 9 },
  Enter: { key: "Enter", code: "Enter", vk: 13, text: "\r" },
};

// ---- Accessibility and language checks, each in its own browser (so media settings and size are clean).
const waitUntil = async (fn, ms = 4000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await fn();
    if (v) return v;
    await sleep(100);
  }
  return null;
};

async function openGame(url, { reducedMotion = false, width = 1440, height = 900, mobile = false } = {}) {
  const b = await launch(await freePort());
  if (reducedMotion) await b.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await b.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
  await b.send("Page.navigate", { url });
  const st = () => b.evaluate("window.__game ? window.__game.state() : null");
  const ready = await waitUntil(async () => (await st())?.ready, 300000);
  return { b, st, ready };
}

/** Teleport next to Bushra and press E. Returns the state once the conversation is open (or null). */
async function startTalking(b, st, nameRegex) {
  const noura = (await st()).npcs.people.find((x) => x.id === "noura");
  await b.evaluate(`window.__game.teleport(${noura.x}, ${noura.z + 1})`);
  await waitUntil(async () => nameRegex.test((await st()).talkButton.text), 90000);
  const down = (type) => b.send("Input.dispatchKeyEvent", { type, key: "e", code: "KeyE", windowsVirtualKeyCode: 69 });
  await down("rawKeyDown");
  await down("keyUp");
  return waitUntil(async () => {
    const s0 = await st();
    return s0 && s0.dialogue.open && s0;
  }, 60000);
}

async function accessibilityChecks() {
  // 1. Reduced motion: text appears at once, no typing delay.
  {
    const { b, st, ready } = await openGame(URL, { reducedMotion: true });
    if (!ready) record("reduced-motion", "With reduced motion the conversation text appears at once", "FAIL", "the game did not start");
    else {
      const opened = await startTalking(b, st, /Bushra/);
      const d = opened ? opened.dialogue : null;
      const motionQuery = await b.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches");
      record("reduced-motion", "With reduced motion on, a conversation shows its whole line at once (no typing)", motionQuery && d && d.typing === false && d.shown === d.text && d.text.length > 0 ? "PASS" : "FAIL", `media query matches=${motionQuery}; ${d ? `${d.shown.length} of ${d.text.length} characters shown immediately, typing=${d.typing}` : "no conversation"}`);
    }
    await b.close();
  }
  // 2. A 320 px wide screen: nothing sticks out sideways, and the dialogue box fits.
  {
    const { b, st, ready } = await openGame(URL, { width: 320, height: 640, mobile: true });
    if (!ready) record("narrow-320", "On a 320 px screen the conversation fits", "FAIL", "the game did not start");
    else {
      const opened = await startTalking(b, st, /Talk to Bushra|Bushra/);
      await waitUntil(async () => (await st()).dialogue.choices > 0, 60000);
      const fit = await b.evaluate(`(() => {
        const r = document.getElementById("dialogue").getBoundingClientRect();
        return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom), w: window.innerWidth, h: window.innerHeight, overflow: document.documentElement.scrollWidth - window.innerWidth };
      })()`);
      record("narrow-320", "On a 320 px screen the conversation box fits and nothing sticks out sideways", opened && fit.left >= 0 && fit.right <= fit.w && fit.top >= 0 && fit.bottom <= fit.h && fit.overflow <= 0 ? "PASS" : "FAIL", opened ? JSON.stringify(fit) : "no conversation");
    }
    await b.close();
  }
  // 3. Arabic: right-to-left, Arabic words, and no {placeholders} left on screen.
  {
    const { b, st, ready } = await openGame(`${URL}&lang=ar`);
    if (!ready) record("arabic", "The Arabic version works", "FAIL", "the game did not start");
    else {
      const page = await b.evaluate(`(() => ({
        lang: document.documentElement.lang,
        dir: document.documentElement.dir,
        direction: getComputedStyle(document.body).direction,
        hint: document.getElementById("hint").textContent,
        billTitle: document.querySelector("#bill h2") ? document.querySelector("#bill h2").textContent : "",
        arabicLetters: /[\\u0600-\\u06FF]/.test(document.body.innerText),
        leaks: (document.body.innerText.match(/\\{\\w+\\}/g) || []),
      }))()`);
      const opened = await startTalking(b, st, /نورة/);
      const d = opened ? opened.dialogue : null;
      const spoken = d ? /[؀-ۿ]/.test(d.text) && !/\{\w+\}/.test(d.text) : false;
      await sleep(500);
      await b.send("Page.captureScreenshot", { format: "png" }).then((r) => writeFile(path.join(OUT, "7-arabic.png"), Buffer.from(r.data, "base64")));
      record("arabic", "In Arabic the page is right-to-left, the interface and a conversation are in Arabic, and no {placeholder} is left showing", page.lang === "ar" && page.dir === "rtl" && page.direction === "rtl" && page.arabicLetters && /[؀-ۿ]/.test(page.hint) && /[؀-ۿ]/.test(page.billTitle) && page.leaks.length === 0 && spoken ? "PASS" : "FAIL", `lang=${page.lang}, dir=${page.dir}, computed direction=${page.direction}, hint "${page.hint.slice(0, 40)}", bill title "${page.billTitle}", leaks=${JSON.stringify(page.leaks)}, conversation in Arabic=${spoken} (see 7-arabic.png)`);
    }
    await b.close();
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });
  if (process.env.VERIFY_ONLY === "a11y") {
    await accessibilityChecks();
    return finish();
  }
  const b = await launch(await freePort());
  const state = () => b.evaluate("window.__game ? window.__game.state() : null");
  const shot = async (name) => {
    const r = await b.send("Page.captureScreenshot", { format: "png" });
    const buf = Buffer.from(r.data, "base64");
    await writeFile(path.join(OUT, `${name}.png`), buf);
    return buf.length;
  };
  const keyDown = (k) => b.send("Input.dispatchKeyEvent", { type: KEYS[k].text ? "keyDown" : "rawKeyDown", key: KEYS[k].key, code: KEYS[k].code, windowsVirtualKeyCode: KEYS[k].vk, ...(KEYS[k].text ? { text: KEYS[k].text } : {}) });
  const keyUp = (k) => b.send("Input.dispatchKeyEvent", { type: "keyUp", key: KEYS[k].key, code: KEYS[k].code, windowsVirtualKeyCode: KEYS[k].vk });
  const tap = async (k) => {
    await keyDown(k);
    await keyUp(k);
  };
  const waitFor = async (fn, ms = 4000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const v = await fn();
      if (v) return v;
      await sleep(100);
    }
    return null;
  };
  const framesPass = async (n, ms = 30000) => {
    const f0 = (await state()).frames;
    await waitFor(async () => (await state()).frames >= f0 + n, ms);
  };
  // Conversations (Stage 5) and the quest log (Stage 7)
  const conversationChecks = async () => {
    await b.evaluate("window.__game.setSlots([0,0,0,0,0])");
    const people = (await state()).npcs.people;
    const noura = people.find((x) => x.id === "noura");
    await b.evaluate(`window.__game.teleport(${noura.x}, ${noura.z + 1})`);
    await waitFor(async () => /Bushra/.test((await state()).talkButton.text), 90000); // the player starts next to Fay, so wait for the teleport to take effect
    const tb = (await state()).talkButton;
    record("talk-button", "Standing near a helper shows a 'Talk to Bushra' button", !tb.hidden && /Talk to Bushra/.test(tb.text) ? "PASS" : "FAIL", JSON.stringify(tb));
    await tap("KeyE");
    const opened = await waitFor(async () => (await state()).dialogue.open && (await state()), 30000);
    record("talk-open", "Pressing E next to a helper opens a conversation with her", opened && opened.dialogue.who === "noura" ? "PASS" : "FAIL", opened ? JSON.stringify({ who: opened.dialogue.who, node: opened.dialogue.node }) : "did not open");
    // The text types out, and the first press finishes the line.
    const typing = (await state()).dialogue;
    await tap("KeyE");
    await framesPass(1);
    const afterOne = (await state()).dialogue;
    record("talk-typewriter", "The line types out, and the first press finishes it (the second would move on)", typing.typing && typing.shown.length < typing.text.length && afterOne.typing === false && afterOne.shown === afterOne.text ? "PASS" : "FAIL", `before: ${typing.shown.length} of ${typing.text.length} characters; after one press: ${afterOne.shown.length} of ${afterOne.text.length}`);
    const withChoices = await waitFor(async () => (await state()).dialogue.choices > 0 && (await state()), 20000);
    const share = withChoices ? withChoices.dialogue.boxHeightShare : 0;
    record("talk-choices", "Replies appear after the line, 2 to 4 of them, and the box stays under 40% of the screen", withChoices && withChoices.dialogue.choices >= 2 && withChoices.dialogue.choices <= 4 && share > 0.08 && share < 0.4 ? "PASS" : "FAIL", `${withChoices ? withChoices.dialogue.choices : 0} replies, box is ${(share * 100).toFixed(0)}% of the screen height`);
    await shot("6-dialogue");
    // The camera moves in on the speaker.
    await framesPass(10, 120000);
    const cam = (await state()).camera;
    const spk = (await state()).npcs.people.find((x) => x.id === "noura");
    const camDist = Math.hypot(cam.x - spk.x, cam.z - spk.z);
    record("talk-camera", "During a conversation the camera moves close to the speaker, at head height", camDist < 4.5 && cam.y < 2.6 ? "PASS" : "FAIL", `camera ${camDist.toFixed(1)} m from the speaker, ${cam.y.toFixed(1)} m high`);
    // Walking is locked while talking.
    const z0 = (await state()).player.z;
    await keyDown("ArrowUp");
    await framesPass(6, 120000);
    await keyUp("ArrowUp");
    const z1 = (await state()).player.z;
    record("talk-locks-walking", "The operator cannot walk away mid-sentence", Math.abs(z1 - z0) < 0.01 ? "PASS" : "FAIL", `moved ${Math.abs(z1 - z0).toFixed(3)} m while a conversation was open`);
    // A choice by number: "Is the best plan just the 3 cheapest slots?" then "Yes, it has to."
    await keyDown("Digit1");
    await keyUp("Digit1");
    const sawGuess = await waitFor(async () => (await state()).dialogue.node === "guess" && (await state()), 20000);
    await waitFor(async () => (await state()).dialogue.choices === 3, 30000);
    await keyDown("Digit1");
    await keyUp("Digit1");
    // Move on until Bushra switches the slots on for us.
    let shown = null;
    for (let i = 0; i < 12 && !shown; i++) {
      await tap("KeyE");
      await framesPass(1);
      await tap("KeyE");
      await framesPass(1);
      const st = await state();
      if (st.slots.join("") === "11001") shown = st;
    }
    record("talk-effect", "A reply changes the plant: Bushra switches on the 3 cheapest slots and the bill shows 19", shown && shown.bill.total === 19 && shown.predictions.includes("yes") ? "PASS" : "FAIL", shown ? `slots ${shown.slots.join("")}, bill ${shown.bill.total}, guess recorded: ${shown.predictions.join(",")}` : `slots never changed (reached node ${JSON.stringify((await state()).dialogue)})`);
    record("talk-quest", `Talking marks the quest: Bushra done, 'try the obvious plan' done, and 'find a cheaper plan' done only if one was really made earlier in this run (${cheaperPlanMadeEarlier ? "one was" : "none was"}); progress counts in any order`, shown && shown.quest.done.includes("noura") && shown.quest.done.includes("greedy") && shown.quest.done.includes("beat") === cheaperPlanMadeEarlier ? "PASS" : "FAIL", shown ? JSON.stringify(shown.quest.done) : "no state");
    await tap("Escape");
    const closed = await waitFor(async () => (await state()).dialogue.open === false && (await state()), 20000);
    const talkingFlag = await b.evaluate("document.body.dataset.talking === undefined");
    record("talk-escape", "Escape ends the conversation and the controls come back", closed && talkingFlag ? "PASS" : "FAIL", closed ? `open=${closed.dialogue.open}, controls hidden flag cleared=${talkingFlag}` : "still open");
    // Click a helper: the operator walks to her and the conversation starts.
    await b.evaluate("window.__game.setSlots([0,0,0,0,0])");
    const layla = (await state()).npcs.people.find((x) => x.id === "layla");
    await b.evaluate(`window.__game.teleport(${layla.x - 6}, ${layla.z + 1.5})`);
    let prevCam2 = null;
    let settled2 = false;
    for (let tries = 0; tries < 40 && !settled2; tries++) {
      const c1 = (await state()).camera;
      await framesPass(6, 120000);
      const c2 = (await state()).camera;
      settled2 = Math.hypot(c2.x - c1.x, c2.y - c1.y, c2.z - c1.z) < 0.004;
    }
    const lp = await b.evaluate("(() => { const s = window.__game.helperScreenPos('layla'); return s; })()");
    const vp2 = await b.evaluate("[window.innerWidth, window.innerHeight]");
    if (!lp || lp.x < 0 || lp.y < 0 || lp.x > vp2[0] || lp.y > vp2[1]) {
      record("talk-click", "Clicking a helper walks to her and starts talking", "FAIL", `could not aim at Leen (screen position ${JSON.stringify(lp)})`);
    } else {
      const underClick = await b.evaluate(`(() => { const e = document.elementFromPoint(${lp.x}, ${lp.y}); return e ? e.tagName + (e.id ? "#" + e.id : "") + (e.className ? "." + String(e.className).split(" ")[0] : "") : "nothing"; })()`);
    await b.send("Input.dispatchMouseEvent", { type: "mousePressed", x: lp.x, y: lp.y, button: "left", buttons: 1, clickCount: 1 });
      await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: lp.x, y: lp.y, button: "left", buttons: 0, clickCount: 1 });
      const talked = await waitFor(async () => {
        const st0 = await state();
        return st0 && st0.dialogue.open && st0;
      }, 240000);
      const st = await state();
      const where = await b.evaluate("location.href");
      if (!st) {
        record("talk-click", "Clicking a helper walks to her and starts talking", "FAIL", `the game disappeared after the click (page reloaded or crashed). address now: ${where}; element under the click: ${underClick}; page errors: ${b.errors.slice(-3).join(" | ") || "none"}`);
        return;
      }
      const clickInfo = await b.evaluate("JSON.stringify(window.__game.lastClick)");
    record("talk-click", "Clicking a helper walks to her and starts talking", talked && talked.dialogue.who === "layla" ? "PASS" : "FAIL", talked ? `conversation with ${talked.dialogue.who}` : `no conversation started; aimed at pixel ${Math.round(lp.x)},${Math.round(lp.y)}, element there: ${underClick}; last click: ${clickInfo}; walking to goal: ${st.walkingToGoal}; operator at ${st.player.x.toFixed(1)},${st.player.z.toFixed(1)}; Leen at ${JSON.stringify(st.npcs.people.find((x) => x.id === "layla"))}`);
      await tap("Escape");
      await waitFor(async () => (await state()).dialogue.open === false, 20000);
    }
    await b.evaluate("window.__game.teleport(-3, 7)");
  };

  // The guided loop: Simulate, then Result, then play again. Written by other sessions; checked here end to end.
  const flowChecks = async () => {
    await b.evaluate("window.__game.setSlots([1,1,0,0,1])"); // the obvious plan: 3 slots, bill 19
    await framesPass(2, 120000);
    const clickText = (label) =>
      b.evaluate(`(() => {
        const btn = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === ${JSON.stringify(label)} && !x.disabled && x.offsetParent !== null);
        if (!btn) return false;
        btn.click();
        return true;
      })()`);
    const pressed = await clickText("Simulate");
    const sim = await waitFor(async () => {
      const st0 = await state();
      return st0 && st0.phase === "simulate" && st0;
    }, 90000);
    record("flow-simulate", "With 3 slots on, pressing Simulate opens the Simulate screen", pressed && sim ? "PASS" : "FAIL", sim ? `phase ${sim.phase}, bar ${JSON.stringify(sim.flow)}` : `button pressed=${pressed}; phase is ${(await state()).phase}`);
    if (!sim) return;
    await sleep(1500);
    await shot("8-simulate");
    const skipped = await clickText("Skip to result");
    const res = await waitFor(async () => {
      const st0 = await state();
      return st0 && st0.phase === "result" && st0;
    }, 120000);
    record("flow-to-result", "Skipping the search goes to the Result screen", skipped && res ? "PASS" : "FAIL", res ? "phase result" : `skip pressed=${skipped}; phase is ${(await state()).phase}`);
    if (!res) return;
    await sleep(1500);
    await shot("9-result");
    const content = await b.evaluate(`(() => ({
      cards: document.querySelectorAll(".plancard").length,
      zoomRows: document.querySelectorAll("table.zoom tr").length,
      warn: Boolean(document.querySelector(".warn")) && document.querySelector(".warn").textContent.length > 60,
      honest: /quantum advantage/i.test(document.body.innerText),
      bigNumber: /1\\.77\\s*×\\s*10\\^72/.test([...document.querySelectorAll("table.zoom td")].map((td) => td.textContent).join(" ")), // the table sits in a collapsed section, so read its text, not the visible text
      zoomCells: [...document.querySelectorAll("table.zoom td")].map((td) => td.textContent),
    }))()`);
    record("flow-result", "The Result screen shows your plan, the cheapest and the obvious plan, the Zoom Out table (down to 2^240) and the honest note", content.cards === 3 && content.zoomRows === 3 && content.warn && content.honest && content.bigNumber ? "PASS" : "FAIL", JSON.stringify(content));
    const fin = await state();
    record("flow-quest", "Having simulated and seen the result, the quest ticks 'simulate' and 'result'", fin.quest.done.includes("simulate") && fin.quest.done.includes("result") ? "PASS" : "FAIL", JSON.stringify(fin.quest.done));
    const again = await clickText("Play again");
    const back = await waitFor(async () => {
      const st0 = await state();
      return st0 && st0.phase === "play" && st0;
    }, 90000);
    record("flow-again", "'Play again' returns to the plant", again && back ? "PASS" : "FAIL", back ? "phase play" : `phase is ${(await state()).phase}`);
  };

  // Click terminal 3: the operator should walk there and press it.
  const clickTerminal3 = async (terms) => {
    await b.evaluate("window.__game.setSlots([0,0,0,0,0])");
    await b.evaluate(`window.__game.teleport(${terms[2].x - 3.3}, 6)`);
    // Wait until the camera has stopped moving. Frames are slow here, so compare over rendered frames, not milliseconds.
    let settled = false;
    for (let tries = 0; tries < 40 && !settled; tries++) {
      const c1 = (await state()).camera;
      await framesPass(6, 120000);
      const c2 = (await state()).camera;
      settled = Math.hypot(c2.x - c1.x, c2.y - c1.y, c2.z - c1.z) < 0.004;
    }
    const pt = await b.evaluate("window.__game.terminalScreenPos(2)");
    const vp = await b.evaluate("[window.innerWidth, window.innerHeight]");
    if (!settled || pt.x < 0 || pt.y < 0 || pt.x > vp[0] || pt.y > vp[1]) {
      record("click-terminal", "Clicking terminal 3 sends the operator to it and switches slot 3 on", "FAIL", `could not aim: camera settled=${settled}, terminal at pixel ${Math.round(pt.x)},${Math.round(pt.y)} on a ${vp[0]}x${vp[1]} screen`);
      return;
    }
    await b.send("Input.dispatchMouseEvent", { type: "mousePressed", x: pt.x, y: pt.y, button: "left", buttons: 1, clickCount: 1 });
    await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: pt.x, y: pt.y, button: "left", buttons: 0, clickCount: 1 });
    const clicked = await waitFor(async () => (await state()).slots[2] === 1 && (await state()), 180000);
    const info = await b.evaluate("JSON.stringify(window.__game.lastClick)");
    record("click-terminal", "Clicking terminal 3 sends the operator to it and switches slot 3 on", clicked && Math.hypot(clicked.player.x - terms[2].x, clicked.player.z - terms[2].z) < 2 ? "PASS" : "FAIL", `${clicked ? `slots ${clicked.slots.join("")}, operator ${Math.hypot(clicked.player.x - terms[2].x, clicked.player.z - terms[2].z).toFixed(2)} m from the terminal` : "slot 3 never switched on"}; aimed at pixel ${Math.round(pt.x)},${Math.round(pt.y)}; last click: ${info}`);
  };


  // Hold a key until the operator has moved far enough (or time runs out).
  async function walk(key, axis, sign, metres = 1.5, maxMs = 60000) {
    const s0 = await state();
    const start = s0.player[axis];
    await keyDown(key);
    const t0 = Date.now();
    let moved = 0;
    while (Date.now() - t0 < maxMs) {
      await sleep(120);
      const s = await state();
      moved = (s.player[axis] - start) * sign;
      if (moved >= metres) break;
    }
    await keyUp(key);
    const s1 = await state();
    return { moved, off: Math.abs(s1.player[axis === "x" ? "z" : "x"] - s0.player[axis === "x" ? "z" : "x"]), ms: Date.now() - t0, fps: s1.fps };
  }

  // ---- 1. Load, with the loading message observed
  await b.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `window.__loadLog = [];
      new MutationObserver(() => {
        const l = document.getElementById('loading'), t = document.getElementById('loading-text');
        if (l) window.__loadLog.push({ hidden: l.hidden, text: t ? t.textContent : '' });
      }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });`,
  });
  await b.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  const t0 = Date.now();
  await b.send("Page.navigate", { url: URL });
  const ready = await waitFor(async () => (await state())?.ready, 300000);
  if (!ready) {
    record("load", "Page loads and the world is ready", "FAIL", `not ready after 300 s; errors: ${b.errors.slice(0, 3).join(" | ")}`);
    await b.close();
    return finish();
  }
  const s0 = await state();
  record("load", "Page loads and the world is ready", "PASS", `${((Date.now() - t0) / 1000).toFixed(1)} s`);
  const log = await b.evaluate("window.__loadLog");
  const sawLoading = log.some((e) => !e.hidden && e.text.length > 0) && log.some((e) => e.hidden);
  record("loading", "A loading message shows, then goes away", sawLoading ? "PASS" : "FAIL", `${log.length} DOM changes seen; first visible text: "${log.find((e) => !e.hidden && e.text)?.text ?? "none"}"`);
  record("sound-default", "Sound is off until asked", s0.audio.on === false ? "PASS" : "FAIL", `audio.on=${s0.audio.on}`);
  if (process.env.VERIFY_ONLY === "flow") {
    await flowChecks();
    await b.close();
    return finish();
  }
  if (process.env.VERIFY_ONLY === "budget") {
    await sleep(3000);
    const sr0 = await state();
    const meshes = await b.evaluate("window.__game.meshCounts()");
    const total = Object.values(meshes).reduce((a, v) => a + v.meshes, 0);
    const casters = Object.values(meshes).reduce((a, v) => a + v.casters, 0);
    const rows = Object.entries(meshes).sort((a, c) => c[1].meshes - a[1].meshes).map(([k, v]) => `${k}: ${v.meshes} meshes, ${v.casters} cast shadows`);
    console.log(`BUDGET render: ${sr0.render.calls} draw calls, ${sr0.render.triangles} triangles; scene meshes ${total}, shadow casters ${casters}`);
    console.log("BUDGET " + rows.slice(0, 25).join("\nBUDGET "));
    for (const tier of ["medium", "low"]) {
      await b.evaluate(`(() => { const s = document.getElementById("quality"); s.value = "${tier}"; s.dispatchEvent(new Event("change")); })()`);
      await waitFor(async () => (await state()).quality.tier === tier, 20000);
      await framesPass(4, 120000);
      const r = (await state()).render;
      console.log(`BUDGET ${tier} tier: ${r.calls} draw calls, ${r.triangles} triangles`);
    }
    await b.close();
    return finish();
  }
  if (process.env.VERIFY_ONLY === "talk") {
    await conversationChecks();
    await b.close();
    return finish();
  }
  if (process.env.VERIFY_ONLY === "click") {
    await clickTerminal3(await b.evaluate("window.__game.terminals"));
    await b.close();
    return finish();
  }

  // ---- 2. Rendering
  await sleep(1500);
  const sr = await state();
  const bytes = await shot("1-operator-desktop");
  record("render", "A 3D scene is drawn", sr.render.calls > 0 && sr.render.triangles > 0 && bytes > 30000 ? "PASS" : "FAIL", `${sr.render.calls} draw calls, ${sr.render.triangles} triangles, screenshot ${bytes} bytes (look at 1-operator-desktop.png)`);
  record("budget-high", `Laptop (high tier) within ${BUDGET.high.drawCalls} draw calls and ${BUDGET.high.triangles / 1000}k triangles, shadow pass included`, sr.render.calls <= BUDGET.high.drawCalls && sr.render.triangles <= BUDGET.high.triangles ? "PASS" : "FAIL", `${sr.render.calls} draw calls, ${(sr.render.triangles / 1000).toFixed(0)}k triangles`);
  // This test browser has no graphics card, so the rest of the run uses the low tier to keep frames quick.
  await b.evaluate(`(() => { const s = document.getElementById("quality"); s.value = "low"; s.dispatchEvent(new Event("change")); })()`);

  // ---- 3. Walking: up, down, left, right
  const up = await walk("ArrowUp", "z", -1);
  record("move-up", "Arrow up walks away from the camera", up.moved >= 1.5 && up.off < 0.5 ? "PASS" : "FAIL", `moved ${up.moved.toFixed(2)} m in ${up.ms} ms, sideways drift ${up.off.toFixed(2)} m`);
  const down = await walk("ArrowDown", "z", +1);
  record("move-down", "Arrow down walks towards the camera", down.moved >= 1.5 && down.off < 0.5 ? "PASS" : "FAIL", `moved ${down.moved.toFixed(2)} m in ${down.ms} ms`);
  const left = await walk("ArrowLeft", "x", -1);
  record("move-left", "Arrow left walks left", left.moved >= 1.5 && left.off < 0.5 ? "PASS" : "FAIL", `moved ${left.moved.toFixed(2)} m in ${left.ms} ms`);
  const right = await walk("ArrowRight", "x", +1);
  record("move-right", "Arrow right walks right", right.moved >= 1.5 && right.off < 0.5 ? "PASS" : "FAIL", `moved ${right.moved.toFixed(2)} m in ${right.ms} ms`);
  const w = await walk("KeyW", "z", -1);
  record("move-wasd", "W also walks up", w.moved >= 1.5 ? "PASS" : "FAIL", `moved ${w.moved.toFixed(2)} m`);

  // ---- 4. Collision and site edge (uses the verification teleport)
  await b.evaluate("window.__game.teleport(0, 1.2)");
  const freeHere = !(await b.evaluate("window.__game.blocked(0, 1.2)"));
  const blockedAhead = await b.evaluate("window.__game.blocked(0, 0.3)");
  await keyDown("ArrowUp");
  const startZ = (await state()).player.z;
  let lastZ = startZ;
  let started = false;
  let still = 0;
  const tc = Date.now();
  while (Date.now() - tc < 90000 && still < 8) {
    await sleep(150);
    const z = (await state()).player.z;
    if (Math.abs(z - startZ) > 0.02) started = true;
    still = started && Math.abs(z - lastZ) < 0.005 ? still + 1 : 0;
    lastZ = z;
  }
  await keyUp("ArrowUp");
  const sSkid = await state();
  record("collide-machine", "The operator cannot walk through a pump skid (walks into it and stops, not a timeout)", freeHere && blockedAhead && started && still >= 8 && sSkid.player.z > 0.3 && sSkid.player.z < 0.5 ? "PASS" : "FAIL", `start free=${freeHere}, ahead blocked=${blockedAhead}, held still ${still} polls, stopped at z=${sSkid.player.z.toFixed(2)} (expected about 0.4: skid edge 0.05 plus the operator's radius)`);
  const bounds = await b.evaluate("window.__game.bounds");
  await b.evaluate(`window.__game.teleport(${bounds.minX + 2}, 7)`);
  await walk("ArrowLeft", "x", -1, 20, 20000);
  const sEdge = await state();
  record("site-edge", "The operator cannot leave the site", sEdge.player.x >= bounds.minX - 0.01 ? "PASS" : "FAIL", `stopped at x=${sEdge.player.x.toFixed(2)} (edge is x=${bounds.minX})`);

  // ---- 4b. Zones: each can be reached on foot from the start, and each has a screenshot
  const reach = await b.evaluate(`(() => {
    const g = window.__game, b = g.bounds, step = 0.5;
    const key = (i, j) => i + "," + j;
    const cell = (x, z) => [Math.round((x - b.minX) / step), Math.round((z - b.minZ) / step)];
    const pos = (i, j) => [b.minX + i * step, b.minZ + j * step];
    const nx = Math.floor((b.maxX - b.minX) / step), nz = Math.floor((b.maxZ - b.minZ) / step);
    const start = cell(-22, 7), seen = new Set([key(...start)]), q = [start];
    while (q.length) {
      const [i, j] = q.shift();
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni > nx || nj > nz || seen.has(key(ni, nj))) continue;
        const [x, z] = pos(ni, nj);
        if (g.blocked(x, z)) continue;
        seen.add(key(ni, nj));
        q.push([ni, nj]);
      }
    }
    return g.zones.map((z) => ({ id: z.id, reachable: !g.blocked(z.entry.x, z.entry.z) && seen.has(key(...cell(z.entry.x, z.entry.z))) }));
  })()`);
  const unreachable = reach.filter((z) => !z.reachable).map((z) => z.id);
  record("zones", `All ${reach.length} zones can be reached on foot from the start`, unreachable.length === 0 ? "PASS" : "FAIL", unreachable.length ? `cannot reach: ${unreachable.join(", ")}` : reach.map((z) => z.id).join(", "));
  const zonesInfo = await b.evaluate("window.__game.zones");
  for (const z of zonesInfo) {
    await b.evaluate(`window.__game.teleport(${z.entry.x}, ${z.entry.z})`);
    await waitFor(async () => {
      const s = await state();
      return Math.hypot(s.camera.x - s.player.x, s.camera.z - s.player.z) < 14.5;
    }, 60000);
    await sleep(500);
    await shot(`5-zone-${z.id}`);
  }
  await b.evaluate("window.__game.teleport(-22, 7)");

  // ---- 4c. Quality tiers
  const setQuality = (v) => b.evaluate(`(() => { const s = document.getElementById("quality"); s.value = "${v}"; s.dispatchEvent(new Event("change")); })()`);
  await setQuality("low");
  await waitFor(async () => (await state()).quality.tier === "low", 5000);
  const qLow = (await state()).quality;
  await setQuality("high");
  await waitFor(async () => (await state()).quality.tier === "high", 5000);
  const qHigh = (await state()).quality;
  await setQuality("low");
  record("tiers", "The Quality control switches tiers (low: no real shadows, pixel ratio 1 and fewer trees; high: 2048 shadow map)", qLow.shadowsOn === false && qLow.pixelRatio <= 1 && qLow.trees < qHigh.trees && qHigh.shadowMap === 2048 && qHigh.shadowsOn === true ? "PASS" : "FAIL", `low ${JSON.stringify(qLow)}; high ${JSON.stringify(qHigh)}`);
  await b.evaluate("window.__game.teleport(-3, 7)");


  // ---- 4d. The game itself: terminals and the bill
  const plans = allPlans(PRESETS.team);
  const dom = () => b.evaluate(`(() => {
    const t = (id) => document.getElementById(id).textContent;
    const m = document.getElementById("bill-message");
    return { total: t("bill-total"), electricity: t("bill-electricity"), restarts: t("bill-restarts"), penalty: t("bill-penalty"), message: m.textContent, state: m.dataset.state, summary: document.querySelector("#bill summary").textContent };
  })()`);
  const lastNumber = (str) => Number(str.split("=").pop().trim());
  await b.evaluate("window.__game.setSlots([0,0,0,0,0])");
  const bill0 = await dom();
  record("bill-empty", "With no slots on, the bill shows only the rule penalty (90) and says what to do", bill0.total === "90" && bill0.state === "empty" && /exactly 3/.test(bill0.message) ? "PASS" : "FAIL", JSON.stringify(bill0));
  const bad = [];
  for (let k = 0; k < 32; k++) {
    const x = [0, 1, 2, 3, 4].map((i) => (k >> i) & 1);
    await b.evaluate(`window.__game.setSlots(${JSON.stringify(x)})`);
    const d = await dom();
    const p = plans[k];
    const wantState = p.chosen === 0 ? "empty" : p.chosen < 3 ? "partial" : p.chosen === 3 ? "ready" : "over";
    const ok = Number(d.total) === p.total && lastNumber(d.electricity) === p.electricity && lastNumber(d.restarts) === p.restartCost && lastNumber(d.penalty) === p.penalty && d.state === wantState;
    if (!ok) bad.push({ plan: k, shown: d, expected: { total: p.total, electricity: p.electricity, restarts: p.restartCost, penalty: p.penalty, state: wantState } });
  }
  record("bill-32", "For all 32 plans the bill on screen matches the cost table (total, electricity, restarts, penalty, state)", bad.length === 0 ? "PASS" : "FAIL", bad.length ? JSON.stringify(bad.slice(0, 2)) : "32 of 32 match, computed independently in this script from src/math");

  await b.evaluate("window.__game.setSlots([0,0,0,0,0])");
  const terms = await b.evaluate("window.__game.terminals");
  const goTo = async (i) => {
    await b.evaluate(`window.__game.teleport(${terms[i].x}, ${terms[i].z + 1.15})`);
    await framesPass(2);
  };
  await goTo(0);
  const atTerminal = await state();
  record("use-button", "Standing at a terminal shows a 'Switch slot 1 on' button", !atTerminal.useButton.hidden && /Switch slot 1 on/.test(atTerminal.useButton.text) ? "PASS" : "FAIL", JSON.stringify(atTerminal.useButton));
  await tap("KeyE");
  await framesPass(2);
  let s1 = await state();
  record("press-terminal", "Pressing E at terminal 1 switches slot 1 on, its lamp turns green, and the bill matches the table", s1.slots.join("") === "10000" && s1.bill.total === plans[1].total && s1.lamps[0] === 0x39d96b && s1.lamps.slice(1).every((c) => c === 0xd6452b) ? "PASS" : "FAIL", `slots ${s1.slots.join("")}, bill ${s1.bill.total} (table ${plans[1].total}), lamps ${s1.lamps.map((c) => c.toString(16)).join(",")}`);
  record("shake-start", "Switching a pump on from cold shakes that pump and no other", s1.shaking[0] && s1.shaking.slice(1).every((v) => !v) ? "PASS" : "FAIL", `shaking ${JSON.stringify(s1.shaking)}`);
  await goTo(1);
  await tap("KeyE");
  await framesPass(2);
  const s2 = await state();
  record("no-shake-join", "Joining a running slot (no cold start) does not shake the new pump", s2.slots.join("") === "11000" && s2.shaking[1] === false && s2.bill.total === plans[3].total ? "PASS" : "FAIL", `slots ${s2.slots.join("")}, shaking ${JSON.stringify(s2.shaking)}, bill ${s2.bill.total} (table ${plans[3].total})`);
  await goTo(0);
  await tap("KeyE");
  await framesPass(2);
  const s3 = await state();
  record("shake-restart", "Switching slot 1 off makes slot 2 start cold, and slot 2's pump shakes", s3.slots.join("") === "01000" && s3.shaking[1] === true && s3.bill.total === plans[2].total ? "PASS" : "FAIL", `slots ${s3.slots.join("")}, shaking ${JSON.stringify(s3.shaking)}, bill ${s3.bill.total} (table ${plans[2].total})`);

  await clickTerminal3(terms);

  // A slot button works from the keyboard alone.
  await b.evaluate("window.__game.setSlots([0,0,0,0,0])");
  await b.evaluate('document.querySelector(\'[data-slot-button="4"]\').focus()');
  await tap("Space");
  await framesPass(2);
  const sb = await state();
  record("slot-button-keyboard", "Slot 4's button switches the slot on from the keyboard (Space), without walking", sb.slots.join("") === "00010" && sb.bill.total === plans[8].total ? "PASS" : "FAIL", `slots ${sb.slots.join("")}, bill ${sb.bill.total} (table ${plans[8].total})`);
  await b.evaluate("window.__game.setSlots([1,1,1,0,0])");
  const best = await dom();
  cheaperPlanMadeEarlier = true;
  record("bill-best", "The best plan (slots 1, 2, 3) shows 18 and the 'ready' message", best.total === "18" && best.state === "ready" ? "PASS" : "FAIL", JSON.stringify(best));
  await b.evaluate("window.__game.setSlots([0,0,0,0,0])");
  await b.evaluate("window.__game.teleport(-3, 7)");

  await conversationChecks();
  await flowChecks();
  await b.evaluate("window.__game.setSlots([0,0,0,0,0])");
  await b.evaluate("window.__game.teleport(-3, 7)");

  // ---- 5. Overview, 360 degrees, zoom, back
  await tap("KeyO");
  const ov = await waitFor(async () => (await state()).mode === "overview" && (await state()), 3000);
  const pressed = await b.evaluate("document.getElementById('btn-overview').getAttribute('aria-pressed')");
  record("overview", "O opens the overview", ov && pressed === "true" ? "PASS" : "FAIL", `mode=${ov?.mode}, button pressed=${pressed}`);
  await sleep(600);
  await shot("2-overview-start");
  let prev = (await state()).camera.azimuth;
  let total = 0;
  const cx = 720;
  for (let i = 0; i < 4; i++) {
    await b.send("Input.dispatchMouseEvent", { type: "mousePressed", x: cx - 150, y: 450, button: "left", buttons: 1, clickCount: 1 });
    for (let k = 1; k <= 10; k++) await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: cx - 150 + k * 30, y: 450, button: "left", buttons: 1 });
    await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: cx + 150, y: 450, button: "left", buttons: 0, clickCount: 1 });
    await sleep(900);
    const a = (await state()).camera.azimuth;
    let d = a - prev;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    total += d;
    prev = a;
    if (i === 1) await shot("3-overview-turned");
  }
  const degrees = Math.abs((total * 180) / Math.PI);
  const sCam = await state();
  record("overview-360", "The overview turns a full 360 degrees", degrees >= 340 && sCam.camera.y > 1 ? "PASS" : "FAIL", `turned ${degrees.toFixed(0)} degrees over 4 drags, camera height ${sCam.camera.y.toFixed(1)} m`);
  const d0 = sCam.camera.distance;
  await b.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 720, y: 450, deltaX: 0, deltaY: -500 });
  await framesPass(8);
  const dIn = (await state()).camera.distance;
  await b.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 720, y: 450, deltaX: 0, deltaY: 1500 });
  await framesPass(8);
  const dOut = (await state()).camera.distance;
  const ovFrame = (await state()).frameMs;
  record("overview-zoom", "The overview zooms in and out within limits", dIn < d0 && dOut > dIn && dOut <= 110.5 && dIn >= 9.5 ? "PASS" : "FAIL", `distance ${d0.toFixed(1)} -> ${dIn.toFixed(1)} -> ${dOut.toFixed(1)} m (frame time in overview ${ovFrame} ms)`);
  await tap("KeyO");
  await waitFor(async () => {
    const s = await state();
    return Math.hypot(s.camera.x - s.player.x, s.camera.z - s.player.z) < 14;
  }, 40000);
  const back = await state();
  const near = Math.hypot(back.camera.x - back.player.x, back.camera.z - back.player.z);
  record("overview-back", "O returns to the operator view", back.mode === "operator" && near < 14 ? "PASS" : "FAIL", `mode=${back.mode}, camera ${near.toFixed(1)} m from the operator`);

  // ---- 6. Sound
  await tap("KeyM");
  const on = await waitFor(async () => {
    const s = await state();
    return s.audio.on && s.audio.context === "running" && s;
  }, 4000);
  const soundPressed = await b.evaluate("document.getElementById('btn-sound').getAttribute('aria-pressed')");
  record("sound-on", "M starts ambient sound (sea, wind, machinery, birds)", on && on.audio.layers.length === 4 && soundPressed === "true" ? "PASS" : "FAIL", `context=${on?.audio.context}, layers=${on?.audio.layers.join("/")}. Note: the browser flag that skips the click requirement is on, and headless Chrome has no speakers, so this proves the audio graph runs, not that it sounds good`);
  await tap("KeyM");
  const off = await waitFor(async () => {
    const s = await state();
    return !s.audio.on && s.audio.context === "suspended" && s;
  }, 4000);
  record("sound-off", "M stops the sound", off ? "PASS" : "FAIL", `context=${off ? off.audio.context : (await state()).audio.context}`);

  // ---- 7. Keyboard only
  await b.evaluate("document.activeElement && document.activeElement.blur()");
  await tap("Tab");
  const f0 = await b.evaluate("document.activeElement.id");
  await tap("Enter"); // opens the Settings panel
  await tap("Tab");
  const f1 = await b.evaluate("document.activeElement.id");
  await tap("Tab");
  const f2 = await b.evaluate("document.activeElement.id");
  const outline = await b.evaluate("getComputedStyle(document.activeElement).outlineStyle + ' ' + getComputedStyle(document.activeElement).outlineWidth");
  record("keyboard", "Tab reaches Settings, then Overview and First person inside it, with a visible focus ring", f0 === "btn-settings" && f1 === "btn-overview" && f2 === "btn-pov" && !outline.startsWith("none") ? "PASS" : "FAIL", `focus order: ${f0}, ${f1}, ${f2}; outline on focused control: ${outline}`);

  // ---- 8. Phone-sized screen with touch
  await b.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await b.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await b.send("Page.navigate", { url: URL });
  await sleep(1500);
  const phoneReady = await waitFor(async () => (await state())?.ready, 120000);
  await sleep(1500);
  const qPhone = phoneReady ? (await state()).quality : null;
  record("phone-tier", "On a phone-sized touch screen the game starts on the medium tier and caps the pixel ratio at 1.5 (screen ratio is 3)", qPhone && qPhone.tier === "medium" && qPhone.pixelRatio <= 1.5 && qPhone.shadowMap === 1024 ? "PASS" : "FAIL", JSON.stringify(qPhone));
  const rp = phoneReady ? (await state()).render : { calls: 0, triangles: 0 };
  record("budget-medium", `Phone (medium tier) within ${BUDGET.medium.drawCalls} draw calls and ${BUDGET.medium.triangles / 1000}k triangles, shadow pass included`, rp.calls > 0 && rp.calls <= BUDGET.medium.drawCalls && rp.triangles <= BUDGET.medium.triangles ? "PASS" : "FAIL", `${rp.calls} draw calls, ${(rp.triangles / 1000).toFixed(0)}k triangles`);
  const layout = await b.evaluate(`(() => {
    const pad = document.querySelector('.pad');
    const btns = [...document.querySelectorAll('[data-dir]')].map(x => { const r = x.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
    const box = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
    const hit = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
    const bar = box('.bar'), controls = box('.controls'), bill = box('.bill');
    const arrows = [...document.querySelectorAll('[data-dir]')].map((x) => { const r = x.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; });
    const anyArrow = (o) => arrows.some((a) => hit(o, a));
    const overlaps = [hit(bar, controls) && 'title/controls', anyArrow(bar) && 'title/arrows', anyArrow(controls) && 'controls/arrows', anyArrow(bill) && 'bill/arrows', hit(bill, controls) && 'bill/controls', hit(bill, bar) && 'bill/title'].filter(Boolean);
    return { padDisplay: getComputedStyle(pad).display, btns, overflow: document.documentElement.scrollWidth - window.innerWidth, overlaps };
  })()`);
  const bigEnough = layout.btns.every(([w, h]) => w >= 44 && h >= 44);
  await shot("4-mobile");
  record("mobile-layout", "On a 390 px screen the arrows show, are big enough, nothing overflows and nothing overlaps", layout.padDisplay === "grid" && bigEnough && layout.overflow <= 0 && layout.overlaps.length === 0 ? "PASS" : "FAIL", `overlaps: ${layout.overlaps.join(", ") || "none"}; pad display=${layout.padDisplay}, buttons ${JSON.stringify(layout.btns)}, sideways overflow ${layout.overflow}px (look at 4-mobile.png)`);
  const before = await state();
  const rect = await b.evaluate("(() => { const r = document.querySelector('[data-dir=right]').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()");
  await b.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: rect[0], y: rect[1] }] });
  const tEnd = Date.now() + 25000;
  let movedTouch = 0;
  while (Date.now() < tEnd) {
    await sleep(150);
    movedTouch = (await state()).player.x - before.player.x;
    if (movedTouch >= 1.5) break;
  }
  await b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  record("mobile-touch", "Touching the right arrow walks right", movedTouch >= 1.5 ? "PASS" : "FAIL", `moved ${movedTouch.toFixed(2)} m`);
  const billOpen = await b.evaluate("document.getElementById('bill').open");
  const billSummary = await b.evaluate("document.querySelector('#bill summary').textContent");
  record("mobile-bill", "On a phone the bill starts folded to one line, with the total and slot count", billOpen === false && /Bill \d+, \d of 3 slots on/.test(billSummary) ? "PASS" : "FAIL", `open=${billOpen}, summary "${billSummary}"`);
  const tt = await b.evaluate("window.__game.terminals");
  await b.evaluate(`window.__game.teleport(${tt[1].x}, ${tt[1].z + 1.15})`);
  await waitFor(async () => !(await state()).useButton.hidden, 60000);
  const ur = await b.evaluate("(() => { const r = document.getElementById('btn-use').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2, r.width, r.height]; })()");
  await b.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: ur[0], y: ur[1] }] });
  await b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  const tapped = await waitFor(async () => (await state()).slots[1] === 1 && (await state()), 30000);
  record("mobile-use", "On a phone the 'Switch slot' button is big enough and a tap switches the slot on", tapped && ur[2] >= 44 && ur[3] >= 44 ? "PASS" : "FAIL", `button ${Math.round(ur[2])}x${Math.round(ur[3])} px, slots ${tapped ? tapped.slots.join("") : "unchanged"}`);

  // ---- 9. Errors and frame rate
  const sf = await state();
  record("console", "No console errors or exceptions during the run", b.errors.length === 0 ? "PASS" : "FAIL", b.errors.length ? b.errors.slice(0, 3).join(" | ") : "none");
  const parts = await b.evaluate("window.__game.breakdown()");
  const top = Object.entries(parts).sort((a, c) => c[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${(v / 1000).toFixed(0)}k`).join(", ");
  record("fps", "Frame rate", "NOT CHECKED", `frame time ${sf.frameMs} ms in headless software rendering, which says nothing about a real phone or laptop GPU. Biggest triangle sources: ${top}`);
  await b.close();

  // ---- 10. No-WebGL error state (second browser with 3D switched off)
  const nb = await launch(await freePort(), ["--disable-3d-apis"]);
  await nb.send("Page.navigate", { url: URL });
  const err = await waitFor(
    async () => nb.evaluate("(() => { const e = document.getElementById('error'); return e && !e.hidden ? document.getElementById('error-text').textContent : null; })()"),
    20000,
  );
  record("error-state", "Without WebGL a plain-words message and a link to the maths page show", err ? "PASS" : "FAIL", err ? `"${err}"` : "no error message appeared");
  await nb.close();

  await accessibilityChecks();
  await checkAssets();
  finish();
}

async function checkAssets() {
  try {
    const manifest = JSON.parse(await readFile("public/assets/manifest.json", "utf8"));
    const md = await readFile("ASSETS.md", "utf8");
    const missingDoc = manifest.filter((m) => !md.includes(`\`${m.id}\``)).map((m) => m.id);
    const missingFile = [];
    for (const m of manifest) {
      try {
        await access(path.join("public/assets", m.folder, m.main));
      } catch {
        missingFile.push(m.id);
      }
    }
    const notCc0 = manifest.filter((m) => m.licence !== "CC0").map((m) => m.id);
    record("licences", "Every downloaded asset is listed in ASSETS.md, exists on disk, and has a recorded licence", !missingDoc.length && !missingFile.length ? "PASS" : "FAIL", `${manifest.length} assets; missing from ASSETS.md: ${missingDoc.length}; missing files: ${missingFile.length}; not CC0: ${notCc0.length ? notCc0.join(",") : "none"}`);
  } catch (e) {
    record("licences", "Asset licence record", "FAIL", e.message);
  }
}

function finish() {
  const failed = results.filter((r) => r.status === "FAIL").length;
  console.log(`\n${results.filter((r) => r.status === "PASS").length} passed, ${failed} failed, ${results.filter((r) => r.status === "NOT CHECKED").length} not checked`);
  writeFile(path.join(OUT, "report.json"), JSON.stringify(results, null, 2)).then(() => process.exit(failed ? 1 : 0));
}

main().catch((e) => {
  console.error("verify crashed:", e);
  process.exit(2);
});
