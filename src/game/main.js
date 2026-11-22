// Stage 4: terminals and the bill. Walk to a control post and press it (E or Space, or click it),
// the slot switches on, the pump shudders on a cold start, and the bill shows every number.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { pickLang, gameStrings, LANGUAGES } from "../i18n.js";
import "./i18n.css";
import "./simLayout.js";
import { PRESETS } from "../math/index.js";
import { createAssets } from "./assets.js";
import { createInput } from "./input.js";
import { createAmbience } from "./audio.js";
import { createUiSound } from "./uisound.js";
import { buildPlayer } from "./characters.js";
import { createNpcs } from "./npcs.js";
import { createSky } from "./sky.js";
import { createQuality, startingTier, TIERS } from "./quality.js";
import { createBillPanel } from "./billpanel.js";
import { createTerminals } from "./terminals.js";
import { createPumps } from "./pumps.js";
import { createSiteTags } from "./siteTags.js";
import { createArcade3d } from "./arcade3d.js";
import { createTrail } from "./trail.js";
import { billLines, newStarts } from "./bill.js";
import { createFlow } from "./flow.js";
import { createTankField } from "./tankField.js";
import { createSimView } from "./simView.js";
import { nearestTerminal, standPoint, terminalAt } from "./interact.js";
import { buildWorld, BOUNDS, SPAWN, CENTER } from "./world.js";
import { allPlans, greedyPlan } from "../math/index.js";
import { createDialogue } from "./dialogue.js";
import { createQuest } from "./quest.js";
import { DEMO, dialogueVars } from "./scripts.js";
import { cheapPeople } from "./perf.js";

const savedLang = (() => {
  try {
    return localStorage.getItem("qw-lang") || "";
  } catch {
    return "";
  }
})();
const LANG = pickLang(location.search, savedLang);
const t = gameStrings(LANG);
document.documentElement.lang = LANG;
document.documentElement.dir = LANG === "ar" ? "rtl" : "ltr";
const $ = (id) => document.getElementById(id);
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k]);
const canvas = $("scene");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarse = matchMedia("(pointer: coarse)").matches || Math.min(window.innerWidth, window.innerHeight) < 700;

const hintText = coarse ? t.hintTouch : t.hint;
$("hint").textContent = hintText;
$("btn-overview").textContent = t.overview;
$("btn-pov").textContent = t.pov;
$("btn-sound").textContent = t.soundOff;
$("error-link").textContent = t.errorLink;
$("loading-text").textContent = t.loading;
$("quality").setAttribute("aria-label", t.quality.label);
for (const [value, label] of Object.entries({ auto: t.quality.auto, high: t.quality.high, medium: t.quality.medium, low: t.quality.low })) {
  $("quality").append(new Option(label, value));
}
// Language: changing it reloads the page, so every screen is rebuilt in the new language.
const langSelect = document.createElement("select");
langSelect.id = "lang";
langSelect.setAttribute("aria-label", t.language);
for (const [value, label] of Object.entries(LANGUAGES)) langSelect.append(new Option(label, value, false, value === LANG));
langSelect.addEventListener("change", () => {
  try {
    localStorage.setItem("qw-lang", langSelect.value);
  } catch {}
  const url = new URL(location.href);
  url.searchParams.set("lang", langSelect.value);
  location.href = url.toString();
});
$("settings-panel").append(langSelect);

// The two selects stay in the page (checks and the quality code drive them) but are hidden. Each gets a
// row of option buttons instead, so every choice is one click and nothing opens as a grey system popup.
function optionRow(select, label) {
  const wrap = document.createElement("div");
  wrap.className = "opt-group";
  wrap.setAttribute("role", "radiogroup");
  wrap.setAttribute("aria-label", label);
  const title = document.createElement("div");
  title.className = "opt-title";
  title.textContent = label;
  wrap.append(title);
  const buttons = [...select.options].map((o) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "opt";
    b.setAttribute("role", "radio");
    b.textContent = o.textContent;
    b.addEventListener("click", () => {
      if (select.value === o.value) return;
      select.value = o.value;
      select.dispatchEvent(new Event("change"));
    });
    wrap.append(b);
    return [o.value, b];
  });
  const sync = () => buttons.forEach(([v, b]) => b.setAttribute("aria-checked", String(v === select.value)));
  select.addEventListener("change", sync);
  sync();
  select.after(wrap);
}
optionRow($("quality"), t.quality.label);
optionRow(langSelect, t.language);

// Settings: one button opens a panel with the view, sound, quality and language controls.
const uiSound = createUiSound();
const settingsBtn = $("btn-settings");
function setSettings(open) {
  $("settings-panel").hidden = !open;
  settingsBtn.setAttribute("aria-expanded", String(open));
}
settingsBtn.textContent = `\u2699 ${t.settings}`;
settingsBtn.addEventListener("click", () => setSettings($("settings-panel").hidden));
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("settings-panel").hidden) {
    setSettings(false);
    settingsBtn.focus();
  }
});
document.addEventListener("pointerdown", (e) => {
  if (!$("settings-panel").hidden && !e.target.closest(".controls")) setSettings(false);
});
const showClick = () => {
  $("btn-click").textContent = uiSound.enabled ? t.clickSounds : t.clickSoundsOff;
  $("btn-click").setAttribute("aria-pressed", String(uiSound.enabled));
};
showClick();
$("btn-click").addEventListener("click", () => {
  uiSound.set(!uiSound.enabled);
  showClick();
});
// A soft pop on every button, tab or summary press (keyboard presses too). Disabled buttons stay quiet.
document.addEventListener(
  "click",
  (e) => {
    const el = e.target.closest && e.target.closest("button, summary, select");
    if (el && !el.disabled && el.id !== "btn-click") uiSound.click();
  },
  true,
);

function fail(message) {
  $("loading").hidden = true;
  $("error-text").textContent = message;
  $("error").hidden = false;
}

let renderer;
try {
  // Anti-aliasing cannot change after start, and phones do not need it at their pixel density.
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !coarse, powerPreference: "high-performance" });
} catch {
  fail(t.errorNoWebGL);
}

if (renderer) start().catch((err) => {
  console.error(err);
  fail(t.errorLoad);
});

async function start() {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 700);

  const manager = new THREE.LoadingManager();
  manager.onProgress = (_url, loaded, total) => {
    $("loading-bar").value = Math.round((loaded / total) * 100);
  };
  const assets = createAssets(manager);

  const sun = new THREE.DirectionalLight(0xfff0dc, 2.6);
  sun.position.set(-30, 40, 22);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -42, right: 42, top: 32, bottom: -32, near: 1, far: 140 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  const sky = createSky(renderer, scene, sun.position, { reduceMotion });

  const world = await buildWorld(scene, assets, t);

  const operator = buildPlayer();
  operator.position.set(SPAWN.x, 0, SPAWN.z);
  operator.rotation.y = Math.PI; // facing away from the camera, towards the sea
  scene.add(operator);

  const controls = new OrbitControls(camera, canvas);
  controls.enabled = false;
  controls.enableDamping = true;
  controls.minDistance = 10;
  controls.maxDistance = 110;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.target.copy(CENTER);

  const ambience = createAmbience();
  const input = createInput(act);

  // ---- the game: five slots, a bill, five terminals, five pumps
  const model = PRESETS.team;
  const slots = [0, 0, 0, 0, 0];
  let flow = null;
  let quest = null; // the quest log
  let dialogue = null; // conversations with the helpers
  let phase = "play"; // title | play | simulate | result | around; the flow module changes it
  const terminalsUi = createTerminals(world.terminals, model, t.terminal);
  const pumps = createPumps(scene, world.pumpModel, world.pumpBays, { reduceMotion });
  const siteTags = createSiteTags({ stage: document.querySelector(".stage"), canvas, camera, bays: world.pumpBays, text: t.flow.result.site });
  let coldSlots = []; // bays that start cold in the player's plan; their pumps shudder again on the Result screen
  let coldClock = 0;
  const field = createTankField({ scene, model, reduceMotion });
  // Simulate in the real plant: electricity towers at the pumps, with the tank yard and chart as options.
  const simView = createSimView({ scene, stage: document.querySelector(".stage"), canvas, camera, field, bays: world.pumpBays, model, text: t.flow.simview, reduceMotion });
  const arcade = createArcade3d(scene, world.terminals, world.pumpBays, model);
  const panel = createBillPanel({ root: $("bill"), model, text: t.bill, onToggle: (i) => toggleSlot(i) });
  if (window.innerWidth <= 700) $("bill").open = false;

  function applySlots(next, { shake = true } = {}) {
    const before = slots.slice();
    next.forEach((v, i) => (slots[i] = v ? 1 : 0));
    slots.forEach((v, i) => {
      terminalsUi.set(i, Boolean(v));
      pumps.setRunning(i, Boolean(v));
      arcade.setOn(i, Boolean(v));
    });
    if (shake) for (const s of newStarts(before, slots)) pumps.shake(s - 1);
    panel.update(slots);
    if (flow) flow.onSlots(slots);
    if (quest) quest.slots(slots);
  }
  function toggleSlot(i) {
    const next = slots.slice();
    next[i] = next[i] ? 0 : 1;
    applySlots(next);
    $("status").textContent = fill(next[i] ? t.statusSlotOn : t.statusSlotOff, { n: i + 1 });
  }
  applySlots(slots, { shake: false });

  // ---- size
  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);

  // ---- quality tiers: pixel ratio, shadow map, sea update rate, trees and shrubs
  const quality = createQuality({
    start: startingTier(coarse),
    apply(name) {
      const tier = TIERS[name];
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, tier.pixelRatio));
      resize();
      sun.shadow.mapSize.set(tier.shadow, tier.shadow);
      sun.castShadow = tier.shadows !== false; // the low tier draws no real shadows at all (people keep a blob)
      if (sun.shadow.map) {
        sun.shadow.map.dispose();
        sun.shadow.map = null;
      }
      world.setSeaEvery(tier.seaEvery);
      world.trees.forEach((tree, i) => (tree.visible = i < Math.ceil(world.trees.length * tier.trees)));
      world.shrubs.forEach((s) => (s.visible = tier.shrubs));
      for (const tree of world.trees) tree.traverse((o) => o.isMesh && (o.castShadow = tier.treeShadows));
    },
  });
  $("quality").addEventListener("change", () => {
    quality.choose($("quality").value);
    $("status").textContent = `${t.quality.label}: ${quality.tier}.`;
  });

  // ---- state
  const player = { speed: 3.6, radius: 0.35, phase: 0 };
  let mode = "operator";
  let fps = 60;
  let frameMs = 16;
  let frames = 0;
  let lastFrame = performance.now();
  let pressT = -1;
  let goal = null; // where a click sent the operator: { x, z, then, stuck }

  function act(action) {
    if (dialogue && dialogue.isOpen) {
      if (action === "use") dialogue.advance();
      if (action === "sound") toggleSound();
      return;
    }
    if (phase !== "play" && phase !== "around") return;
    if (action === "overview" && phase === "play") toggleOverview();
    if (action === "sound") toggleSound();
    if (action === "pov" && phase === "play" && mode === "operator") togglePov();
    if (action === "use" && mode === "operator" && phase === "play") {
      if (useNearest()) uiSound.click();
      else talkNearest();
    }
  }

  function toggleOverview() {
    mode = mode === "operator" ? "overview" : "operator";
    const overview = mode === "overview";
    controls.enabled = overview;
    goal = null;
    if (overview) {
      camera.position.set(0, 26, 40);
      controls.target.copy(CENTER);
      controls.update();
    }
    $("btn-overview").setAttribute("aria-pressed", String(overview));
    $("btn-overview").textContent = overview ? t.operatorView : t.overview;
    $("hint").textContent = overview ? t.hintOverview : hintText;
    $("status").textContent = overview ? t.statusOverview : t.statusOperator;
    document.body.dataset.mode = mode;
  }

  // First person: the camera sits at the operator's eyes. Left and right turn, up and down walk, drag to look.
  let pov = false;
  let povOn = false; // pov and nothing else (overview, a conversation, another screen) taking the camera
  let yaw = 0;
  let pitch = 0;
  const FOV = camera.fov;
  function togglePov() {
    pov = !pov;
    yaw = operator.rotation.y;
    pitch = 0;
    goal = null;
    $("btn-pov").setAttribute("aria-pressed", String(pov));
    $("btn-pov").textContent = pov ? t.povOff : t.pov;
    $("hint").textContent = pov ? t.hintPov : hintText;
  }
  $("btn-pov").addEventListener("click", togglePov);
  canvas.addEventListener("pointermove", (e) => {
    if (!povOn || !(e.buttons & 1)) return;
    yaw -= e.movementX * 0.005;
    pitch = Math.max(-1, Math.min(1, pitch - e.movementY * 0.004));
  });

  async function toggleSound() {
    const turnOn = !ambience.state.on;
    if (turnOn) await ambience.start();
    else ambience.stop();
    $("btn-sound").setAttribute("aria-pressed", String(turnOn));
    $("btn-sound").textContent = turnOn ? t.soundOn : t.soundOff;
    $("status").textContent = turnOn ? t.statusSoundOn : t.statusSoundOff;
  }
  $("btn-overview").addEventListener("click", toggleOverview);
  $("btn-sound").addEventListener("click", toggleSound);

  // ---- using a terminal
  function useNearest() {
    const near = nearestTerminal(operator.position, world.terminals);
    if (!near) return false;
    operator.rotation.y = Math.atan2(near.x - operator.position.x, near.z - operator.position.z);
    pressT = 0;
    toggleSlot(near.slot - 1);
    return true;
  }
  $("btn-use").addEventListener("click", useNearest);

  // ---- talking to a helper: E (or the Talk button, or a click) when no control post is in reach
  function talkNearest() {
    const who = npcs.nearest(operator.position);
    if (!who) return false;
    return dialogue.open(who);
  }
  const talkBtn = document.createElement("button");
  talkBtn.id = "btn-talk";
  talkBtn.type = "button";
  talkBtn.hidden = true;
  document.querySelector(".stage").append(talkBtn);
  talkBtn.addEventListener("click", talkNearest);
  let talkLabel = "";
  function updateTalkButton() {
    const ok = dialogue && !dialogue.isOpen && mode === "operator" && phase === "play" && $("btn-use").hidden;
    const who = ok ? npcs.nearest(operator.position) : null;
    const label = who ? fill(t.dialogue.ui.talk, { name: who.name }) : "";
    if (label === talkLabel) return;
    talkLabel = label;
    talkBtn.hidden = !who;
    talkBtn.textContent = label;
  }

  // What the tracker wants next: a spot to walk to (the trail leads there) and where the arrow floats.
  function questTarget() {
    if (!quest || phase !== "play" || mode !== "operator" || (dialogue && dialogue.isOpen)) return null;
    const next = quest.next();
    const helper = npcs.npcs.find((n) => n.p.id === next);
    if (helper) return { arrow: { x: helper.group.position.x, y: 2.5, z: helper.group.position.z }, go: { x: helper.group.position.x, z: helper.group.position.z }, stop: 2.2 };
    if (next === "greedy" || next === "beat") {
      let list = world.terminals;
      if (next === "greedy") {
        const need = quest.greedySlots().filter((n) => !slots[n - 1]);
        if (need.length) list = world.terminals.filter((x) => need.includes(x.slot));
      } else {
        const off = world.terminals.filter((x) => !slots[x.slot - 1]);
        if (off.length) list = off;
      }
      const post = nearestTerminal(operator.position, list, Infinity);
      if (post) return { arrow: post, go: standPoint(post), stop: 0.3 };
    }
    return null;
  }
  const trail = createTrail({ scene, blocked: (x, z) => blocked(x, z) });
  let frameDt = 0.016;
  let useLabel = "";
  function updateUseButton() {
    const near = mode === "operator" && !(dialogue && dialogue.isOpen) ? nearestTerminal(operator.position, world.terminals) : null;
    // The bouncing arrow follows the tracker: over the helper to talk to next, or over a control post to press.
    const target = questTarget();
    arcade.pointAt(target ? target.arrow : near);
    trail.update(frameDt, waterTime, operator.position, target ? target.go : null, target ? target.stop : 0);
    const label = near ? fill(slots[near.slot - 1] ? t.use.off : t.use.on, { n: near.slot }) : "";
    if (label === useLabel) return;
    useLabel = label;
    $("btn-use").hidden = !near;
    $("btn-use").textContent = label;
  }

  // ---- click or tap: a control post (walk there and press it) or the ground (walk there)
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downAt = null;
  canvas.addEventListener("pointerdown", (e) => {
    downAt = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener("pointerup", (e) => {
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    downAt = null;
    if (moved > 8 || mode !== "operator" || phase !== "play" || (dialogue && dialogue.isOpen)) return;
    uiSound.click();
    const rect = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(scene.children, true).find((h) => {
      for (let o = h.object; o; o = o.parent) if (o === operator || o === world.sea) return false;
      return true;
    });
    const who = hit ? npcs.byObject(hit.object) : null;
    const post = hit && hit.point.y < 2.6 ? terminalAt(hit.point, world.terminals) : null;
    if (who) {
      // walk up to the helper (about 2 m away, on our side) and start talking
      const dx = operator.position.x - who.position.x;
      const dz = operator.position.z - who.position.z;
      const len = Math.hypot(dx, dz) || 1;
      goal = { x: who.position.x + (dx / len) * 2.2, z: who.position.z + (dz / len) * 2.2, stuck: 0, then: () => talkNearest() };
    } else if (post) {
      const s = standPoint(post);
      goal = { x: s.x, z: s.z, stuck: 0, then: () => useNearest() };
    } else if (hit && !blocked(hit.point.x, hit.point.z)) {
      goal = { x: hit.point.x, z: hit.point.z, stuck: 0, then: null };
    }
    if (window.__game) {
      window.__game.lastClick = {
        hit: hit ? { x: +hit.point.x.toFixed(2), y: +hit.point.y.toFixed(2), z: +hit.point.z.toFixed(2), object: hit.object.name || hit.object.type, parent: hit.object.parent ? hit.object.parent.name : "" } : null,
        terminal: post ? post.slot : null,
        goal: goal ? { x: +goal.x.toFixed(2), z: +goal.z.toFixed(2) } : null,
        pixel: [Math.round(e.clientX), Math.round(e.clientY)],
      };
    }
  });

  // ---- helpers who walk the plant and give clues when you stand close
  const npcs = createNpcs({ scene, stage: document.querySelector(".stage"), canvas, camera, text: t.npcs, model, blocked: (x, z) => blocked(x, z), reduceMotion });
  npcs.onSay((msg) => ($("status").textContent = msg));
  // fewer draw calls: merge each person's static parts and use a blob shadow instead of real shadows
  cheapPeople(operator);
  npcs.npcs.forEach((n) => cheapPeople(n.group));

  // ---- conversations and the quest log
  const stageEl = document.querySelector(".stage");
  const plansAll = allPlans(model);
  const progress = { predictions: [] };
  quest = createQuest({ stage: stageEl, text: t.quest, model, onComplete: (msg) => ($("status").textContent = msg), onChange: (line) => flow && flow.setGoal(line) });
  dialogue = createDialogue({
    stage: stageEl,
    text: t.dialogue,
    reduceMotion,
    getVars: () => dialogueVars(model, slots),
    effects: {
      obvious: () => applySlots(greedyPlan(model, plansAll).x, { shake: true }),
      block: () => applySlots(DEMO.block, { shake: true }),
      islands: () => applySlots(DEMO.islands, { shake: true }),
      predict: (guess) => progress.predictions.push(guess),
    },
    onTopic: (who, node, isStart) => {
      if (!isStart) quest.talked(who);
    },
    onOpen: (person) => {
      goal = null;
      operator.rotation.y = Math.atan2(person.position.x - operator.position.x, person.position.z - operator.position.z);
      yaw = operator.rotation.y;
      pitch = 0;
    },
  });

  // ---- movement with simple collision
  function blocked(x, z) {
    if (x < BOUNDS.minX || x > BOUNDS.maxX || z < BOUNDS.minZ || z > BOUNDS.maxZ) return true;
    return world.colliders.some((c) => Math.abs(x - c.x) < c.hw + player.radius && Math.abs(z - c.z) < c.hd + player.radius);
  }

  function walk(dt) {
    let a = input.axis();
    const p = operator.position;
    if (povOn) {
      yaw -= a.x * 2.2 * dt;
      a = { x: Math.sin(yaw) * -a.z, z: Math.cos(yaw) * -a.z };
    }
    let dx = 0;
    let dz = 0;
    if (a.x || a.z) {
      goal = null;
      const len = Math.hypot(a.x, a.z);
      dx = (a.x / len) * player.speed * dt;
      dz = (a.z / len) * player.speed * dt;
    } else if (goal) {
      const gx = goal.x - p.x;
      const gz = goal.z - p.z;
      const dist = Math.hypot(gx, gz);
      if (dist < 0.15) {
        const then = goal.then;
        goal = null;
        if (then) then();
      } else {
        const step = Math.min(player.speed * dt, dist);
        dx = (gx / dist) * step;
        dz = (gz / dist) * step;
      }
    }
    let moving = false;
    if (dx || dz) {
      const x0 = p.x;
      const z0 = p.z;
      if (!blocked(p.x + dx, p.z)) p.x += dx;
      if (!blocked(p.x, p.z + dz)) p.z += dz;
      const moved = Math.hypot(p.x - x0, p.z - z0);
      if (goal) {
        goal.stuck = moved < Math.hypot(dx, dz) * 0.2 ? goal.stuck + dt : 0;
        if (goal.stuck > 0.6) goal = null;
      }
      let diff = povOn ? yaw - operator.rotation.y : Math.atan2(dx, dz) - operator.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      operator.rotation.y += diff * Math.min(1, dt * 12);
      moving = true;
    }
    player.phase += dt * 9 * (moving ? 1 : 0);
    if (pressT >= 0) {
      pressT += dt;
      operator.userData.press(Math.sin(Math.PI * Math.min(pressT / 0.55, 1)));
      if (pressT > 0.55) {
        pressT = -1;
        operator.userData.press(0);
      }
    }
    operator.userData.walk(player.phase, moving ? 1 : 0);
    return moving;
  }

  const desired = new THREE.Vector3();
  const look = new THREE.Vector3();
  const lookNow = new THREE.Vector3(SPAWN.x, 2, SPAWN.z - 4);
  // In a conversation the camera sits behind the player's shoulder and looks at the speaker.
  function dialogueCamera(dt) {
    const s = dialogue.speaker.position;
    const p = operator.position;
    let dx = s.x - p.x;
    let dz = s.z - p.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    desired.set(p.x - dx * 2.1 - dz * 0.9, 1.75, p.z - dz * 2.1 + dx * 0.9);
    const k = reduceMotion ? 1 : 1 - Math.exp(-7 * dt);
    camera.position.lerp(desired, k);
    look.set(s.x, 1.25, s.z);
    lookNow.lerp(look, k);
    camera.lookAt(lookNow);
  }

  function povCamera() {
    const p = operator.position;
    camera.position.set(p.x, 1.6, p.z);
    look.set(p.x + Math.sin(yaw) * Math.cos(pitch), 1.6 + Math.sin(pitch), p.z + Math.cos(yaw) * Math.cos(pitch));
    lookNow.copy(look);
    camera.lookAt(look);
    operator.rotation.y = yaw;
  }

  function followCamera(dt) {
    const p = operator.position;
    desired.set(p.x, 6.5, p.z + 9.5);
    const k = reduceMotion ? 1 : 1 - Math.exp(-5 * dt);
    camera.position.lerp(desired, k);
    look.set(p.x, 2, p.z - 4);
    lookNow.lerp(look, k);
    camera.lookAt(lookNow);
  }
  camera.position.set(SPAWN.x, 6.5, SPAWN.z + 9.5);
  camera.lookAt(lookNow);

  // Behind the title, Simulate and Result screens the plant turns slowly.
  let orbit = 0;
  function orbitCamera(dt) {
    orbit += dt * (reduceMotion ? 0 : 0.07);
    camera.position.set(CENTER.x + Math.sin(orbit) * 46, 16, CENTER.z + Math.cos(orbit) * 46);
    camera.lookAt(CENTER.x, 2, CENTER.z);
  }

  // On the Simulate screen the camera looks at the search yard (32 tanks) south of the plant.
  const simPos = new THREE.Vector3();
  const simLook = new THREE.Vector3();
  const simLookNow = new THREE.Vector3(CENTER.x, 2, CENTER.z);
  function simCamera(dt) {
    const p = simView.pose(camera.aspect, camera.fov);
    simPos.set(p.x, p.y, p.z);
    simLook.set(p.lx, p.ly, p.lz);
    const k = reduceMotion ? 1 : 1 - Math.exp(-2.2 * dt);
    camera.position.lerp(simPos, k);
    simLookNow.lerp(simLook, k);
    camera.lookAt(simLookNow);
  }

  // On the Result screen the camera shows the whole pump hall, shifted so the report panel does not cover it.
  function resultCamera(dt) {
    orbit += dt * (reduceMotion ? 0 : 0.07);
    const narrow = canvas.clientWidth <= 700;
    const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = Math.min(95, Math.max(24, (narrow ? 40 : 40 / 0.55) / (2 * half * camera.aspect)));
    const az = Math.sin(orbit * 2) * 0.18;
    const mid = world.pumpBays.reduce((a, b) => a + b.x, 0) / world.pumpBays.length;
    const bz = world.pumpBays[0].z;
    camera.position.set(mid + Math.sin(az) * dist, dist * 0.42, bz + Math.cos(az) * dist);
    camera.lookAt(mid + (narrow ? 0 : 2 * half * dist * camera.aspect * 0.22), narrow ? -dist * 0.12 : 1.5, bz);
  }

  // The guided flow: intro, coach, Simulate, Result. ?skip opens straight on the plant (for the automated checks).
  flow = createFlow({
    root: $("flow"),
    text: t.flow,
    reduceMotion,
    field,
    narrow: () => canvas.clientWidth / Math.max(canvas.clientHeight, 1) < 0.8,
    getSlots: () => slots.slice(),
    setSlots: (x) => applySlots(x, { shake: false }),
    onPhase(next, report) {
      phase = next;
      if (quest) quest.phase(next);
      if (next === "result" && report) {
        siteTags.show(report.rows);
        coldSlots = report.coldSlots;
        coldClock = 2.4;
      } else {
        siteTags.hide();
        coldSlots = [];
      }
      if (next === "simulate") simLookNow.set(camera.position.x * 0 + CENTER.x, 2, CENTER.z);
      if (next === "around" && mode !== "overview") toggleOverview();
      if (next !== "around" && mode === "overview") toggleOverview();
      if (next === "play") {
        lookNow.set(operator.position.x, 2, operator.position.z - 4);
        camera.position.set(operator.position.x, 6.5, operator.position.z + 9.5);
      }
    },
  });
  flow.setGoal(quest.nextLine());
  flow.start(new URLSearchParams(location.search).has("skip"));

  const clock = new THREE.Clock();
  let waterTime = 0;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    frameDt = dt;
    frames++;
    const nowMs = performance.now();
    const realMs = nowMs - lastFrame;
    frameMs += (realMs - frameMs) * 0.1;
    lastFrame = nowMs;
    quality.tick(realMs);
    fps += (1 / Math.max(dt, 0.001) - fps) * 0.05;
    waterTime += dt * (reduceMotion ? 0.25 : 1);
    world.update(waterTime);
    sky.update(dt, camera);
    if ((phase === "play" || phase === "around") && !dialogue.isOpen) walk(dt);
    const wantPov = pov && mode === "operator" && phase === "play" && !dialogue.isOpen;
    if (wantPov !== povOn) {
      povOn = wantPov;
      operator.visible = !povOn;
      camera.fov = povOn ? 70 : FOV;
      camera.updateProjectionMatrix();
    }
    // roof and front wall off while inside (kept on in first person, where you look up at a ceiling)
    world.setControlRoomOpen(!povOn && world.inControlRoom(operator.position.x, operator.position.z));
    pumps.update(dt, waterTime);
    npcs.update(dt, operator.position, phase === "play" && mode === "operator", slots, dialogue.isOpen);
    for (const n of npcs.npcs) n.group.visible = phase === "play" || phase === "around"; // keep the Simulate and Result screens uncluttered
    arcade.update(dt, waterTime, phase === "play" && mode === "operator");
    field.update(dt, waterTime);
    simView.update(dt, waterTime);
    updateUseButton();
    updateTalkButton();
    if (dialogue.isOpen) dialogueCamera(dt);
    else if (phase === "result") {
      resultCamera(dt);
      coldClock += dt;
      if (coldClock > 3) {
        coldClock = 0;
        for (const slot of coldSlots) pumps.shake(slot - 1);
      }
    } else if (phase === "simulate") simCamera(Math.min(realMs / 1000, 0.25));
    else if (phase === "title") orbitCamera(dt);
    else if (mode === "operator") (povOn ? povCamera : followCamera)(dt);
    else controls.update();
    siteTags.update();
    renderer.render(scene, camera);
  });

  // Read-only view of the game for the automated checks (npm run verify).
  window.__game = {
    bounds: BOUNDS,
    zones: world.zones,
    terminals: world.terminals.map(({ slot, x, z }) => ({ slot, x, z })),
    blocked,
    state: () => ({
      ready: true,
      mode,
      phase,
      flow: flow.debug(),
      field: field.debug(),
      simView: simView.debug(),
      player: { x: operator.position.x, z: operator.position.z, facing: operator.rotation.y },
      camera: {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
        azimuth: mode === "overview" ? controls.getAzimuthalAngle() : null,
        distance: mode === "overview" ? camera.position.distanceTo(controls.target) : null,
      },
      slots: slots.slice(),
      npcs: npcs.debug(),
      dialogue: dialogue.debug(),
      quest: quest.debug(),
      talkButton: { hidden: talkBtn.hidden, text: talkBtn.textContent },
      predictions: progress.predictions.slice(),
      bill: billLines(model, slots),
      shaking: pumps.shaking(),
      lamps: world.terminals.map((x) => x.lamp.material.color.getHex()),
      walkingToGoal: Boolean(goal),
      useButton: { hidden: $("btn-use").hidden, text: $("btn-use").textContent },
      audio: ambience.state,
      render: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles },
      quality: { tier: quality.tier, mode: quality.mode, pixelRatio: renderer.getPixelRatio(), shadowMap: sun.shadow.mapSize.x, shadowsOn: sun.castShadow, trees: world.trees.filter((x) => x.visible).length },
      fps: Math.round(fps),
      frameMs: Math.round(frameMs),
      frames,
    }),
    // For the automated checks only: triangles by named object.
    breakdown: () => {
      const out = {};
      scene.traverse((o) => {
        if (!o.isMesh) return;
        let top = o;
        while (top.parent && top.parent !== scene) top = top.parent;
        const key = top.name || o.name || o.type;
        const g = o.geometry;
        out[key] = (out[key] || 0) + Math.round((g.index ? g.index.count : g.attributes.position.count) / 3);
      });
      return out;
    },
    // For the automated checks only.
    // For the automated checks only: how many meshes (draw calls) each named object adds, and how many cast shadows.
    meshCounts: () => {
      const out = {};
      scene.traverse((o) => {
        if (!o.isMesh) return;
        for (let p = o; p; p = p.parent) if (!p.visible) return; // hidden things are not drawn
        let top = o;
        while (top.parent && top.parent !== scene) top = top.parent;
        const key = top.name || o.name || o.type;
        out[key] = out[key] || { meshes: 0, casters: 0 };
        out[key].meshes++;
        if (o.castShadow) out[key].casters++;
      });
      return out;
    },
    teleport: (x, z) => operator.position.set(x, 0, z),
    helperScreenPos: (id) => {
      const n = npcs.npcs.find((x) => x.p.id === id);
      if (!n) return null;
      const v = new THREE.Vector3(n.group.position.x, 1.0, n.group.position.z).project(camera);
      return { x: (v.x * 0.5 + 0.5) * canvas.clientWidth, y: (-v.y * 0.5 + 0.5) * canvas.clientHeight };
    },
    setSlots: (x) => applySlots(x, { shake: false }),
    simTankScreen: (k) => simView.tankScreen(k),
    terminalScreenPos: (i) => {
      const info = world.terminals[i];
      const v = new THREE.Vector3(info.x, 1.0, info.z + 0.1).project(camera);
      return { x: (v.x * 0.5 + 0.5) * canvas.clientWidth, y: (-v.y * 0.5 + 0.5) * canvas.clientHeight };
    },
  };

  $("loading").hidden = true;
  document.body.dataset.mode = mode;
  $("status").textContent = t.statusReady;
}
