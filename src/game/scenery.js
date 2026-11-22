// The world beyond the fence, in the arcade look: flat colours, chunky low-poly shapes, no photo textures.
// Sand, dunes, rocks, palms and bushes, a sea that goes from turquoise to deep blue with a foam line, two dhow boats,
// buoys, gulls and far hills. Everything is merged or instanced, so the whole thing costs about a dozen draw calls
// (the realistic trees it replaces cost more). None of it is walkable: the player stays inside the fence.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { SLOT_COLORS, NAVY } from "./palette.js";

const PI = Math.PI;
let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const range = (a, b) => a + rnd() * (b - a);
const reduceMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Ground height under the sand plane and the sloping shore (see world.js): flat to z = -11, then falling away.
export const groundY = (z) => (z > -11 ? -0.12 : -0.12 - (-11 - z) * 0.055);

/** One coloured piece with position, normal and colour only, so every piece can be merged into one mesh. */
function piece(geo, hex, { pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1] } = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (g.attributes.uv) g.deleteAttribute("uv");
  if (!g.attributes.normal) g.computeVertexNormals();
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale)));
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}
const toon = (extra = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0, ...extra });
const mergeMesh = (parts, material, { cast = false } = {}) => {
  const mesh = new THREE.Mesh(mergeGeometries(parts, false), material);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  return mesh;
};

// ---------------------------------------------------------------- sand: warm cream with soft ripple lines, not a photo
function sandTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = "#f7db92";
  g.fillRect(0, 0, 512, 512);
  g.lineCap = "round";
  for (let row = 0; row < 12; row++) {
    const y = 20 + row * 42 + range(-6, 6);
    g.strokeStyle = row % 2 ? "rgba(236,187,104,.55)" : "rgba(255,238,184,.7)";
    g.lineWidth = row % 2 ? 5 : 7;
    g.beginPath();
    for (let x = 0; x <= 512; x += 16) {
      const yy = y + Math.sin((x / 512) * PI * 4 + row) * 6;
      x === 0 ? g.moveTo(x, yy) : g.lineTo(x, yy);
    }
    g.stroke();
  }
  for (let i = 0; i < 160; i++) {
    g.fillStyle = i % 3 ? "rgba(231,180,96,.5)" : "rgba(255,244,205,.7)";
    g.beginPath();
    g.arc(range(0, 512), range(0, 512), range(1.5, 3.5), 0, PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}
let sandTex = null;
export function sandMaterial(repeatX, repeatY) {
  sandTex ??= sandTexture();
  const tex = sandTex.clone();
  tex.needsUpdate = true;
  tex.repeat.set(repeatX, repeatY);
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0 });
}

// ---------------------------------------------------------------- sea: turquoise near the shore, deep blue far out
export function tintSea(mesh, centreZ) {
  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  const shallow = new THREE.Color("#5eead8");
  const mid = new THREE.Color("#18b4e6");
  const deep = new THREE.Color("#0b50c0");
  const col = new Float32Array(pos.count * 3);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const d = THREE.MathUtils.clamp((-(pos.getZ(i) + centreZ) - 19) / 70, 0, 1); // 0 at the waterline, 1 far out
    d < 0.3 ? tmp.copy(shallow).lerp(mid, d / 0.3) : tmp.copy(mid).lerp(deep, (d - 0.3) / 0.7);
    col.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  mesh.material.vertexColors = true;
  mesh.material.color.set(0xffffff);
  mesh.material.envMapIntensity = 0.7;
  mesh.material.clearcoat = 0;
  mesh.material.needsUpdate = true;
}

function foamTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = "#ffffff";
  for (let x = 0; x < 512; x += 24) {
    g.globalAlpha = 0.95;
    g.beginPath();
    g.arc(x + 12, 40 + Math.sin(x * 0.05) * 3, 15, 0, PI * 2);
    g.fill();
  }
  for (let x = 0; x < 512; x += 24) {
    g.globalAlpha = 0.55;
    g.beginPath();
    g.arc(x, 20 + Math.cos(x * 0.07) * 3, 7, 0, PI * 2);
    g.fill();
  }
  g.globalAlpha = 0.9;
  g.fillRect(0, 44, 512, 20); // the solid inner edge, on the sand side
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(40, 1);
  return tex;
}

// ---------------------------------------------------------------- palms
function frondGeometry(L, W) {
  const seg = 5;
  const ring = (u) => ({ x: L * u, y: L * (0.34 * u - 0.7 * u * u), hw: W * Math.pow(1 - u, 0.7) + 0.02 });
  const v = [];
  for (let s = 0; s < seg; s++) {
    const a = ring(s / seg);
    const b = ring((s + 1) / seg);
    v.push(a.x, a.y, -a.hw, a.x, a.y, a.hw, b.x, b.y, -b.hw);
    v.push(a.x, a.y, a.hw, b.x, b.y, b.hw, b.x, b.y, -b.hw);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  geo.computeVertexNormals();
  return geo;
}

function palmGeometry(lean, height) {
  const parts = [];
  const segs = 7;
  const P = (t) => new THREE.Vector3(lean * t * t, height * t, 0);
  for (let i = 0; i < segs; i++) {
    const a = P(i / segs);
    const b = P((i + 1) / segs);
    const len = a.distanceTo(b);
    const r0 = 0.26 - 0.1 * (i / segs);
    const r1 = 0.26 - 0.1 * ((i + 1) / segs);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    parts.push(piece(new THREE.CylinderGeometry(r1, r0, len * 1.03, 7), i % 2 ? "#a8703c" : "#c48a52", { pos: [mid.x, mid.y, mid.z], rot: [0, 0, -Math.atan2(b.x - a.x, b.y - a.y)] }));
  }
  const top = P(1);
  parts.push(piece(new THREE.SphereGeometry(0.34, 6, 4), "#8a5a2b", { pos: [top.x, top.y, top.z] }));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * PI * 2;
    parts.push(piece(new THREE.SphereGeometry(0.2, 5, 4), "#6d4220", { pos: [top.x + Math.cos(a) * 0.35, top.y - 0.3, top.z + Math.sin(a) * 0.35] }));
  }
  const fronds = 9;
  for (let i = 0; i < fronds; i++) {
    const yaw = (i / fronds) * PI * 2 + range(-0.15, 0.15);
    parts.push(piece(frondGeometry(range(2.1, 2.7), 0.42), i % 2 ? "#2fae4e" : "#4fcf67", { pos: [top.x, top.y + 0.1, top.z], rot: [0, yaw, 0] }));
  }
  return mergeGeometries(parts, false);
}

function palms(scene) {
  const variants = [palmGeometry(0.8, 5.6), palmGeometry(-0.6, 6.4), palmGeometry(0.3, 4.8)];
  const mat = toon({ side: THREE.DoubleSide });
  // [variant, x, z, scale]. Back row behind the fence, then the corners and sides.
  const spots = [
    [0, -22, -14.5, 1.1], [1, -8, -15.5, 1.0], [2, 5, -14, 1.2], [0, 19, -15, 1.0], [1, -14, -17, 0.9], [2, 12, -16.5, 1.1], [0, 27, -14.5, 1.0],
    [1, -33, -10, 1.15], [0, 34, -9, 1.2], [2, -36, 14, 1.1], [1, 37, 15, 1.2], [0, -48, 30, 1.3], [2, 50, 30, 1.2], [1, 2, 26, 1.0], [0, -13, 22, 0.9],
  ];
  return variants.map((geo, vi) => {
    const mine = spots.filter((s) => s[0] === vi);
    const mesh = new THREE.InstancedMesh(geo, mat, mine.length);
    const m = new THREE.Matrix4();
    mine.forEach(([, x, z, s], i) => {
      m.compose(new THREE.Vector3(x, groundY(z) - 0.05, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, range(0, PI * 2), 0)), new THREE.Vector3(s, s, s));
      mesh.setMatrixAt(i, m);
    });
    mesh.name = "tree";
    mesh.frustumCulled = false; // one bounding sphere for the whole spread is not worth computing
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  });
}

function bushes(scene) {
  const parts = [];
  for (const [cx, cz] of [[-15, -12.9], [-1, -13], [12, -12.9], [-30, 6], [31, 5]]) {
    for (let i = 0; i < 3; i++) {
      const r = range(0.5, 0.85);
      parts.push(piece(new THREE.IcosahedronGeometry(1, 1), i % 2 ? "#3fbf5a" : "#58d06f", { pos: [cx + range(-0.7, 0.7), -0.12 + r * 0.55, cz + range(-0.4, 0.4)], scale: [r * 1.2, r * 0.85, r] }));
    }
  }
  const mesh = mergeMesh(parts, toon(), { cast: false });
  mesh.name = "shrub";
  scene.add(mesh);
  return [mesh];
}

// ---------------------------------------------------------------- dunes, rocks, far hills
function dunes(scene) {
  const colours = ["#f4d089", "#efc577", "#fadf9f"];
  const list = [
    [-40, 22, 14, 1.6, 9], [-22, 31, 16, 2.2, 10], [0, 38, 22, 2.6, 12], [24, 29, 15, 1.9, 9], [44, 22, 13, 1.7, 8], [62, 36, 18, 2.8, 12],
    [-58, 34, 18, 2.6, 11], [-72, 12, 14, 2.0, 9], [72, 10, 14, 1.8, 9], [-62, -6, 12, 1.6, 8], [64, -4, 12, 1.7, 8], [-90, 30, 20, 3.2, 12], [92, 28, 20, 3.0, 12],
  ];
  const parts = list.map(([x, z, sx, sy, sz], i) =>
    piece(new THREE.SphereGeometry(1, 9, 5, 0, PI * 2, 0, PI / 2), colours[i % 3], { pos: [x, -0.14, z], rot: [0, range(0, PI), 0], scale: [sx, sy, sz] }),
  );
  const mesh = mergeMesh(parts, toon({ roughness: 1 }));
  mesh.name = "dunes";
  scene.add(mesh);
}

function rocks(scene) {
  const colours = ["#cfcdd2", "#b9b7c0", "#e2dfe2", "#aeb3bd", "#d9bc90"].map((c) => new THREE.Color(c));
  const spots = [];
  for (let i = 0; i < 24; i++) {
    const x = -70 + i * 6 + range(-2, 2);
    if (x > -29 && x < -17) continue; // keep the jetty clear
    spots.push([x, range(-21.5, -17.5), range(0.6, 1.5)]);
  }
  for (let i = 0; i < 9; i++) spots.push([range(-60, 60), range(16, 34), range(0.5, 1.1)]);
  const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9 }), spots.length);
  const m = new THREE.Matrix4();
  spots.forEach(([x, z, s], i) => {
    m.compose(new THREE.Vector3(x, groundY(z) + s * 0.15, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(range(-0.3, 0.3), range(0, PI * 2), range(-0.3, 0.3))), new THREE.Vector3(s * range(1, 1.5), s * range(0.6, 0.9), s));
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, colours[i % colours.length]);
  });
  mesh.name = "rocks";
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function hills(scene) {
  const list = [[-260, -260, 70, 60], [-190, -290, 55, 48], [-120, -300, 60, 70], [-40, -310, 50, 40], [40, -320, 70, 55], [120, -300, 60, 64], [200, -280, 70, 52], [270, -250, 60, 58], [-300, -180, 50, 44], [310, -170, 52, 46]];
  const parts = list.map(([x, z, r, h], i) => piece(new THREE.ConeGeometry(r * 1.3, h * 0.5, 5), i % 2 ? "#b4dbf6" : "#a6d0f2", { pos: [x, h * 0.25 - 2, z], rot: [0, range(0, PI), 0] }));
  const mesh = mergeMesh(parts, toon({ roughness: 1 }));
  mesh.name = "far_hills";
  mesh.receiveShadow = false;
  scene.add(mesh);
}

// ---------------------------------------------------------------- boats, buoys, gulls
function dhow(hullColour, stripeColour, sailColour) {
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-2.1, 0.95);
  hullShape.lineTo(-1.7, 0.05);
  hullShape.lineTo(1.8, 0.05);
  hullShape.lineTo(3.0, 1.15);
  hullShape.lineTo(2.6, 1.15);
  hullShape.lineTo(2.0, 0.95);
  hullShape.closePath();
  const hull = new THREE.ExtrudeGeometry(hullShape, { depth: 1.5, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12, bevelSegments: 1 });
  hull.translate(0, 0, -0.75);
  const sailShape = new THREE.Shape();
  sailShape.moveTo(0, 0);
  sailShape.lineTo(2.6, 0);
  sailShape.lineTo(0.1, 2.8);
  sailShape.closePath();
  const sail = new THREE.ExtrudeGeometry(sailShape, { depth: 0.05, bevelEnabled: false });
  const flag = new THREE.Shape();
  flag.moveTo(0, 0);
  flag.lineTo(0.7, 0.18);
  flag.lineTo(0, 0.36);
  flag.closePath();
  const parts = [
    piece(hull, hullColour),
    piece(new THREE.BoxGeometry(4.7, 0.17, 1.8), stripeColour, { pos: [0.4, 0.6, 0] }),
    piece(new THREE.BoxGeometry(1.1, 0.9, 1.2), NAVY, { pos: [-1.1, 1.5, 0] }),
    piece(new THREE.BoxGeometry(1.35, 0.12, 1.45), "#ffffff", { pos: [-1.1, 2.0, 0] }),
    piece(new THREE.CylinderGeometry(0.07, 0.09, 3.6, 6), "#8a5a2b", { pos: [0.4, 2.7, 0] }),
    piece(sail, sailColour, { pos: [0.5, 1.25, 0.04] }),
    piece(new THREE.ExtrudeGeometry(flag, { depth: 0.04, bevelEnabled: false }), "#ff5d73", { pos: [0.4, 4.35, 0] }),
  ];
  return mergeMesh(parts, toon({ side: THREE.DoubleSide }));
}

function seaLife(scene) {
  const boats = [
    { mesh: dhow(SLOT_COLORS[0], "#ffffff", "#fff4d6"), x: -9, z: -34, yaw: 0.25, phase: 0 },
    { mesh: dhow(SLOT_COLORS[3], "#ffd23f", "#ffe9b0"), x: 17, z: -52, yaw: PI - 0.2, phase: 2 },
  ];
  for (const b of boats) {
    b.mesh.name = "boat";
    b.mesh.position.set(b.x, -0.55, b.z);
    b.mesh.rotation.y = b.yaw;
    scene.add(b.mesh);
  }
  // Buoys along the line of the intake pipe, out from the jetty.
  const buoyParts = [new THREE.SphereGeometry(0.34, 8, 6), new THREE.CylinderGeometry(0.05, 0.05, 0.7, 5)];
  const buoyGeo = mergeGeometries([piece(buoyParts[0], "#ffd23f", { pos: [0, 0.1, 0] }), piece(buoyParts[1], "#ffffff", { pos: [0, 0.55, 0] })], false);
  const buoys = new THREE.InstancedMesh(buoyGeo, toon(), 8);
  buoys.name = "buoys";
  buoys.frustumCulled = false;
  scene.add(buoys);
  const buoySpots = Array.from({ length: 8 }, (_, i) => [-23 + Math.sin(i * 1.7) * 0.8, -27 - i * 4.5]);

  // Gulls: two-triangle wings that flap by squashing in height, circling high over the plant.
  const wing = new THREE.BufferGeometry();
  wing.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0.18, 0, 0, -0.18, -1, 0.3, 0, 0, 0, 0.18, 0, 0, -0.18, 1, 0.3, 0], 3));
  const gulls = new THREE.InstancedMesh(wing, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }), 7);
  gulls.name = "gulls";
  gulls.frustumCulled = false;
  scene.add(gulls);
  const flock = Array.from({ length: 7 }, (_, i) => ({ cx: range(-30, 30), cz: range(-30, -5), r: range(8, 20), h: range(11, 20), speed: range(0.12, 0.22) * (i % 2 ? 1 : -1), phase: range(0, PI * 2) }));

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const tmpV = new THREE.Vector3();
  const tmpS = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  let last = 0;
  let foamShift = 0;
  const update = (t, foam) => {
    const dt = Math.min(0.1, Math.max(0, t - last));
    last = t;
    const k = reduceMotion ? 0 : 1;
    for (const b of boats) {
      b.mesh.position.y = -0.55 + Math.sin(t * 1.1 + b.phase) * 0.07 * k;
      b.mesh.rotation.z = Math.sin(t * 0.9 + b.phase) * 0.03 * k;
      b.mesh.rotation.x = Math.sin(t * 1.3 + b.phase) * 0.02 * k;
    }
    buoySpots.forEach(([x, z], i) => {
      m.compose(tmpV.set(x, -0.5 + Math.sin(t * 1.4 + i) * 0.08 * k, z), q.identity(), tmpS.set(1, 1, 1));
      buoys.setMatrixAt(i, m);
    });
    buoys.instanceMatrix.needsUpdate = true;
    flock.forEach((g, i) => {
      const a = g.phase + t * g.speed * k;
      const flap = k ? Math.sin(t * 6 + g.phase * 3) * 0.7 : 0.4;
      tmpV.set(g.cx + Math.cos(a) * g.r, g.h + Math.sin(a * 2) * 0.8, g.cz + Math.sin(a) * g.r);
      q.setFromAxisAngle(up, -a + (g.speed > 0 ? 0 : PI));
      m.compose(tmpV, q, tmpS.set(1.2, flap, 1.2));
      gulls.setMatrixAt(i, m);
    });
    gulls.instanceMatrix.needsUpdate = true;
    if (foam) {
      foamShift += dt * 0.015 * k;
      foam.material.map.offset.x = foamShift;
      foam.position.z = -18.4 + Math.sin(t * 0.8) * 0.5 * k;
      foam.material.opacity = 0.78 + Math.sin(t * 1.6) * 0.18 * k;
    }
  };
  return update;
}

/** Everything outside the fence. Returns the trees and shrubs (the quality tiers show or hide those) and update(t). */
export function buildScenery(scene) {
  dunes(scene);
  rocks(scene);
  hills(scene);
  const trees = palms(scene);
  const shrubs = bushes(scene);

  const foam = new THREE.Mesh(
    new THREE.PlaneGeometry(520, 2.6),
    new THREE.MeshBasicMaterial({ map: foamTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  );
  foam.rotation.x = -PI / 2;
  foam.position.set(0, -0.38, -18.4);
  foam.name = "foam";
  scene.add(foam);

  const lifeUpdate = seaLife(scene);
  return { trees, shrubs, update: (t) => lifeUpdate(t, foam) };
}
