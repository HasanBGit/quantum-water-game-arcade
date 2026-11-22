// The search yard: 32 glass tanks on the sand south of the plant, one per plan.
// Water level = how much the search "wants" that plan (the Grover amplitude).
//   above the line  = positive, below the line = flipped by the oracle.
// A clerk character walks the rows and checks plans one by one for the classical side.
// Plain three.js; the flow module tells it what to show, it never decides anything.
import * as THREE from "three";
import { allPlans, chosenSlots, PLAN_COUNT } from "../math/index.js";
import { SLOT_COLORS, NAVY } from "./palette.js";
import { buildPerson, SKIN } from "./characters.js";

const GAP_X = 3.4;
const GAP_Z = 4.6;
const RADIUS = 1.15;
const BASE = 0.25;
const GLASS_H = 4.0;
const MID = BASE + GLASS_H / 2; // the "ground line": zero water
const H = 1.85; // metres of water for an amplitude of 1
const CZ = 25.5; // field centre
const CX = 2;

const COLORS = { plain: 0xb7a8ff, marked: 0x19c3d6, flipped: 0x6a5fd0, you: 0xffd23f, measured: 0xff5d73 };

function labelTexture(plan, state, isYou) {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 112;
  const g = c.getContext("2d");
  const fill = state === "hit" ? "#19c3d6" : state === "seen" ? "#d9d3ff" : "#ffffff";
  g.fillStyle = NAVY;
  g.beginPath();
  g.roundRect(4, 4, 120, 104, 22);
  g.fill();
  g.fillStyle = isYou ? "#ffd23f" : fill;
  g.beginPath();
  g.roundRect(10, 10, 108, 92, 17);
  g.fill();
  g.fillStyle = state === "hit" && !isYou ? "#fff" : NAVY;
  g.font = "900 54px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(String(plan.total), 64, 44);
  plan.x.forEach((on, i) => {
    g.beginPath();
    g.arc(25 + i * 19.5, 82, 7, 0, Math.PI * 2);
    g.fillStyle = on ? SLOT_COLORS[i] : "#e4e6f4";
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = NAVY;
    g.stroke();
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createTankField({ scene, model, reduceMotion }) {
  const plans = allPlans(model);
  const root = new THREE.Group();
  root.name = "search_yard";
  root.visible = false;
  scene.add(root);

  let cols = 8;
  const rows = () => PLAN_COUNT / cols;
  const tankPos = (k) => ({
    x: CX + ((k % cols) - (cols - 1) / 2) * GAP_X,
    z: CZ + (Math.floor(k / cols) - (rows() - 1) / 2) * GAP_Z,
  });

  // ---- slab under the tanks
  const slab = new THREE.Mesh(new THREE.BoxGeometry(1, 0.3, 1), new THREE.MeshStandardMaterial({ color: 0xaab4e0, roughness: 0.9 }));
  slab.receiveShadow = true;
  root.add(slab);

  // ---- the tanks
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xbdeeff, transparent: true, opacity: 0.22, roughness: 0.1, metalness: 0, side: THREE.DoubleSide, depthWrite: false });
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x4a4fa8, roughness: 0.6 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x1b1b4b, roughness: 0.5 });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0x1b1b4b });
  const tanks = plans.map((plan) => {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(RADIUS + 0.2, RADIUS + 0.25, BASE, 28), baseMat);
    base.position.y = BASE / 2;
    base.castShadow = true;
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(RADIUS, RADIUS, GLASS_H, 28, 1, true), glassMat);
    glass.position.y = MID;
    glass.renderOrder = 2;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(RADIUS, 0.04, 8, 28), rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = BASE + GLASS_H;
    const line = new THREE.Mesh(new THREE.TorusGeometry(RADIUS + 0.02, 0.04, 8, 28), lineMat);
    line.rotation.x = Math.PI / 2;
    line.position.y = MID;
    const waterMat = new THREE.MeshStandardMaterial({ color: COLORS.plain, roughness: 0.25, emissive: 0x000000 });
    const water = new THREE.Mesh(new THREE.CylinderGeometry(RADIUS - 0.07, RADIUS - 0.07, 1, 28), waterMat);
    const ringMat = new THREE.MeshBasicMaterial({ color: COLORS.marked, transparent: true, opacity: 0, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(RADIUS + 0.35, RADIUS + 0.75, 40), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    const sprite = new THREE.Mesh(
      new THREE.PlaneGeometry(2.0, 1.75),
      new THREE.MeshBasicMaterial({ map: labelTexture(plan, "new", false), transparent: true }),
    );
    sprite.rotation.x = -Math.PI / 2 + 0.95; // a plate on the ground, tilted up towards the camera
    sprite.position.set(0, 0.5, RADIUS + 1.2);
    g.add(base, glass, rim, line, water, ring, sprite);
    root.add(g);
    return { g, water, waterMat, ring, ringMat, sprite, cur: 0, target: 0, state: "new", marked: false, measured: false, flip: 0 };
  });
  const setLabel = (k, state) => {
    const t = tanks[k];
    t.state = state;
    t.sprite.material.map.dispose();
    t.sprite.material.map = labelTexture(plans[k], state, k === you);
    t.sprite.material.needsUpdate = true;
  };

  // ---- "you are here" arrow, the measure beacon, the average line
  let you = -1;
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.8, 4), new THREE.MeshBasicMaterial({ color: COLORS.you }));
  arrow.rotation.x = Math.PI;
  arrow.visible = false;
  root.add(arrow);
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 14, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: COLORS.measured, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide }),
  );
  beacon.visible = false;
  root.add(beacon);
  const meanMat = new THREE.MeshBasicMaterial({ color: 0x8a5cff });
  const meanLines = [];
  let meanTarget = null;
  let meanCur = 0;

  // ---- the clerk
  const clerk = buildPerson({ skin: SKIN.white, outfit: 0xffd23f, trim: 0xff9f1c, head: "cap", headColor: 0xff5d73, vest: 0xffffff, shoes: 0x2b2b2b });
  clerk.visible = false;
  clerk.scale.setScalar(2.4); // a bigger clerk, so he reads from the far camera
  root.add(clerk);
  let walk = null; // { path: [{x,z,tank}], i, speed, onStep, n, pause }
  let walkPhase = 0;

  function layout() {
    const W = cols * GAP_X + 3;
    const D = rows() * GAP_Z + 3;
    slab.scale.set(W, 1, D);
    slab.position.set(CX, 0.05, CZ);
    tanks.forEach((t, k) => {
      const p = tankPos(k);
      t.g.position.set(p.x, 0, p.z);
    });
    while (meanLines.length) root.remove(meanLines.pop());
    for (let r = 0; r < rows(); r++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, cols * GAP_X - 0.6, 6), meanMat);
      m.rotation.z = Math.PI / 2;
      m.position.set(CX, MID, CZ + (r - (rows() - 1) / 2) * GAP_Z + RADIUS + 0.25);
      m.visible = false;
      root.add(m);
      meanLines.push(m);
    }
  }
  layout();

  function pose(aspect, fov) {
    const half = Math.tan(THREE.MathUtils.degToRad(fov / 2));
    const W = cols * GAP_X + 4;
    const D = rows() * GAP_Z + 3;
    const dist = Math.max(30, (W / 2) / (half * aspect) * 1.08, D * 1.6);
    return { x: CX, y: 6 + dist * 0.72, z: CZ + dist * 0.62, lx: CX, ly: 1.0, lz: CZ + 1.5 };
  }

  // ---- the walk: serpentine through the rows, in the aisle in front of each tank
  function buildPath() {
    const path = [];
    for (let r = 0; r < rows(); r++) {
      const dir = r % 2 === 0 ? 1 : -1;
      for (let i = 0; i < cols; i++) {
        const c = dir === 1 ? i : cols - 1 - i;
        const k = r * cols + c;
        const p = tankPos(k);
        path.push({ x: p.x, z: p.z + RADIUS + 2.6, tank: k });
      }
      if (r < rows() - 1) {
        const last = path[path.length - 1];
        const out = last.x + dir * (GAP_X * 0.85);
        path.push({ x: out, z: last.z, tank: -1 });
        path.push({ x: out, z: last.z + GAP_Z, tank: -1 });
      }
    }
    return path;
  }

  function resetStates() {
    tanks.forEach((t, k) => setLabel(k, "new"));
  }

  return {
    group: root,
    pose,
    /** Show the yard for a player's plan. `narrow` puts the tanks in 4 columns for phones. */
    show(yourPlan, narrow = false) {
      const want = narrow ? 4 : 8;
      if (want !== cols) {
        cols = want;
        layout();
      }
      you = yourPlan;
      root.visible = true;
      tanks.forEach((t, k) => {
        t.cur = t.target = 0;
        t.marked = t.measured = false;
      });
      resetStates();
      const p = tankPos(you);
      arrow.position.set(p.x, BASE + GLASS_H + 1.6, p.z);
      arrow.visible = true;
      tanks[you].ringMat.color.setHex(COLORS.you);
      beacon.visible = false;
      meanTarget = null;
      clerk.visible = false;
    },
    hide() {
      root.visible = false;
      walk = null;
      tanks.forEach((t) => (t.ringMat.opacity = 0));
    },
    /** Levels are Grover amplitudes in plan order. marked: Set of plan indices, or null. */
    setLevels(amps, { marked = null, measured = null, meanAt = null } = {}) {
      tanks.forEach((t, k) => {
        t.target = amps[k];
        t.marked = Boolean(marked && marked.has(k));
        t.measured = measured === k;
        if (reduceMotion) t.cur = t.target;
      });
      meanTarget = meanAt;
      if (meanAt !== null && !meanLines[0].visible) meanCur = 0;
      if (reduceMotion && meanAt !== null) meanCur = meanAt;
      if (measured !== null) {
        const p = tankPos(measured);
        beacon.position.set(p.x, 7, p.z);
        beacon.visible = true;
      } else beacon.visible = false;
    },
    /** The classical clerk checks every plan, one by one. onStep(n, planIndex) after each check. */
    startClerk({ bar, fast = false, onStep }) {
      resetStates();
      const path = buildPath();
      if (reduceMotion) {
        let n = 0;
        for (const wp of path) {
          if (wp.tank < 0) continue;
          setLabel(wp.tank, plans[wp.tank].total < bar ? "hit" : "seen");
          onStep(++n, wp.tank);
        }
        clerk.visible = false;
        walk = null;
        return;
      }
      clerk.visible = true;
      clerk.position.set(path[0].x - GAP_X, 0, path[0].z);
      walk = { path, i: 0, speed: fast ? 16 : 6.5, onStep, n: 0, pause: 0, bar };
    },
    update(dt, time) {
      if (!root.visible) return;
      const k1 = 1 - Math.exp(-5 * dt);
      tanks.forEach((t, k) => {
        t.cur += (t.target - t.cur) * k1;
        const level = t.cur * H;
        const h = Math.max(Math.abs(level), 0.02);
        t.water.scale.y = h;
        t.water.position.y = MID + level / 2;
        t.flip = t.cur < -0.01 ? 1 : 0;
        const col = t.marked ? (t.flip ? COLORS.flipped : COLORS.marked) : COLORS.plain;
        t.waterMat.color.setHex(col);
        t.waterMat.emissive.setHex(t.marked ? 0x0a5560 : 0x000000);
        const ringOn = t.marked || k === you || t.measured;
        t.ringMat.color.setHex(k === you ? COLORS.you : t.measured ? COLORS.measured : COLORS.marked);
        t.ringMat.opacity += ((ringOn ? 0.85 : 0) - t.ringMat.opacity) * k1;
      });
      if (meanTarget !== null) meanCur += (meanTarget - meanCur) * k1;
      meanLines.forEach((m) => {
        m.visible = meanTarget !== null;
        m.position.y = MID + meanCur * H;
      });
      arrow.position.y = BASE + GLASS_H + 1.6 + Math.sin(time * 4) * 0.2;
      arrow.rotation.y += dt * 2;
      beacon.material.opacity = 0.3 + Math.sin(time * 6) * 0.1;

      if (walk) {
        const wp = walk.path[walk.i];
        if (walk.pause > 0) {
          walk.pause -= dt;
          clerk.userData.walk(walkPhase, 0);
          if (walk.pause <= 0) walk.i++;
        } else {
          const dx = wp.x - clerk.position.x;
          const dz = wp.z - clerk.position.z;
          const d = Math.hypot(dx, dz);
          const step = walk.speed * dt;
          if (d <= step) {
            clerk.position.x = wp.x;
            clerk.position.z = wp.z;
            if (wp.tank >= 0) {
              clerk.rotation.y = Math.PI; // face the tank (it is on the -z side)
              setLabel(wp.tank, plans[wp.tank].total < walk.bar ? "hit" : "seen");
              walk.onStep(++walk.n, wp.tank);
              walk.pause = walk.speed > 10 ? 0.02 : 0.18;
            } else walk.i++;
          } else {
            clerk.position.x += (dx / d) * step;
            clerk.position.z += (dz / d) * step;
            const diff = Math.atan2(Math.sin(Math.atan2(dx, dz) - clerk.rotation.y), Math.cos(Math.atan2(dx, dz) - clerk.rotation.y));
            clerk.rotation.y += diff * Math.min(1, dt * 14);
            walkPhase += dt * walk.speed * 1.6;
            clerk.userData.walk(walkPhase, 1);
          }
        }
        if (walk.i >= walk.path.length) {
          walk = null;
          clerk.userData.walk(0, 0);
        }
      }
    },
    debug: () => ({
      visible: root.visible,
      cols,
      levels: tanks.map((t) => +t.cur.toFixed(3)),
      marked: tanks.reduce((n, t) => n + (t.marked ? 1 : 0), 0),
      clerk: walk ? { n: walk.n, x: +clerk.position.x.toFixed(1), z: +clerk.position.z.toFixed(1) } : null,
    }),
    // For the automated checks.
    tankPos,
    chosen: (k) => chosenSlots(plans[k].x),
  };
}
