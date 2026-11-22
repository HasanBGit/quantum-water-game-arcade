// Realistic people built from shapes (no model files). About 1.77 m tall, adult proportions
// (7.5 heads), facing +Z. buildPerson(spec) returns a group with the same hooks as before:
//   group.userData.walk(phase, amount)  legs, knees, arms and a little body bounce; also drives
//                                       the idle life (blinking, small head movements) so call it every frame
//   group.userData.press(amount)        reach the right arm forward to a button
//   group.userData.wave(t)              right arm up and swinging, 0 = off
// Every static piece of a body part is merged into one mesh per material, so a person costs about
// 30 draw calls instead of about 70.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Skin tones.
export const SKIN = { saudi: 0xc68e5b, black: 0x6b4430, white: 0xf1c8a5, girlA: 0xd9a273, girlB: 0xb67a4d, girlC: 0xf0c4a0 };

// ---- shared textures (made once, in the browser) --------------------------------------------
let weaveTex = null;
function weave() {
  if (weaveTex) return weaveTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = "#808080";
  g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 64; i += 2) {
    g.fillStyle = i % 4 ? "#9a9a9a" : "#6a6a6a";
    g.fillRect(i, 0, 1, 64);
    g.fillStyle = i % 4 ? "#707070" : "#929292";
    g.fillRect(0, i, 64, 1);
  }
  weaveTex = new THREE.CanvasTexture(c);
  weaveTex.wrapS = weaveTex.wrapT = THREE.RepeatWrapping;
  weaveTex.repeat.set(10, 12);
  return weaveTex;
}

const checkTexCache = new Map();
function checkTex(hex) {
  if (checkTexCache.has(hex)) return checkTexCache.get(hex);
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const col = "#" + new THREE.Color(hex).getHexString();
  g.fillStyle = "#f6f2ea";
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = col;
  for (const p of [0, 64]) {
    g.fillRect(p, 0, 22, 128);
    g.fillRect(0, p, 128, 22);
  }
  g.fillStyle = col + "88";
  for (let i = 0; i < 128; i += 8) {
    g.fillRect(i, 0, 1, 128);
    g.fillRect(0, i, 128, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  t.colorSpace = THREE.SRGBColorSpace;
  checkTexCache.set(hex, t);
  return t;
}

// ---- helpers ---------------------------------------------------------------------------------
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

// A group whose shapes are baked into one mesh per material when done() is called.
function makePart(parent, x = 0, y = 0, z = 0) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  parent.add(group);
  const byMat = new Map();
  return {
    group,
    add(geo, material, p = [0, 0, 0], r = [0, 0, 0], sc = [1, 1, 1]) {
      _m.compose(_p.set(p[0], p[1], p[2]), _q.setFromEuler(_e.set(r[0], r[1], r[2])), _s.set(sc[0], sc[1], sc[2]));
      geo.applyMatrix4(_m);
      if (!byMat.has(material)) byMat.set(material, []);
      byMat.get(material).push(geo);
    },
    done() {
      for (const [material, geos] of byMat) {
        const merged = geos.length > 1 ? mergeGeometries(geos, false) : geos[0];
        const mesh = new THREE.Mesh(merged ?? geos[0], material);
        mesh.castShadow = true;
        group.add(mesh);
      }
      byMat.clear();
      return group;
    },
  };
}

const sphere = (w = 16, h = 12) => new THREE.SphereGeometry(1, w, h);
const lathe = (pts, seg = 28, a = 0, len = Math.PI * 2) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg, a, len);

// Head ellipsoid, in metres. The head group is centred on the middle of the head.
const HX = 0.092, HY = 0.115, HZ = 0.103;
const faceZ = (x, y) => HZ * Math.sqrt(Math.max(0, 1 - (x / HX) ** 2 - (y / HY) ** 2));

// Sphere shell scaled to the head. gap > 0 leaves an opening at the front for the face.
function shell(thetaLen, gap = 0, segs = 28) {
  return gap > 0
    ? new THREE.SphereGeometry(1, segs, 18, Math.PI / 2 + gap, Math.PI * 2 - 2 * gap, 0, thetaLen)
    : new THREE.SphereGeometry(1, segs, 18, 0, Math.PI * 2, 0, thetaLen);
}

/**
 * spec: {
 *   skin, outfit (thobe, abaya or shirt colour), trim (cuff and hem accent), shoes,
 *   pants (colour: trousers and a short shirt instead of a long thobe),
 *   head: "ghutra" | "hijab" | "cap" | "bare",  headColor (cloth, or hair for "bare"),
 *   headTrim (hijab edge), headPattern ("check" for a red-and-white shemagh),
 *   vest (colour or null), hardHat (bool), beard (colour or null), glasses (bool),
 *   skirt (true for a long flowing abaya and a narrower build), height (scale, default 1)
 * }
 */
export function buildPerson(spec) {
  const s = { height: 1, beard: null, vest: null, hardHat: false, glasses: false, shoes: 0x2b2b2b, pants: null, ...spec };
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const std = (color, roughness) => new THREE.MeshStandardMaterial({ color, roughness });
  const cloth = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, bumpMap: weave(), bumpScale: 0.8, side: THREE.DoubleSide, ...extra });
  const skin = std(s.skin, 0.58);
  const outfit = cloth(s.outfit);
  const trim = cloth(s.trim ?? s.outfit);
  const legMat = s.pants ? cloth(s.pants) : outfit;
  const shoeMat = std(s.shoes, 0.45);
  const soleMat = std(0x16161a, 0.8);
  const hairColor = s.head === "bare" ? s.headColor ?? 0x2a1c14 : 0x2a1c14;
  const browColor = s.beard ?? hairColor;
  const woman = !!s.skirt;
  const SH = woman ? 0.19 : 0.21; // shoulder joint x

  // ---- torso, with the long thobe or abaya (or a shirt) -----------------------------------
  const T = makePart(body);
  let prof;
  if (s.pants) prof = [[0.17, 0.86], [0.162, 1.0], [0.158, 1.1], [0.17, 1.3], [0.158, 1.4], [0.13, 1.46], [0.06, 1.515], [0.055, 1.55]];
  else if (woman) prof = [[0.27, 0.1], [0.245, 0.35], [0.2, 0.75], [0.165, 1.05], [0.158, 1.12], [0.165, 1.3], [0.15, 1.4], [0.125, 1.46], [0.06, 1.515], [0.055, 1.55]];
  else prof = [[0.215, 0.1], [0.2, 0.3], [0.185, 0.6], [0.168, 0.95], [0.16, 1.1], [0.17, 1.3], [0.158, 1.4], [0.13, 1.46], [0.06, 1.515], [0.055, 1.55]];
  const tx = woman ? 1.08 : 1.22;
  const tz = woman ? 0.85 : 0.8;
  T.add(lathe(prof), outfit, [0, 0, 0], [0, 0, 0], [tx, 1, tz]);
  if (!s.pants) {
    // hem band
    const hemR = woman ? 0.27 : 0.215;
    T.add(new THREE.TorusGeometry(hemR * 0.985, 0.014, 6, 32), trim, [0, 0.105, 0], [Math.PI / 2, 0, 0], [tx, tz, 1]);
  } else {
    T.add(new THREE.TorusGeometry(0.165, 0.013, 6, 24), std(0x241c16, 0.6), [0, 0.99, 0], [Math.PI / 2, 0, 0], [1.2, 0.82, 1]); // belt
  }
  for (const side of [-1, 1]) T.add(sphere(), outfit, [side * SH, 1.425, 0], [0, 0, 0], [0.058, 0.056, 0.058]); // shoulder caps
  T.add(new THREE.CylinderGeometry(0.058, 0.062, 0.04, 18, 1, true), trim, [0, 1.52, 0]); // collar
  T.add(new THREE.CylinderGeometry(0.047, 0.054, 0.16, 14), skin, [0, 1.56, 0]); // neck
  if (s.vest) {
    const vestMat = cloth(s.vest, { roughness: 0.7 });
    const strip = cloth(0xdfe7ec, { roughness: 0.35 });
    const gap = 0.14;
    const vp = [[0.182, 1.0], [0.176, 1.1], [0.186, 1.3], [0.17, 1.4], [0.14, 1.45]];
    T.add(lathe(vp, 28, gap, Math.PI * 2 - 2 * gap), vestMat, [0, 0, 0], [0, 0, 0], [1.22, 1, 0.8]);
    for (const y of [1.1, 1.26]) {
      const r = y < 1.2 ? 0.178 : 0.188;
      T.add(lathe([[r, y - 0.016], [r + 0.004, y - 0.016], [r + 0.004, y + 0.016], [r, y + 0.016]], 28, gap, Math.PI * 2 - 2 * gap), strip, [0, 0, 0], [0, 0, 0], [1.22, 1, 0.8]);
    }
  }
  T.done();

  // ---- legs ---------------------------------------------------------------------------------
  const ankleMat = s.pants ? legMat : skin;
  const makeLeg = (x) => {
    const hip = makePart(body, x, 0.93, 0);
    hip.add(sphere(), legMat, [0, 0, 0], [0, 0, 0], [0.068, 0.068, 0.068]);
    hip.add(new THREE.CylinderGeometry(0.068, 0.056, 0.46, 14), legMat, [0, -0.23, 0]);
    hip.done();
    const knee = makePart(hip.group, 0, -0.46, 0);
    knee.add(sphere(), legMat, [0, 0, 0], [0, 0, 0], [0.057, 0.057, 0.057]);
    knee.add(new THREE.CylinderGeometry(0.056, 0.04, 0.4, 14), legMat, [0, -0.2, 0]);
    knee.add(new THREE.CylinderGeometry(0.039, 0.036, 0.06, 12), ankleMat, [0, -0.405, 0]);
    knee.done();
    const foot = makePart(knee.group, 0, -0.42, 0);
    foot.add(sphere(18, 12), shoeMat, [0, -0.004, 0.045], [0, 0, 0], [0.05, 0.04, 0.12]);
    foot.add(new THREE.BoxGeometry(0.096, 0.012, 0.25), soleMat, [0, -0.044, 0.04]);
    foot.done();
    return { hip: hip.group, knee: knee.group, foot: foot.group };
  };
  const legL = makeLeg(-0.088);
  const legR = makeLeg(0.088);

  // ---- arms (sleeves in the outfit colour, hands in skin) ---------------------------------------
  const wristR = woman ? 0.062 : 0.043;
  const makeArm = (side) => {
    const sh = makePart(body, side * SH, 1.43, 0);
    sh.add(new THREE.CylinderGeometry(0.056, 0.05, 0.3, 14), outfit, [0, -0.15, 0]);
    sh.done();
    const el = makePart(sh.group, 0, -0.29, 0);
    el.add(sphere(), outfit, [0, 0, 0], [0, 0, 0], [0.05, 0.05, 0.05]);
    el.add(new THREE.CylinderGeometry(0.05, wristR, 0.27, 14), outfit, [0, -0.135, 0]);
    el.add(new THREE.CylinderGeometry(wristR + 0.004, wristR + 0.004, 0.026, 14), trim, [0, -0.262, 0]);
    el.done();
    const hand = makePart(el.group, 0, -0.27, 0);
    hand.add(sphere(), skin, [0, -0.04, 0], [0, 0, 0], [0.032, 0.042, 0.018]); // palm
    for (let i = 0; i < 4; i++) {
      const len = [0.04, 0.047, 0.045, 0.036][i];
      hand.add(new THREE.CapsuleGeometry(0.0105, len, 3, 8), skin, [-0.0225 + i * 0.015, -0.082 - len / 2 + 0.006, 0.008], [-0.18, 0, 0]);
    }
    hand.add(new THREE.CapsuleGeometry(0.011, 0.034, 3, 8), skin, [-side * 0.03, -0.05, 0.012], [-0.35, 0, side * 0.45]); // thumb
    hand.done();
    sh.group.rotation.z = side * 0.07;
    return { sh: sh.group, el: el.group };
  };
  const armL = makeArm(-1);
  const armR = makeArm(1);

  // ---- head: ellipsoid skull, jaw, ears, eyes, brows, nose, lips -----------------------------
  const H = makePart(body, 0, 1.645, 0);
  H.add(sphere(32, 24), skin, [0, 0, 0], [0, 0, 0], [HX, HY, HZ]);
  H.add(sphere(24, 16), skin, [0, -0.066, 0.012], [0, 0, 0], [0.056, 0.046, 0.06]); // jaw and chin
  for (const side of [-1, 1]) {
    H.add(sphere(12, 10), skin, [side * 0.094, -0.004, -0.006], [0, 0, 0], [0.011, 0.024, 0.017]); // ears
    const ex = side * 0.037;
    const ez = faceZ(ex, 0.02);
    H.add(sphere(14, 10), std(0xf4f1ea, 0.3), [ex, 0.02, ez - 0.003], [0, 0, 0], [0.0175, 0.0125, 0.008]); // eye white
    H.add(sphere(12, 10), std(0x3b2412, 0.25), [ex, 0.02, ez + 0.0022], [0, 0, 0], [0.0098, 0.0098, 0.005]); // iris
    H.add(sphere(8, 6), std(0x050505, 0.2), [ex, 0.02, ez + 0.0052], [0, 0, 0], [0.0048, 0.0048, 0.003]); // pupil
    H.add(new THREE.BoxGeometry(0.036, 0.0075, 0.009), std(browColor, 0.9), [side * 0.038, 0.052, faceZ(side * 0.038, 0.052) + 0.001], [-0.05, 0, -side * 0.09]); // brow
    H.add(sphere(8, 6), skin, [side * 0.013, -0.02, faceZ(side * 0.013, -0.02) + 0.011], [0, 0, 0], [0.01, 0.009, 0.009]); // nostril wing
  }
  H.add(new THREE.CapsuleGeometry(0.0085, 0.03, 4, 8), skin, [0, 0.008, faceZ(0, 0.008) + 0.003], [-0.12, 0, 0]); // nose bridge
  H.add(sphere(12, 10), skin, [0, -0.015, faceZ(0, -0.015) + 0.014], [0, 0, 0], [0.011, 0.0095, 0.0105]); // nose tip
  const lip = std(woman ? 0xb85a64 : 0x9c5548, 0.5);
  H.add(sphere(12, 8), lip, [0, -0.057, faceZ(0, -0.057) + 0.001], [0, 0, 0], [0.023, 0.0055, 0.008]); // upper lip
  H.add(sphere(12, 8), lip, [0, -0.067, faceZ(0, -0.067) + 0.0005], [0, 0, 0], [0.02, 0.006, 0.0085]); // lower lip
  if (s.glasses) {
    const rim = std(0x16161e, 0.3);
    for (const side of [-1, 1]) {
      H.add(new THREE.TorusGeometry(0.0285, 0.0034, 6, 20), rim, [side * 0.037, 0.02, faceZ(side * 0.037, 0.02) + 0.012]);
      H.add(new THREE.BoxGeometry(0.004, 0.004, 0.1), rim, [side * 0.0705, 0.027, -0.034]);
    }
    H.add(new THREE.BoxGeometry(0.02, 0.004, 0.004), rim, [0, 0.026, faceZ(0, 0.026) + 0.012]);
  }
  if (s.beard) {
    const bm = std(s.beard, 0.95);
    H.add(new THREE.SphereGeometry(1, 28, 14, 0, Math.PI, Math.PI * 0.6, Math.PI * 0.4), bm, [0, 0, 0.002], [0, 0, 0], [HX * 1.06, HY * 1.04, HZ * 1.06]); // beard along the jaw
    H.add(sphere(12, 8), bm, [0, -0.043, faceZ(0, -0.043) + 0.003], [0, 0, 0], [0.03, 0.007, 0.01]); // moustache
  }

  // Head covering.
  const sc = (k) => [HX * k, HY * k, HZ * k];
  if (s.head === "hijab") {
    const hij = cloth(s.headColor, { roughness: 0.85 });
    H.add(shell(Math.PI * 0.3), hij, [0, 0, -0.008], [0, 0, 0], sc(1.215));
    H.add(shell(Math.PI * 0.8, Math.PI * 0.24), hij, [0, 0, -0.008], [0, 0, 0], sc(1.2));
    H.add(lathe([[0.075, -0.09], [0.12, -0.16], [0.19, -0.25], [0.235, -0.36], [0.25, -0.5]]), hij, [0, 0, -0.005], [0, 0, 0], [1.1, 1, 0.9]); // cloth over the shoulders and chest
    H.add(new THREE.TorusGeometry(0.1, 0.0065, 6, 28), cloth(s.headTrim ?? s.headColor), [0, 0.002, 0.058], [0, 0, 0], [0.85, 1.07, 1]); // edge round the face
  } else if (s.head === "ghutra") {
    const g = s.headPattern === "check" ? new THREE.MeshStandardMaterial({ map: checkTex(s.headColor), roughness: 0.85, bumpMap: weave(), bumpScale: 0.6, side: THREE.DoubleSide }) : cloth(s.headColor, { roughness: 0.85 });
    H.add(shell(Math.PI * 0.34), g, [0, 0.005, -0.004], [0, 0, 0], sc(1.13));
    H.add(new THREE.CylinderGeometry(0.108, 0.205, 0.3, 28, 1, true, Math.PI * 0.3, Math.PI * 1.4), g, [0, -0.15, -0.012], [0.05, 0, 0], [1, 1, 0.82]); // cloth behind the head and over the shoulders
    for (const side of [-1, 1]) {
      H.add(new THREE.BoxGeometry(0.06, 0.22, 0.018), g, [side * 0.135, -0.19, 0.025], [0, 0, side * 0.08]); // loose end hanging at the front
    }
    const ag = std(0x121217, 0.5);
    for (const y of [0.052, 0.07]) H.add(new THREE.TorusGeometry(0.104, 0.0062, 8, 30), ag, [0, y, -0.004], [Math.PI / 2 - 0.08, 0, 0], [1, 1.07, 1]); // agal
  } else if (s.head === "cap") {
    const capM = cloth(s.headColor, { roughness: 0.8 });
    H.add(shell(Math.PI * 0.36), capM, [0, 0.004, -0.003], [0, 0, 0], sc(1.045));
    H.add(new THREE.TorusGeometry(0.093, 0.005, 6, 28), cloth(s.trim ?? 0xd9c9a0), [0, 0.047, -0.003], [Math.PI / 2, 0, 0], [1, 1.1, 1]);
  } else {
    const hair = std(hairColor, 0.9);
    H.add(shell(Math.PI * 0.3), hair, [0, 0.004, -0.004], [0, 0, 0], sc(1.05));
    H.add(shell(Math.PI * 0.64, Math.PI * 0.42), hair, [0, 0.004, -0.008], [0, 0, 0], sc(1.045));
  }
  if (s.hardHat) {
    const hat = std(0xffd23f, 0.35);
    H.add(new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), hat, [0, 0.02, 0.004], [0, 0, 0], [0.112, 0.105, 0.125]);
    H.add(new THREE.CylinderGeometry(1, 1, 0.012, 32), hat, [0, 0.022, 0.014], [0, 0, 0], [0.122, 1, 0.14]);
    H.add(new THREE.BoxGeometry(0.02, 0.012, 0.2), hat, [0, 0.12, 0]);
  }
  H.done();
  const head = H.group;

  // Eyelids: skin-coloured shells over the eyes that close for a blink.
  const lids = [-1, 1].map((side) => {
    const lid = new THREE.Mesh(sphere(12, 8), skin);
    lid.position.set(side * 0.037, 0.02, faceZ(side * 0.037, 0.02) + 0.0005);
    lid.scale.set(0.0195, 0.0001, 0.011);
    head.add(lid);
    return lid;
  });

  body.scale.setScalar(s.height);

  // ---- animation hooks ------------------------------------------------------------------------
  const seed = Math.random() * 20;
  let pressing = 0;
  const swing = (L, a, amount) => {
    const long = !s.pants; // a long thobe or abaya hides the legs, so keep the knees from poking out
    L.hip.rotation.x = -Math.sin(a) * (long ? 0.24 : 0.3) * amount;
    L.knee.rotation.x = Math.max(0, Math.cos(a)) * (long ? 0.2 : 0.55) * amount;
    L.foot.rotation.x = -(L.hip.rotation.x + L.knee.rotation.x); // keep the shoe flat
  };
  root.userData.walk = (phase, amount) => {
    const t = performance.now() / 1000 + seed;
    swing(legL, phase, amount);
    swing(legR, phase + Math.PI, amount);
    const sw = Math.sin(phase) * 0.45 * amount;
    armL.sh.rotation.x = sw;
    armL.el.rotation.x = -0.1 - Math.max(0, -sw) * 0.9;
    armR.sh.rotation.x = pressing > 0 ? -pressing * 1.3 : -sw;
    armR.el.rotation.x = pressing > 0 ? -0.1 - pressing * 0.35 : -0.1 - Math.max(0, sw) * 0.9;
    armL.sh.rotation.z = -0.07;
    armR.sh.rotation.z = 0.07;
    body.position.y = Math.abs(Math.sin(phase)) * 0.025 * amount;
    // idle life: a slow glance, a slight nod, and a blink every few seconds
    head.rotation.y = Math.sin(t * 0.6) * 0.07 * (1 - amount);
    head.rotation.x = Math.sin(t * 0.43) * 0.025;
    const b = (t % 3.6) / 0.16;
    const lidY = b < 1 ? Math.sin(b * Math.PI) * 0.0135 : 0.0001;
    for (const l of lids) l.scale.y = lidY;
  };
  root.userData.press = (amount) => {
    pressing = amount;
  };
  root.userData.wave = (t) => {
    if (t > 0) {
      armR.sh.rotation.set(0, 0, 2.5 + Math.sin(t * 9) * 0.12);
      armR.el.rotation.set(-0.1, 0, Math.sin(t * 9) * 0.35);
    } else {
      armR.sh.rotation.z = 0.07;
      armR.el.rotation.z = 0;
    }
  };
  root.userData.walk(0, 0);
  return root;
}

// The player: a Saudi man in a white thobe and a red-and-white shemagh with a black agal, and the
// plant's teal reflective vest, so he reads as the operator at a glance.
export function buildPlayer() {
  return buildPerson({
    skin: SKIN.saudi,
    outfit: 0xfdfdfb,
    trim: 0xe3e6ea,
    head: "ghutra",
    headColor: 0xd8453c,
    headPattern: "check",
    vest: 0x19c3d6,
    hardHat: false,
    beard: 0x1d1612,
    shoes: 0x3a2a1a,
  });
}

// Six helpers. Colour and clothing differ so each reads clearly from the camera.
export const NPC_LOOKS = {
  maryam: { skin: SKIN.girlA, outfit: 0xff5d73, trim: 0xffffff, head: "hijab", headColor: 0xffb3c0, headTrim: 0xff5d73, shoes: 0xffffff, skirt: true },
  noura: { skin: SKIN.girlB, outfit: 0x8a5cff, trim: 0xffd23f, head: "hijab", headColor: 0xd8c8ff, headTrim: 0x8a5cff, shoes: 0xffd23f, skirt: true },
  layla: { skin: SKIN.girlC, outfit: 0x1f9e8f, trim: 0xffffff, head: "hijab", headColor: 0x55e07a, headTrim: 0x1f9e8f, shoes: 0xffffff, skirt: true, glasses: true },
  faisal: { skin: SKIN.saudi, outfit: 0xb9d8f2, trim: 0x8fb8dc, head: "ghutra", headColor: 0xffffff, beard: 0x2a1c14, shoes: 0x3a2a1a },
  omar: { skin: SKIN.black, outfit: 0xf4ead2, trim: 0xd9c9a0, head: "cap", headColor: 0xffffff, beard: 0x120d0a, shoes: 0x2b2b2b },
  james: { skin: SKIN.white, outfit: 0xe9e9ee, trim: 0xc7c9d1, pants: 0x39445a, head: "bare", headColor: 0xc58b3d, beard: 0xa8742c, shoes: 0x2b2b2b, glasses: true },
};
