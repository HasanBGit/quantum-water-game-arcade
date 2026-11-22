// Site pieces built from shapes: pipes, lamp posts, a water tower, signs, the control room,
// a chain-link fence, a jetty, bollards and floor markings. Metres, +Y up, front faces +Z.
import * as THREE from "three";
import { pbr } from "./textures.js";
import { put, box, cyl, hcyl, painted, steel, mergeStatic } from "./builders.js";

const PI = Math.PI;
const UP = new THREE.Vector3(0, 1, 0);

/** A cylinder between two points. */
function pipeBetween(a, b, r, mat, seg = 16) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), seg), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
  m.castShadow = m.receiveShadow = true;
  return m;
}

/**
 * Pipes along polylines of [x, y, z] points, with elbows and flanges, all merged into a few meshes.
 * specs: [{ points, radius, color, supportEvery }]. `supportEvery` (metres) adds steel posts under
 * horizontal runs that are high above the ground. Returns { object, supports: [[x, z], ...] } so the
 * caller can add colliders for the posts.
 */
export function buildPipes(specs) {
  const g = new THREE.Group();
  const flange = steel();
  const post = painted(0x3b4850, 0.6);
  const mats = new Map();
  const materialFor = (color) => {
    if (!mats.has(color)) mats.set(color, new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness: 0.42 }));
    return mats.get(color);
  };
  const supports = [];
  for (const { points, radius, color, supportEvery = 0 } of specs) {
    const mat = materialFor(color);
    const pts = points.map((p) => new THREE.Vector3(...p));
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      g.add(pipeBetween(a, b, radius, mat));
      const dir = new THREE.Vector3().subVectors(b, a);
      const len = dir.length();
      const unit = dir.clone().normalize();
      if (len >= 0.5) {
        for (const t of [0.12, len - 0.12]) {
          g.add(pipeBetween(a.clone().addScaledVector(unit, t - 0.02), a.clone().addScaledVector(unit, t + 0.02), radius * 1.55, flange, 14));
        }
      }
      if (supportEvery && Math.abs(dir.y) < 0.01 && a.y > 1) {
        for (let d = supportEvery / 2; d < len; d += supportEvery) {
          const p = a.clone().addScaledVector(unit, d);
          put(g, box(0.14, p.y - radius, 0.14, post), p.x, (p.y - radius) / 2, p.z);
          put(g, box(0.4, 0.06, 0.18, post), p.x, p.y - radius, p.z);
          supports.push([p.x, p.z]);
        }
      }
    }
    for (let i = 1; i < pts.length - 1; i++) {
      const sph = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.04, 14, 10), mat);
      sph.position.copy(pts[i]);
      sph.castShadow = true;
      g.add(sph);
    }
  }
  return { object: mergeStatic(g), supports };
}

/** A 6 m lamp post with an arm and a lit lens. */
export function buildLampPost() {
  const g = new THREE.Group();
  const dark = painted(0x4b5358, 0.5);
  const lens = new THREE.MeshStandardMaterial({ color: 0xfff3d6, emissive: 0xffe9b0, emissiveIntensity: 1.8 });
  put(g, cyl(0.17, 0.06, dark, 16), 0, 0.03, 0);
  put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.085, 6, 12), dark), 0, 3, 0);
  put(g, box(1.2, 0.06, 0.07, dark), 0.55, 5.9, 0);
  put(g, box(0.55, 0.1, 0.28, dark), 1.1, 5.86, 0);
  put(g, box(0.5, 0.02, 0.22, lens), 1.1, 5.8, 0);
  return mergeStatic(g);
}

/** Tall elevated feed-water tank: the landmark you can see from the start. About 14 m. */
export function buildWaterTower() {
  const g = new THREE.Group();
  const steelM = painted(0x56646d, 0.55);
  const shell = pbr("corrugated_iron", [8, 2]);
  const teal = painted(0x1f9aa6, 0.45);
  const roof = painted(0xc9d0d4, 0.45);
  const legH = 9;
  const L = 1.5;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(g, cyl(0.14, legH, steelM, 12), sx * L, legH / 2, sz * L);
  for (const y of [3, 6]) {
    for (const [a, b] of [[[-L, y, -L], [L, y + 3 - 3, -L]], [[L, y, -L], [L, y, L]], [[L, y, L], [-L, y, L]], [[-L, y, L], [-L, y, -L]]]) {
      g.add(pipeBetween(new THREE.Vector3(...a), new THREE.Vector3(...b), 0.05, steelM, 8));
    }
    for (const [a, b] of [[[-L, y - 3, -L], [L, y, -L]], [[L, y - 3, L], [-L, y, L]]]) {
      g.add(pipeBetween(new THREE.Vector3(...a), new THREE.Vector3(...b), 0.04, steelM, 8));
    }
  }
  put(g, cyl(2.5, 0.12, steelM, 32), 0, legH + 0.06, 0);
  put(g, cyl(2.2, 3.6, shell, 40), 0, legH + 0.12 + 1.8, 0);
  for (const y of [legH + 0.9, legH + 2.1, legH + 3.3]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.205, 0.07, 8, 40), teal);
    ring.rotation.x = PI / 2;
    put(g, ring, 0, y, 0);
  }
  put(g, new THREE.Mesh(new THREE.ConeGeometry(2.3, 1.0, 40), roof), 0, legH + 3.72 + 0.5, 0);
  put(g, cyl(0.3, 0.3, roof, 16), 0, legH + 4.9, 0);
  for (const x of [-0.18, 0.18]) put(g, cyl(0.02, legH + 3.8, steelM, 6), x + L, (legH + 3.8) / 2, L + 0.2);
  for (let y = 0.5; y < legH + 3.5; y += 0.32) put(g, hcyl(0.015, 0.36, steelM, 6), L, y, L + 0.2);
  return mergeStatic(g);
}

function signTexture(text) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 160;
  const g = c.getContext("2d");
  g.fillStyle = "#0f4c5c";
  g.fillRect(0, 0, 512, 160);
  g.strokeStyle = "#ffffff";
  g.lineWidth = 6;
  g.strokeRect(10, 10, 492, 140);
  g.fillStyle = "#ffffff";
  g.textAlign = "center";
  g.textBaseline = "middle";
  let size = 64;
  g.font = `bold ${size}px system-ui, sans-serif`;
  while (g.measureText(text).width > 440 && size > 24) {
    size -= 4;
    g.font = `bold ${size}px system-ui, sans-serif`;
  }
  g.fillText(text, 256, 82);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** A sign board on two posts. Faces +Z. */
export function buildSign(text, width = 2.2) {
  const g = new THREE.Group();
  g.name = `sign_${text}`;
  const dark = painted(0x3b4850, 0.6);
  for (const x of [-width / 2 + 0.15, width / 2 - 0.15]) put(g, cyl(0.04, 2.5, dark, 8), x, 1.25, 0);
  put(g, box(width, width * 0.3125, 0.05, dark), 0, 2.05, 0);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.06, width * 0.3125 - 0.06), new THREE.MeshBasicMaterial({ map: signTexture(text) }));
  face.position.set(0, 2.05, 0.03);
  g.add(face);
  const back = face.clone(); // readable from behind too
  back.rotation.y = PI;
  back.position.z = -0.03;
  g.add(back);
  return mergeStatic(g);
}

/** Control room: a small block building with a door, windows and a canopy. 9 x 5.5 m. Front faces +Z. */
export function buildControlRoom(label) {
  const g = new THREE.Group();
  g.name = "control_room";
  const W = 9;
  const D = 5.5;
  const H = 3.2;
  const walls = pbr("concrete_wall_004", [4, 1.3]);
  const plinth = pbr("painted_plaster_wall", [4, 1]);
  const roofMat = painted(0x59646b, 0.6);
  const dark = painted(0x232a2e, 0.6);
  const glass = new THREE.MeshStandardMaterial({ color: 0x3a5a6a, metalness: 0.9, roughness: 0.05, emissive: 0x7a6a48, emissiveIntensity: 0.08 });

  put(g, box(W + 0.4, 0.15, D + 0.4, plinth), 0, 0.075, 0);
  put(g, box(W, H, D, walls), 0, 0.15 + H / 2, 0);
  put(g, box(W + 0.5, 0.22, D + 0.5, roofMat), 0, 0.15 + H + 0.11, 0);
  put(g, box(1.6, 0.55, 1.3, painted(0xb7bec2, 0.5)), 2.6, 0.15 + H + 0.22 + 0.28, -0.8);
  const zf = D / 2 + 0.01;
  put(g, box(1.1, 2.1, 0.08, dark), -2.5, 0.15 + 1.05, zf);
  put(g, box(1.9, 0.09, 1.0, dark), -2.5, 0.15 + 2.35, zf + 0.5);
  for (const x of [-3.3, -1.7]) put(g, cyl(0.04, 2.35, dark, 8), x, 0.15 + 1.17, zf + 0.95);
  for (const x of [0.4, 2.3, 4.0]) {
    put(g, box(1.55, 1.25, 0.05, dark), x, 0.15 + 1.75, zf);
    put(g, box(1.4, 1.1, 0.06, glass), x, 0.15 + 1.75, zf + 0.02);
  }
  const face = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.5), new THREE.MeshBasicMaterial({ map: signTexture(label) }));
  face.position.set(-2.5, 0.15 + 2.75, zf + 0.02);
  g.add(face);
  return mergeStatic(g);
}

function chainTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  g.strokeStyle = "#cfd5d8";
  g.lineWidth = 3.5;
  for (let i = -128; i <= 256; i += 32) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 128, 128);
    g.moveTo(i, 128);
    g.lineTo(i + 128, 0);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Chain-link fence along a polyline of [x, z] points. The mesh is a cut-out texture, so it costs almost nothing. */
export function buildFence(points, height = 2.2) {
  const g = new THREE.Group();
  const mesh = new THREE.MeshStandardMaterial({ map: chainTexture(), alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.5, roughness: 0.5 });
  mesh.userData.noShadow = true;
  const post = steel();
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, z1] = points[i];
    const [x2, z2] = points[i + 1];
    const len = Math.hypot(x2 - x1, z2 - z1);
    const geo = new THREE.PlaneGeometry(len, height - 0.1);
    const uv = geo.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, (uv.getX(k) * len) / 0.55, ((uv.getY(k) * (height - 0.1)) / 0.55));
    const panel = new THREE.Mesh(geo, mesh);
    panel.position.set((x1 + x2) / 2, height / 2, (z1 + z2) / 2);
    panel.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    g.add(panel);
    const dx = (x2 - x1) / len;
    const dz = (z2 - z1) / len;
    const rail = hcyl(0.025, len, post, 8);
    rail.position.set((x1 + x2) / 2, height, (z1 + z2) / 2);
    rail.rotation.y = -Math.atan2(dz, dx);
    g.add(rail);
    for (let d = 0; d <= len + 0.01; d += 3) put(g, cyl(0.04, height + 0.05, post, 8), x1 + dx * d, (height + 0.05) / 2, z1 + dz * d);
  }
  return mergeStatic(g);
}

/** Short concrete jetty with piles and a hand rail, running north (-Z) into the sea. */
export function buildJetty(length = 13) {
  const g = new THREE.Group();
  const concrete = pbr("painted_plaster_wall", [2, 6]);
  const dark = painted(0x3b4850, 0.6);
  const yellow = painted(0xe0ac12, 0.5);
  put(g, box(3, 0.35, length, concrete), 0, 0.3, -length / 2);
  for (let z = -1; z > -length; z -= 3) for (const x of [-1.3, 1.3]) put(g, cyl(0.16, 3, dark, 12), x, -1.1, z);
  for (const x of [-1.4, 1.4]) {
    put(g, hcyl(0.03, 0.01, dark, 6), x, 1.2, 0);
    for (let z = -0.5; z > -length; z -= 2) put(g, cyl(0.035, 1.0, dark, 6), x, 0.98, z);
    const rail = cyl(0.03, length - 0.5, dark, 6);
    rail.rotation.x = PI / 2;
    put(g, rail, x, 1.45, -length / 2);
  }
  for (const z of [-length + 0.4]) put(g, cyl(0.12, 0.6, yellow, 12), 0, 0.78, z);
  return mergeStatic(g);
}

/** Yellow safety bollards at the given [x, z] spots. */
export function buildBollards(spots) {
  const g = new THREE.Group();
  const yellow = painted(0xe0ac12, 0.5);
  const black = painted(0x1b1f22, 0.7);
  for (const [x, z] of spots) {
    put(g, cyl(0.1, 0.95, yellow, 14), x, 0.475, z);
    put(g, cyl(0.102, 0.12, black, 14), x, 0.6, z);
    put(g, cyl(0.11, 0.03, black, 14), x, 0.96, z);
  }
  return mergeStatic(g);
}

/** Flat painted rectangles on the ground: [x, z, width, depth, "yellow" | "white"]. */
export function buildMarkings(rects) {
  const g = new THREE.Group();
  const mats = { yellow: painted(0xe0ac12, 0.7), white: painted(0xe9ecef, 0.7) };
  for (const [x, z, w, d, color] of rects) put(g, box(w, 0.012, d, mats[color]), x, 0.006, z).castShadow = false;
  return mergeStatic(g);
}
