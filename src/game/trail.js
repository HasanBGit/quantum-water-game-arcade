// A trail of yellow chevrons on the ground that leads the player to the next thing to do.
// It finds a way round the equipment on a coarse grid (A*), then lays chevrons along it. A wave of
// growing chevrons runs towards the goal so the direction reads without any words.
import * as THREE from "three";
import { BOUNDS } from "./world.js";

const CELL = 0.5;
const COLS = Math.ceil((BOUNDS.maxX - BOUNDS.minX) / CELL) + 1;
const ROWS = Math.ceil((BOUNDS.maxZ - BOUNDS.minZ) / CELL) + 1;
const SPACING = 0.9; // metres between chevrons
const MAX = 90;
const GROUND = 0.13; // just above the pump pads (0.1), so the trail never sinks into them

const cellOf = (x, z) => [Math.round((x - BOUNDS.minX) / CELL), Math.round((z - BOUNDS.minZ) / CELL)];
const centre = (c, r) => [BOUNDS.minX + c * CELL, BOUNDS.minZ + r * CELL];

export function createTrail({ scene, blocked }) {
  // Chevron pointing along +Z (rotated per instance).
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.3);
  shape.lineTo(0.28, -0.12);
  shape.lineTo(0.28, -0.34);
  shape.lineTo(0, -0.04);
  shape.lineTo(-0.28, -0.34);
  shape.lineTo(-0.28, -0.12);
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2); // lie flat; the tip now points to -Z
  geo.rotateY(Math.PI); // tip to +Z
  const mat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.95, depthWrite: false });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX);
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  mesh.visible = false;
  scene.add(mesh);

  let free = null; // Uint8Array: 1 where the operator can stand
  const open = () => {
    if (free) return free;
    free = new Uint8Array(COLS * ROWS);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) free[r * COLS + c] = blocked(...centre(c, r)) ? 0 : 1;
    return free;
  };

  /** Nearest free cell to (c, r), searched in growing squares. */
  function snap(c, r) {
    const g = open();
    for (let d = 0; d < 8; d++) {
      for (let dr = -d; dr <= d; dr++) {
        for (let dc = -d; dc <= d; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== d) continue;
          const cc = c + dc;
          const rr = r + dr;
          if (cc >= 0 && rr >= 0 && cc < COLS && rr < ROWS && g[rr * COLS + cc]) return [cc, rr];
        }
      }
    }
    return null;
  }

  function findPath(from, to) {
    const g = open();
    const s = snap(...cellOf(from.x, from.z));
    const e = snap(...cellOf(to.x, to.z));
    if (!s || !e) return null;
    const start = s[1] * COLS + s[0];
    const goal = e[1] * COLS + e[0];
    const cost = new Float32Array(COLS * ROWS).fill(Infinity);
    const prev = new Int32Array(COLS * ROWS).fill(-1);
    const heap = [[0, start]]; // [priority, cell]
    cost[start] = 0;
    const push = (item) => {
      heap.push(item);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p][0] <= heap[i][0]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1;
          const r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top;
    };
    const gc = goal % COLS;
    const gr = (goal / COLS) | 0;
    while (heap.length) {
      const [, cur] = pop();
      if (cur === goal) break;
      const c = cur % COLS;
      const r = (cur / COLS) | 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dc && !dr) continue;
          const cc = c + dc;
          const rr = r + dr;
          if (cc < 0 || rr < 0 || cc >= COLS || rr >= ROWS) continue;
          const n = rr * COLS + cc;
          if (!g[n]) continue;
          if (dc && dr && (!g[r * COLS + cc] || !g[rr * COLS + c])) continue; // no cutting corners
          const nc = cost[cur] + (dc && dr ? 1.414 : 1);
          if (nc < cost[n]) {
            cost[n] = nc;
            prev[n] = cur;
            push([nc + Math.hypot(gc - cc, gr - rr), n]);
          }
        }
      }
    }
    if (prev[goal] === -1 && goal !== start) return null;
    const pts = [];
    for (let n = goal; n !== -1; n = prev[n]) pts.push(centre(n % COLS, (n / COLS) | 0));
    return pts.reverse();
  }

  /** Walk along a polyline and return a point every `step` metres, with the heading there. */
  function sample(pts, step) {
    const out = [];
    let next = step / 2; // distance along the path of the next chevron
    let walked = 0;
    for (let i = 1; i < pts.length; i++) {
      const [x0, z0] = pts[i - 1];
      const [x1, z1] = pts[i];
      const len = Math.hypot(x1 - x0, z1 - z0);
      const heading = Math.atan2(x1 - x0, z1 - z0);
      while (next <= walked + len) {
        const t = (next - walked) / len;
        out.push({ x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, h: heading });
        next += step;
      }
      walked += len;
    }
    return out;
  }

  let marks = [];
  let key = "";
  let sinceReplan = 1;
  const dummy = new THREE.Object3D();

  return {
    /** `from` and `to` are { x, z }, or `to` is null to hide the trail. `stopShort` ends it that many metres before `to`. */
    update(dt, time, from, to, stopShort = 1.6) {
      if (!to) {
        mesh.visible = false;
        key = "";
        return;
      }
      sinceReplan += dt;
      const k = `${cellOf(from.x, from.z)}|${cellOf(to.x, to.z)}`;
      if (k !== key && sinceReplan > 0.2) {
        key = k;
        sinceReplan = 0;
        const path = findPath(from, to);
        marks = path ? sample(path, SPACING) : [];
      }
      let shown = 0;
      const n = marks.length;
      for (let i = 0; i < n && shown < MAX; i++) {
        const m = marks[i];
        if (Math.hypot(m.x - from.x, m.z - from.z) < 1.0) continue; // not under the operator's feet
        if (Math.hypot(m.x - to.x, m.z - to.z) < stopShort) continue; // stop before the goal
        const wave = 0.5 + 0.5 * Math.sin(time * 5 - i * 0.7);
        dummy.position.set(m.x, GROUND, m.z);
        dummy.rotation.set(0, m.h, 0);
        dummy.scale.setScalar(0.65 + wave * 0.55);
        dummy.updateMatrix();
        mesh.setMatrixAt(shown++, dummy.matrix);
      }
      mesh.count = shown;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.visible = shown > 0;
    },
  };
}
