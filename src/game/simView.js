// Simulate, seen in the real plant. The search runs as before (flow.js drives the tank field); this module
// listens to the same levels and shows them three ways:
//   Plant       (default) an electricity tower at each pump. Its fill is the chance that the search would run
//               that slot: sum of (level squared) over every plan that uses it. It fills and drains with each step.
//   Tank yard   the 32 glass tanks. Click a tank to pin that plan: the plant then shows it as on/off towers.
//   Chart       the bars of the old chart, in a panel that only opens when asked.
// It does not change the maths or the player's slots. It wraps field.show/hide/setLevels from the outside.
import * as THREE from "three";
import "./simview.css";
import { allPlans, chosenSlots, PLAN_COUNT } from "../math/index.js";
import { SLOT_COLORS, NAVY } from "./palette.js";

const TOWER_H = 4.2;
const SVGNS = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}, ...kids) => {
  const n = tag.startsWith("svg:") ? document.createElementNS(SVGNS, tag.slice(4)) : document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  n.append(...kids);
  return n;
};

function labelTexture(text, color) {
  const c = document.createElement("canvas");
  c.width = 192;
  c.height = 96;
  const g = c.getContext("2d");
  g.fillStyle = NAVY;
  g.beginPath();
  g.roundRect(4, 8, 184, 80, 30);
  g.fill();
  g.fillStyle = "#fff";
  g.beginPath();
  g.roundRect(10, 14, 172, 68, 24);
  g.fill();
  g.fillStyle = color;
  g.fillRect(24, 66, 144, 8);
  g.fillStyle = NAVY;
  g.font = "900 44px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 96, 44);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSimView({ scene, stage, canvas, camera, field, bays, model, text, reduceMotion }) {
  const plans = allPlans(model);
  const uses = plans.map((p) => chosenSlots(p.x));
  const bill = plans.map((p) => p.total);

  // ---------------------------------------------------------------- state
  let mode = "plant"; // plant | yard
  let open = false;
  let chartOpen = false;
  let pinned = null;
  let amps = Array(PLAN_COUNT).fill(1 / Math.sqrt(PLAN_COUNT));
  let marked = null;
  let you = -1;

  // ---------------------------------------------------------------- towers in the plant
  const root = new THREE.Group();
  root.name = "power_towers";
  root.visible = false;
  scene.add(root);
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xcdf3ff, transparent: true, opacity: 0.22, roughness: 0.1, side: THREE.DoubleSide, depthWrite: false });
  const capMat = new THREE.MeshStandardMaterial({ color: 0x1b1b4b, roughness: 0.5 });
  const towers = bays.map((b, i) => {
    const g = new THREE.Group();
    g.position.set(b.x - 0.9, b.y, b.z + 2.05);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.3, 24), new THREE.MeshStandardMaterial({ color: SLOT_COLORS[i], roughness: 0.5 }));
    base.position.y = 0.15;
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, TOWER_H, 24, 1, true), glassMat);
    glass.position.y = 0.3 + TOWER_H / 2;
    glass.renderOrder = 2;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.16, 24), capMat);
    cap.position.y = 0.3 + TOWER_H + 0.08;
    const fillMat = new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xffa800, emissiveIntensity: 0.9, roughness: 0.3 });
    const fill = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 1, 24), fillMat);
    const bolt = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 7 }, () => new THREE.Vector3())), new THREE.LineBasicMaterial({ color: 0xffffff }));
    bolt.frustumCulled = false;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture("0%", SLOT_COLORS[i]), depthWrite: false }));
    sprite.position.y = 0.3 + TOWER_H + 1.0;
    sprite.scale.set(1.9, 0.95, 1);
    sprite.renderOrder = 5;
    g.add(base, glass, cap, fill, bolt, sprite);
    root.add(g);
    return { g, fill, fillMat, bolt, sprite, cur: 0, target: 0, shown: "", boltT: 0 };
  });

  // ---------------------------------------------------------------- numbers
  function chance() {
    const p = Array(bays.length).fill(0);
    let expected = 0;
    for (let k = 0; k < PLAN_COUNT; k++) {
      const q = amps[k] * amps[k];
      expected += q * bill[k];
      for (const s of uses[k]) p[s - 1] += q;
    }
    return { p, expected };
  }

  function aim() {
    if (pinned !== null) {
      const on = new Set(uses[pinned]);
      towers.forEach((t, i) => (t.target = on.has(i + 1) ? 1 : 0));
    } else {
      chance().p.forEach((v, i) => (towers[i].target = Math.min(1, v)));
    }
    refreshInfo();
    if (chartOpen) drawChart();
  }

  // ---------------------------------------------------------------- DOM: view switcher, info, chart
  const T = text;
  const btn = (label, view) => {
    const b = el("button", { type: "button", "data-view": view, "aria-pressed": "false" }, label);
    return b;
  };
  const bPlant = btn(T.plant, "plant");
  const bYard = btn(T.yard, "yard");
  const bChart = btn(T.chart, "chart");
  const info = el("p", { class: "svinfo", role: "status", "aria-live": "polite" });
  const bar = el("div", { id: "simview", class: "simview", hidden: "" }, el("div", { class: "svbtns", role: "group", "aria-label": T.label }, bPlant, bYard, bChart), info);
  stage.append(bar);

  const chartSvg = el("svg:svg", { viewBox: "0 0 640 220", role: "img", "aria-label": T.chartLabel, class: "svchart" });
  const chartTitle = el("h3", {}, T.chartTitle);
  const chartClose = el("button", { type: "button", class: "quiet" }, T.chartClose);
  const panel = el("div", { id: "simchart", class: "simchart", hidden: "" }, chartTitle, chartSvg, chartClose);
  stage.append(panel);

  const order = plans.map((p, k) => k).sort((a, b) => bill[a] - bill[b] || a - b);
  function drawChart() {
    chartSvg.replaceChildren();
    const ZERO = 100;
    const SC = 88;
    chartSvg.append(el("svg:line", { x1: 4, x2: 636, y1: ZERO, y2: ZERO, class: "zero" }));
    order.forEach((k, pos) => {
      const a = amps[k];
      const h = Math.max(Math.abs(a) * SC, 0.5);
      const x = 8 + pos * 19.6;
      const cls = ["bar-rect", marked && marked.has(k) ? "marked" : "", k === you ? "you" : "", k === pinned ? "pinned" : ""].join(" ").trim();
      chartSvg.append(el("svg:rect", { x, width: 15, y: a >= 0 ? ZERO - h : ZERO, height: h, rx: 3, class: cls }));
      chartSvg.append(el("svg:text", { x: x + 7.5, y: 214, class: "cost", "text-anchor": "middle" }, String(bill[k])));
    });
  }

  function refreshInfo() {
    if (pinned !== null) {
      info.textContent = T.pinned.replace("{slots}", uses[pinned].join(", ")).replace("{bill}", String(bill[pinned]));
    } else {
      info.textContent = T.live.replace("{bill}", chance().expected.toFixed(1));
    }
  }

  function setMode(next) {
    mode = next;
    bPlant.setAttribute("aria-pressed", String(next === "plant"));
    bYard.setAttribute("aria-pressed", String(next === "yard"));
    root.visible = open && next === "plant";
    // In plant view the yard is sunk out of sight, not hidden, so the clerk and the tank levels keep running.
    field.group.position.y = open && next === "plant" ? -300 : 0;
    bar.dataset.mode = next;
    canvas.style.cursor = next === "yard" ? "pointer" : "";
  }
  function setChart(on) {
    chartOpen = on;
    bChart.setAttribute("aria-pressed", String(on));
    panel.hidden = !(open && on);
    if (on) drawChart();
  }
  bPlant.addEventListener("click", () => setMode("plant"));
  bYard.addEventListener("click", () => setMode("yard"));
  bChart.addEventListener("click", () => setChart(!chartOpen));
  chartClose.addEventListener("click", () => setChart(false));

  // ---------------------------------------------------------------- pick a tank
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.5);
  const hit = new THREE.Vector3();
  let downAt = null;
  canvas.addEventListener("pointerdown", (e) => (downAt = { x: e.clientX, y: e.clientY }));
  canvas.addEventListener("pointerup", (e) => {
    if (!open || mode !== "yard" || !downAt) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    downAt = null;
    if (moved > 8) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(ground, hit)) return;
    let best = -1;
    let bestD = 1.8;
    for (let k = 0; k < PLAN_COUNT; k++) {
      const p = field.tankPos(k);
      const d = Math.hypot(p.x - hit.x, p.z - hit.z);
      if (d < bestD) (best = k), (bestD = d);
    }
    if (best < 0) return;
    pinned = pinned === best ? null : best;
    aim();
  });

  // ---------------------------------------------------------------- hook into the tank field (from outside)
  const _show = field.show;
  const _hide = field.hide;
  const _levels = field.setLevels;
  field.show = (yourPlan, narrow) => {
    _show(yourPlan, narrow);
    open = true;
    you = yourPlan;
    pinned = null;
    marked = null;
    amps = Array(PLAN_COUNT).fill(0);
    towers.forEach((t) => (t.cur = 0));
    bar.hidden = false;
    setChart(false);
    setMode("plant");
    aim();
  };
  field.hide = () => {
    _hide();
    open = false;
    bar.hidden = true;
    panel.hidden = true;
    root.visible = false;
    field.group.position.y = 0;
  };
  field.setLevels = (a, opts = {}) => {
    _levels(a, opts);
    amps = a.slice();
    marked = opts.marked || null;
    aim();
  };

  // ---------------------------------------------------------------- per frame
  const k0 = new THREE.Vector3();
  function update(dt, time) {
    if (!root.visible) return;
    const k = reduceMotion ? 1 : 1 - Math.exp(-4.5 * dt);
    towers.forEach((t, i) => {
      t.cur += (t.target - t.cur) * k;
      const h = Math.max(t.cur * TOWER_H, 0.02);
      t.fill.scale.y = h;
      t.fill.position.y = 0.3 + h / 2;
      t.fillMat.emissiveIntensity = reduceMotion ? 0.9 : 0.55 + t.cur * 0.7 + Math.sin(time * 14 + i * 2) * 0.12 * t.cur;
      const label = `${Math.round(t.cur * 100)}%`;
      if (label !== t.shown) {
        t.shown = label;
        t.sprite.material.map.dispose();
        t.sprite.material.map = labelTexture(label, SLOT_COLORS[i]);
        t.sprite.material.needsUpdate = true;
      }
      // a little lightning inside the fill, faster when it is fuller
      const live = t.cur > 0.04 && !reduceMotion;
      t.bolt.visible = live;
      if (live) {
        t.boltT -= dt;
        if (t.boltT <= 0) {
          t.boltT = 0.07;
          const pts = t.bolt.geometry.attributes.position;
          for (let j = 0; j < pts.count; j++) {
            const f = j / (pts.count - 1);
            pts.setXYZ(j, j === 0 || j === pts.count - 1 ? 0 : (Math.random() - 0.5) * 0.45, 0.3 + f * h, (Math.random() - 0.5) * 0.1 + 0.2);
          }
          pts.needsUpdate = true;
        }
      }
    });
  }

  /** Camera pose that fits all 32 tanks (from their real positions), pitched down so the front rows are not cut off. */
  function yardPose(aspect, fov) {
    const half = Math.tan(THREE.MathUtils.degToRad(fov / 2));
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let k = 0; k < PLAN_COUNT; k++) {
      const p = field.tankPos(k);
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z);
    }
    const W = x1 - x0 + 6;
    const D = z1 - z0 + 6;
    const pitch = THREE.MathUtils.degToRad(58);
    const dist = Math.min(120, Math.max(30, (W / 2) / (half * aspect), (D * Math.sin(pitch) + 6) / (2 * half)) * 1.2);
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2 + 1.5; // look a little towards the camera: the controls cover the bottom of the screen
    return { x: cx, y: 1.5 + dist * Math.sin(pitch), z: cz + dist * Math.cos(pitch), lx: cx, ly: 1.5, lz: cz };
  }

  /** Camera pose that shows the whole pump hall from above. */
  function pose(aspect, fov) {
    if (mode === "yard") return yardPose(aspect, fov);
    const half = Math.tan(THREE.MathUtils.degToRad(fov / 2));
    const mid = bays.reduce((a, b) => a + b.x, 0) / bays.length;
    const bz = bays[0].z;
    const W = 40;
    const dist = Math.min(95, Math.max(24, W / (2 * half * aspect)));
    return { x: mid, y: dist * 0.5, z: bz + dist * 0.85, lx: mid, ly: 3.2, lz: bz + 0.5 };
  }

  return {
    update,
    pose,
    get mode() {
      return mode;
    },
    /** Where a tank is on screen (for the automated checks). */
    tankScreen(k) {
      const p = field.tankPos(k);
      const v = new THREE.Vector3(p.x, 2.5, p.z).project(camera);
      return { x: (v.x * 0.5 + 0.5) * canvas.clientWidth, y: (-v.y * 0.5 + 0.5) * canvas.clientHeight };
    },
    debug: () => ({ open, mode, pinned, chartOpen, towers: towers.map((t) => +t.cur.toFixed(2)), targets: towers.map((t) => +t.target.toFixed(2)) }),
  };
}
