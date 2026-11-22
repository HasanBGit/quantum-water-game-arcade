// Equipment built from shapes, with real CC0 surface textures from Poly Haven.
// Units are metres, +Y up. Every builder returns a THREE.Group named by its asset id.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { pbr } from "./textures.js";

const PI = Math.PI;

/**
 * Bake every static mesh in the group into one mesh per material, so a piece of
 * equipment costs a handful of draw calls instead of hundreds. Meshes named in
 * `keep` stay separate (for parts that change later, like lamps and screens).
 * The group must still be at the origin.
 */
// Plain painted surfaces (no texture) all use this one material; each piece keeps its own colour in its vertices.
// That turns dozens of painted meshes into one draw call.
export const flatMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.25, roughness: 0.55 });

export function mergeStatic(group, keep = []) {
  group.updateMatrixWorld(true);
  const byMaterial = new Map();
  const meshes = [];
  group.traverse((o) => {
    if (o.isMesh && !keep.includes(o.name)) meshes.push(o);
  });
  for (const o of meshes) {
    const geo = o.geometry.clone();
    geo.applyMatrix4(o.matrixWorld);
    const flat = o.material.userData.flat || o.material === flatMaterial;
    for (const name of Object.keys(geo.attributes)) if (!["position", "normal", "uv", ...(flat ? ["color"] : [])].includes(name)) geo.deleteAttribute(name);
    if (!geo.attributes.uv) geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    if (flat && !geo.attributes.color) {
      const c = o.material.color;
      const n = geo.attributes.position.count;
      const colors = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    }
    const key = flat ? flatMaterial : o.material;
    if (!byMaterial.has(key)) byMaterial.set(key, []);
    byMaterial.get(key).push(geo);
    o.parent.remove(o);
    o.geometry.dispose();
  }
  for (const [material, geos] of byMaterial) {
    const list = geos.every((g) => g.index) ? geos : geos.map((g) => (g.index ? g.toNonIndexed() : g));
    const merged = new THREE.Mesh(mergeGeometries(list, false), material);
    merged.castShadow = !material.userData.noShadow;
    merged.receiveShadow = true;
    group.add(merged);
    geos.forEach((g) => g.dispose());
  }
  return group;
}

export function put(group, mesh, x = 0, y = 0, z = 0) {
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}
export const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
export const cyl = (r, h, mat, seg = 24) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat);
/** Cylinder lying along X. */
export function hcyl(r, len, mat, seg = 24) {
  const m = cyl(r, len, mat, seg);
  m.rotation.z = PI / 2;
  return m;
}
/** Cylinder lying along Z. */
export function zcyl(r, len, mat, seg = 24) {
  const m = cyl(r, len, mat, seg);
  m.rotation.x = PI / 2;
  return m;
}

// Materials are shared by look, so equal looks end up in one merged mesh.
const materialCache = new Map();
function shared(key, make) {
  if (!materialCache.has(key)) materialCache.set(key, make());
  return materialCache.get(key);
}
export const steel = () => shared("steel", () => new THREE.MeshStandardMaterial({ color: 0xcfd6d9, metalness: 0.9, roughness: 0.32 }));
export const painted = (color, rough = 0.5) =>
  shared(`painted|${color}|${rough}`, () => {
    const m = new THREE.MeshStandardMaterial({ color, metalness: 0.25, roughness: rough });
    m.userData.flat = true; // merged into the shared coloured mesh by mergeStatic
    return m;
  });

/** Flange on a pipe running along X. */
export function flangeX(group, x, y, z, pipeR, mat) {
  put(group, hcyl(pipeR * 1.8, 0.03, mat), x, y, z);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI * 2;
    put(group, hcyl(0.011, 0.05, mat, 8), x, y + Math.cos(a) * pipeR * 1.45, z + Math.sin(a) * pipeR * 1.45);
  }
}

function dialTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#f4f4f0";
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = "#1a1a1a";
  g.lineWidth = 2;
  for (let i = 0; i <= 10; i++) {
    const a = PI * 0.75 + (i / 10) * PI * 1.5;
    g.beginPath();
    g.moveTo(64 + Math.cos(a) * 46, 64 + Math.sin(a) * 46);
    g.lineTo(64 + Math.cos(a) * 56, 64 + Math.sin(a) * 56);
    g.stroke();
  }
  g.strokeStyle = "#c0261b";
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(64, 64);
  g.lineTo(64 + Math.cos(PI * 1.55) * 44, 64 + Math.sin(PI * 1.55) * 44);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** High-pressure pump on a steel skid. About 2.5 m long, running along X. */
export function buildPumpSkid() {
  const g = new THREE.Group();
  g.name = "pump_skid";
  const frame = pbr("blue_metal_plate", [3, 1]);
  const paint = pbr("blue_metal_plate", [2, 1]);
  const metal = steel();
  const yellow = painted(0xe0ac12);
  const dark = painted(0x1b1f22, 0.8);

  for (const z of [-0.36, 0.36]) put(g, box(2.5, 0.1, 0.09, frame), 0, 0.15, z);
  for (const x of [-1.1, -0.35, 0.35, 1.1]) put(g, box(0.09, 0.09, 0.82, frame), x, 0.15, 0);
  put(g, box(2.4, 0.02, 0.7, dark), 0, 0.21, 0);
  for (const [x, z] of [[-1.15, -0.38], [-1.15, 0.38], [1.15, -0.38], [1.15, 0.38]]) put(g, box(0.12, 0.1, 0.12, dark), x, 0.05, z);

  // Motor
  put(g, box(0.7, 0.06, 0.5, frame), -0.6, 0.25, 0);
  put(g, hcyl(0.27, 0.95, paint), -0.6, 0.57, 0);
  for (let i = 0; i < 10; i++) put(g, hcyl(0.285, 0.018, paint), -1.0 + i * 0.09, 0.57, 0);
  put(g, hcyl(0.23, 0.12, paint), -1.1, 0.57, 0);
  put(g, hcyl(0.25, 0.18, dark), -1.22, 0.57, 0);
  put(g, box(0.22, 0.16, 0.2, paint), -0.6, 0.57 + 0.27 + 0.08, 0);

  // Coupling guard and pump barrel
  put(g, hcyl(0.2, 0.22, yellow), -0.02, 0.57, 0);
  put(g, hcyl(0.17, 0.95, metal), 0.55, 0.57, 0);
  for (let i = 0; i < 5; i++) put(g, hcyl(0.2, 0.05, metal), 0.22 + i * 0.17, 0.57, 0);
  put(g, hcyl(0.23, 0.08, metal), 0.1, 0.57, 0);
  put(g, hcyl(0.23, 0.08, metal), 1.0, 0.57, 0);

  // Suction nozzle and discharge line
  put(g, hcyl(0.09, 0.3, metal), 1.18, 0.57, 0);
  flangeX(g, 1.34, 0.57, 0, 0.09, metal);
  put(g, cyl(0.055, 0.6, metal), 0.55, 0.57 + 0.17 + 0.3, 0);
  put(g, new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), metal), 0.55, 1.34, 0);
  put(g, hcyl(0.055, 0.7, metal), 0.9, 1.34, 0);
  flangeX(g, 1.26, 1.34, 0, 0.055, metal);

  // Pressure gauge
  put(g, zcyl(0.012, 0.12, metal, 8), 0.55, 1.05, 0.08);
  put(g, zcyl(0.06, 0.035, metal), 0.55, 1.05, 0.16);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.052, 24), new THREE.MeshBasicMaterial({ map: dialTexture() }));
  face.position.set(0.55, 1.05, 0.1785);
  g.add(face);
  return mergeStatic(g);
}

/** Rack of six horizontal membrane vessels with feed and permeate headers. About 3.6 m long. */
export function buildMembraneRack() {
  const g = new THREE.Group();
  g.name = "membrane_rack";
  const frame = painted(0x3f5a70, 0.55);
  const metal = steel();
  const white = new THREE.MeshPhysicalMaterial({ color: 0xe8edf0, roughness: 0.35, clearcoat: 0.4, clearcoatRoughness: 0.3 });
  const cap = painted(0x6d7f8c, 0.45);
  const blue = painted(0x4f9bbd, 0.4);

  for (const x of [-1.75, 0, 1.75]) for (const z of [-0.5, 0.5]) put(g, box(0.06, 1.8, 0.06, frame), x, 0.9, z);
  for (const y of [0.38, 0.83, 1.28]) {
    for (const z of [-0.45, 0.45]) put(g, box(3.5, 0.04, 0.06, frame), 0, y, z);
    for (const x of [-1.5, 0, 1.5]) put(g, box(0.06, 0.04, 1.0, frame), x, y, 0);
  }
  put(g, box(3.6, 0.08, 0.08, frame), 0, 0.04, -0.5);
  put(g, box(3.6, 0.08, 0.08, frame), 0, 0.04, 0.5);

  for (const y of [0.52, 0.97, 1.42]) {
    for (const z of [-0.2, 0.2]) {
      put(g, hcyl(0.11, 3.2, white), 0, y, z);
      for (const x of [-1.62, 1.62]) put(g, hcyl(0.125, 0.06, cap), x, y, z);
      for (const x of [-1.0, 0, 1.0]) put(g, hcyl(0.118, 0.04, metal), x, y, z);
      put(g, hcyl(0.035, 0.16, metal, 12), -1.74, y, z);
      put(g, hcyl(0.03, 0.16, blue, 12), 1.74, y, z);
    }
    put(g, zcyl(0.04, 0.5, metal, 12), -1.82, y, 0);
    put(g, zcyl(0.032, 0.5, blue, 12), 1.82, y, 0);
  }
  put(g, cyl(0.07, 1.7, metal, 20), -1.82, 0.9, 0);
  put(g, cyl(0.055, 1.7, blue, 20), 1.82, 0.9, 0);
  return mergeStatic(g);
}

/** Product-water storage tank, about 4.5 m across and 5 m tall. */
export function buildTank({ inlet = 1 } = {}) {
  const g = new THREE.Group();
  g.name = "tank";
  const R = 2.1;
  const H = 4;
  const shell = pbr("corrugated_iron", [10, 1.5]);
  const concrete = pbr("painted_plaster_wall", [3, 1]);
  const metal = steel();
  const roof = painted(0xc9d0d4, 0.45);

  put(g, cyl(R + 0.2, 0.25, concrete, 48), 0, 0.125, 0);
  put(g, cyl(R, H, shell, 64), 0, 0.25 + H / 2, 0);
  for (let i = 1; i < 4; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R + 0.005, 0.015, 8, 64), metal);
    ring.rotation.x = PI / 2;
    put(g, ring, 0, 0.25 + (i * H) / 4, 0);
  }
  const top = 0.25 + H;
  put(g, new THREE.Mesh(new THREE.ConeGeometry(R + 0.05, 0.6, 64), roof), 0, top + 0.3, 0);
  put(g, cyl(0.25, 0.25, roof), 0, top + 0.7, 0);
  put(g, cyl(0.3, 0.05, metal), 0, top + 0.84, 0);
  const rail = new THREE.Mesh(new THREE.TorusGeometry(R - 0.05, 0.02, 8, 64), metal);
  rail.rotation.x = PI / 2;
  put(g, rail, 0, top + 0.12, 0);

  // Ladder on the +Z side
  for (const x of [-0.2, 0.2]) put(g, cyl(0.02, top, metal, 8), x, top / 2, R + 0.12);
  for (let y = 0.4; y < top - 0.2; y += 0.3) put(g, hcyl(0.015, 0.4, metal, 8), 0, y, R + 0.12);

  // Inlet pipe and valve at the base
  const d = inlet;
  put(g, hcyl(0.12, 0.8, metal), d * (R + 0.3), 0.6, 0);
  flangeX(g, d * (R + 0.7), 0.6, 0, 0.12, metal);
  put(g, cyl(0.025, 0.3, metal, 8), d * (R + 0.5), 0.82, 0);
  put(g, new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 8, 20), painted(0xc0261b)), d * (R + 0.5), 0.98, 0).rotation.x = PI / 2;
  return mergeStatic(g);
}

function screenTexture(lines) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#0b1d24";
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = "#7fe0f2";
  g.font = "bold 30px system-ui, sans-serif";
  lines.forEach((t, i) => g.fillText(t, 16, 44 + i * 40));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Control post with a screen, a button and a stack light. Its front faces +Z. */
export function buildTerminal() {
  const g = new THREE.Group();
  g.name = "terminal";
  const cabinet = painted(0x1f9aa6, 0.45); // teal: the colour of things you can use
  const concrete = pbr("painted_plaster_wall", [1, 1]);
  const dark = painted(0x22282c, 0.7);
  const glow = (color) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6 });

  put(g, box(0.6, 0.1, 0.44, concrete), 0, 0.05, 0);
  put(g, box(0.5, 0.95, 0.3, cabinet), 0, 0.575, 0);
  put(g, box(0.56, 0.03, 0.38, dark), 0, 1.07, 0);
  const slope = put(g, box(0.5, 0.04, 0.26, dark), 0, 0.98, 0.06);
  slope.rotation.x = -0.6;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.4, 0.2),
    new THREE.MeshBasicMaterial({ map: screenTexture(["SLOT 1", "PUMP OFF"]) }),
  );
  screen.position.set(0, 0.99, 0.085);
  screen.rotation.x = -0.6;
  screen.name = "screen";
  g.add(screen);
  put(g, cyl(0.04, 0.03, glow(0xd6452b)), 0.12, 0.78, 0.155).rotation.x = PI / 2;
  const lamp = put(g, cyl(0.025, 0.02, glow(0x39d96b)), -0.12, 0.78, 0.155);
  lamp.rotation.x = PI / 2;
  lamp.name = "lamp";
  put(g, cyl(0.02, 0.35, dark, 12), 0.2, 1.27, 0);
  put(g, cyl(0.05, 0.07, glow(0xd6452b)), 0.2, 1.48, 0);
  put(g, cyl(0.05, 0.07, glow(0xf1b80a)), 0.2, 1.56, 0);
  put(g, cyl(0.05, 0.07, glow(0x39d96b)), 0.2, 1.64, 0);
  return mergeStatic(g, ["screen", "lamp"]);
}

/**
 * Placeholder operator: realistic proportions (1.75 m), white hard hat, teal vest.
 * It is a stand-in until a licensed realistic character is chosen.
 * Faces +Z. Returns the group; call group.userData.walk(phase, amount) to swing the limbs and
 * group.userData.press(amount) (0 to 1) to reach the right arm forward.
 */
export function buildOperator() {
  const root = new THREE.Group();
  root.name = "operator";
  const g = new THREE.Group(); // the body is modelled facing +X; turn it to face +Z
  g.rotation.y = -PI / 2;
  root.add(g);
  const skin = painted(0xbfc4c6, 0.8);
  const trousers = painted(0x243447, 0.85);
  const boots = painted(0x1c1c1c, 0.7);
  const shirt = painted(0xe9ecef, 0.85);
  const vest = painted(0x1f9aa6, 0.8);
  const hat = painted(0xf4f6f7, 0.35);

  const limb = (x, y, z, r, len, mat) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 12), mat);
    m.position.y = -(len / 2 + r);
    m.castShadow = true;
    pivot.add(m);
    g.add(pivot);
    return pivot;
  };
  const legL = limb(0, 0.92, 0.1, 0.075, 0.68, trousers);
  const legR = limb(0, 0.92, -0.1, 0.075, 0.68, trousers);
  for (const leg of [legL, legR]) {
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.11), boots);
    boot.position.set(0.05, -0.85, 0);
    boot.castShadow = true;
    leg.add(boot);
  }
  const armL = limb(0, 1.48, 0.22, 0.05, 0.5, shirt);
  const armR = limb(0, 1.48, -0.22, 0.05, 0.5, shirt);

  put(g, new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.42, 8, 16), shirt), 0, 1.22, 0).scale.set(0.8, 1, 1.35);
  put(g, new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.3, 8, 16), vest), 0, 1.22, 0).scale.set(0.9, 0.85, 1.42);
  put(g, new THREE.Mesh(new THREE.SphereGeometry(0.105, 24, 18), skin), 0, 1.66, 0);
  put(g, cyl(0.045, 0.08, skin, 12), 0, 1.55, 0);
  const dome = put(g, new THREE.Mesh(new THREE.SphereGeometry(0.125, 28, 16, 0, PI * 2, 0, PI / 2), hat), 0, 1.7, 0);
  dome.scale.set(1, 1, 1.05);
  put(g, cyl(0.15, 0.012, hat, 32), 0.015, 1.7, 0);
  put(g, box(0.02, 0.025, 0.2, hat), 0, 1.835, 0);

  let pressing = 0;
  root.userData.walk = (phase, amount) => {
    const s = Math.sin(phase) * 0.7 * amount;
    legL.rotation.z = s;
    legR.rotation.z = -s;
    armL.rotation.z = -s * 0.8;
    armR.rotation.z = pressing > 0 ? pressing * 1.35 : s * 0.8;
  };
  root.userData.press = (amount) => {
    pressing = amount;
  };
  return root;
}

/** Wave height at a point, shared by the sea mesh and anything that floats. */
export function waveHeight(x, z, t) {
  return (
    Math.sin(x * 0.11 + t * 0.9) * 0.1 +
    Math.sin(z * 0.17 - t * 0.7) * 0.07 +
    Math.sin((x + z) * 0.23 + t * 1.3) * 0.04
  );
}

/** Sea surface. Call update(t) every frame. */
export function buildSea() {
  const geo = new THREE.PlaneGeometry(420, 160, 84, 32);
  geo.rotateX(-PI / 2);
  const mat = new THREE.MeshPhysicalMaterial({ color: 0x12b5e0, roughness: 0.09, metalness: 0, envMapIntensity: 1.4, clearcoat: 0.3 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "sea_tile";
  mesh.receiveShadow = true;
  const pos = geo.attributes.position;
  let frame = 0;
  let every = 2;
  const update = (t, force = false) => {
    if (!force && frame++ % every !== 0) return;
    for (let i = 0; i < pos.count; i++) pos.setY(i, waveHeight(pos.getX(i), pos.getZ(i), t));
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  };
  update(0, true);
  return { object: mesh, update, setEvery: (n) => (every = n) };
}
